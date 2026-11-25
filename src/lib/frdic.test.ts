import { test } from "node:test";
import assert from "node:assert/strict";
// XML DOM is supplied by the existing Capacitor CLI dependency; fixtures use well-formed markup.
import { DOMParser } from "@xmldom/xmldom";
import { dictionaryImage, frdicUrl, parseFrdic, loadFrdic, relationKind } from "./frdic.ts";
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

test("picking: meanings, examples, phrases and relatives are told apart; picture characters become gaps", () => {
  const img = (n: string) => `<img class="dictimgtoword" src="https://www.frdic.com/tmp/wordimg/${n}.png"/>`;
  const data = parseFrdic(`<html><div id="ExpFCchild"><a href="/dicts/cg/x">提示</a><br/><span class="cara">n. m.   </span><br/><span class="exp">1. ${img("a")}${img("b")}，辩护人<br/><span class="eg">avocat conseil ${img("c")}顾问<br/>Cet avocat agit dans l'intérêt de son client. 这位${img("d")}为客户行事<br/></span><br/>2.〈转〉说情人</span><br/><span class="exp">3. avocat du diable</span><br/><span class="exp">（1）诡辩者</span><br/><span class="cara">v. i. </span><br/><span class="eg">Je pense donc je suis. [哲]我思故我在。<br/>Le temps n'est plus où le peuple chinois était humilié.<br/>中国人民的时代已经过去了。</span></div><div id="ExpSYNchild"><div><div><h5>助记：</h5>a在旁边+voc声音</div><p></p><div><h5>派生：</h5><ul><li><a href="/dicts/fr/peut-%c3%aatre">peut-être</a>  ad. 或许</li></ul></div><div><h5>用法：</h5><ul><li>être + adj. 是……的</li></ul></div></div><div class="derivation"><h5>名词变化：</h5><a href="/dicts/fr/avocate">avocate</a><br/></div><h5>近义词：</h5><a href="/dicts/fr/champion">champion</a>, <a href="/dicts/fr/avocat">avocat</a><h5>反义词：</h5><a href="/dicts/fr/juge">juge</a></div><div id="ExpLJchild"><div class="lj_item"><div class="content"><p class="line">Mon oncle est <span class="key">avocat</span>.</p><p class="exp">我${img("e")}是${img("f")}。</p></div></div></div></html>`, "avocat", parse);
  const by = (k: string) => data.items.filter((x) => x.kind === k);
  assert.deepEqual(by("sense").map((x) => [x.pos, x.zh]), [["n.m.", "□□，辩护人"], ["n.m.", "〈转〉说情人"]]);
  assert.deepEqual(by("phrase").map((x) => [x.fr, x.zh]), [["avocat conseil", "□顾问"], ["avocat du diable", "诡辩者"], ["être + adj.", "是……的"]]);
  assert.deepEqual(by("example").map((x) => [x.fr, x.zh]), [
    ["Cet avocat agit dans l'intérêt de son client.", "这位□为客户行事"],
    ["Je pense donc je suis.", "[哲]我思故我在。"],
    ["Le temps n'est plus où le peuple chinois était humilié.", "中国人民的时代已经过去了。"],
    ["Mon oncle est avocat.", "我□是□。"],
  ]);
  assert.deepEqual(by("family").map((x) => [x.fr, x.zh]), [["peut-être", "ad. 或许"], ["avocate", ""]]);
  assert.deepEqual(by("syn").map((x) => x.fr), ["champion"]);
  assert.deepEqual(by("ant").map((x) => x.fr), ["juge"]);
  assert.deepEqual(by("note").map((x) => x.zh), ["助记：a在旁边+voc声音"]);
});

test("the login page is recognised, not reported as a missing word", () => {
  assert.throws(() => parseFrdic("<html><head><title>登录_法语助手在线词典</title></head><body/></html>", "test", parse), /登录页/);
});

test("relation headings drawn with picture characters still map to 近义 / 反义 / 派生", () => {
  assert.equal(relationKind("近□词"), "syn");
  assert.equal(relationKind("近义词"), "syn");
  assert.equal(relationKind("反□词"), "ant");
  assert.equal(relationKind("反义词"), "ant");
  assert.equal(relationKind("□容词变化"), "family");
  assert.equal(relationKind("副□变化"), "family");
  assert.equal(relationKind("名词变化"), "family");
  assert.equal(relationKind("派生"), "family");
  assert.equal(relationKind("联想词"), "");
  assert.equal(relationKind("用法"), "");
});

test("related words: picture-character headings, plain-text antonyms, and 联想词 kept apart", () => {
  const img = (n: string) => `<img class="dictimgtoword" src="https://www.frdic.com/tmp/wordimg/${n}.png"/>`;
  const html = `<html><div id="ExpSYNchild">`
    + `<div class="derivation"><h5>${img("xing")}容词变化：</h5><a href="/dicts/fr/heureuse">heureuse</a><br/></div>`
    + `<div class="derivation"><h5>副${img("ci")}变化：</h5><a href="/dicts/fr/heureusement">heureusement</a><br/></div>`
    + `<h5>近${img("yi")}词：</h5><a href="/dicts/fr/content">content</a>, <a href="/dicts/fr/joyeux">joyeux</a>、ravi`
    + `<h5>反${img("yi2")}词：</h5><a href="/dicts/fr/malheureux">malheureux</a>, triste&#160;chagrinant`
    + `<div><p>désolé</p></div>`
    + `<div class="eudic_wordtype_cont"><h5>联想词</h5><a href="/dicts/fr/chance">chance</a> fortune</div>`
    + `<h5>联想词：</h5><a href="/dicts/fr/bonheur">bonheur</a> gaieté`
    + `</div></html>`;
  const data = parseFrdic(html, "heureux", parse);
  const by = (k: string) => data.items.filter((x) => x.kind === k).map((x) => x.fr);
  assert.deepEqual(by("family"), ["heureuse", "heureusement"]);
  assert.deepEqual(by("syn"), ["content", "joyeux", "ravi"]);
  assert.deepEqual(by("ant"), ["malheureux", "triste", "chagrinant"]);
  for (const loose of ["chance", "fortune", "bonheur", "gaieté", "désolé"]) {
    assert.ok(!data.items.some((x) => x.fr === loose), loose);
  }
});
