import type { StoredUserBook } from "./lounge-types";

const MAX_BOOK_FILE_BYTES = 80 * 1024 * 1024;
const MAX_CHAPTER_CHARS = 9500;
const DRM_ERROR_MESSAGE =
  "这本 EPUB 带有 DRM 加密保护，暂无法在浏览器内直接解析；请导入无 DRM 的 EPUB 或 TXT 文件";

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  thinsp: " ",
  ensp: " ",
  emsp: " ",
  shy: "",
  oelig: "œ",
  OElig: "Œ",
  aelig: "æ",
  AElig: "Æ",
  ccedil: "ç",
  Ccedil: "Ç",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  sect: "§",
  para: "¶",
  times: "×",
  divide: "÷",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  aring: "å",
  Agrave: "À",
  Aacute: "Á",
  Acirc: "Â",
  Atilde: "Ã",
  Auml: "Ä",
  Aring: "Å",
  egrave: "è",
  eacute: "é",
  ecirc: "ê",
  euml: "ë",
  Egrave: "È",
  Eacute: "É",
  Ecirc: "Ê",
  Euml: "Ë",
  igrave: "ì",
  iacute: "í",
  icirc: "î",
  iuml: "ï",
  Igrave: "Ì",
  Iacute: "Í",
  Icirc: "Î",
  Iuml: "Ï",
  ograve: "ò",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  Ograve: "Ò",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Ouml: "Ö",
  ugrave: "ù",
  uacute: "ú",
  ucirc: "û",
  uuml: "ü",
  Ugrave: "Ù",
  Uacute: "Ú",
  Ucirc: "Û",
  Uuml: "Ü",
  yuml: "ÿ",
  Yuml: "Ÿ",
  ntilde: "ñ",
  Ntilde: "Ñ",
  szlig: "ß",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z0-9]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const cp = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
    }
    if (entity.startsWith("#")) {
      const cp = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
    }
    return HTML_ENTITIES[entity] ?? full;
  });
}

function normalizeInlineText(raw: string): string {
  return raw.replace(/[\r\n\t\u00a0 ]+/g, " ").trim();
}

function countWords(paragraphs: readonly string[]): number {
  let total = 0;
  for (const p of paragraphs) {
    const matches = p.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
    total += matches ? matches.length : 0;
  }
  return total;
}

function hashSlugFallback(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `b${(h >>> 0).toString(36)}`;
}

function makeBookSlug(rawName: string): string {
  const base = rawName.replace(/\.[^.]+$/, "").trim();
  const ascii = base
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return ascii || hashSlugFallback(base || rawName);
}

