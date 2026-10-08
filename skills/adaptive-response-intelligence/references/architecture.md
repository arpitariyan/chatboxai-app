# Adaptive Response Intelligence Engine - Architecture Reference

## Component Flow Breakdown

1. **Input Normalization (`src/services/intelligence/intentEngine.ts`)**
   - Normalizes whitespace, extracts language, removes conversational padding.
   - Detects code fences, mathematical expressions, or URLs.

2. **Intent Classification**
   - 15 Canonical Intent Classes:
     1. `general_chat` (Greetings, polite chitchat)
     2. `question_answering` (Fact retrieval, trivia, definitions)
     3. `coding` (Writing algorithms, implementations, functions)
     4. `debugging` (Stack traces, runtime errors, fixing broken code)
     5. `research` (Deep comparative inquiry, academic/industry literature)
     6. `explanation` (Concept deconstruction, ELI5, intuition)
     7. `summarization` (Condensing articles, meeting notes, transcripts)
     8. `translation` (Cross-language localization, idiomatic translation)
     9. `writing` (Drafting emails, essays, articles, creative stories)
     10. `planning` (Project timelines, itineraries, checklists)
     11. `comparison` (Product benchmarks, tech stack trade-offs)
     12. `brainstorming` (Idea generation, naming, feature suggestions)
     13. `troubleshooting` (System diagnosis, network issues, device repair)
     14. `multimodal` (Image explanation, OCR query, visual analysis)
     15. `file_analysis` (Document Q&A, spreadsheet crunching, PDF search)

3. **Complexity Scoring**
   - Scoring criteria: query length, technical terminology, logical constraints, multi-step clauses, code tokens.
   - Buckets:
     - `LOW` (0-29): 1-turn call, skip LLM judge, deterministic check only.
     - `MEDIUM` (30-64): 1-turn call + lightweight evaluation.
     - `HIGH` (65-84): Full evaluation + deterministic verification + bounded refinement.
     - `CRITICAL` (85-100): Deep multi-check + grounding verification + refinement.

4. **Answer Contract**
   - Tone: `concise` | `balanced` | `detailed`
   - Depth: `surface` | `standard` | `deep`
   - Format: `markdown_prose` | `code_only` | `structured_table` | `bullet_points`
   - Code Style: includes error handling, typescript types, inline comments when required.
   - Grounding: strict citation requirements when web/files are attached.

5. **Prompt Compiler (`src/services/intelligence/promptCompiler.ts`)**
   - Modular blocks:
     `BASE_SYSTEM_POLICY`
     + `TASK_POLICY[intent]`
     + `ANSWER_CONTRACT_DIRECTIVES`
     + `ACTIVE_USER_PREFERENCES`
     + `GROUNDING_POLICY` (if web sources or files present)
     + `SAFETY_AND_ACCURACY_POLICY`
