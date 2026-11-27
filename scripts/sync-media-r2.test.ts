import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
// @ts-expect-error -- plain ESM script without type declarations
import * as r2 from "./sync-media-r2.mjs";

test("signV4 reproduces the AWS S3 GET Object documentation example", () => {
  const signed = r2.signV4({
    method: "GET",
    host: "examplebucket.s3.amazonaws.com",
    canonicalPath: "/test.txt",
    headers: { Range: "bytes=0-9" },
    payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    now: new Date("2013-05-24T00:00:00Z"),
  });
  assert.equal(
    signed.Authorization,
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
  );
});

test("keys are RFC 3986 encoded per path segment and ListObjectsV2 pages parse", () => {
  assert.equal(r2.encodeKeyPath("materials/co/été (1)!.mp3"), "materials/co/%C3%A9t%C3%A9%20%281%29%21.mp3");
  const page = r2.parseListObjectsV2(
    `<?xml version="1.0"?><ListBucketResult><IsTruncated>true</IsTruncated>
     <Contents><Key>atlas/audio/f/a&amp;b.mp3</Key><Size>12</Size><ETag>&quot;0123456789abcdef0123456789abcdef&quot;</ETag></Contents>
     <Contents><Key>materials/x.mp3</Key><Size>0</Size></Contents>
     <NextContinuationToken>tok/en==</NextContinuationToken></ListBucketResult>`,
  );
  assert.deepEqual(page, {
    objects: [
      { key: "atlas/audio/f/a&b.mp3", size: 12, etag: "0123456789abcdef0123456789abcdef" },
      { key: "materials/x.mp3", size: 0 },
    ],
    truncated: true,
    nextToken: "tok/en==",
  });

  const tmp = path.join(os.tmpdir(), `r2-md5-${process.pid}.json`);
  fs.writeFileSync(tmp, '{"a":1}');
  const expectedMd5 = createHash("md5").update('{"a":1}').digest("hex");
  try {
    assert.equal(r2.needsUpload({ file: tmp, size: 7 }, { size: 7, etag: expectedMd5 }), false);
    // Same byte size ('{"a":2}'), different MD5 -> must upload!
    fs.writeFileSync(tmp, '{"a":2}');
    assert.equal(r2.needsUpload({ file: tmp, size: 7 }, { size: 7, etag: expectedMd5 }), true);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test("local inventory mirrors the build's offloaded-media predicate", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r2-inv-"));
  try {
    const put = (rel: string, size = 3) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), Buffer.alloc(size));
    };
    put("atlas/audio/f/rue.mp3");
    put("atlas/audio/.DS_Store");
    put("atlas/index.json");
    put("materials/rfi/ep.mp3", 5);
    put("materials/rfi/ep.json");
    put("materials/rfi/ep.vtt");
    put("materials/co/clip.M4A");
    put("lexdb/e/ab.json", 7);
    assert.deepEqual(
      r2.localInventory("all", dir).map((i: { key: string; size: number }) => [i.key, i.size]),
      [
        ["atlas/audio/f/rue.mp3", 3],
        ["lexdb/e/ab.json", 7],
        ["materials/co/clip.M4A", 3],
        ["materials/rfi/ep.mp3", 5],
      ],
    );
    assert.equal(r2.localInventory("audio", dir).length, 1);
    assert.equal(r2.localInventory("materials", dir).length, 2);
    assert.equal(r2.localInventory("lexdb", dir).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("argument parsing validates --only and --concurrency", () => {
  assert.deepEqual(r2.parseArgs([]), { dryRun: false, setup: false, only: "all", concurrency: 24 });
  assert.deepEqual(r2.parseArgs(["--dry-run", "--setup", "--only=audio", "--concurrency=8"]), {
    dryRun: true,
    setup: true,
    only: "audio",
    concurrency: 8,
  });
  assert.throws(() => r2.parseArgs(["--only=video"]));
  assert.throws(() => r2.parseArgs(["--concurrency=0"]));
  assert.throws(() => r2.parseArgs(["--bogus"]));
});