interface ZipEntryMeta {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

interface ZipArchive {
  has: (path: string) => boolean;
  listPaths: () => string[];
  readText: (path: string) => Promise<string | null>;
}

function normalizeZipPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function openZipArchive(zip: Uint8Array): ZipArchive {
  if (zip.byteLength < 22) {
    throw new Error("无法读取 EPUB 压缩包（文件不完整或已损坏）");
  }
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  const minPos = Math.max(0, zip.length - 65557);
  for (let i = zip.length - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("无法打开 EPUB 文件（未找到有效的 ZIP 目录结构）");
  }

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder("utf-8");
  const exact = new Map<string, ZipEntryMeta>();
  const lower = new Map<string, ZipEntryMeta>();

  for (let n = 0; n < count && p + 46 <= zip.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const rawName = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (rawName.endsWith("/")) continue;
    const name = normalizeZipPath(rawName);
    const meta: ZipEntryMeta = { name, method, compressedSize, localOffset };
    exact.set(name, meta);
    lower.set(name.toLowerCase(), meta);
  }

  const find = (wanted: string): ZipEntryMeta | undefined => {
    const clean = normalizeZipPath(wanted);
    return exact.get(clean) ?? lower.get(clean.toLowerCase());
  };

  return {
    has: (wanted) => Boolean(find(wanted)),
    listPaths: () => [...exact.keys()],
    readText: async (wanted) => {
      const meta = find(wanted);
      if (!meta) return null;
      const local = meta.localOffset;
      if (local + 30 > zip.length || view.getUint32(local, true) !== 0x04034b50) {
        throw new Error(`EPUB 内部条目损坏：${meta.name}`);
      }
      const localNameLen = view.getUint16(local + 26, true);
      const localExtraLen = view.getUint16(local + 28, true);
      const start = local + 30 + localNameLen + localExtraLen;
      const data = zip.subarray(start, start + meta.compressedSize);
      if (meta.method === 0) return dec.decode(data);
      if (meta.method !== 8) {
        throw new Error(`不支持的 EPUB 压缩算法（method ${meta.method}）`);
      }
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    },
  };
}

function dirOf(zipPath: string): string {
  const idx = zipPath.lastIndexOf("/");
  return idx >= 0 ? zipPath.slice(0, idx + 1) : "";
}

function safeDecodeUri(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveZipPath(baseDir: string, rawHref: string): string {
  const withoutFrag = decodeHtmlEntities(rawHref).split("#")[0].split("?")[0].trim();
  const decoded = safeDecodeUri(withoutFrag).replace(/\\/g, "/");
  if (!decoded) return "";
  const combined = decoded.startsWith("/") ? decoded.slice(1) : `${baseDir}${decoded}`;
  const out: string[] = [];
  for (const seg of combined.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      out.pop();
    } else {
      out.push(seg);
    }
  }
  return out.join("/");
}

function parseXmlAttrs(tagAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(tagAttrs)) !== null) {
    attrs[m[1].toLowerCase()] = decodeHtmlEntities(m[2] ?? m[3] ?? "");
  }
  return attrs;
}

function stripTagsAndDecode(raw: string): string {
  return normalizeInlineText(decodeHtmlEntities(raw.replace(/<[^>]+>/g, " ")));
}

/**
 * Parse an HTML/XHTML chapter string into an optional heading (`h1`-`h3`) and clean body paragraphs.
 * Uses `DOMParser("text/html")` in browser environments so French named entities (`&oelig;`, `&laquo;`, `&nbsp;`)
 * never trigger XML parse failures, with a zero-dependency entity/block parser fallback in Node.
 */
export function parseHtmlChapter(rawHtml: string): { heading?: string; paragraphs: string[] } {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(rawHtml, "text/html");
    const root = doc.body ?? doc.documentElement;
    if (!root) return { paragraphs: [] };
    root.querySelectorAll("script, style, svg, nav, noscript, head").forEach((el) => el.remove());

    let heading: string | undefined;
    const firstHeading = root.querySelector("h1, h2, h3");
    if (firstHeading) {
      const hText = normalizeInlineText(firstHeading.textContent ?? "");
      if (hText) heading = hText;
    }

    const BLOCK_TAGS = new Set([
      "P",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "LI",
      "BLOCKQUOTE",
      "PRE",
      "DIV",
      "SECTION",
      "ARTICLE",
    ]);

    const paragraphs: string[] = [];
    const walk = (el: Element) => {
      const tag = el.tagName.toUpperCase();
      if (tag === "P" || /^H[1-6]$/.test(tag) || tag === "LI" || tag === "PRE") {
        el.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
        for (const line of (el.textContent ?? "").split("\n")) {
          const clean = normalizeInlineText(line);
          if (clean) paragraphs.push(clean);
        }
        return;
      }
      const childElements = Array.from(el.children);
      const hasBlockChild = childElements.some((c) => BLOCK_TAGS.has(c.tagName.toUpperCase()));
      if (!hasBlockChild && BLOCK_TAGS.has(tag)) {
        el.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
        for (const line of (el.textContent ?? "").split("\n")) {
          const clean = normalizeInlineText(line);
          if (clean) paragraphs.push(clean);
        }
        return;
      }
      for (const child of childElements) walk(child);
    };

    walk(root);
    if (!paragraphs.length) {
      const fallback = normalizeInlineText(root.textContent ?? "");
      if (fallback) paragraphs.push(fallback);
    }
    return { heading, paragraphs };
  }

  // Zero-dependency Node fallback parser with full French HTML entity support
  const cleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(?:head|script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/(?:head|script|style|svg|noscript)>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "");

  let heading: string | undefined;
  const hMatch = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(cleaned);
  if (hMatch) {
    const hText = stripTagsAndDecode(hMatch[2]);
    if (hText) heading = hText;
  }

  const withBreaks = cleaned
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|section|article|blockquote|li|tr|h[1-6]|pre|hr)\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  const decoded = decodeHtmlEntities(withBreaks);
  const paragraphs = decoded
    .split(/\n+/)
    .map(normalizeInlineText)
    .filter(Boolean);

  return { heading, paragraphs };
}

