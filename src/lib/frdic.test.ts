import { test } from "node:test";
import assert from "node:assert/strict";
// XML DOM is supplied by the existing Capacitor CLI dependency; fixtures use well-formed markup.
import { DOMParser } from "@xmldom/xmldom";
import { dictionaryImage, frdicUrl, parseFrdic, loadFrdic } from "./frdic.ts";
const parse = (s: string) => new DOMParser().parseFromString(s, "text/html") as unknown as Document;

test("dictionary URLs safely encode French, Chinese and punctuation", () => {
  assert.equal(new URL(frdicUrl("être lié à #?&")).search, "");
  assert.equal(decodeURIComponent(new URL(frdicUrl("être lié à #?&")).pathname), "/dicts/fr/être lié à #?&");
  assert.equal(dictionaryImage("/tmp/wordimg/example.png"),"https://www.frdic.com/tmp/wordimg/example.png");
  for (const url of ["javascript:alert(1)","https://example.com/tmp/wordimg/a.png","https://www.frdic.com/ads/a.png","https://evil@www.frdic.com/tmp/wordimg/a.png"]) assert.equal(dictionaryImage(url),null);
});

test("only dictionary sections and safe presentation nodes survive; image characters remain", () => {
  const data=parseFrdic(`<html><body><div>advertisement</div><div id="ExpFCchild"><span onclick="evil()" style="display:none">释义</span><br/><img src="/tmp/wordimg/character.png" onerror="evil()"/><a href="javascript:evil()">用法</a><script>evil()</script><iframe src="https://example.com">iframe</iframe><img src="https://example.com/tracker.png"/></div><div id="ExpSYNchild"><p>派生词</p></div><div id="ExpLJchild"><p>例句</p></div></body></html>`,"test",parse);
  assert.deepEqual(data.sections.map(x=>x.title),["释义与用法","近义、反义与派生","例句"]);
  const serialized=JSON.stringify(data.sections);
  for (const text of ["advertisement","evil","onclick","onerror","display:none","iframe","tracker"]) assert.ok(!serialized.includes(text),text);
  assert.ok(serialized.includes("/tmp/wordimg/character.png"));
  assert.ok(serialized.includes("释义"));
  assert.ok(serialized.includes("用法"));
  assert.throws(()=>parseFrdic("<html><body>登录</body></html>","test",parse),/暂未找到/);
});

test("empty and cancelled queries do not contact the dictionary; HTTP errors are clear", async () => {
  await assert.rejects(loadFrdic(" ",new AbortController().signal),/请输入/);
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(loadFrdic("bonjour",cancelled.signal),{name:"AbortError"});
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response("",{status:429});
    await assert.rejects(loadFrdic("test",new AbortController().signal),/429/);
    globalThis.fetch=async()=>{throw new TypeError("Failed to fetch")};
    await assert.rejects(loadFrdic("test",new AbortController().signal),/无法连接/);
  } finally {globalThis.fetch=original;}
});

test("web lookup uses the local forwarder and preserves its upstream error", async () => {
  const original = globalThis.fetch;
  const originalDOM = globalThis.DOMParser;
  try {
    globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
    globalThis.fetch = async (url) => {
      assert.equal(url, "/dictionary-proxy?q=secondaire");
      return Response.json({ html: '<html><div id="ExpFCchild">次要的；中等教育的</div></html>' });
    };
    const data = await loadFrdic("secondaire", new AbortController().signal);
    assert.equal(data.sections[0].title, "释义与用法");
    assert.ok(JSON.stringify(data.sections).includes("次要的"));
    globalThis.fetch = async () => Response.json({ error: "法语助手返回错误（500）" }, { status: 502 });
    await assert.rejects(loadFrdic("erreur", new AbortController().signal), /法语助手返回错误（500）/);
  } finally { globalThis.fetch = original; globalThis.DOMParser = originalDOM; }
});

test("static hosting falls back to direct lookup with no referrer", async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      if (calls === 1) return new Response("<html>app</html>", { headers: { "Content-Type": "text/html" } });
      assert.equal(url, frdicUrl("être lié"));
      assert.equal(options?.referrerPolicy, "no-referrer");
      return new Response("", { status: 500 });
    };
    await assert.rejects(loadFrdic("être lié", new AbortController().signal), /网页直连请求（500）/);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("dictionary presentation roles stay namespaced and related words keep separate rows", () => {
  const data = parseFrdic('<html><div id="ExpFCchild"><span class="eg btn unknown" style="color:red">bonjour<span class="trans">你好</span></span></div><div id="ExpSYNchild"><w>salut<span>招呼</span></w><w>merci<span>谢谢</span></w></div><div id="ExpLJchild"><div class="lj_item"><p class="line">Bonjour</p><p class="exp">你好</p></div></div></html>', 'bonjour', parse);
  const serialized = JSON.stringify(data.sections);
  for (const role of ['frdic-eg', 'frdic-trans', 'frdic-lj_item', 'frdic-line', 'frdic-exp']) assert.ok(serialized.includes(role));
  assert.equal(serialized.split('frdic-related-word').length - 1, 2);
  for (const unsafe of ['unknown', 'btn', 'color:red']) assert.ok(!serialized.includes(unsafe));
});
