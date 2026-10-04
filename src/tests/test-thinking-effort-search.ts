/**
 * src/tests/test-thinking-effort-search.ts
 *
 * Comprehensive test suite verifying the integrated:
 * 1. Thinking Mode (default ON, disableable, intelligent complexity scaling)
 * 2. Effort Levels (Low, Medium, High, Extra High parameter resolution & system directives)
 * 3. Web Search Query Formulation & Store Synchronization
 */

import { analyzeUserQuery } from '../services/search/queryPlanner';
import {
  getThinkingModeSuffix,
  getEffortSystemSuffix,
  resolveModelParameters,
} from '../services/llm/providers';
import { parseAiResponse } from '../utils/parseAiResponse';
import { useModelStore } from '../stores/useModelStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('\n--- 1. Testing Query Complexity Analyzer & Query Formulation ---');
{
  const simple1 = analyzeUserQuery('Hello');
  assert(simple1.complexity === 'SIMPLE', 'Greeting "Hello" should be SIMPLE');
  assert(simple1.needsDeepReasoning === false, 'Simple greeting does not need deep reasoning');

  const simple2 = analyzeUserQuery('what is the capital of France?');
  assert(simple2.complexity === 'SIMPLE', 'Short factual lookup should be SIMPLE');
  assert(simple2.cleanSearchQuery === 'capital of France', 'Should strip "what is the" conversational prefix');

  const moderate = analyzeUserQuery('Can you please explain how photosythesis works and its main stages?');
  assert(moderate.complexity === 'MODERATE', 'Exploratory explanation should be MODERATE');
  assert(!moderate.cleanSearchQuery.toLowerCase().startsWith('can you please'), 'Conversational prefix stripped');

  const complex1 = analyzeUserQuery(
    'Write a TypeScript function to solve the Traveling Salesperson Problem using dynamic programming with bitmasking, and benchmark its time complexity and edge cases.'
  );
  assert(complex1.complexity === 'COMPLEX', 'Algorithmic dynamic programming query should be COMPLEX');
  assert(complex1.needsDeepReasoning === true, 'Complex query needs deep reasoning');
}

console.log('\n--- 2. Testing Thinking Mode Directives ---');
{
  // When Thinking Mode is OFF
  const thinkingOff = getThinkingModeSuffix(false, 'COMPLEX', 'High');
  assert(thinkingOff.includes('THINKING MODE: DISABLED'), 'Should explicitly disable thinking');
  assert(thinkingOff.includes('Do NOT output any thinking process'), 'Should instruct model to return only direct answer');

  // When Thinking Mode is ON & query is SIMPLE
  const thinkingSimple = getThinkingModeSuffix(true, 'SIMPLE', 'Low');
  assert(thinkingSimple.includes('CONCISE MODE'), 'Simple query should use concise mode');
  assert(thinkingSimple.includes('brief 1-2 sentence verification'), 'Should restrict reasoning to brief verification');

  // When Thinking Mode is ON & query is COMPLEX
  const thinkingComplex = getThinkingModeSuffix(true, 'COMPLEX', 'High');
  assert(thinkingComplex.includes('DEEP REASONING'), 'Complex query should use deep reasoning mode');
  assert(thinkingComplex.includes('step-by-step reasoning analysis'), 'Should require thorough step-by-step reasoning');

  // When Thinking Mode is ON & query is MODERATE
  const thinkingModerate = getThinkingModeSuffix(true, 'MODERATE', 'Medium');
  assert(thinkingModerate.includes('focused reasoning process'), 'Moderate query should use focused reasoning');
}

