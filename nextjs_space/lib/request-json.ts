import { NextRequest } from 'next/server';

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// JSON-only mutations cannot be submitted by a cross-site HTML form.
export async function readMutationJson(request: NextRequest, maxBytes = 20_000): Promise<unknown> {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.NEXTAUTH_URL || request.url);
  if (origin) {
    let allowed = false;
    try {
      const actual = new URL(origin);
      // The deployed Nginx site serves both the canonical and www domain.
      // Permit only that exact alias, preserving protocol and port.
      allowed = actual.origin === origin && actual.protocol === expected.protocol && actual.port === expected.port
        && actual.hostname.replace(/^www\./, '') === expected.hostname.replace(/^www\./, '');
    } catch { /* Malformed/null origins cannot authorize a mutation. */ }
    if (!allowed) throw new RequestError('İstek kaynağı doğrulanamadı.', 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new RequestError('JSON içerikli istek gerekli.', 415);
  }
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestError('İstek çok uzun.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('İstek içeriği gerekli.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RequestError('İstek çok uzun.', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new RequestError('Geçersiz JSON içeriği.'); }
  } finally { reader.releaseLock(); }
}
