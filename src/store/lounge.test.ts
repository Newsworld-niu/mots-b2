import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type { StoredUserBook } from "../lib/lounge-types";
import { audioMediaKey, getRealMedia, pdfMediaKey, saveRealMedia } from "./real-media";
import { dayKey, resetProgress, store } from "./store";

/** Minimal in-memory IndexedDB shim so `createIdb` works deterministically under Node tests. */
function installMockIndexedDb() {
  const dbs = new Map<string, Map<string, Map<IDBValidKey, unknown>>>();

  const makeReq = <T>(compute: () => T): IDBRequest<T> => {
    const req: Record<string, unknown> = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
    };
    queueMicrotask(() => {
      try {
        req.result = compute();
        if (typeof req.onsuccess === "function") (req.onsuccess as () => void)();
      } catch (err) {
        req.error = err;
        if (typeof req.onerror === "function") (req.onerror as () => void)();
      }
    });
    return req as unknown as IDBRequest<T>;
  };

  (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
    open(name: string) {
      const req: Record<string, unknown> = {
        result: undefined,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        const isNew = !dbs.has(name);
        if (isNew) dbs.set(name, new Map());
        const stores = dbs.get(name)!;
        const db = {
          objectStoreNames: {
            contains: (s: string) => stores.has(s),
          },
          createObjectStore: (s: string) => {
            if (!stores.has(s)) stores.set(s, new Map());
            return {};
          },
          transaction: (storeName: string) => ({
            objectStore: () => {
              const map = stores.get(storeName)!;
              return {
                put: (val: unknown, key: IDBValidKey) =>
                  makeReq(() => {
                    map.set(key, val);
                    return key;
                  }),
                get: (key: IDBValidKey) => makeReq(() => map.get(key)),
                getAll: () => makeReq(() => [...map.values()]),
                getAllKeys: () => makeReq(() => [...map.keys()]),
                delete: (key: IDBValidKey) =>
                  makeReq(() => {
                    map.delete(key);
                    return undefined;
                  }),
                clear: () =>
                  makeReq(() => {
                    map.clear();
                    return undefined;
                  }),
              };
            },
          }),
          close: () => {},
          onclose: null,
          onversionchange: null,
        };
        req.result = db;
        if (isNew && typeof req.onupgradeneeded === "function") {
          (req.onupgradeneeded as () => void)();
        }
        if (typeof req.onsuccess === "function") {
          (req.onsuccess as () => void)();
        }
      });
      return req;
    },
  };
}

installMockIndexedDb();

const lounge = await import("./lounge");

beforeEach(async () => {
  resetProgress();
  lounge.setLoungeMode("chill");
  await lounge.clearAllLoungeIdb();
});

test("fb2-books CRUD, local lounge video + subtitles, YouTube custom subs, and isolated clearAllLoungeIdb", async () => {
  // Seed RFI/FEI real-media records that MUST survive clearAllLoungeIdb()
  await saveRealMedia(audioMediaKey("rfi-101"), new Blob(["mp3-bytes"], { type: "audio/mpeg" }), "rfi.mp3");
  await saveRealMedia(pdfMediaKey("rfi-101"), new Blob(["pdf-bytes"], { type: "application/pdf" }), "rfi.pdf");

  const sampleBook: StoredUserBook = {
    id: "epub-petit-prince-4096",
    title: "Le Petit Prince",
    author: "Saint-Exupéry",
    format: "epub",
    created: 1000,
    byteSize: 4096,
    chapters: [{ id: "ch-1", title: "Chapitre I", fr: ["Dessine-moi un mouton."], words: 4 }],
  };
  const saved = await lounge.saveUserBook(sampleBook);
  assert.equal(saved, true);

  const loadedBook = await lounge.getUserBook(sampleBook.id);
  assert.equal(loadedBook?.title, "Le Petit Prince");
  assert.equal((await lounge.listUserBooks()).length, 1);

  const videoFile = new File([new Uint8Array(2048)], "balade_paris.mp4", { type: "video/mp4" });
  const subText = `WEBVTT\n\n00:01.000 --> 00:03.000\nBonjour Paris !\n你好巴黎！\n`;
  const subFile = new File([subText], "balade.vtt", { type: "text/vtt" });

  const videoMeta = await lounge.saveLocalLoungeVideo({ videoFile, subFile });
  assert.equal(videoMeta.title, "balade paris");
  assert.equal(videoMeta.videoBytes, 2048);
  assert.equal(videoMeta.hasSubtitles, true);
  assert.equal(videoMeta.cueCount, 1);

  const listedVideos = await lounge.listLocalLoungeVideos();
  assert.equal(listedVideos.length, 1);
  assert.equal(listedVideos[0].id, videoMeta.id);

  const loadedMedia = await lounge.loadLocalLoungeVideoUrls(videoMeta.id);
  assert.equal(loadedMedia.videoBlob?.size, 2048);
  assert.equal(loadedMedia.cues.length, 1);
  assert.equal(loadedMedia.cues[0].zh, "你好巴黎！");

  const ytCues = await lounge.saveYoutubeCustomSubtitles(
    "yt-abc",
    "1\n00:00:02,000 --> 00:00:05,000\nC'est magnifique.\n太美了。\n",
  );
  assert.equal(ytCues.length, 1);
  assert.equal((await lounge.loadYoutubeCustomSubtitles("yt-abc"))[0].fr, "C'est magnifique.");

  const est = await lounge.estimateLoungeIdbBytes();
  assert.equal(est.bookCount, 1);
  assert.equal(est.booksBytes, 4096);
  assert.equal(est.videoCount, 1);
  assert.ok(est.videosBytes > 2048);

  await lounge.deleteUserBook(sampleBook.id);
  assert.equal(await lounge.getUserBook(sampleBook.id), null);

  await lounge.deleteLocalLoungeVideo(videoMeta.id);
  assert.equal((await lounge.listLocalLoungeVideos()).length, 0);

  // Re-add book & video then clearAllLoungeIdb -> RFI audio/pdf must stay intact
  await lounge.saveUserBook(sampleBook);
  await lounge.saveLocalLoungeVideo({ videoFile });
  await lounge.clearAllLoungeIdb();

  const afterClear = await lounge.estimateLoungeIdbBytes();
  assert.deepEqual(afterClear, { booksBytes: 0, videosBytes: 0, bookCount: 0, videoCount: 0 });
  assert.deepEqual(await lounge.loadYoutubeCustomSubtitles("yt-abc"), []);
  assert.ok(await getRealMedia(audioMediaKey("rfi-101")), "RFI audio preserved");
  assert.ok(await getRealMedia(pdfMediaKey("rfi-101")), "RFI pdf preserved");
});

