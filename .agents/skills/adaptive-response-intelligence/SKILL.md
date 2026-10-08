---
name: adaptive-response-intelligence
description: Production-grade Adaptive Response Intelligence Engine for mobile and Android applications. Formulates intelligent query classification, complexity estimation, dynamic context assembly, answer contracts, modular prompt compilation, deterministic verification, hallucination firewalls, quality evaluations, bounded adaptive refinement, and telemetry.
version: 1.0.0
---

# Adaptive Response Intelligence Engine

The **Adaptive Response Intelligence Engine** is a modular, high-reliability AI orchestration system engineered for mobile applications. It replaces naive single-prompt LLM calls with an adaptive multi-stage pipeline that guarantees response quality, correctness, context grounding, and token/battery efficiency.

## 1. System Pipeline Architecture

```
User Request
  │
  ▼
Request Normalization & Sanitization
  │
  ▼
Intent Engine (15 Task Classifications)
  │
  ▼
Complexity Engine (LOW | MEDIUM | HIGH | CRITICAL)
  │
  ▼
Context Intelligence (Recency-Weighted Turns + Memory + Docs)
  │
  ▼
Answer Contract Resolution (Depth, Format, Style, Constraints)
  │
  ▼
Tool / Web Search Decision (Deterministic vs External Need)
  │
  ▼
Model Routing & Budget Allocation
  │
  ▼
Prompt Compiler (Base + Task + Contract + Context + Safety)
  │
  ▼
Candidate Generation
  │
  ▼
Deterministic Verification (Code syntax, Schema, Math, Citations)
  │
  ▼
Response Critic & Hallucination Firewall
  │
  ├── [Score >= Threshold & No Critical Violations] ──┐
  │                                                   │
  ▼ [Defect Found & Passes < Max 2]                   │
Adaptive Refinement (Targeted Correction Prompt)      │
  │                                                   │
  ▼                                                   │
Final Quality Gate & Confidence Scoring (HIGH|MED|LOW) │
  │                                                   │
  └───────────────────┬───────────────────────────────┘
                      ▼
               Clean Output Stream / Display
                      │
                      ▼
       Observability, Telemetry & Memory Learning
```

## 2. Core Modules

| Module | Location | Responsibility |
|---|---|---|
| **Intent Engine** | `src/services/intelligence/intentEngine.ts` | Identifies primary task (coding, QA, math, research, translation, etc.) with confidence. |
| **Complexity Engine** | `src/services/intelligence/complexityEngine.ts` | Categorizes compute budget into LOW, MEDIUM, HIGH, or CRITICAL. Prevents expensive loops on trivial queries. |
| **Context Assembler** | `src/services/intelligence/contextAssembler.ts` | Token-aware history summarization, preference injection, and document merging. |
| **Answer Contract** | `src/services/intelligence/answerContract.ts` | Establishes explicit response requirements (concise/detailed, technical/simple, markdown rules). |
| **Prompt Compiler** | `src/services/intelligence/promptCompiler.ts` | Assembles modular system prompts from isolated policies rather than monolithic static strings. |
| **Deterministic Verifier** | `src/services/intelligence/deterministicVerifier.ts` | Zero-LLM cost checks: code block syntax, unclosed fences, JSON schema, and markdown link health. |
| **Hallucination Firewall** | `src/services/intelligence/hallucinationFirewall.ts` | Cross-checks factual assertions against provided search/document sources. Flags ungrounded citations. |
| **Response Critic** | `src/services/intelligence/criticEngine.ts` | Evaluates correctness, instruction adherence, relevance, and safety against configurable thresholds. |
| **Adaptive Refiner** | `src/services/intelligence/refinementEngine.ts` | Drives targeted self-correction loops bounded to maximum 2 passes with early termination. |
| **Confidence Engine** | `src/services/intelligence/confidenceEngine.ts` | Assigns HIGH, MEDIUM, or LOW confidence score based on verification and grounding signals. |
| **Telemetry & Observability** | `src/services/intelligence/telemetry.ts` | Safe, privacy-redacted logging of latency, token estimates, verification passes, and user feedback. |

## 3. Complexity Budget Levels

1. **LOW (Direct Response)**:
   - *Queries*: Greetings, chitchat, simple one-shot definitions, straightforward affirmations.
   - *Pipeline*: Single LLM call. Deterministic sanity check. Fast return. Zero extra judging latency.

2. **MEDIUM (Single Generation + Light Critic)**:
   - *Queries*: Explanations, summaries, single-step tasks, general knowledge.
   - *Pipeline*: Generation + deterministic validation + lightweight critic evaluation. Refinement triggered only if critical failure occurs.

3. **HIGH (Generation + Deterministic Verification + Refinement)**:
   - *Queries*: Multi-file coding, debugging with stack traces, comparison of frameworks, complex math/logic.
   - *Pipeline*: Plan construction + Generation + AST/syntax verification + Critic + Adaptive refinement pass if defects are identified.

4. **CRITICAL (Full Quality Gated Multi-Check)**:
   - *Queries*: Architectural decisions, security analysis, critical financial/legal summarization.
   - *Pipeline*: Multi-check validation + Hallucination verification + Refinement loop + Strict quality gate.

## 4. Deterministic Verification Principles

Never spend LLM tokens or mobile battery on what a deterministic parser can verify for free:
- Code blocks: Check unclosed triple-backticks, language tags, matching brackets/parentheses.
- JSON/Structured: Check `JSON.parse` and schema conformance.
- Citations: Check that all `[1]`, `[2]` citations reference existing, valid source entries.
- Length & constraints: Verify word counts and user formatting specifications.

## 5. Mobile Production Rules

- **Zero API Key Leakage**: Keys remain securely managed via environment variables and backend proxies.
- **No Infinite Loops**: Maximum refinement passes strictly capped at 2.
- **Battery & Thermal Safety**: No continuous background evaluations.
- **Graceful Degraded Mode**: If network drops or evaluator fails, return the best candidate immediately with a safe qualification note.
- **UI Non-Invasiveness**: Never expose internal critic scores, evaluation prompts, or reasoning raw tokens to end users.
