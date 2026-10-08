import { toUIModels } from './models-registry';

export const AIModelsOption = toUIModels();

export const DEEP_RESEARCH_MODELS = [
    // ── AUTO (Best available for Research) ──────────────────
    {
        id: 'dr-auto',
        name: 'Auto (Best Research)',
        desc: 'Automatically picks best verified research model',
        modelApi: 'auto',
        provider: 'mixed',
        reasoningParam: null,
        isPro: false,
    },

    // ── GOOGLE (Frontier Multimodal & Deep Search) ───────────
    {
        id: 'dr-gemini-2.5-flash',
        name: 'Gemini 2.5 Flash Research',
        desc: 'Google Gemini 2.5 Flash — frontier intelligence & live search synthesis',
        modelApi: 'gemini-2.5-flash',
        provider: 'google',
        reasoningParam: null,
        isPro: false,
    },
    {
        id: 'dr-gemini-2.5-lite',
        name: 'Gemini 2.5 Flash-Lite Research',
        desc: 'Google Gemini 2.5 Flash-Lite — ultra-fast research retrieval',
        modelApi: 'gemini-2.5-flash-lite',
        provider: 'google',
        reasoningParam: null,
        isPro: false,
    },

    // ── GROQ (High-Speed Reasoning & Synthesis) ─────────────
    {
        id: 'dr-gpt-120b',
        name: 'GPT-OSS 120B Deep Reasoning',
        desc: 'OpenAI 120B — deep architectural reasoning on Groq',
        modelApi: 'openai/gpt-oss-120b',
        provider: 'groq',
        reasoningParam: { type: 'groq', key: 'reasoning_effort', value: 'high' },
        isPro: false,
    },
    {
        id: 'dr-qwen-27b',
        name: 'Qwen 3.8 27B Research Reasoning',
        desc: 'Qwen 3.8 27B — top-tier reasoning and coding depth on Groq',
        modelApi: 'qwen/qwen3.8-27b',
        provider: 'groq',
        reasoningParam: { type: 'groq', key: 'reasoning_effort', value: 'default' },
        isPro: false,
    },
    {
        id: 'dr-gpt-20b',
        name: 'GPT-OSS 20B Fast Thinking',
        desc: 'OpenAI 20B — fastest reasoning on Groq (~1000 t/s), great fallback',
        modelApi: 'openai/gpt-oss-20b',
        provider: 'groq',
        reasoningParam: { type: 'groq', key: 'reasoning_effort', value: 'high' },
        isPro: false,
    },

    // ── OPENROUTER (High Context 1M & MoE Reasoning) ────────
    {
        id: 'dr-nemo-lightning',
        name: 'Nemotron 3.5 Lightning (1M Ctx)',
        desc: 'NVIDIA Nemotron 3.5 — 1M context window for massive multi-document research',
        modelApi: 'nvidia/nemotron-3.5-lightning:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-nemo-super',
        name: 'Nemotron 3 Super 120B',
        desc: 'Nemotron 3 Super 120B MoE — agentic reasoning workflows, free tier',
        modelApi: 'nvidia/nemotron-3-super-120b-a12b:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-nemo-ultra',
        name: 'Nemotron 3 Ultra 550B',
        desc: 'Nemotron 3 Ultra 550B — massive scale reasoning and synthesis',
        modelApi: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-nemo-omni',
        name: 'Nemotron 3 Nano Omni Reasoning',
        desc: 'Native reasoning model — fast chain-of-thought for deep research',
        modelApi: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },
    {
        id: 'dr-north-code',
        name: 'North Mini Code Research',
        desc: 'Cohere North Mini Code — optimized for software, math & algorithmic research',
        modelApi: 'cohere/north-mini-code:free',
        provider: 'openrouter',
        reasoningParam: { type: 'openrouter', enabled: true },
        isPro: false,
    },

    // ── PRO (Replicate Frontier Reasoning) ──────────────────
    {
        id: 'dr-claude-sonnet',
        name: 'Claude 4.5 Sonnet Thinking',
        desc: 'Claude 4.5 Sonnet — newest Anthropic model via thinking mode',
        modelApi: 'anthropic/claude-4.5-sonnet',
        provider: 'replicate',
        reasoningParam: null,
        isPro: true,
    },
];