console.log('\n--- 3. Testing Effort Levels & Safe Parameter Adaptation ---');
{
  const lowSuffix = getEffortSystemSuffix('Low');
  assert(lowSuffix.includes('EFFORT LEVEL: LOW'), 'Low effort prompt generated');

  const extraHighSuffix = getEffortSystemSuffix('Extra High');
  assert(extraHighSuffix.includes('EFFORT LEVEL: EXTRA HIGH'), 'Extra High effort prompt generated');
  assert(extraHighSuffix.includes('exhaustive'), 'Extra High asks for exhaustive depth');

  // Low Effort params
  const lowParams = resolveModelParameters('chatboxai/gpt-oss-20b', { effortLevel: 'Low' });
  assert(lowParams.max_tokens === 1536, 'Low effort max_tokens is 1536');
  assert(lowParams.temperature === 0.7, 'Low effort temperature is 0.7');

  // Medium Effort params
  const medParams = resolveModelParameters('chatboxai/gpt-oss-20b', { effortLevel: 'Medium' });
  assert(medParams.max_tokens === 2560, 'Medium effort max_tokens is 2560');
  assert(medParams.temperature === 0.6, 'Medium effort temperature is 0.6');

  // High Effort params
  const highParams = resolveModelParameters('chatboxai/gpt-oss-20b', { effortLevel: 'High' });
  assert(highParams.max_tokens === 4096, 'High effort max_tokens is 4096');
  assert(highParams.temperature === 0.4, 'High effort temperature is 0.4');

  // Extra High Effort params
  const extraHighParams = resolveModelParameters('chatboxai/gpt-oss-20b', { effortLevel: 'Extra High' });
  assert(extraHighParams.max_tokens === 6144, 'Extra High effort max_tokens is 6144');
  assert(extraHighParams.temperature === 0.2, 'Extra High effort temperature is 0.2');

  // Strict reasoning model (OpenAI o1/o3) parameter safety
  const o1Params = resolveModelParameters('o1-preview', { effortLevel: 'High' });
  assert(o1Params.temperature === undefined, 'Strict reasoning models should omit temperature to avoid HTTP 400');
  assert(o1Params.max_tokens === 4096, 'o1 models retain appropriate token budget');
}

console.log('\n--- 4. Testing parseAiResponse Reasoning Separation ---');
{
  const responseWithThinking = '<think>\nHere is the step by step reasoning.\nStep 1: Check facts.\n</think>\n\nParis is the capital of France.';
  const parsed = parseAiResponse(responseWithThinking);
  assert(parsed.thinking.includes('Step 1: Check facts.'), 'Thinking trace extracted');
  assert(parsed.finalAnswer.trim() === 'Paris is the capital of France.', 'Final answer clean without <think> tags');

  const responseWithoutThinking = 'This is a direct answer with zero thinking.';
  const parsedDirect = parseAiResponse(responseWithoutThinking);
  assert(parsedDirect.thinking === '', 'No thinking trace found');
  assert(parsedDirect.finalAnswer === 'This is a direct answer with zero thinking.', 'Direct answer preserved');
}

console.log('\n--- 5. Testing useModelStore Defaults & Synchronization ---');
{
  const store = useModelStore.getState();
  assert(store.thinkingMode === true, 'Thinking Mode is ON by default');
  assert(store.effortLevel === 'Low', 'Default effort level is Low');
  assert(store.webSearchEnabled === false, 'Web search is opt-in (default OFF)');

  // Toggle Thinking Mode
  store.setThinkingMode(false);
  assert(useModelStore.getState().thinkingMode === false, 'Can disable thinking mode');
  store.setThinkingMode(true);
  assert(useModelStore.getState().thinkingMode === true, 'Can enable thinking mode');

  // Toggle Effort Level
  store.setEffortLevel('High');
  assert(useModelStore.getState().effortLevel === 'High', 'Can set effort level to High');
  store.setEffortLevel('Low');

  // Toggle Web Search
  store.setWebSearchEnabled(true);
  assert(useModelStore.getState().webSearchEnabled === true, 'Can enable web search');
  store.setWebSearchEnabled(false);
  assert(useModelStore.getState().webSearchEnabled === false, 'Can disable web search');
}

console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