function splitLongChapter(
  baseTitle: string,
  paragraphs: readonly string[],
  maxChars = MAX_CHAPTER_CHARS,
): { title: string; fr: string[] }[] {
  const cleanParas = paragraphs.map((p) => p.trim()).filter(Boolean);
  if (!cleanParas.length) return [];

  const expanded: string[] = [];
  for (const para of cleanParas) {
    if (para.length <= maxChars) {
      expanded.push(para);
      continue;
    }
    const sentences = para.split(/(?<=[.!?…»])\s+/);
    let chunk = "";
    for (const s of sentences) {
      if (!chunk) {
        chunk = s;
      } else if (chunk.length + 1 + s.length <= maxChars) {
        chunk = `${chunk} ${s}`;
      } else {
        expanded.push(chunk);
        chunk = s;
      }
    }
    if (chunk) {
      for (let i = 0; i < chunk.length; i += maxChars) {
        expanded.push(chunk.slice(i, i + maxChars));
      }
    }
  }

  const totalChars = expanded.reduce((sum, p) => sum + p.length, 0);
  if (totalChars <= maxChars || expanded.length === 1) {
    return [{ title: baseTitle, fr: expanded }];
  }

  const parts: string[][] = [];
  let cur: string[] = [];
  let curLen = 0;

  for (const para of expanded) {
    if (cur.length > 0 && curLen + para.length > maxChars) {
      parts.push(cur);
      cur = [para];
      curLen = para.length;
    } else {
      cur.push(para);
      curLen += para.length;
    }
  }
  if (cur.length) parts.push(cur);

  if (parts.length === 1) {
    return [{ title: baseTitle, fr: parts[0] }];
  }
  return parts.map((fr, idx) => ({
    title: `${baseTitle} (${idx + 1}/${parts.length})`,
    fr,
  }));
}

function parseTocFromNavHtml(navHtml: string, navDir: string, out: Map<string, string>) {
  const navBlockMatch =
    /<nav\b[^>]*epub:type=["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i.exec(navHtml) ??
    /<nav\b[^>]*>([\s\S]*?)<\/nav>/i.exec(navHtml);
  const scope = navBlockMatch ? navBlockMatch[1] : navHtml;
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(scope)) !== null) {
    const attrs = parseXmlAttrs(m[1]);
    const href = attrs.href;
    if (!href) continue;
    const resolved = resolveZipPath(navDir, href);
    const label = stripTagsAndDecode(m[2]);
    if (resolved && label && !out.has(resolved)) {
      out.set(resolved, label);
    }
  }
}

function parseTocFromNcx(ncxXml: string, ncxDir: string, out: Map<string, string>) {
  const pointRe =
    /<navLabel\b[^>]*>\s*<text\b[^>]*>([\s\S]*?)<\/text>\s*<\/navLabel>\s*<content\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = pointRe.exec(ncxXml)) !== null) {
    const label = stripTagsAndDecode(m[1]);
    const attrs = parseXmlAttrs(m[2]);
    const src = attrs.src;
    if (!src || !label) continue;
    const resolved = resolveZipPath(ncxDir, src);
    if (resolved && !out.has(resolved)) {
      out.set(resolved, label);
    }
  }
}

