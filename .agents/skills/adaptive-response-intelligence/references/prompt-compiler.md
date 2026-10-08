# Prompt Compiler Specification

## Philosophy
Monolithic static prompts ("You are a helpful assistant...") fail to adapt to specialized tasks.
The Prompt Compiler dynamically composes runtime system instructions from orthogonal policies.

## Composition Pipeline
```
[Base System Policy]
        +
[Task-Specific Policy (e.g. Coding / Debugging / Research / Math)]
        +
[Answer Contract (Length, Tone, Structure, Constraints)]
        +
[Context & Memory Layer (Personalization, Active Memory items)]
        +
[Grounding Directive (Source Citations, URL bounds)]
        +
[Safety & Hallucination Prevention Directive]
```

## Contract Directives
1. **Conciseness vs Depth**: If user says "short" or "in one sentence", strict brevity is enforced.
2. **Deterministic Code Standards**: Never truncate code with `// ... rest of code here` unless asked.
3. **Citation Integrity**: Only cite explicit sources `[1]`, `[2]`. Never invent imaginary links.
