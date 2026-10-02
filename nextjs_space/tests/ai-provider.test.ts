import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { aiErrorResponse, getAIConfig, requestAICompletion } from '../lib/ai-provider';

beforeEach(() => {
  for (const name of ['AI_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL', 'ABACUSAI_API_KEY', 'ABACUSAI_MODEL']) {
    vi.stubEnv(name, '');
  }
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const options = { messages: [{ role: 'user' as const, content: 'Merhaba' }], max_tokens: 3000 };

it('fails without credentials and does not contact any provider', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(requestAICompletion(options)).rejects.toMatchObject({ status: 503 });
  expect(fetcher).not.toHaveBeenCalled();
});
it('selects Groq without leaking its key to the legacy endpoint', async () => {
  vi.stubEnv('GROQ_API_KEY', 'groq-test-key'); vi.stubEnv('ABACUSAI_API_KEY', 'abacus-test-key');
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Türkçe"}}]}\n\n');
  const fetcher = vi.fn().mockResolvedValue(new Response(bytes)); vi.stubGlobal('fetch', fetcher);
  const response = await requestAICompletion({ ...options, stream: true });
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(init.headers.Authorization).toBe('Bearer groq-test-key');
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ model: 'openai/gpt-oss-120b', stream: true,
    max_completion_tokens: 3000, reasoning_effort: 'low', include_reasoning: false });
  expect(body).not.toHaveProperty('max_tokens');
  expect(body).not.toHaveProperty('signal');
  expect(await response.text()).toContain('Türkçe');
});
it('keeps explicit Abacus configuration working', async () => {
  vi.stubEnv('AI_PROVIDER', 'abacus'); vi.stubEnv('ABACUSAI_API_KEY', 'legacy-key');
  vi.stubEnv('GROQ_API_KEY', 'unused-key');
  const fetcher = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetcher);
  await requestAICompletion(options);
  expect(fetcher.mock.calls[0][0]).toBe('https://apps.abacus.ai/v1/chat/completions');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ max_tokens: 3000, model: 'gpt-5.4-mini' });
});
it('does not fall back to a paid provider when Groq credentials are missing', () => {
  vi.stubEnv('AI_PROVIDER', 'groq'); vi.stubEnv('ABACUSAI_API_KEY', 'legacy-key');
  expect(getAIConfig).toThrow('henüz etkinleştirilmedi');
});
it('preserves JSON mode and uses model-specific parameters only for GPT OSS', async () => {
  vi.stubEnv('GROQ_API_KEY', 'key'); vi.stubEnv('GROQ_MODEL', 'another-model');
  const fetcher = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetcher);
  await requestAICompletion({ ...options, response_format: { type: 'json_object' } });
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.response_format).toEqual({ type: 'json_object' });
  expect(body).not.toHaveProperty('reasoning_effort');
});
it('returns a readable quota error with Retry-After and never echoes upstream data', async () => {
  vi.stubEnv('GROQ_API_KEY', 'secret-key');
  const fetcher = vi.fn().mockResolvedValue(new Response('secret-key private prompt', {
    status: 429, headers: { 'retry-after': '5.4' },
  })); vi.stubGlobal('fetch', fetcher);
  const error = await requestAICompletion(options).catch(e => e);
  const response = aiErrorResponse(error);
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('6');
  expect(await response.json()).toEqual({ error: 'AI kullanım kotası doldu. Lütfen daha sonra tekrar deneyin.' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('sanitizes authentication and network errors', async () => {
  vi.stubEnv('GROQ_API_KEY', 'secret-key');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret-key', { status: 401 })));
  const error = await requestAICompletion(options).catch(e => e);
  expect(error.status).toBe(503); expect(error.message).not.toContain('secret-key');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret-key')));
  await expect(requestAICompletion(options)).rejects.toMatchObject({ status: 503 });
});