async function parseEpubBytes(bytes: Uint8Array, fallbackTitle: string): Promise<{
  title: string;
  author?: string;
  chapters: StoredUserBook["chapters"];
}> {
  const zip = openZipArchive(bytes);
  if (zip.has("META-INF/encryption.xml")) {
    throw new Error(DRM_ERROR_MESSAGE);
  }

  let opfPath = "";
  const containerXml = await zip.readText("META-INF/container.xml");
  if (containerXml) {
    const rootMatch = /<rootfile\b([^>]*)\/?>/i.exec(containerXml);
    if (rootMatch) {
      const attrs = parseXmlAttrs(rootMatch[1]);
      if (attrs["full-path"]) opfPath = normalizeZipPath(safeDecodeUri(attrs["full-path"]));
    }
  }
  if (!opfPath) {
    opfPath = zip.listPaths().find((p) => p.toLowerCase().endsWith(".opf")) ?? "";
  }
  if (!opfPath) {
    throw new Error("无法识别这本 EPUB 的目录结构（缺少 OPF 描述文件）");
  }

  const opfXml = await zip.readText(opfPath);
  if (!opfXml) {
    throw new Error(`无法读取 EPUB 目录描述文件（${opfPath}）`);
  }
  const opfDir = dirOf(opfPath);

  const titleMatch = /<(?:dc:)?title\b[^>]*>([\s\S]*?)<\/(?:dc:)?title>/i.exec(opfXml);
  const title = (titleMatch ? stripTagsAndDecode(titleMatch[1]) : "") || fallbackTitle || "Sans titre";

  const authorMatch = /<(?:dc:)?creator\b[^>]*>([\s\S]*?)<\/(?:dc:)?creator>/i.exec(opfXml);
  const author = (authorMatch ? stripTagsAndDecode(authorMatch[1]) : "") || undefined;

  interface ManifestItem {
    id: string;
    href: string;
    resolvedPath: string;
    mediaType: string;
    properties: string;
  }

  const manifest = new Map<string, ManifestItem>();
  const manifestBlock = /<manifest\b[^>]*>([\s\S]*?)<\/manifest>/i.exec(opfXml)?.[1] ?? opfXml;
  const itemRe = /<item\b([^>]*)\/?>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(manifestBlock)) !== null) {
    const attrs = parseXmlAttrs(im[1]);
    const id = attrs.id;
    const href = attrs.href;
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href,
      resolvedPath: resolveZipPath(opfDir, href),
      mediaType: (attrs["media-type"] ?? "").toLowerCase(),
      properties: attrs.properties ?? "",
    });
  }

  const tocTitles = new Map<string, string>();
  const navItem = [...manifest.values()].find((it) =>
    it.properties
      .split(/\s+/)
      .map((s) => s.toLowerCase())
      .includes("nav"),
  );
  if (navItem) {
    const navHtml = await zip.readText(navItem.resolvedPath);
    if (navHtml) parseTocFromNavHtml(navHtml, dirOf(navItem.resolvedPath), tocTitles);
  }

  const spineTagMatch = /<spine\b([^>]*)>([\s\S]*?)<\/spine>/i.exec(opfXml);
  const spineAttrs = spineTagMatch ? parseXmlAttrs(spineTagMatch[1]) : {};
  const ncxItem =
    (spineAttrs.toc ? manifest.get(spineAttrs.toc) : undefined) ??
    [...manifest.values()].find(
      (it) => it.mediaType === "application/x-dtbncx+xml" || it.resolvedPath.toLowerCase().endsWith(".ncx"),
    );
  if (ncxItem) {
    const ncxXml = await zip.readText(ncxItem.resolvedPath);
    if (ncxXml) parseTocFromNcx(ncxXml, dirOf(ncxItem.resolvedPath), tocTitles);
  }

  const spineBody = spineTagMatch ? spineTagMatch[2] : opfXml;
  const itemRefs: { idref: string; linear: boolean }[] = [];
  const refRe = /<itemref\b([^>]*)\/?>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = refRe.exec(spineBody)) !== null) {
    const attrs = parseXmlAttrs(rm[1]);
    if (attrs.idref) {
      itemRefs.push({
        idref: attrs.idref,
        linear: (attrs.linear ?? "yes").toLowerCase() !== "no",
      });
    }
  }

  const activeRefs = itemRefs.some((r) => r.linear) ? itemRefs.filter((r) => r.linear) : itemRefs;
  const seenPaths = new Set<string>();
  const splitParts: { title: string; fr: string[] }[] = [];

  for (const ref of activeRefs) {
    const item = manifest.get(ref.idref);
    if (!item || !item.resolvedPath || seenPaths.has(item.resolvedPath)) continue;
    if (item === navItem) continue;
    const isHtml =
      item.mediaType.includes("html") ||
      item.mediaType.includes("xml") ||
      /\.(?:x?html?|xml)$/i.test(item.resolvedPath);
    if (!isHtml || item.mediaType === "application/x-dtbncx+xml") continue;

    seenPaths.add(item.resolvedPath);
    const rawHtml = await zip.readText(item.resolvedPath);
    if (!rawHtml) continue;

    const { heading, paragraphs } = parseHtmlChapter(rawHtml);
    if (!paragraphs.length) continue;

    const tocTitle = tocTitles.get(item.resolvedPath);
    const baseTitle = tocTitle || heading || `Chapitre ${splitParts.length + 1}`;
    const body = [...paragraphs];
    if (
      body.length > 1 &&
      body[0].toLowerCase().replace(/\s+/g, " ") === baseTitle.toLowerCase().replace(/\s+/g, " ")
    ) {
      body.shift();
    }
    if (countWords(body) === 0) continue;

    splitParts.push(...splitLongChapter(baseTitle, body, MAX_CHAPTER_CHARS));
  }

  if (!splitParts.length) {
    throw new Error("未在这本 EPUB 中提取到可阅读的章节正文");
  }

  const chapters: StoredUserBook["chapters"] = splitParts.map((part, idx) => ({
    id: `ch-${idx + 1}`,
    title: part.title,
    fr: part.fr,
    words: countWords(part.fr),
  }));

  return { title, ...(author ? { author } : {}), chapters };
}

