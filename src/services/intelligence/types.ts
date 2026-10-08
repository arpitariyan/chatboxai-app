/**
 * src/services/intelligence/types.ts
 *
 * Strongly typed models for the Adaptive Response Intelligence Engine.
 */

export type UserIntent =
  | 'general_chat'
  | 'question_answering'
  | 'coding'
  | 'debugging'
  | 'research'
  | 'explanation'
  | 'summarization'
  | 'translation'
  | 'writing'
  | 'planning'
  | 'comparison'
  | 'brainstorming'
  | 'troubleshooting'
  | 'multimodal'
  | 'file_analysis';

export type ComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface IntentClassification {
  primaryIntent: UserIntent;
  confidence: number; // 0.0 - 1.0
  secondaryIntents?: UserIntent[];
  requiresWebSearch: boolean;
  requiresFileContext: boolean;
  requiresReasoning: boolean;
  detectedLanguage?: string;
  hasCodeSnippet: boolean;
}

export interface ComplexityEstimate {
  level: ComplexityLevel;
  score: number; // 0 - 100
  tokenBudget: {
    maxInputTokens: number;
    maxOutputTokens: number;
  };
  computeBudget: {
    allowRefinement: boolean;
    maxRefinementPasses: number;
    requireCriticEvaluation: boolean;
    requireDeterministicVerification: boolean;
  };
  rationale: string;
}

export interface AnswerContract {
  tone: 'concise' | 'balanced' | 'comprehensive';
  depth: 'surface' | 'standard' | 'deep';
  format: 'prose' | 'bullet_points' | 'code_only' | 'table' | 'step_by_step';
  includeExamples: boolean;
  strictCitationEnforcement: boolean;
  userSpecifiedConstraints: string[];
}

export interface DeterministicVerificationIssue {
  type: 'unclosed_code_fence' | 'unbalanced_brackets' | 'json_syntax_error' | 'invalid_citation' | 'empty_response' | 'truncated_output';
  message: string;
  severity: 'critical' | 'warning';
  autoFixed?: boolean;
}

export interface DeterministicVerificationResult {
  isValid: boolean;
  issues: DeterministicVerificationIssue[];
  repairedContent?: string;
  passedChecks: string[];
}

export interface CriticScore {
  correctness: number; // 0.0 - 1.0
  relevance: number; // 0.0 - 1.0
  completeness: number; // 0.0 - 1.0
  instructionFollowing: number; // 0.0 - 1.0
  clarity: number; // 0.0 - 1.0
  safety: number; // 0.0 - 1.0
  overallScore: number; // 0.0 - 1.0
  passedThreshold: boolean;
  defectsIdentified: string[];
  suggestedRefinementDirective?: string;
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  score: number; // 0 - 100
  factors: {
    sourceGroundingScore: number;
    verificationScore: number;
    criticAgreementScore: number;
    queryAmbiguityPenalty: number;
  };
  explanation: string;
}

export interface RefinementTrace {
  passNumber: number;
  reason: string;
  directive: string;
  scoreBefore: number;
  scoreAfter: number;
}

export interface IntelligenceTelemetryRecord {
  requestId: string;
  timestamp: number;
  intent: UserIntent;
  complexity: ComplexityLevel;
  confidence: ConfidenceLevel;
  overallQuality: number;
  refinementPasses: number;
  latencyMs: number;
  modelUsed: string;
  verifiedDeterministically: boolean;
  groundedSourceCount: number;
  userFeedback?: 'like' | 'dislike' | 'regenerate';
}

export interface OrchestratedResponse {
  finalAnswer: string;
  finalThinking: string;
  intent: UserIntent;
  complexity: ComplexityLevel;
  confidence: ConfidenceAssessment;
  verificationResult: DeterministicVerificationResult;
  refinementsApplied: RefinementTrace[];
  modelUsed: string;
  sourcesGrounded: number;
  telemetryId: string;
  isVerified: boolean;
}
