export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  system?: string;
}

export interface LLMResponse {
  provider: string;
  choices: {
    message: { role: string; content: string };
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callOpenAICompat(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  baseURL: string,
  apiKey: string,
  providerLabel: string
): Promise<LLMResponse> {
  const url = `${baseURL}/chat/completions`;
  
  const formattedMessages = [...messages];
  if (options.system && !formattedMessages.find(m => m.role === 'system')) {
    formattedMessages.unshift({ role: 'system', content: options.system });
  }

  const payload = {
    model: modelApi,
    messages: formattedMessages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2048,
    top_p: options.top_p ?? 1.0,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    stream: false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${providerLabel}] API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    provider: providerLabel,
    choices: data.choices.map((c: any) => ({
      message: { role: c.message.role, content: c.message.content },
      finish_reason: c.finish_reason,
      index: c.index,
    })),
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  };
}

export async function callGoogleProvider(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  apiKey: string
): Promise<LLMResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelApi}:generateContent?key=${apiKey}`;

  const contents = messages
    .filter(m => m.role !== 'system') // Google handles system differently
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  const payload: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 2048,
      topP: options.top_p ?? 1.0,
    },
  };

  const systemMessage = messages.find(m => m.role === 'system')?.content || options.system;
  if (systemMessage) {
    payload.systemInstruction = {
      parts: [{ text: systemMessage }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[google] API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    provider: 'google',
    choices: [{
      message: { role: 'assistant', content: textContent },
      finish_reason: data.candidates?.[0]?.finishReason ?? 'stop',
      index: 0,
    }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: data.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
