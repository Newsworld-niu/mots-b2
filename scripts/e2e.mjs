/* Browser checks for the French edition against a running server (FR_URL, default http://127.0.0.1:5190/).
 * Uses CHROME_PATH if set, macOS Chrome if present, or Playwright's bundled Chromium. Writes screenshots and a JSON log to output/. */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.env.FR_URL ?? "http://127.0.0.1:5190/").replace(/\/?$/, "/");
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CHROME = process.env.CHROME_PATH || (existsSync(MAC_CHROME) ? MAC_CHROME : undefined);
mkdirSync("output/e2e", { recursive: true });
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const SETTINGS = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false });
const settle = (p, ms = 900) => p.waitForTimeout(ms);

const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx.addInitScript((s) => {
  if (!sessionStorage.getItem("seeded")) {
    localStorage.setItem("word-atlas:settings", s);
    sessionStorage.setItem("seeded", "1");
  }
}, SETTINGS);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

// 1) Atlas data loads from the generated lexicon
await page.goto(BASE + "#/atlas");
await page.waitForSelector(".tile");
const expectCount = JSON.parse(await (await fetch(BASE + "atlas/index.json")).text()).count;
await settle(page, 400);
check("atlas lists every lexicon entry", (await page.getByText(`${expectCount.toLocaleString("en-US")} 个结果`).count()) === 1, `expected ${expectCount}`);
const idx = await page.evaluate(async (u) => (await fetch(u)).json(), BASE + "atlas/index.json");
check("index.json carries the French dataset id", idx.id === "francais-b2-lexicon", idx.id);

// 2) Level filter exposes 等级待核实
await page.getByRole("button", { name: "A1", exact: true }).first().click();
await settle(page, 300);
const a1 = idx.words.filter((w) => w[4] === 0).length;
check("level filter A1 shows the estimated A1 words from index.json", (await page.getByText(`${a1.toLocaleString("en-US")} 个结果`).count()) === 1, `A1 words=${a1}`);
// a level only gets a filter button when some word has it; every word now has an estimate
const unv = idx.words.filter((w) => w[4] === 6).length;
const unvButtons = await page.getByRole("button", { name: "等级待核实", exact: true }).count();
check("等级待核实 filter appears exactly when some word has no estimate", unv > 0 ? unvButtons > 0 : unvButtons === 0, `unverified=${unv} buttons=${unvButtons}`);

