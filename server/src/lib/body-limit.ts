export interface BodyReader {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
  cancel: () => Promise<unknown>;
  releaseLock: () => void;
}

export interface BodyLimitRequest {
  headers?: Headers | Record<string, string | undefined>;
  body?: { getReader: () => BodyReader } | null;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function getContentLength(headers: BodyLimitRequest["headers"]): number | null {
  if (!headers) return null;
  const raw =
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get("content-length")
      : Object.entries(headers as Record<string, string | undefined>).find(
          ([k]) => k.toLowerCase() === "content-length",
        )?.[1];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function readBodyWithLimit(
  request: BodyLimitRequest,
  maxBytes: number,
): Promise<{ ok: true; body: Uint8Array } | { ok: false; status: 413 }> {
  const declared = getContentLength(request.headers);
  if (declared !== null && declared > maxBytes) {
    return { ok: false, status: 413 };
  }

  if (request.body && typeof request.body.getReader === "function") {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return { ok: false, status: 413 };
        }
        chunks.push(value);
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        combined.set(c, offset);
        offset += c.byteLength;
      }
      return { ok: true, body: combined };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }

  const ab = await request.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    return { ok: false, status: 413 };
  }
  return { ok: true, body: new Uint8Array(ab) };
}