const TXT_CHAPTER_HEADING_RE =
  /^(?:chapitre|livre|partie|acte|scène|scene|lettre|conte|prologue|épilogue|epilogue|préface|preface|introduction|chapter|part)\b[^\n]{0,72}$/i;
const ROMAN_HEADING_RE = /^(?:[IVXLCDM]{1,8}|\d{1,3})\s*[.:\-—]?\s*$/;
const CJK_CHAPTER_RE = /^第\s*[0-9一二三四五六七八九十百千]+\s*[章节回部篇][^\n]{0,50}$/;

function isTxtChapterHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return null;
  const md = /^#{1,3}\s+(.+)$/.exec(trimmed);
  if (md) return md[1].trim();
  if (TXT_CHAPTER_HEADING_RE.test(trimmed)) return trimmed;
  if (ROMAN_HEADING_RE.test(trimmed)) return `Chapitre ${trimmed.replace(/[.:\-—]\s*$/, "")}`;
  if (CJK_CHAPTER_RE.test(trimmed)) return trimmed;
  return null;
}

function parsePlainTextBook(rawText: string, fallbackTitle: string): {
  title: string;
  chapters: StoredUserBook["chapters"];
} {
  const normalized = rawText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    throw new Error("文件内容为空，未检测到可读正文");
  }

  let bookTitle = fallbackTitle || "Sans titre";
  let bodyText = normalized;

  const firstNewline = normalized.indexOf("\n");
  const firstLine = (firstNewline >= 0 ? normalized.slice(0, firstNewline) : normalized).trim();
  const topH1 = /^#\s+(.+)$/.exec(firstLine);
  if (topH1 && firstNewline >= 0) {
    bookTitle = topH1[1].trim() || bookTitle;
    bodyText = normalized.slice(firstNewline + 1).trim();
  }

  const rawBlocks = bodyText.includes("\n\n") ? bodyText.split(/\n\s*\n+/) : bodyText.split(/\n+/);
  const sections: { title: string; paragraphs: string[] }[] = [];
  let current: { title: string; paragraphs: string[] } | null = null;

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    const maybeHeading = isTxtChapterHeading(lines[0]);
    if (maybeHeading) {
      if (current && current.paragraphs.length) sections.push(current);
      current = { title: maybeHeading, paragraphs: [] };
      if (lines.length > 1) {
        const rest = normalizeInlineText(lines.slice(1).join(" "));
        if (rest) current.paragraphs.push(rest);
      }
      continue;
    }

    if (!current) {
      current = { title: bookTitle, paragraphs: [] };
    }
    const para = normalizeInlineText(lines.join(" "));
    if (para) current.paragraphs.push(para);
  }
  if (current && current.paragraphs.length) sections.push(current);

  if (!sections.length) {
    throw new Error("文件内容为空，未检测到可读正文");
  }

  const splitParts: { title: string; fr: string[] }[] = [];
  for (const sec of sections) {
    splitParts.push(...splitLongChapter(sec.title, sec.paragraphs, MAX_CHAPTER_CHARS));
  }

  const chapters: StoredUserBook["chapters"] = splitParts.map((part, idx) => ({
    id: `ch-${idx + 1}`,
    title: sections.length === 1 && splitParts.length > 1 ? `第 ${idx + 1} 节` : part.title,
    fr: part.fr,
    words: countWords(part.fr),
  }));

  return { title: bookTitle, chapters };
}

