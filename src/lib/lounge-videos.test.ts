import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CURATED_YOUTUBE_VIDEOS,
  loadSampleVideoCues,
  OPEN_SAMPLE_VIDEOS,
} from "./lounge-videos";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

const VTT_ARROW_RE =
  /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})$/;
const YT_ID_RE = /^[\w-]{11}$/;
const HAN_RE = /[\u4e00-\u9fff]/;
const LATIN_RE = /[A-Za-zÀ-ÿ]/;

function toSeconds(ts: string): number {
  const [h = "0", m = "0", rest = "0.0"] = ts.split(":");
  const [s = "0", ms = "0"] = rest.split(".");
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

describe("OPEN_SAMPLE_VIDEOS & bilingual WebVTT files", () => {
  it("defines 3 open CC / public-domain sample videos with valid https Wikimedia URLs", () => {
    assert.equal(OPEN_SAMPLE_VIDEOS.length, 3);

    const ids = new Set<string>();
    for (const video of OPEN_SAMPLE_VIDEOS) {
      assert.equal(video.kind, "open");
      assert.ok(video.id.length > 0);
      assert.ok(!ids.has(video.id), `Duplicate sample video id: ${video.id}`);
      ids.add(video.id);

      assert.match(video.videoUrl, /^https:\/\/upload\.wikimedia\.org\/.+\.webm$/);
      if (video.posterUrl) {
        assert.match(video.posterUrl, /^https:\/\/upload\.wikimedia\.org\/.+/);
      }
      assert.ok(video.durationSec > 60, `${video.id} should have realistic durationSec`);
      assert.ok(video.durationLabel.length > 0);
      assert.ok(video.summaryZh.length >= 30);
      assert.ok(video.cultureNoteZh.length >= 30);
      assert.ok(
        video.keyExpressions.length >= 3 && video.keyExpressions.length <= 5,
        `${video.id} should have 3–5 keyExpressions`,
      );
      for (const expr of video.keyExpressions) {
        assert.ok(expr.fr.trim().length > 0);
        assert.ok(HAN_RE.test(expr.zh));
      }
    }

    const caminandes = OPEN_SAMPLE_VIDEOS.find((v) => v.id === "caminandes");
    const melies = OPEN_SAMPLE_VIDEOS.find((v) => v.id === "melies-lune");
    const sintel = OPEN_SAMPLE_VIDEOS.find((v) => v.id === "sintel");

    assert.ok(caminandes && caminandes.energy === 1 && caminandes.level === "A2" && caminandes.ttsNarration === true);
    assert.ok(melies && melies.energy === 1 && melies.level === "B1" && melies.ttsNarration === true);
    assert.ok(sintel && sintel.energy === 2 && sintel.level === "B2");
  });

  it("ships valid WEBVTT files on disk with >=12 well-timed bilingual cues each", () => {
    for (const video of OPEN_SAMPLE_VIDEOS) {
      const diskPath = path.join(PUBLIC_DIR, video.vttPath.replace(/^\//, ""));
      assert.ok(fs.existsSync(diskPath), `Missing VTT file on disk: ${diskPath}`);

      const raw = fs.readFileSync(diskPath, "utf8").replace(/\r\n?/g, "\n").trim();
      assert.ok(raw.startsWith("WEBVTT"), `${video.vttPath} must start with WEBVTT`);

      const blocks = raw.split(/\n{2,}/).slice(1);
      assert.ok(
        blocks.length >= 12 && blocks.length <= 20,
        `${video.vttPath} expected 14–20 (>=12) cues, found ${blocks.length}`,
      );

      let prevEnd = 0;
      for (const [idx, block] of blocks.entries()) {
        const lines = block.split("\n").map((l) => l.trim());
        assert.equal(
          lines.length,
          3,
          `${video.vttPath} cue #${idx + 1} must have timestamp + French + Chinese (3 lines)`,
        );

        const [tsLine = "", frLine = "", zhLine = ""] = lines;
        const tsMatch = tsLine.match(VTT_ARROW_RE);
        assert.ok(tsMatch, `${video.vttPath} cue #${idx + 1} has invalid timestamp: ${tsLine}`);

        const start = toSeconds(tsMatch[1] ?? "00:00:00.000");
        const end = toSeconds(tsMatch[2] ?? "00:00:00.000");
        assert.ok(start >= prevEnd, `${video.vttPath} cue #${idx + 1} overlaps previous cue`);
        assert.ok(end > start, `${video.vttPath} cue #${idx + 1} end must exceed start`);
        assert.ok(
          end <= video.durationSec,
          `${video.vttPath} cue #${idx + 1} exceeds durationSec (${end} > ${video.durationSec})`,
        );
        prevEnd = end;

        assert.ok(LATIN_RE.test(frLine), `${video.vttPath} cue #${idx + 1} line 1 should be French`);
        assert.ok(HAN_RE.test(zhLine), `${video.vttPath} cue #${idx + 1} line 2 should be Chinese`);
      }
    }
  });

  it("loads and parses bilingual sample cues via loadSampleVideoCues", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      requestedUrls.push(urlStr);
      const diskPath = path.join(PUBLIC_DIR, urlStr.replace(/^\//, ""));
      if (!fs.existsSync(diskPath)) {
        return new Response("Not Found", { status: 404 });
      }
      const content = fs.readFileSync(diskPath, "utf8");
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/vtt; charset=utf-8" },
      });
    }) as typeof fetch;

    try {
      for (const video of OPEN_SAMPLE_VIDEOS) {
        const cues = await loadSampleVideoCues(video.vttPath);
        assert.ok(cues.length >= 14, `${video.id} should parse >=14 cues`);
        for (const cue of cues) {
          assert.ok(cue.end > cue.start);
          assert.ok(LATIN_RE.test(cue.fr));
          assert.ok(cue.zh && HAN_RE.test(cue.zh));
        }
      }
      assert.deepEqual(requestedUrls, [
        "/materials/videos/caminandes-fr.vtt",
        "/materials/videos/melies-lune-fr.vtt",
        "/materials/videos/sintel-fr.vtt",
      ]);

      await assert.rejects(
        () => loadSampleVideoCues("/materials/videos/non-existent.vtt"),
        /Failed to load subtitles \(404\)/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("CURATED_YOUTUBE_VIDEOS", () => {
  it("contains 14 curated French YouTube videos with valid 11-char IDs and rich study metadata", () => {
    assert.equal(CURATED_YOUTUBE_VIDEOS.length, 14);

    const ids = new Set<string>();
    const ytIds = new Set<string>();
    const energyCounts = new Map<number, number>();
    const levels = new Set<string>();

    for (const item of CURATED_YOUTUBE_VIDEOS) {
      assert.equal(item.kind, "youtube");
      assert.ok(!ids.has(item.id), `Duplicate id: ${item.id}`);
      ids.add(item.id);

      assert.match(item.youtubeId, YT_ID_RE, `Invalid YouTube ID on ${item.id}: ${item.youtubeId}`);
      assert.ok(!ytIds.has(item.youtubeId), `Duplicate YouTube ID: ${item.youtubeId}`);
      ytIds.add(item.youtubeId);

      assert.equal(
        item.fallbackUrl,
        `https://www.youtube.com/watch?v=${item.youtubeId}`,
        `Mismatched fallbackUrl on ${item.id}`,
      );
      assert.match(item.fallbackUrl, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);

      assert.ok(item.channel.trim().length > 0);
      assert.ok(item.title.trim().length > 0);
      assert.ok(HAN_RE.test(item.titleZh));
      assert.ok(item.durationLabel.trim().length > 0);
      assert.ok(item.tags.length >= 2);
      assert.ok(item.summaryZh.length >= 30);
      assert.ok(item.cultureNoteZh.length >= 30);

      assert.ok(
        item.keyExpressions.length >= 3 && item.keyExpressions.length <= 5,
        `${item.id} must have 3–5 keyExpressions`,
      );
      for (const expr of item.keyExpressions) {
        assert.ok(LATIN_RE.test(expr.fr));
        assert.ok(HAN_RE.test(expr.zh));
        assert.ok(expr.note && expr.note.trim().length > 0);
      }

      energyCounts.set(item.energy, (energyCounts.get(item.energy) ?? 0) + 1);
      levels.add(item.level);
    }

    assert.ok((energyCounts.get(1) ?? 0) >= 3, "Must cover Energy tier 1");
    assert.ok((energyCounts.get(2) ?? 0) >= 3, "Must cover Energy tier 2");
    assert.ok((energyCounts.get(3) ?? 0) >= 3, "Must cover Energy tier 3");
    assert.deepEqual(levels, new Set(["A2", "B1", "B2"]));

    const brutVideos = CURATED_YOUTUBE_VIDEOS.filter((v) => v.channel === "Brut");
    assert.ok(brutVideos.length >= 1);
    for (const b of brutVideos) {
      assert.equal(b.hasBurnedInSubs, true);
    }
  });
});
