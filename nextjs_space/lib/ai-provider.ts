/** Server-only AI transport. Credentials never come from a client request. */
export class AIServiceError extends Error {
  constructor(message: string, public status = 503, public retryAfter?: number) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export function getAIConfig() {
  const provider = process.env.AI_PROVIDER?.trim() || (process.env.GROQ_API_KEY?.trim() ? 'groq' : 'abacus');
  if (provider !== 'groq' && provider !== 'abacus') {
    throw new AIServiceError('AI sağlayıcısı yapılandırması geçersiz.');
  }
  const key = (provider === 'groq' ? process.env.GROQ_API_KEY : process.env.ABACUSAI_API_KEY)?.trim();
  if (!key) throw new AIServiceError('AI asistanı henüz etkinleştirilmedi.');
  return {
    provider,
    key,
    url: provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://apps.abacus.ai/v1/chat/completions',
    model: (provider === 'groq' ? process.env.GROQ_MODEL : process.env.ABACUSAI_MODEL)?.trim()
      || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-5.4-mini'),
  };
}

type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type CompletionOptions = {
  messages: AIMessage[];
  stream?: boolean;
  max_tokens: number;
  temperature?: number;
  response_format?: { type: 'json_object' };
  signal?: AbortSignal;
};

export async function requestAICompletion(options: CompletionOptions): Promise<Response> {
  const config = getAIConfig();
  const { signal, max_tokens, ...body } = options;
  const isGroq = config.provider === 'groq';
  let response: Response;
  // Node >=20.19 supports any(); the project's TypeScript 5.2 DOM types predate it.
  const signals = AbortSignal as typeof AbortSignal & { any(signals: AbortSignal[]): AbortSignal };
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      signal: signals.any([AbortSignal.timeout(90_000), ...(signal ? [signal] : [])]),
      body: JSON.stringify({
        ...body,
        model: config.model,
        ...(isGroq ? { max_completion_tokens: max_tokens } : { max_tokens }),
        ...(isGroq && config.model.startsWith('openai/gpt-oss-')
          ? { reasoning_effort: 'low', include_reasoning: false } : {}),
      }),
    });
  } catch {
    throw new AIServiceError('AI hizmetine ulaşılamadı. Lütfen biraz sonra tekrar deneyin.');
  }
  if (!response.ok) {
    // Do not expose or log provider response bodies (they may echo user data).
    await response.body?.cancel();
    if (response.status === 429) {
      const retry = Number(response.headers.get('retry-after'));
      throw new AIServiceError('AI kullanım kotası doldu. Lütfen daha sonra tekrar deneyin.', 429,
        Number.isFinite(retry) && retry > 0 ? Math.min(86400, Math.ceil(retry)) : 60);
    }
    if (response.status === 413) {
      throw new AIServiceError('Mesaj ve analiz verileri çok uzun. Daha kısa bir soruyla tekrar deneyin.', 413);
    }
    throw new AIServiceError('AI hizmeti isteği tamamlayamadı. Lütfen daha sonra tekrar deneyin.');
  }
  return response;
}

export function aiErrorResponse(error: unknown): Response {
  const known = error instanceof AIServiceError;
  return Response.json({ error: known ? error.message : 'AI yanıtı alınamadı. Lütfen tekrar deneyin.' }, {
    status: known ? error.status : 502,
    headers: known && error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
  });
}