// 3) Entry sheet: estimated level, numbered meanings, translated examples, collocations
await page.goto(BASE + "#/atlas?w=entretien");
await page.waitForSelector(".sheet .headword");
await settle(page, 500);
const sheetText = await page.locator(".sheet").innerText();
check("entry sheet shows its 推定 level", /推定 (A1|A2|B1|B2)/.test(sheetText));
check("entry sheet shows each meaning and a translated example", /面试/.test(sheetText) && /维护/.test(sheetText) && /entretien d'embauche lundi matin/.test(sheetText) && /求职面试/.test(sheetText));
check("entry sheet shows collocations", /常用搭配/.test(sheetText) && /passer un entretien/.test(sheetText));
await page.screenshot({ path: "output/e2e/entry-sheet.png" });
await page.keyboard.press("Escape");

// 4) Learning session: intro cards, quiz kinds, summary, progress persisted
await page.goto(BASE + "#/");
await page.getByRole("button", { name: /开始今天的旅程/ }).click();
await page.waitForURL(/#\/learn/);
await settle(page, 600);
await page.screenshot({ path: "output/e2e/learn-first-step.png" });
let answered = 0, intros = 0;
const kinds = new Set();
for (let i = 0; i < 300; i++) {
  if (await page.locator(".summary").count()) break;
  // the intro card's verdicts: 不认识 / 认识 / 完全认识
  const introBtn = page.locator(".intro-verdicts button").filter({ hasText: /^认识/ }).first();
  if (await introBtn.count()) {
    intros++;
    await introBtn.click();
    await settle(page, 150);
    continue;
  }
  if (await page.locator(".option:not([disabled])").count()) {
    kinds.add("option");
    answered++;
    await page.locator(".option:not([disabled])").first().click();
  } else if (await page.locator(".spell-input").count()) {
    kinds.add("spell");
    answered++;
    await page.locator(".spell-input").first().fill("zzz");
    await page.keyboard.press("Enter");
  } else { await settle(page, 200); }
  await settle(page, 150);
  const cont = page.getByRole("button", { name: /^(继续|下一题)/ }).first();
  if (await cont.count()) {
    await cont.click();
    await settle(page, 120);
  }
  if (answered > 200) break;
}
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null"));
check("learning session runs and saves progress", answered > 0 && stored && Object.keys(stored.cards || {}).length > 0, `answered=${answered} intros=${intros} cards=${Object.keys(stored?.cards || {}).length}`);
check("progress stored under word-atlas:v2:francais-b2-lexicon", stored?.datasetId === "francais-b2-lexicon");

// 5) Practice: typing a French sentence is scored with accents respected
await page.goto(BASE + "#/practice");
await settle(page, 700);
check("practice page renders its own heading", (await page.getByText("听、读、写、说，分科击破。").count()) === 1);
await page.screenshot({ path: "output/e2e/practice.png" });

// 6) Migration: a prototype payload (mots-b2:v1) is carried over on first load
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
const legacy = {
  progress: {
    version: 1,
    cards: {
      entretien: { due: Date.now() + 86400000 * 3, s: 9, d: 4, el: 2, sd: 6, ls: 0, reps: 4, lapses: 0, st: 2, seen: Date.now() - 86400000 * 30, last: Date.now() - 86400000 },
      pollution: { due: Date.now() - 1000, s: 0.5, d: 6, el: 0, sd: 0, ls: 2, reps: 1, lapses: 1, st: 1, seen: Date.now() - 86400000 * 2 },
    },
    bookmarks: ["entretien"],
    days: {},
    typing: [],
    session: null,
    mistakes: ["pollution"],
  },
  settings: { dailyNew: 12, retention: 0.9, autoplay: true, spell: true, theme: "dark" },
};
await ctx2.addInitScript((payload) => {
  if (!sessionStorage.getItem("legacy-seeded")) {
    localStorage.setItem("mots-b2:v1", payload);
    localStorage.setItem("word-atlas:settings", JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false }));
    sessionStorage.setItem("legacy-seeded", "1");
  }
}, JSON.stringify(legacy));
const p2 = await ctx2.newPage();
await p2.goto(BASE + "#/me");
await settle(p2, 1200);
const migrated = await p2.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null"));
check("legacy prototype cards are migrated to v2 storage", Object.keys(migrated?.cards || {}).length === 2, `cards=${Object.keys(migrated?.cards || {}).length}`);
check("migrated bookmark and mistake are kept", migrated?.bookmarks?.[0] === "entretien" && migrated?.mistakes?.[0] === "pollution");
check("migrated reps survive the v2 validator", migrated?.cards?.entretien?.reps === 4 && migrated?.cards?.entretien?.s === 9);
check("migrated card ids still exist in the atlas with the same lemma", idx.words.some((w) => w[0] === "entretien" && w[1] === "entretien") && idx.words.some((w) => w[0] === "pollution" && w[1] === "pollution"));
await p2.goto(BASE + "#/");
await settle(p2, 1000);
const learnedText = await p2.locator(".mini-stats").first().innerText().catch(() => "");
check("Today shows the migrated words as learned", /2/.test(learnedText), learnedText.replace(/\s+/g, " ").slice(0, 80));
await p2.screenshot({ path: "output/e2e/today-migrated.png" });
await ctx2.close();

// 7) Noun articles, the un/une drill and the 变位 section
await page.goto(BASE + "#/atlas?w=maison");
await page.waitForSelector(".sheet .headword");
check("noun sheet shows its indefinite article (une maison)", (await page.locator(".sheet .headword .art").first().textContent()) === "une");
await page.keyboard.press("Escape");
await page.goto(BASE + "#/practice");
await settle(page, 500);
await page.locator(".mode-cards .mode-card", { hasText: /名词性数/ }).click();
await page.getByRole("button", { name: "学习路线" }).click();
await page.getByRole("button", { name: "开始一轮" }).click();
await settle(page, 400);
check("un/une drill starts with two article buttons", (await page.locator(".options-gender .option").count()) === 2);
await page.goto(BASE + "#/conj");
await page.waitForSelector(".conj-stats");
check("变位 section lists the verbs learned in the session above", !/可练动词\s*0/.test(await page.locator(".conj-stats").innerText()));
await page.goto(BASE + "#/atlas?w=etre");
await page.waitForSelector(".sheet .headword");
await page.locator(".conj-entry summary").click();
await page.getByRole("tab", { name: "imparfait" }).click();
check("verb sheet shows conjugation tables (j'étais)", (await page.locator(".conj-entry .conj-table").innerText()).replace(/\s+/g, " ").trim().startsWith("j'étais"));
await page.keyboard.press("Escape");

