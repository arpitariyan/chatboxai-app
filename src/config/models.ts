import { toUIModels } from './models-registry';

export const AIModelsOption = toUIModels();

export const DEEP_RESEARCH_MODELS = [

    // ── AUTO (Best available for Research) ──────────────────
    {
        id: 'dr-auto',
        name: 'Auto (Best)',
        desc: 'Automatically picks best research model',
        modelApi: 'auto',
        provider: 'mixed',
        reasoningParam: null,
        isPro: false,
    },

    // ── REPLICATE (priority: Claude access) ─────────────────
    {
        id: 'dr-1',
        name: 'Claude 3.7 Sonnet Thinking',
        desc: 'Claude 3.7 Sonnet — Anthropic top model via Thinking',
        modelApi: 'anthropic/claude-3.7-sonnet',
        provider: 'replicate',
        reasoningParam: null,
        isPro: true,
    },
    {
        id: 'dr-2',
        name: 'Claude 4.5 Sonnet Thinking',
        desc: 'Claude 4.5 Sonnet — newest Anthropic model via Thinking',
        modelApi: 'anthropic/claude-4.5-sonnet',
        provider: 'replicate',
        reasoningParam: null,
        isPro: true,
    },

    // ── GROQ (priority: speed + reasoning) ──────────────────
    {
        id: 'dr-3',
        name: 'Qwen3 32B Thinking',
        desc: 'Dual-mode thinking model — deep reasoning, 6K ctx/min on Groq',
        modelApi: 'qwen/qwen3-32b',
        provider: 'groq',
        reasoningParam: { type: 'groq', key: 'reasoning_effort', value: 'default' },
        isPro: false,
    },
    {
        id: 'dr-4',
        name: 'GPT-OSS 120B Reasoning',
        desc: 'OpenAI 120B — highest reasoning quality on Groq, reasoning_effort: high',
        modelApi: 'openai/gpt-oss-120b',
        provider: 'groq',
        reasoningParam: { type: 'groq', key: 'reasoning_effort', value: 'high' },
        isPro: true,
    },
    {
        id: 'dr-5',
        name: 'GPT-OSS 20B Fast Thinking',
        desc: 'OpenAI 20B — fastest reasoning on Groq (~1000 t/s), great fallback',
        modelApi: 'openai/gpt-oss-20b',
        provider: 'groq',
        reasoningParam: { type: 'groq', key: 'reasoning_effort', value: 'high' },
        isPro: false,
    },
    {
        id: 'dr-6',
        name: 'Kimi K2 Agentic',
        desc: 'Multi-step agentic reasoning — best for long-chain research tasks',
        modelApi: 'moonshotai/kimi-k2-instruct',
        provider: 'openrouter',
        reasoningParam: null,
        isPro: false,
    },
    {
        id: 'dr-7',
        name: 'Llama 3.3 70B Versatile',
        desc: 'Llama 3.3 70B — best general quality on Groq, lightning fast',
        modelApi: 'llama-3.3-70b-versatile',
        provider: 'groq',
        reasoningParam: null,
        isPro: false,
    },

    // ── OPENROUTER (priority: depth + free) ─────────────────
    {
        id: 'dr-8',
        name: 'Qwen 3.6 Plus Preview Thinking',
        desc: 'Qwen 3.6 Plus Preview — top free reasoning/coding depth with long context',
        modelApi: 'qwen/qwen3.6-plus-preview:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-9',
        name: 'NVIDIA Nemotron 3 Super',
        desc: 'Nemotron 3 Super — 1M context for long-form research and agent workflows',
        modelApi: 'nvidia/nemotron-3-super:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-10',
        name: 'MiniMax M2.5 Thinking',
        desc: 'MiniMax M2.5 — strong software + office workflow reasoning',
        modelApi: 'minimax/minimax-m2.5:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-11',
        name: 'StepFun 3.5 Flash Thinking',
        desc: 'Native reasoning model — 196B MoE, 256K ctx, reasoning tokens visible',
        modelApi: 'stepfun/step-3.5-flash:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-12',
        name: 'GLM 4.5 Air Thinking',
        desc: 'Thinking mode ON — agentic, tool use, 131K ctx, toggle anytime',
        modelApi: 'z-ai/glm-4.5-air:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-13',
        name: 'Trinity Large Thinking',
        desc: 'Arcee 400B MoE — frontier reasoning, 131K ctx, free',
        modelApi: 'arcee-ai/trinity-large-preview:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-14',
        name: 'GPT-OSS 20B Thinking',
        desc: 'OpenAI 20B free on OpenRouter — reasoning config support, 131K ctx',
        modelApi: 'openai/gpt-oss-20b:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-15',
        name: 'Qwen3 Coder 480B',
        desc: '480B MoE coding + research — chain-of-thought, 262K ctx',
        modelApi: 'qwen/qwen3-coder:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    }
];
