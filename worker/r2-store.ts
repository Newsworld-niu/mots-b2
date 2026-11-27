import {
  PreconditionFailedError,
  type ObjGetResult,
  type ObjListItem,
  type ObjPutConditions,
  type ObjStore,
} from "../server/src/lib/store-types.js";

/**
 * ObjStore backed by a Cloudflare R2 bucket binding.
 *
 * Conditions are always passed to `onlyIf` as HTTP `Headers`: R2's object form (`etagDoesNotMatch: "*"`) treats
 * `*` as a literal ETag rather than the wildcard, which would silently turn create-only writes into overwrites.
 */
export class R2ObjStore implements ObjStore {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string, ifNoneMatch?: string): Promise<ObjGetResult | null | "not-modified"> {
    const obj = await this.bucket.get(
      key,
      ifNoneMatch ? { onlyIf: new Headers({ "If-None-Match": ifNoneMatch }) } : undefined,
    );
    if (obj === null) return null;
    // A failed precondition yields the object's metadata without a body.
    if (!("body" in obj) || !obj.body) return "not-modified";
    return { body: await obj.text(), etag: obj.httpEtag };
  }

  async put(key: string, body: string, cond?: ObjPutConditions): Promise<string> {
    const options: R2PutOptions = {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    };
    if (cond?.ifNoneMatchStar) {
      options.onlyIf = new Headers({ "If-None-Match": "*" });
    } else if (cond?.ifMatch !== undefined) {
      options.onlyIf = new Headers({ "If-Match": cond.ifMatch });
    }
    const obj = await this.bucket.put(key, body, options);
    // R2 returns null (rather than throwing) when an onlyIf precondition fails.
    if (obj === null) throw new PreconditionFailedError();
    return obj.httpEtag;
  }

  async list(prefix: string): Promise<ObjListItem[]> {
    const out: ObjListItem[] = [];
    let cursor: string | undefined;
    for (;;) {
      const listed = await this.bucket.list({ prefix, cursor });
      for (const o of listed.objects) {
        out.push({ key: o.key, lastModified: o.uploaded, size: o.size });
      }
      if (!listed.truncated) break;
      cursor = listed.cursor;
      if (!cursor) break;
    }
    return out;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.bucket.head(key)) !== null;
  }

  async delete(key: string): Promise<boolean> {
    // R2 delete() resolves the same way for missing keys, so look first to report whether anything was removed.
    if ((await this.bucket.head(key)) === null) return false;
    await this.bucket.delete(key);
    return true;
  }
}