// 8) 篇章写作 without an AI service: draft kept, saved, checked against the grid by the learner
const LETTER = [
  "Chère Julie,",
  "Merci beaucoup pour ton message et pour ta gentille invitation. Je suis très contente de savoir que tu organises une fête pour ton anniversaire samedi prochain.",
  "Malheureusement, je ne pourrai pas venir le soir parce que je dois travailler jusqu'à vingt heures. Hier, je suis allée voir mon chef et il fait beau, mais il n'a pas voulu changer mon emploi du temps.",
  "En revanche, je peux passer chez toi dans l'après-midi pour t'aider à préparer le repas et à décorer la maison. Je pourrais aussi apporter un gâteau au chocolat, puisque tu l'aimes beaucoup.",
  "Dis-moi si cela te convient et à quelle heure je peux arriver. J'ai hâte de te voir et de rencontrer tes nouveaux amis de l'université.",
  "Je t'embrasse très fort,",
  "Claire",
].join("\n\n");
const openStudio = async (p, card) => {
  await p.goto(BASE + "#/practice");
  await p.locator(".practice-exam-grid .mode-card").first().waitFor({ timeout: 5000 });
  await p.locator(".practice-exam-grid .mode-card").filter({ hasText: card }).first().click();
  await settle(p, 500);
};
const progressOf = (p) =>
  p.evaluate(async () => {
    const raw = JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null");
    if (!raw || typeof indexedDB === "undefined") return raw;
    try {
      const heavy = await new Promise((resolve) => {
        const req = indexedDB.open("fb2-vault", 1);
        req.onupgradeneeded = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("heavy")) { db.close(); return resolve(null); }
          const r = db.transaction("heavy", "readonly").objectStore("heavy").get("francais-b2-lexicon");
          r.onsuccess = () => { db.close(); resolve(r.result ?? null); };
          r.onerror = () => { db.close(); resolve(null); };
        };
        req.onerror = () => resolve(null);
      });
      if (heavy?.essays && !raw.essays?.length) raw.essays = heavy.essays;
      if (heavy?.texts && !raw.texts?.length) raw.texts = heavy.texts;
    } catch {}
    return raw;
  });

await openStudio(page, "篇章写作");
check("篇章 studio opens on its task list", (await page.getByText("把句子，连成一篇。").count()) === 1);
check("篇章 without AI says marking needs an AI service", (await page.getByText(/还没有设置 AI 接口/).count()) > 0);
const recTitle = (await page.locator(".essay-task.is-rec b").innerText()).trim();
await page.locator(".essay-task.is-rec").click();
await page.locator(".essay-input").fill(LETTER);
await settle(page, 300);
check("篇章 counts the words as you write", /^\d+ 词 · (?:要求|至少)/.test((await page.locator(".essay-count").innerText()).trim()), await page.locator(".essay-count").innerText());
await page.getByRole("button", { name: /返回题目/ }).click();
await settle(page, 300);
check("篇章 keeps the draft and marks the task 有草稿", /有草稿/.test(await page.locator(".essay-task", { hasText: recTitle }).first().innerText()));
await page.locator(".essay-task", { hasText: recTitle }).first().click();
check("篇章 reopens the draft", (await page.locator(".essay-input").inputValue()) === LETTER);
await page.getByRole("button", { name: /保存并自己检查/ }).click();
await settle(page, 400);
check("篇章 without AI shows the five-part grid to check by yourself", (await page.getByText("离线对照官方评分表自评（0–5 分）").count()) === 1 && (await page.locator(".speak-rubric-row").count()) === 5);
const p8 = await progressOf(page);
check("篇章 saves the unmarked essay and clears the draft", p8?.essays?.length === 1 && !p8.essays[0].fb && !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("fb2.essay.draft.")))));