/**
 * Parse a user-imported `.epub`, `.txt`, or `.md` `File` entirely in the browser with zero external dependencies.
 */
export async function parseBookFile(file: File): Promise<StoredUserBook> {
  if (file.size > MAX_BOOK_FILE_BYTES) {
    throw new Error(`「${file.name}」体积过大（超过 80 MB），请导入较小的电子书文件`);
  }
  const rawName = file.name || "livre.txt";
  const ext = rawName.toLowerCase().includes(".") ? (rawName.toLowerCase().split(".").pop() ?? "") : "";
  const isEpub = ext === "epub" || file.type === "application/epub+zip";
  const isTxt = ext === "txt" || ext === "md" || ext === "markdown" || (!isEpub && file.type.startsWith("text/"));

  if (!isEpub && !isTxt) {
    throw new Error(`暂不支持「${rawName}」格式，请导入 .epub、.txt 或 .md 文件`);
  }

  const format: "epub" | "txt" = isEpub ? "epub" : "txt";
  const slug = makeBookSlug(rawName);
  const id = `${format}-${slug}-${file.size}`;
  const fallbackTitle = rawName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Sans titre";

  if (isEpub) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseEpubBytes(bytes, fallbackTitle);
    return {
      id,
      title: parsed.title,
      ...(parsed.author ? { author: parsed.author } : {}),
      format: "epub",
      created: Date.now(),
      byteSize: file.size,
      chapters: parsed.chapters,
    };
  }

  const text = await file.text();
  const parsed = parsePlainTextBook(text, fallbackTitle);
  return {
    id,
    title: parsed.title,
    format: "txt",
    created: Date.now(),
    byteSize: file.size,
    chapters: parsed.chapters,
  };
}
