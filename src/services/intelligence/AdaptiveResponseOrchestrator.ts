/**
 * src/services/intelligence/AdaptiveResponseOrchestrator.ts
 *
 * Master Orchestrator for the Adaptive Response Intelligence Engine.
 * Coordinates input normalization, intent analysis, complexity budgeting,
 * contract resolution, modular prompt compilation, generation, deterministic checks,
 * hallucination firewall, response critic, bounded refinement, and telemetry.
 */

import { LLMFallbackService } from '../llm/LLMFallbackService';
import { LLMMessage, LLMContentPart, LLMOptions } from '../llm/providers';
import { IntentEngine } from './intentEngine';
import { ComplexityEngine } from './complexityEngine';
import { AnswerContractResolver } from './answerContract';
import { PromptCompiler } from './promptCompiler';
import { DeterministicVerifier } from './deterministicVerifier';
import { HallucinationFirewall } from './hallucinationFirewall';
import { ResponseCritic } from './criticEngine';
import { ConfidenceEngine } from './confidenceEngine';
import { ContradictionDetector } from './contradictionDetector';
import { IntelligenceTelemetry } from './telemetry';
import { SemanticCache } from './semanticCache';
import { FailureMemory } from './failureMemory';
import {
  OrchestratedResponse,
  RefinementTrace,
  UserIntent,
} from './types';
import { SearchResultItem } from '../search/webSearchService';
import { parseAiResponse } from '../../utils/parseAiResponse';

import { EffortLevel } from '../../stores/useModelStore';

export interface OrchestrationRequest {
  query: string;
  modelId: string;
  userEmail: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  sources?: SearchResultItem[];
  attachments?: any[];
  isIncognito?: boolean;
  effortLevel?: EffortLevel;
  thinkingMode?: boolean;
  onProgress?: (stage: string) => void;
}

export class AdaptiveResponseOrchestrator {
  /**
   * Orchestrate full adaptive intelligence pipeline for a user message.
   */
  public static async execute(
    request: OrchestrationRequest
  ): Promise<OrchestratedResponse> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const history = request.conversationHistory || [];
    const sources = request.sources || [];
    const attachments = request.attachments || [];

    // ── 1. Semantic Cache Check (Fast-path) ──────────────────────────────────
    const cached = SemanticCache.get(
      request.userEmail,
      request.modelId,
      request.query,
      request.isIncognito
    );

    if (cached) {
      console.log(`[Orchestrator] Cache hit for "${request.query.slice(0, 30)}..."`);
      return {
        finalAnswer: cached.response,
        finalThinking: cached.thinking,
        intent: cached.intent as UserIntent,
        complexity: 'LOW',
        confidence: {
          level: 'HIGH',
          score: 95,
          factors: {
            sourceGroundingScore: 100,
            verificationScore: 100,
            criticAgreementScore: 95,
            queryAmbiguityPenalty: 0,
          },
          explanation: 'Instant cached response.',
        },
        verificationResult: { isValid: true, issues: [], passedChecks: ['semantic_cache_hit'] },
        refinementsApplied: [],
        modelUsed: `${request.modelId} (cached)`,
        sourcesGrounded: sources.length,
        telemetryId: requestId,
        isVerified: true,
      };
    }

    // ── 2. Intent Understanding ─────────────────────────────────────────────
    request.onProgress?.('Analyzing query intent & constraints...');
    const hasImages = attachments.some((a) => a.type === 'image');
    const intent = IntentEngine.classify(request.query, attachments.length > 0, hasImages);

    // ── 3. Complexity & Adaptive Compute Estimation ─────────────────────────
    const complexity = ComplexityEngine.estimate(request.query, intent, history.length);

    // ── 4. Answer Contract & Contradiction Detection ────────────────────────
    const contract = AnswerContractResolver.resolve(request.query, intent, complexity, sources.length > 0);
    const contradiction = ContradictionDetector.detect(request.query, history);

    // ── 5. Modular Prompt Compilation ───────────────────────────────────────
    request.onProgress?.('Synthesizing optimal reasoning directives...');
    const customDirectives = FailureMemory.getActiveRemedies();
    if (contradiction.guidanceNote) {
      customDirectives.push(contradiction.guidanceNote);
    }

    const systemPrompt = PromptCompiler.compile({
      intent,
      contract,
      complexity,
      sources,
      customDirectives,
    });

    // ── 6. LLM Messages Assembly ────────────────────────────────────────────
    const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

    // Token-efficient history sliding window: keep last 10 turns
    for (const turn of history.slice(-10)) {
      messages.push({ role: turn.role, content: turn.content });
    }

    // Attachments handling
    const imageAttachments = attachments.filter((a) => a.type === 'image' && a.data);
    const fileAttachments = attachments.filter((a) => a.type === 'file' && a.data);

    let fullQuery = request.query;
    if (fileAttachments.length > 0) {
      const fileTexts = fileAttachments
        .map((f) => `[File: ${f.name}]\n${f.data}`)
        .join('\n\n');
      fullQuery = `${request.query}\n\n${fileTexts}`;
    }

