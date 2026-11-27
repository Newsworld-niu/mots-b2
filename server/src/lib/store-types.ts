/**
 * Storage abstraction shared by the Azure Functions backend (BlobObjStore in ./store.ts) and the Cloudflare
 * Worker (R2ObjStore in worker/r2-store.ts). Keep this file free of SDK imports so the Worker bundle never pulls
 * in @azure/storage-blob.
 */

export class PreconditionFailedError extends Error {
  constructor(message = "Precondition failed") {
    super(message);
    this.name = "PreconditionFailedError";
  }
}

export interface ObjGetResult {
  body: string;
  etag: string;
}

export interface ObjPutConditions {
  ifMatch?: string;
  ifNoneMatchStar?: boolean;
}

export interface ObjListItem {
  key: string;
  lastModified: Date;
  size: number;
}

export interface ObjStore {
  get(key: string, ifNoneMatch?: string): Promise<ObjGetResult | null | "not-modified">;
  put(key: string, body: string, cond?: ObjPutConditions): Promise<string>;
  list(prefix: string): Promise<ObjListItem[]>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

const utf8 = new TextEncoder();

export class MemoryObjStore implements ObjStore {
  private readonly items = new Map<
    string,
    { body: string; etag: string; lastModified: Date; size: number }
  >();
  private counter = 0;

  async get(
    key: string,
    ifNoneMatch?: string,
  ): Promise<ObjGetResult | null | "not-modified"> {
    const item = this.items.get(key);
    if (!item) return null;
    if (ifNoneMatch && (ifNoneMatch === "*" || item.etag === ifNoneMatch)) {
      return "not-modified";
    }
    return { body: item.body, etag: item.etag };
  }

  async put(
    key: string,
    body: string,
    cond?: ObjPutConditions,
  ): Promise<string> {
    const existing = this.items.get(key);
    if (cond?.ifNoneMatchStar && existing) {
      throw new PreconditionFailedError();
    }
    if (
      cond?.ifMatch !== undefined &&
      (!existing || existing.etag !== cond.ifMatch)
    ) {
      throw new PreconditionFailedError();
    }
    const etag = `"${++this.counter}"`;
    this.items.set(key, {
      body,
      etag,
      lastModified: new Date(),
      size: utf8.encode(body).byteLength,
    });
    return etag;
  }

  async list(prefix: string): Promise<ObjListItem[]> {
    const out: ObjListItem[] = [];
    for (const [key, item] of this.items.entries()) {
      if (key.startsWith(prefix)) {
        out.push({
          key,
          lastModified: item.lastModified,
          size: item.size,
        });
      }
    }
    out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return out;
  }

  async delete(key: string): Promise<boolean> {
    return this.items.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.items.has(key);
  }
}
