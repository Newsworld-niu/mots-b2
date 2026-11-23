/** 阅读: the learner's saved texts, kept with the progress (and so in backups), newest first. */
import { MAX_TEXT_LENGTH, MAX_TEXTS, titleOf, type SavedText } from "../lib/reader";
import { clearTombstone, markTombstone, store } from "./store";

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Save a text; the oldest ones beyond MAX_TEXTS are dropped. Returns its id. */
export function saveText(input: Omit<SavedText, "id" | "created" | "title"> & { title?: string }): string {
  const id = `t-${rid()}`;
  const text = input.text.replace(/\r/g, "").trim().slice(0, MAX_TEXT_LENGTH);
  const t: SavedText = { ...input, id, text, title: input.title?.trim().slice(0, 80) || titleOf(text), created: Date.now() };
  store.progress((p) => clearTombstone({ ...p, texts: [t, ...(p.texts ?? [])].slice(0, MAX_TEXTS) }, `text:${id}`));
  return id;
}

export function deleteText(id: string) {
  store.progress((p) => {
    const texts = (p.texts ?? []).filter((t) => t.id !== id);
    const { texts: _old, ...rest } = p;
    return markTombstone(texts.length ? { ...rest, texts } : rest, `text:${id}`);
  });
}

export function markTextRead(id: string, read: boolean) {
  store.progress((p) => ({
    ...p,
    texts: (p.texts ?? []).map((t) => {
      if (t.id !== id) return t;
      const { read: _was, ...rest } = t;
      return read ? { ...rest, read: Date.now() } : rest;
    }),
  }));
}