    if (imageAttachments.length > 0) {
      const parts: LLMContentPart[] = [{ type: 'text', text: fullQuery }];
      for (const img of imageAttachments) {
        parts.push({
          type: 'image_url',
          image_url: { url: img.data!, detail: 'auto' },
        });
      }
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: 'user', content: fullQuery });
    }

    // ── 7. Primary Model Generation ─────────────────────────────────────────
    request.onProgress?.(request.thinkingMode ? 'Reasoning step-by-step...' : 'Generating response...');
    const llmOptions: LLMOptions = {
      effortLevel: request.effortLevel || 'Medium',
      thinkingMode: request.thinkingMode ?? false,
      queryComplexity: complexity.level === 'LOW' ? 'SIMPLE' : complexity.level === 'MEDIUM' ? 'MODERATE' : 'COMPLEX',
      max_tokens: complexity.tokenBudget.maxOutputTokens,
    };

    const initialResult = await LLMFallbackService.routeRequest(
      request.modelId,
      messages,
      llmOptions
    );

    const rawContent = initialResult?.choices?.[0]?.message?.content || '';
    const resolvedModelName =
      initialResult?.resolvedModel?.provider ||
      initialResult?.resolvedModel?.modelApi ||
      request.modelId;

    const parsedInitial = parseAiResponse(rawContent);
    let currentAnswer = parsedInitial.finalAnswer;
    const currentThinking = parsedInitial.thinking;

    // ── 8. Deterministic Verification & Auto-Repair ─────────────────────────
    let verification = DeterministicVerifier.verify(currentAnswer, contract, sources);
    if (verification.repairedContent) {
      currentAnswer = verification.repairedContent;
    }

    // ── 9. Hallucination Firewall Grounding Audit ────────────────────────────
    const grounding = HallucinationFirewall.audit(currentAnswer, sources);

    // ── 10. Critic Evaluation ────────────────────────────────────────────────
    let critic = ResponseCritic.evaluate(
      request.query,
      currentAnswer,
      intent,
      complexity,
      contract,
      verification,
      grounding
    );

    // ── 11. Adaptive Refinement (Bounded, Max 1-2 Passes) ─────────────────────
    const refinementsApplied: RefinementTrace[] = [];
    const maxPasses = complexity.computeBudget.allowRefinement
      ? complexity.computeBudget.maxRefinementPasses
      : 0;

    let currentPass = 0;
    while (!critic.passedThreshold && currentPass < maxPasses) {
      currentPass++;
      request.onProgress?.(`Refining response for quality standards (Pass ${currentPass}/${maxPasses})...`);

      const scoreBefore = critic.overallScore;
      const refinementDirective =
        critic.suggestedRefinementDirective ||
        'Improve accuracy, adhere strictly to the user prompt, and fix formatting defects.';

      const refinementMessages: LLMMessage[] = [
        ...messages,
        { role: 'assistant', content: currentAnswer },
        {
          role: 'user',
          content:
            `Please refine and improve your previous answer to fix the following quality issues:\n${refinementDirective}\n\n` +
            `Output the updated, complete, high-quality answer.`,
        },
      ];

      try {
        const targetModelForRefinement = initialResult?.resolvedModel?.publicId || request.modelId;
        const refinedResult = await LLMFallbackService.routeRequest(
          targetModelForRefinement,
          refinementMessages,
          { ...llmOptions, thinkingMode: false } // Fast single pass for refinement
        );

        const refinedRaw = refinedResult?.choices?.[0]?.message?.content || '';
        const parsedRefined = parseAiResponse(refinedRaw);
        let candidateAnswer = parsedRefined.finalAnswer;

        // Re-verify candidate
        const newVerification = DeterministicVerifier.verify(candidateAnswer, contract, sources);
        if (newVerification.repairedContent) {
          candidateAnswer = newVerification.repairedContent;
        }

        const newGrounding = HallucinationFirewall.audit(candidateAnswer, sources);
        const newCritic = ResponseCritic.evaluate(
          request.query,
          candidateAnswer,
          intent,
          complexity,
          contract,
          newVerification,
          newGrounding
        );

        // Keep improvement if it achieved a better score
        if (newCritic.overallScore >= critic.overallScore) {
          currentAnswer = candidateAnswer;
          verification = newVerification;
          critic = newCritic;
        }

        refinementsApplied.push({
          passNumber: currentPass,
          reason: critic.defectsIdentified.join('; ') || 'Quality elevation',
          directive: refinementDirective,
          scoreBefore,
          scoreAfter: critic.overallScore,
        });

        // Terminate early if threshold satisfied
        if (critic.passedThreshold) {
          break;
        }
      } catch (refineErr: any) {
        console.warn('[Orchestrator] Refinement pass encountered non-fatal error:', refineErr.message);
        break; // Keep previous best answer
      }
    }

    // ── 12. Final Quality Gate & Confidence Assessment ───────────────────────
    const confidence = ConfidenceEngine.assess(
      request.query,
      critic,
      verification,
      grounding
    );

    // Record failure memory if persistent defects remained
    if (critic.defectsIdentified.length > 0) {
      FailureMemory.record('format_violation', critic.defectsIdentified[0]);
    }

    // ── 13. Telemetry & Observability ────────────────────────────────────────
    const latencyMs = Date.now() - startTime;
    IntelligenceTelemetry.log({
      requestId,
      timestamp: Date.now(),
      intent: intent.primaryIntent,
      complexity: complexity.level,
      confidence: confidence.level,
      overallQuality: critic.overallScore,
      refinementPasses: refinementsApplied.length,
      latencyMs,
      modelUsed: resolvedModelName,
      verifiedDeterministically: verification.isValid,
      groundedSourceCount: sources.length,
    });

    // ── 14. Semantic Cache Update (if eligible) ──────────────────────────────
    if (!request.isIncognito && confidence.level !== 'LOW') {
      SemanticCache.set(
        request.userEmail,
        request.modelId,
        request.query,
        currentAnswer,
        currentThinking,
        intent.primaryIntent,
        request.isIncognito
      );
    }

    return {
      finalAnswer: currentAnswer,
      finalThinking: currentThinking,
      intent: intent.primaryIntent,
      complexity: complexity.level,
      confidence,
      verificationResult: verification,
      refinementsApplied,
      modelUsed: resolvedModelName,
      sourcesGrounded: sources.length,
      telemetryId: requestId,
      isVerified: verification.isValid && confidence.level === 'HIGH',
    };
  }
}
