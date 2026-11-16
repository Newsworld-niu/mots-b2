import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dictionaryProxy } from "../dictionary-proxy.ts";

async function request(url: string, headers: IncomingMessage["headers"] = {}, method = "GET") {
  const req = { url, method, headers: { host: "127.0.0.1:5190", ...headers } } as IncomingMessage;
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200, writableEnded: false, destroyed: false, body: "", headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(body: string) { this.body = body; this.writableEnded = true; },
  });
  let next = false;
  await dictionaryProxy(req, res as unknown as ServerResponse, () => { next = true; });
  return { res, next };
}

test("dictionary forwarder restricts callers, methods and query length without fetching", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("must not contact upstream"); };
  try {
    assert.equal((await request("/other")).next, true);
    assert.equal((await request("/dictionary-proxy?q=bonjour", { origin: "https://other.example" })).res.statusCode, 403);
    assert.equal((await request("/dictionary-proxy?q=bonjour", { "sec-fetch-site": "cross-site" })).res.statusCode, 403);
    assert.equal((await request("/dictionary-proxy?q=bonjour", {}, "POST")).res.statusCode, 405);
    assert.equal((await request("/dictionary-proxy?q=")).res.statusCode, 400);
    assert.equal((await request(`/dictionary-proxy?q=${"x".repeat(81)}`)).res.statusCode, 400);
  } finally { globalThis.fetch = original; }
});

test("dictionary HTML is JSON data; only the fixed upstream receives the encoded query", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://www.frdic.com/dicts/fr/%C3%AAtre%20%23%3F%26");
      const headers = new Headers(options?.headers);
      for (const key of ["cookie", "origin", "referer"]) assert.equal(headers.get(key), null);
      assert.equal(options?.redirect, "error");
      return new Response('<div id="ExpFCchild">释义</div>');
    };
    const { res } = await request(`/dictionary-proxy?q=${encodeURIComponent("être #?&")}`, {
      origin: "http://127.0.0.1:5190", cookie: "private=value", referer: "http://127.0.0.1:5190/",
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /application\/json/);
    assert.equal(JSON.parse(res.body).html, '<div id="ExpFCchild">释义</div>');
    assert.equal(res.listenerCount("close"), 0);
  } finally { globalThis.fetch = original; }
});

test("upstream failures and oversized pages produce clear bounded errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("server error", { status: 500 });
    const failure = (await request("/dictionary-proxy?q=secondaire")).res;
    assert.equal(failure.statusCode, 502);
    assert.match(JSON.parse(failure.body).error, /法语助手返回错误（500）/);
    globalThis.fetch = async () => new Response("x".repeat(2_000_001));
    const oversized = (await request("/dictionary-proxy?q=bonjour")).res;
    assert.equal(oversized.statusCode, 502);
    assert.match(JSON.parse(oversized.body).error, /过大/);
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    assert.match(JSON.parse((await request("/dictionary-proxy?q=bonjour")).res.body).error, /无法连接/);
  } finally { globalThis.fetch = original; }
});
