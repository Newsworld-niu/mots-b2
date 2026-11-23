import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LOUNGE_BOOKS,
  RECOMMENDED_PRIVATE_BOOKS,
  loadBookChapter,
} from "./lounge-books";
import { LOUNGE_MICRO_READS, MICRO_READ_CATEGORIES } from "./lounge-reads";
import type { BookChapterData, LoungeBookMeta } from "./lounge-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const BOOKS_DIR = path.join(ROOT_DIR, "public/materials/books");
const CONTENT_LICENSE_PATH = path.join(ROOT_DIR, "CONTENT_LICENSE.md");

function countFrenchWords(paragraphs: readonly string[]): number {
  const matches = paragraphs.join(" ").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

describe("Curated Public-Domain Books & Manifest", () => {
  it("exports 5 pre-1931 dual-PD books with 3 chapters each (15 chapters total)", () => {
    assert.equal(LOUNGE_BOOKS.length, 5);
    const expectedIds = [
      "daudet-moulin",
      "renard-perrault",
      "lupin",
      "maupassant",
      "colette-betes",
    ];
    assert.deepEqual(
      LOUNGE_BOOKS.map((b) => b.id),
      expectedIds,
    );

    for (const book of LOUNGE_BOOKS) {
      assert.ok(
        book.year <= 1930,
        `${book.id} must be published <= 1930, got ${book.year}`,
      );
      assert.equal(book.chapters.length, 3, `${book.id} must have 3 chapters`);
      assert.ok(book.summaryZh.trim().length >= 15);
      assert.ok(book.licenseNote.trim().length >= 10);
      assert.ok(book.moodTags.length >= 2);
    }
  });

  it("mirrors LOUNGE_BOOKS in public/materials/books/manifest.json", () => {
    const manifestPath = path.join(BOOKS_DIR, "manifest.json");
    assert.ok(fs.existsSync(manifestPath), "manifest.json must exist on disk");
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as LoungeBookMeta[];
    assert.deepEqual(manifest, LOUNGE_BOOKS);
  });

  it("validates all 15 chapter JSON shards on disk for alignment, word count, and size", () => {
    let chapterCount = 0;
    for (const book of LOUNGE_BOOKS) {
      for (const chMeta of book.chapters) {
        chapterCount += 1;
        const shardPath = path.join(BOOKS_DIR, book.id, `${chMeta.id}.json`);
        assert.ok(
          fs.existsSync(shardPath),
          `Missing chapter shard: ${shardPath}`,
        );
        const raw = fs.readFileSync(shardPath, "utf8");
        const shard = JSON.parse(raw) as BookChapterData;

        assert.equal(shard.bookId, book.id);
        assert.equal(shard.chapterId, chMeta.id);
        assert.ok(shard.title.trim().length > 0);
        assert.ok(shard.titleZh.trim().length > 0);
        assert.ok(Array.isArray(shard.fr) && shard.fr.length >= 4);
        assert.equal(
          shard.fr.length,
          shard.zh.length,
          `${book.id}/${chMeta.id} fr/zh paragraph count mismatch`,
        );

        for (let i = 0; i < shard.fr.length; i += 1) {
          assert.ok(
            shard.fr[i].trim().length > 0,
            `Empty FR paragraph ${i} in ${book.id}/${chMeta.id}`,
          );
          assert.ok(
            shard.zh[i].trim().length > 0,
            `Empty ZH paragraph ${i} in ${book.id}/${chMeta.id}`,
          );
        }

        assert.ok(
          shard.noteZh && shard.noteZh.trim().length >= 20,
          `${book.id}/${chMeta.id} should include helpful noteZh`,
        );

        const frCharLen = shard.fr.join("\n\n").length;
        assert.ok(
          frCharLen < 10_000 && raw.length < 18_000,
          `${book.id}/${chMeta.id} FR chars (${frCharLen}) must be < 10,000`,
        );
        assert.ok(frCharLen < 10_500);

        const words = countFrenchWords(shard.fr);
        assert.ok(
          words >= 450 && words <= 1_100,
          `${book.id}/${chMeta.id} FR words (${words}) must be within 450..1100`,
        );
        assert.ok(
          Math.abs(chMeta.words - words) <= 25,
          `${book.id}/${chMeta.id} metadata words (${chMeta.words}) should match actual (${words})`,
        );
      }
    }
    assert.equal(chapterCount, 15);
  });

  it("fetches chapter JSON via loadBookChapter", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      const shardPath = path.join(BOOKS_DIR, "daudet-moulin", "ch-01.json");
      return new Response(fs.readFileSync(shardPath, "utf8"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const data = await loadBookChapter("daudet-moulin", "ch-01");
      assert.equal(data.bookId, "daudet-moulin");
      assert.equal(data.chapterId, "ch-01");
      assert.equal(data.fr.length, data.zh.length);
      assert.ok(
        requestedUrls[0]?.endsWith("materials/books/daudet-moulin/ch-01.json"),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Recommended Private Books Metadata", () => {
  it("exports 10 metadata-only cards for copyrighted learner favorites", () => {
    assert.equal(RECOMMENDED_PRIVATE_BOOKS.length, 10);
    const ids = new Set(RECOMMENDED_PRIVATE_BOOKS.map((b) => b.id));
    assert.equal(ids.size, 10);

    const petitPrince = RECOMMENDED_PRIVATE_BOOKS.find((b) =>
      b.title.includes("Petit Prince"),
    );
    assert.ok(petitPrince, "Must include Le Petit Prince");
    assert.match(
      petitPrince.copyrightNoteZh,
      /Mort pour la France|2032|2033/,
      "Le Petit Prince must note French Mort pour la France term protection",
    );

    for (const card of RECOMMENDED_PRIVATE_BOOKS) {
      assert.ok(card.atlasOverlapPct >= 50 && card.atlasOverlapPct <= 99);
      assert.ok(card.tags.length >= 2);
      assert.ok(card.whyZh.trim().length >= 15);
      assert.ok(card.copyrightNoteZh.trim().length >= 10);
    }
  });
});

describe("18 Relaxed Micro-Reads", () => {
  it("exports all 4 micro-read categories and 18 aligned items within 80-240 words", () => {
    assert.deepEqual(
      MICRO_READ_CATEGORIES.map((c) => c.id),
      ["culture", "dialogue", "mystery", "poetry"],
    );
    assert.equal(LOUNGE_MICRO_READS.length, 18);

    const byCat = {
      culture: LOUNGE_MICRO_READS.filter((r) => r.category === "culture"),
      dialogue: LOUNGE_MICRO_READS.filter((r) => r.category === "dialogue"),
      mystery: LOUNGE_MICRO_READS.filter((r) => r.category === "mystery"),
      poetry: LOUNGE_MICRO_READS.filter((r) => r.category === "poetry"),
    };
    assert.equal(byCat.culture.length, 5);
    assert.equal(byCat.dialogue.length, 5);
    assert.equal(byCat.mystery.length, 4);
    assert.equal(byCat.poetry.length, 4);

    const ids = new Set<string>();
    for (const item of LOUNGE_MICRO_READS) {
      assert.ok(!ids.has(item.id), `Duplicate micro-read id: ${item.id}`);
      ids.add(item.id);
      assert.ok(item.fr.length > 0);
      assert.equal(
        item.fr.length,
        item.zh.length,
        `${item.id} must have aligned fr/zh arrays`,
      );
      assert.ok(
        item.b2TipZh && item.b2TipZh.trim().length >= 15,
        `${item.id} must include b2TipZh`,
      );

      const words = countFrenchWords(item.fr);
      const wsWords = item.fr.join(" ").trim().split(/\s+/).length;
      assert.ok(
        words >= 80 && words <= 240,
        `${item.id} lexical words (${words}) must be within 80..240`,
      );
      assert.ok(
        wsWords >= 80 && wsWords <= 240,
        `${item.id} whitespace tokens (${wsWords}) must be within 80..240`,
      );
    }

    for (const dlg of byCat.dialogue) {
      assert.ok(
        dlg.dialogue && dlg.dialogue.length >= 5,
        `${dlg.id} must populate dialogue[]`,
      );
      for (const line of dlg.dialogue) {
        assert.ok(line.speaker.trim().length > 0);
        assert.ok(line.fr.trim().length > 0);
        assert.ok(line.zh.trim().length > 0);
      }
    }

    byCat.mystery.forEach((ep, idx) => {
      assert.ok(ep.series, `${ep.id} must have series metadata`);
      assert.equal(ep.series.ep, idx + 1);
      assert.equal(ep.series.total, 4);
      assert.ok(ep.poll, `${ep.id} must have a poll`);
      assert.equal(ep.poll.optionsZh.length, 3);
      assert.ok(ep.poll.revealIndex >= 0 && ep.poll.revealIndex < 3);
      assert.ok(ep.poll.revealZh.trim().length >= 10);
    });

    const verlaine = byCat.poetry.find((p) =>
      p.title.includes("Il pleure dans mon cœur"),
    );
    assert.ok(verlaine, "Must include Verlaine poem");
    assert.equal(verlaine.recommendedAmbience, "rain");

    for (const poem of byCat.poetry) {
      assert.doesNotMatch(poem.authorNote, /Éluard|Prévert/i);
    }
  });
});

describe("CONTENT_LICENSE.md Lounge Documentation", () => {
  it("documents books, micro-reads, video subtitles, YouTube embeds, and IndexedDB imports", () => {
    const content = fs.readFileSync(CONTENT_LICENSE_PATH, "utf8");
    assert.match(content, /public\/materials\/books\//);
    assert.match(content, /src\/lib\/lounge-reads\.ts/);
    assert.match(content, /public\/materials\/videos\/\*\.vtt/);
    assert.match(content, /YouTube/);
    assert.match(content, /IndexedDB/);
  });
});
