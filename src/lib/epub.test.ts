import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { parseBookFile, parseHtmlChapter, resolveZipPath } from "./epub";

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Build a valid multi-entry ZIP archive in memory (supporting method 0 stored and method 8 deflate-raw). */
function buildInMemoryZip(entries: { name: string; content: string; deflate?: boolean }[]): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const rawBytes = enc.encode(entry.content);
    const method = entry.deflate === false ? 0 : 8;
    const compBytes = method === 8 ? new Uint8Array(deflateRawSync(rawBytes)) : rawBytes;
    const crc = crc32(rawBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compBytes.length, true);
    lv.setUint32(22, rawBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compBytes.length, true);
    cv.setUint32(24, rawBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdHeader.set(nameBytes, 46);

    localParts.push(localHeader, compBytes);
    cdParts.push(cdHeader);
    offset += localHeader.length + compBytes.length;
  }

  const cdSize = cdParts.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + cdSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...localParts, ...cdParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

test("parseBookFile parses real deflated in-memory .epub with relative OPF spine hrefs, French &oelig;/&laquo;/&nbsp; entities, TOC titles, and >9500-char chapter splitting", async () => {
  const longParas = Array.from(
    { length: 30 },
    (_, i) => `<p>Paragraphe ${i + 1} : C&rsquo;est une &oelig;uvre remarquable qui interroge l&rsquo;esprit humain dans toute sa profondeur littéraire et poétique, au fil des saisons parisiennes où la lumière d&rsquo;automne glisse doucement sur les toits d&rsquo;ardoise et les quais paisibles de la Seine.</p>`,
  ).join("\n");

  const zipBytes = buildInMemoryZip([
    { name: "mimetype", content: "application/epub+zip", deflate: false },
    {
      name: "META-INF/container.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/Sub/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    },
    {
      name: "OEBPS/Sub/content.opf",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Contes du C&oelig;ur</dc:title>
    <dc:creator>Antoine de Saint-Exupéry</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="../Text/Chapitre%201.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="../Text/long.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`,
    },
    {
      name: "OEBPS/Sub/nav.xhtml",
      content: `<!DOCTYPE html><html xmlns:epub="http://www.idpf.org/2007/ops"><body>
<nav epub:type="toc">
  <ol>
    <li><a href="../Text/Chapitre%201.xhtml#top">I. Le C&oelig;ur Apprivoisé</a></li>
  </ol>
</nav></body></html>`,
    },
    {
      name: "OEBPS/Text/Chapitre 1.xhtml",
      content: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Ignoré</title><style>body { color: black; }</style></head>
<body>
  <h1>I. Le C&oelig;ur Apprivoisé</h1>
  <p>&laquo;&nbsp;On ne voit bien qu&rsquo;avec le c&oelig;ur.&nbsp;&raquo;</p>
  <p>L&rsquo;&OElig;il regarde, mais l&rsquo;essentiel demeure invisible.</p>
</body>
</html>`,
    },
    {
      name: "OEBPS/Text/long.xhtml",
      content: `<html><body><h2>II. Longue Promenade</h2>${longParas}</body></html>`,
    },
  ]);

  const file = new File([zipBytes as BlobPart], "Le Cœur.epub", { type: "application/epub+zip" });
  const book = await parseBookFile(file);
  const bookAgain = await parseBookFile(file);

  assert.equal(book.id, `epub-le-coeur-${file.size}`);
  assert.equal(book.id, bookAgain.id, "deterministic book ID");
  assert.equal(book.format, "epub");
  assert.equal(book.title, "Contes du Cœur");
  assert.equal(book.author, "Antoine de Saint-Exupéry");
  assert.equal(book.byteSize, file.size);
  assert.ok(book.chapters.length >= 2, "long second chapter splits on paragraph boundaries if >9500 chars");

  assert.equal(book.chapters[0].title, "I. Le Cœur Apprivoisé");
  assert.deepEqual(book.chapters[0].fr, [
    "« On ne voit bien qu’avec le cœur. »",
    "L’Œil regarde, mais l’essentiel demeure invisible.",
  ]);
  assert.ok(book.chapters[0].words >= 12);

  // Build an extra-large chapter (>11,000 chars) to verify splitting into sequential parts
  const hugeParas = Array.from(
    { length: 45 },
    (_, i) => `<p>Section ${i + 1} : ${"Une longue phrase française pleine de nuances subtiles et d'élégance classique. ".repeat(4)}</p>`,
  ).join("\n");
  const hugeZip = buildInMemoryZip([
    {
      name: "META-INF/container.xml",
      content: `<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>`,
    },
    {
      name: "book.opf",
      content: `<package><metadata><dc:title>Grand Livre</dc:title></metadata><manifest><item id="x" href="ch.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="x"/></spine></package>`,
    },
    { name: "ch.xhtml", content: `<html><body><h1>Chapitre Unique</h1>${hugeParas}</body></html>` },
  ]);
  const hugeBook = await parseBookFile(new File([hugeZip as BlobPart], "grand.epub"));
  assert.equal(hugeBook.chapters.length, 2);
  assert.equal(hugeBook.chapters[0].title, "Chapitre Unique (1/2)");
  assert.equal(hugeBook.chapters[1].title, "Chapitre Unique (2/2)");
  for (const ch of hugeBook.chapters) {
    const len = ch.fr.reduce((s, p) => s + p.length, 0);
    assert.ok(len <= 9500, `each split part stays <= 9500 chars (got ${len})`);
  }
});

test("parseBookFile rejects DRM-protected EPUB containing META-INF/encryption.xml with exact Chinese message", async () => {
  const drmZip = buildInMemoryZip([
    { name: "mimetype", content: "application/epub+zip", deflate: false },
    { name: "META-INF/encryption.xml", content: "<encryption></encryption>" },
    { name: "META-INF/container.xml", content: "<container/>" },
  ]);
  const file = new File([drmZip as BlobPart], "protected.epub", { type: "application/epub+zip" });
  await assert.rejects(
    () => parseBookFile(file),
    {
      message: "这本 EPUB 带有 DRM 加密保护，暂无法在浏览器内直接解析；请导入无 DRM 的 EPUB 或 TXT 文件",
    },
  );
});

test("parseBookFile auto-chapters .txt and .md files and splits long plain-text sections", async () => {
  const txtContent = `# Promenades Parisiennes

Chapitre 1 : Matin au Café

Il fait doux ce matin sur le boulevard Saint-Germain.

Nous commandons deux cafés allongés et un croissant chaud.

Chapitre 2 : Pluie sur la Seine

Les bouquinistes referment doucement leurs boîtes vertes sous l'averse.
`;
  const txtFile = new File([txtContent], "Promenades_Parisiennes.txt", { type: "text/plain" });
  const parsed = await parseBookFile(txtFile);

  assert.equal(parsed.id, `txt-promenades-parisiennes-${txtFile.size}`);
  assert.equal(parsed.format, "txt");
  assert.equal(parsed.title, "Promenades Parisiennes");
  assert.equal(parsed.chapters.length, 2);
  assert.equal(parsed.chapters[0].title, "Chapitre 1 : Matin au Café");
  assert.equal(parsed.chapters[0].fr.length, 2);
  assert.equal(parsed.chapters[1].title, "Chapitre 2 : Pluie sur la Seine");
  assert.equal(parsed.chapters[1].fr.length, 1);

  assert.equal(resolveZipPath("OEBPS/Sub/", "../Text/Chapitre%201.xhtml#p2"), "OEBPS/Text/Chapitre 1.xhtml");
  const htmlParsed = parseHtmlChapter("<div><h3>Salut</h3><p>C&oelig;ur &amp; &acirc;me</p></div>");
  assert.equal(htmlParsed.heading, "Salut");
  assert.ok(htmlParsed.paragraphs.includes("Cœur & âme"));
});

test("parseHtmlChapter also works via DOMParser('text/html') with French named entities (&oelig;, &laquo;, &nbsp;)", async () => {
  const { Window } = await import("happy-dom");
  const win = new Window();
  const prev = globalThis.DOMParser;
  (globalThis as unknown as { DOMParser: unknown }).DOMParser = win.DOMParser;
  try {
    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Ignoré</title></head>
  <body>
    <h2>L&rsquo;&OElig;uvre</h2>
    <p>&laquo;&nbsp;Mon c&oelig;ur s&rsquo;ouvre &agrave; ta voix.&nbsp;&raquo;</p>
  </body>
</html>`;
    const res = parseHtmlChapter(xhtml);
    assert.equal(res.heading, "L’Œuvre");
    assert.ok(res.paragraphs.includes("« Mon cœur s’ouvre à ta voix. »"));
  } finally {
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = prev;
    await win.close();
  }
});