// 9–11) The AI studios with the AI service answered by the test: nothing leaves the machine, every answer is fixed
const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx3.addInitScript((s) => {
  if (!sessionStorage.getItem("ai-seeded")) {
    localStorage.setItem("word-atlas:settings", s);
    localStorage.setItem("word-atlas:ai:v1", JSON.stringify({ keys: { openai: "e2e-test-key" }, text: { provider: "openai", model: "gpt-5-mini" } }));
    sessionStorage.setItem("ai-seeded", "1");
  }
  // device speech that "finishes" at once and remembers what it read; no speech recognition (typed answers)
  const spoken = [];
  window.__spoken = spoken;
  const synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    speak(u) { spoken.push(u.text); setTimeout(() => u.onend?.(new Event("end")), 20); },
    cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
  Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
}, SETTINGS);
const p3 = await ctx3.newPage();
p3.on("pageerror", (e) => errors.push(`pageerror (AI studios): ${e.message}`));
p3.on("console", (m) => m.type() === "error" && errors.push(`console (AI studios): ${m.text()}`));

const aiCalls = [];
const sent = (name, k = 0) => aiCalls.filter((c) => c.name === name)[k]?.input;
const marks = (scores, corrections, rewrite) => ({ scores, comment: "整体清楚，时态还要注意。", strengths: ["回应了邀请"], todo: ["注意过去时的配合"], corrections, rewrite });
const ERR = { wrong: "il fait beau", right: "il faisait beau", type: "tense", why: "过去的背景用未完成过去时。", point: "imparfait" };
const SAY = "Je pense que les écrans prennent trop de place dans la vie des enfants. D'abord, ils dorment moins. Ensuite, ils bougent moins. Cependant, les outils numériques peuvent aussi aider à apprendre.";
const longDoc = (n) => `Document ${n}. ` + "Selon une étude récente, de plus en plus de jeunes Français choisissent de travailler à distance, mais beaucoup regrettent le manque de contacts avec leurs collègues. ".repeat(5);
const QS = (doc) => [0, 1, 2].map((a) => ({ doc, q: `Selon le document, la question ${a + 1}…`, options: ["augmente", "diminue", "reste stable"], answer: a, why: "见第一段。", difficulty: a + 1 }));
const MOCK = {
  essay_marking: (k) => (k === 0 ? marks({ task: 3, coherence: 3, socio: 3, lexique: 3, morpho: 3 }, [ERR], LETTER.replace("il fait beau", "il faisait beau")) : marks({ task: 3, coherence: 3, socio: 3, lexique: 5, morpho: 3 }, [], "")),
  essay_model: () => ({ text: "Chère Julie,\n\nMerci mille fois pour ton invitation…", patterns: [{ fr: "Merci mille fois pour", zh: "非常感谢" }] }),
  essay_task: () => ({ title: "邀请同学参加读书会", situation: "你在学校组织读书会，给同学写邮件。", consigne: "Vous écrivez un courriel pour inviter vos camarades.", doc: "", topic: "", points: ["说明时间地点", "介绍活动", "请对方回复"], plan: [{ zh: "称呼", fr: "Chers amis, …" }, { zh: "说明活动", fr: "Je vous écris pour…" }, { zh: "结尾", fr: "À bientôt, …" }], phrases: [{ fr: "J'espère vous y voir.", zh: "希望在那儿见到你们。" }] }),
  comprehension: (_k, input) =>
    input.form === "short"
      ? { intro: "Vous écoutez trois enregistrements.", title: "Le travail", docs: [1, 2, 3].map((n) => ({ text: longDoc(n), zh: "译文" })), questions: [0, 0, 1, 1, 2, 2].map((d, j) => ({ ...QS(d)[j % 2 === 0 ? 0 : 1], doc: d })) }
      : { intro: "Vous lisez l'opinion de ces trois personnes sur un forum…", title: "Faut-il travailler à distance ?", docs: [{ text: `Léa\n${longDoc(1)}\nMarc\n${longDoc(2)}\nSonia\n${longDoc(3)}`, zh: "译文" }], questions: [0, 1, 2, 0, 1, 2].map((a, j) => ({ doc: 0, q: `Point de vue ${j + 1}`, options: ["Léa", "Marc", "Sonia"], answer: a, why: "见原文。", difficulty: 3 })) },
  comprehension_blind_solver: (_k, input) => ({
    items: (input.questions ?? []).map((q, i) => ({
      index: q.index ?? i,
      answer: q.options?.[0] === "Léa" ? i % 3 : i % 2 === 0 ? 0 : 1,
      ambiguousDistractor: false,
      reason: "见原文。",
    })),
  }),
  debate_question: (k) => ({ question: k === 0 ? "Vous dites que les enfants dorment moins : avez-vous un exemple concret ?" : "Certains diraient que l'école doit utiliser les écrans. Qu'en pensez-vous ?" }),
  speaking_assessment: () => marks({ monologue: 3, interaction: 3, lexique: 3, morpho: 1 }, [{ wrong: "ils bougent moins", right: "ils bougent moins", type: "other", why: "", point: "" }], "Je suis convaincu que…"),
};
const answerAi = async (route) => {
  const req = route.request();
  if (/\/ping$/.test(req.url())) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  let body = {};
  try { body = JSON.parse(req.postData() || "{}"); } catch {}
  const name = body.response_format?.json_schema?.name ?? "?";
  const user = body.messages?.[1]?.content;
  let input = {};
  try { input = JSON.parse(Array.isArray(user) ? user[0].text : user); } catch {}
  const k = aiCalls.filter((c) => c.name === name).length;
  aiCalls.push({ name, input, auth: req.headers().authorization });
  const make = MOCK[name];
  if (!make) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: `no mock for ${name}` } }) });
  await new Promise((r) => setTimeout(r, 150));
  return route.fulfill({ contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(make(k, input)) }, finish_reason: "stop" }] }) });
};
// the local forwarder is refused (404 on its ping), so requests go to the service itself, where the test answers
await ctx3.route(/\/ai-proxy\//, answerAi);
for (const host of ["https://api.openai.com/**", "https://api.deepseek.com/**", "https://api.anthropic.com/**", "https://openrouter.ai/**"]) await ctx3.route(host, answerAi);

// 9) 篇章写作 with AI: marked on the grid, a correction kept in the 错句本, a second draft compared, a model text, a new task
await openStudio(p3, "篇章写作");
const aiTitle = (await p3.locator(".essay-task.is-rec b").innerText()).trim();
await p3.locator(".essay-task.is-rec").click();
await p3.locator(".essay-input").fill(LETTER);
await p3.getByRole("button", { name: /交给 AI 批改/ }).click();
await p3.waitForSelector(".essay-total", { timeout: 10000 }).catch(() => {});
check("篇章 sends the essay with its task for marking", sent("essay_marking")?.learnerText === LETTER && !!sent("essay_marking")?.instruction && aiCalls[0]?.auth === "Bearer e2e-test-key");
check("篇章 shows the grid score (5 × 3 = 15/25)", (await p3.locator(".essay-total").first().innerText()).replace(/\s+/g, "") === "15/25");
check("篇章 shows the corrected version", (await p3.getByText("改好的版本").count()) === 1);
await p3.locator("summary", { hasText: "逐处修改" }).first().click();
await p3.getByRole("button", { name: /存进错句本/ }).first().click();
await settle(p3, 300);
check("篇章 keeps a correction in the 错句本", (await progressOf(p3))?.essayNotes?.length === 1 && (await p3.getByRole("button", { name: /已存进错句本/ }).count()) === 1);
await p3.getByRole("button", { name: /照批改改一稿/ }).click();
const second = (await p3.locator(".essay-input").inputValue()).replace("il fait beau", "il faisait beau");
await p3.locator(".essay-input").fill(second);
await p3.getByRole("button", { name: /交第二稿/ }).click();
await p3.waitForSelector(".essay-gain", { timeout: 10000 }).catch(() => {});
check("篇章 marks the second draft and shows the gain (15 → 17, +2)", /15\s*17\s*\/25\s*\+2/.test((await p3.locator(".essay-gain").innerText().catch(() => "")).replace(/\n/g, " ")));
check("篇章 counts the first draft's error as fixed", /改掉了 1 处/.test(await p3.locator(".essay-rev").innerText().catch(() => "")));
await p3.getByRole("button", { name: /看范文/ }).click();
await p3.waitForSelector(".essay-model", { timeout: 10000 }).catch(() => {});
check("篇章 shows a model text with patterns to reuse", /Merci mille fois pour/.test(await p3.locator(".essay-model").innerText().catch(() => "")) && sent("essay_model")?.learnerText === second);
await p3.getByRole("button", { name: /返回题目/ }).click();
await settle(p3, 300);
check("篇章 history lists both drafts' scores", /15\/25 → 二稿 17\/25/.test(await p3.locator(".essay-history").innerText()) && /错句本（1）/.test(await p3.locator("main").innerText()));
await p3.getByRole("button", { name: /出题并开始写/ }).click();
await p3.waitForSelector(".essay-title", { timeout: 10000 }).catch(() => {});
await settle(p3, 500);
const newTitle = await p3.locator(".essay-title").innerText().catch(() => "");
const keptTasks = (await progressOf(p3))?.essayTasks?.length;
check("篇章 opens a new AI task and keeps it", newTitle === "邀请同学参加读书会" && keptTasks === 1, `title=${newTitle} kept=${keptTasks} calls=${aiCalls.map((c) => c.name).join(",")}`);
check("篇章 asks for the new task away from the written titles", Array.isArray(sent("essay_task")?.avoid) && !!aiTitle);

// 10) 听力理解: three short recordings, read aloud at the exam's rhythm, answered and scored
await openStudio(p3, "听力理解");
await p3.getByRole("button", { name: /三段短录音/ }).click();
await p3.getByRole("button", { name: /出一个练习/ }).click();
await p3.waitForSelector(".exam-exercise", { timeout: 10000 }).catch(() => {});
check("听力 asks for a short-recordings exercise", sent("comprehension")?.kind === "listen" && sent("comprehension")?.form === "short" && sent("comprehension")?.questions === 6);
check("听力 hides the documents before they are heard", (await p3.locator(".exam-doc").count()) === 0 && (await p3.locator(".exam-option").count()) === 18);
await p3.getByRole("button", { name: /开始这个练习/ }).click();
for (let i = 0; i < 120 && !(await p3.getByText("这个练习的录音已经放完").count()); i++) {
  const skipBtn = p3.getByRole("button", { name: /跳过等待/ });
  if (await skipBtn.count()) await skipBtn.click().catch(() => {});
  await settle(p3, 150);
}
const spoken = await p3.evaluate(() => window.__spoken ?? []);
check("听力 reads all three recordings aloud, once each", (await p3.getByText("这个练习的录音已经放完").count()) === 1 && [1, 2, 3].every((n) => spoken.filter((t) => t.includes(`Document ${n}.`)).length === 1), `spoken pieces=${spoken.length}`);
const lq = p3.locator(".exam-questions > li");
for (let j = 0; j < (await lq.count()); j++) await lq.nth(j).locator(".exam-option").nth(j % 2 === 0 ? 0 : 1).click();
await p3.getByRole("button", { name: /交卷/ }).click();
await settle(p3, 300);
check("听力 scores every right answer (7/7)", (await p3.locator(".essay-total").innerText()).replace(/\s+/g, "") === "7/7" && (await p3.locator(".exam-option.is-wrong").count()) === 0);
check("听力 shows the transcripts after the answers", (await p3.locator(".exam-doc").count()) === 3);
check("听力 logs the score", (await progressOf(p3))?.examLog?.some((r) => r.part === "listen" && r.score === 7 && r.total === 7));

// 应试阅读 (same studio, reading form): 三人观点, every answer wrong
await openStudio(p3, "应试阅读");
await p3.getByRole("button", { name: /三人观点/ }).click();
await p3.getByRole("button", { name: "不限时" }).click();
await p3.getByRole("button", { name: /出一个练习/ }).click();
await p3.waitForSelector(".exam-exercise", { timeout: 10000 }).catch(() => {});
check("阅读 shows the text at once and the three names as options", (await p3.locator(".exam-doc").count()) === 1 && (await p3.locator(".exam-questions > li").first().locator(".exam-option").allInnerTexts()).join(" ").includes("Marc"));
const rq = p3.locator(".exam-questions > li");
for (let j = 0; j < (await rq.count()); j++) await rq.nth(j).locator(".exam-option").nth(((j % 3) + 1) % 3).click();
await p3.getByRole("button", { name: /交卷/ }).click();
await settle(p3, 300);
check("阅读 scores every wrong answer (0/7) and marks them", (await p3.locator(".essay-total").innerText()).replace(/\s+/g, "") === "0/7" && (await p3.locator(".exam-option.is-wrong").count()) === 6);

// 11) 口语: draw, prepare, talk (typed), debate with the AI examiner, marked on four criteria plus self-rated pronunciation
await openStudio(p3, "PO 口语独白与辩论");
await p3.getByRole("button", { name: /抽内置题库|抽两个题/ }).click();
check("口语 draws two subjects", (await p3.locator(".exam-draw .essay-task").count()) === 2);
await p3.locator(".exam-draw .essay-task").first().click();
check("口语 starts the 30-minute preparation", /准备 (30:00|29:5\d)/.test(await p3.locator(".exam-top").innerText()));
await p3.getByRole("button", { name: /准备好了/ }).click();
await p3.getByRole("button", { name: /说完了/ }).click();
await p3.getByLabel("你说的内容").fill(SAY);
await p3.getByRole("button", { name: /进入辩论/ }).click();
await p3.waitForSelector(".exam-live .exam-q", { timeout: 10000 }).catch(() => {});
const q1 = await p3.locator(".exam-live .exam-q").innerText().catch(() => "");
check("口语 examiner asks about the talk and reads the question aloud", /dorment moins/.test(q1) && sent("debate_question")?.talk === SAY && (await p3.evaluate(() => window.__spoken)).includes(q1));
await p3.getByLabel("你的回答").fill("Oui, mon petit frère joue sur sa tablette tard le soir.");
await p3.getByRole("button", { name: /下一个问题/ }).click();
await p3.waitForFunction(() => /Certains diraient/.test(document.querySelector(".exam-live .exam-q")?.textContent ?? ""), null, { timeout: 10000 }).catch(() => {});
check("口语 second question carries the first exchange", sent("debate_question", 1)?.exchanges?.[0]?.candidate?.includes("petit frère") && (await p3.locator(".exam-debate li").count()) === 1);
await p3.getByLabel("你的回答").fill("Je pense que l'école peut les utiliser, mais avec des limites.");
await p3.getByRole("button", { name: /结束辩论，批改/ }).click();
await p3.waitForSelector(".essay-total", { timeout: 10000 }).catch(() => {});
check("口语 sends the talk and both answers for marking", sent("speaking_assessment")?.talk === SAY && sent("speaking_assessment")?.debate?.length === 2);
// Short typed monologue (<80w) + 2-turn debate (<3 turns) triggers real calibration caps (0+1+1+1 = 3/20, +3 pron = 6/25)
check("口语 calibrates and shows the four AI criteria (0+1+1+1 = 3/20)", (await p3.locator(".essay-total").innerText().catch(() => "")).replace(/\s+/g, "") === "3/20");
await p3.locator(".essay-box .segmented button", { hasText: /^3 ·/ }).click();
check("口语 adds the self-rated pronunciation (6/25)", (await p3.locator(".essay-total").innerText()).replace(/\s+/g, "") === "6/25");
await settle(p3, 400); // progress is saved 250 ms after a change
check("口语 updates examLog score out of 25 with typed marker", (await progressOf(p3))?.examLog?.some((r) => r.part === "speak" && r.score === 6 && r.total === 25 && r.typed === true));
await p3.screenshot({ path: "output/e2e/speaking-result.png", fullPage: true });
check("AI studios never reached a real AI service", aiCalls.length > 0 && aiCalls.every((c) => MOCK[c.name]), aiCalls.map((c) => c.name).join(","));
await ctx3.close();

check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync("output/e2e/results.json", JSON.stringify(checks, null, 2));
await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