test("Lounge store actions update mode, progress, chapters/reads activity, clips + tombstones, and latestLoungeResume", () => {
  lounge.setLoungeMode("study");
  assert.equal(store.get().settings.loungeMode, "study");

  const today = dayKey(new Date());
  lounge.updateBookProgress("book-1", { ch: 0, para: 3, ratio: 0.4, updatedAt: 1000, title: "Le Petit Prince" });
  lounge.updateMediaProgress("vid-1", { pos: 75, dur: 200, updatedAt: 2000, title: "Arte Doc", shelf: "videos" });

  const resume1 = lounge.latestLoungeResume(store.get().progress);
  assert.deepEqual(resume1, {
    shelf: "videos",
    item: "vid-1",
    title: "Arte Doc",
    label: "观看至 1:15",
    updatedAt: 2000,
  });

  // Completing chapter 0 of 3 advances to ch 1 and bumps loungeDays
  lounge.markBookChapterDone("book-1", 0, 3, "Le Petit Prince");
  assert.equal(store.get().progress.bookProgress?.["book-1"].ch, 1);
  assert.equal(store.get().progress.bookProgress?.["book-1"].done, undefined);
  assert.equal(store.get().progress.loungeDays?.[today], 1);

  const resume2 = lounge.latestLoungeResume(store.get().progress);
  assert.equal(resume2?.shelf, "books");
  assert.equal(resume2?.item, "book-1");
  assert.equal(resume2?.ch, 1);

  // Completing a micro-read marks it done (so resume stays on unfinished book-1) and bumps loungeDays
  lounge.markMicroReadDone("mr-cafe", "Un matin au café");
  assert.ok(store.get().progress.mediaProgress?.["mr-cafe"].done);
  assert.equal(store.get().progress.loungeDays?.[today], 2);
  assert.equal(lounge.latestLoungeResume(store.get().progress)?.item, "book-1");

  // Completing final chapter sets done on book-1
  lounge.markBookChapterDone("book-1", 2, 3, "Le Petit Prince");
  assert.ok(store.get().progress.bookProgress?.["book-1"].done);
  assert.equal(store.get().progress.loungeDays?.[today], 3);

  // Clips save & delete with loungeClip:<id> tombstone
  const clipId = lounge.saveLoungeClip({
    fr: "On ne voit bien qu'avec le cœur.",
    zh: "只有用心才能看清。",
    source: "《小王子》",
  });
  assert.ok(clipId.startsWith("lc-"));
  assert.equal(store.get().progress.loungeClips?.length, 1);

  lounge.deleteLoungeClip(clipId);
  assert.equal(store.get().progress.loungeClips, undefined);
  assert.ok(store.get().progress.tombstones?.[`loungeClip:${clipId}`]);
});
