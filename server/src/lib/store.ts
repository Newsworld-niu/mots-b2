import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";

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

function getStatusCode(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    const code = (err as { statusCode?: unknown }).statusCode;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; details?: { errorCode?: unknown } };
  if (typeof e.details?.errorCode === "string") return e.details.errorCode;
  if (typeof e.code === "string") return e.code;
  return undefined;
}

async function streamToString(stream?: NodeJS.ReadableStream): Promise<string> {
  if (!stream) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk),
    );
  }
  return Buffer.concat(chunks).toString("utf8");
}

export class BlobObjStore implements ObjStore {
  private readonly container: ContainerClient;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string, containerName = "sync") {
    this.container =
      BlobServiceClient.fromConnectionString(connectionString).getContainerClient(
        containerName,
      );
  }

  private ensureContainer(): Promise<void> {
    if (!this.ready) {
      this.ready = this.container.createIfNotExists().then(
        () => undefined,
        (err) => {
          this.ready = null;
          throw err;
        },
      );
    }
    return this.ready;
  }

  async get(
    key: string,
    ifNoneMatch?: string,
  ): Promise<ObjGetResult | null | "not-modified"> {
    await this.ensureContainer();
    const blob = this.container.getBlockBlobClient(key);
    try {
      const res = await blob.download(
        0,
        undefined,
        ifNoneMatch ? { conditions: { ifNoneMatch } } : undefined,
      );
      const body = await streamToString(res.readableStreamBody);
      return { body, etag: res.etag ?? "" };
    } catch (err) {
      const status = getStatusCode(err);
      if (status === 304) return "not-modified";
      if (status === 404) return null;
      throw err;
    }
  }

  async put(
    key: string,
    body: string,
    cond?: ObjPutConditions,
  ): Promise<string> {
    await this.ensureContainer();
    const blob = this.container.getBlockBlobClient(key);
    const buf = Buffer.from(body, "utf8");
    const conditions: { ifMatch?: string; ifNoneMatch?: string } = {};
    if (cond?.ifMatch !== undefined) conditions.ifMatch = cond.ifMatch;
    if (cond?.ifNoneMatchStar) conditions.ifNoneMatch = "*";

    try {
      const res = await blob.upload(buf, buf.byteLength, {
        blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
        conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
      });
      return res.etag ?? "";
    } catch (err) {
      const status = getStatusCode(err);
      const errorCode = getErrorCode(err);
      if (
        status === 412 ||
        (cond?.ifNoneMatchStar &&
          status === 409 &&
          errorCode === "BlobAlreadyExists")
      ) {
        throw new PreconditionFailedError();
      }
      throw err;
    }
  }

  async list(prefix: string): Promise<ObjListItem[]> {
    await this.ensureContainer();
    const out: ObjListItem[] = [];
    for await (const item of this.container.listBlobsFlat({ prefix })) {
      out.push({
        key: item.name,
        lastModified: item.properties.lastModified ?? new Date(0),
        size: item.properties.contentLength ?? 0,
      });
    }
    return out;
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureContainer();
    const res = await this.container.getBlockBlobClient(key).deleteIfExists();
    return res.succeeded;
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureContainer();
    return this.container.getBlockBlobClient(key).exists();
  }
}

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
      size: Buffer.byteLength(body, "utf8"),
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
