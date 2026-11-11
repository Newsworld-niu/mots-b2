/**
 * Reading what the learner imports: plain text, CSV/TSV word lists, Word (.docx), and pictures or PDFs that go
 * to the 识图 service. Everything is read in the browser.
 */
import type { Attachment } from "../ai/clients";
import { parseListText, type ListInput } from "./wordlist";

export interface ReadFile {
  name: string;
  /** Running text (txt, md, docx, a CSV that is not a list). */
  text?: string;
  /** Word-list rows (CSV / TSV / two-column text or Word table). */
  rows?: ListInput[];
  /** For the 识图 service (images, PDF). */
  attachment?: Attachment;
}

export const ACCEPT = ".txt,.md,.csv,.tsv,.docx,.pdf,image/*";
const MAX_FILE = 25 * 1024 * 1024;
/** Longest side of a photo sent for recognition: enough for small print, small enough to send quickly. */
const PHOTO_SIDE = 2000;

export async function readImport(file: File): Promise<ReadFile> {
  if (file.size > MAX_FILE) throw new Error(`「${file.name}」太大（超过 25 MB）`);
  const name = file.name;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (file.type.startsWith("image/")) return { name, attachment: await photoAttachment(file) };
  if (ext === "pdf" || file.type === "application/pdf") return { name, attachment: { mime: "application/pdf", data: toBase64(new Uint8Array(await file.arrayBuffer())), name } };
  if (ext === "docx") return textOrList(name, docxText(await unzipEntry(new Uint8Array(await file.arrayBuffer()), "word/document.xml")));
  if (["txt", "md", "csv", "tsv", ""].includes(ext) || file.type.startsWith("text/")) return textOrList(name, await file.text());
  throw new Error(`不支持「${name}」这种文件（可以用 txt、md、csv、tsv、docx、pdf 或图片）`);
}

function textOrList(name: string, text: string): ReadFile {
  const rows = parseListText(text);
  return rows ? { name, rows } : { name, text };
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A photo shrunk to PHOTO_SIDE and encoded as JPEG (phone photos are often 10 MB+). */
export async function photoAttachment(file: File): Promise<Attachment> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1), name: file.name };
}

/* ---------- .docx ---------- */

/** Text of a Word document.xml: paragraphs on their own lines, table cells separated by tabs. */
export function docxText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    // a table row: the cells' paragraph breaks fold into the tabs
    .replace(/\n\t/g, "\t")
    .replace(/\t+\n/g, "\n")
    .replace(/[  ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One file out of a zip (a .docx is a zip), using the browser's deflate. */
export async function unzipEntry(zip: Uint8Array, wanted: string): Promise<string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("这个 Word 文件打不开（不是 .docx？）");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== wanted) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = zip.subarray(start, start + size);
    if (method === 0) return dec.decode(data);
    if (method !== 8) throw new Error("这个 Word 文件的压缩方式不支持");
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  }
  throw new Error("这个 Word 文件里没有正文");
}
