/**
 * 自动配图: candidate pictures for a word, from the lead images of French Wikipedia articles found by a search
 * for it (freely licensed pictures only, pilicense=free). Needs a network connection; nothing is sent but the word.
 * The learner picks one; it is then shrunk and stored like an uploaded picture (store/images.ts).
 */
import { fileToImage } from "../store/images";

export interface PictureHit {
  /** Title of the Wikipedia article the picture illustrates, e.g. "Avocat (fruit)": tells senses apart. */
  title: string;
  /** Thumbnail URL on upload.wikimedia.org (served with CORS, so it can be re-encoded locally). */
  src: string;
  /** Article URL, for the credit line. */
  page: string;
}

const API = "https://fr.wikipedia.org/w/api.php";

/** Search query for a word: the headword without a leading article or reflexive pronoun. */
export function pictureQuery(word: string) {
  return word
    .trim()
    .replace(/^(un|une|le|la|les|l'|l’|des|se|s'|s’)\s*/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

interface ApiPage {
  title: string;
  index?: number;
  thumbnail?: { source: string; width: number; height: number };
}

/** Up to `limit` pictures, best match first; throws a readable error when offline. */
export async function searchPictures(word: string, limit = 6): Promise<PictureHit[]> {
  const q = pictureQuery(word);
  if (!q) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    generator: "search",
    gsrsearch: q,
    gsrlimit: "12",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "480",
    pilicense: "free",
  });
  let data: { query?: { pages?: ApiPage[] } };
  try {
    const res = await fetch(`${API}?${params}`);
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch {
    throw new Error("连不上维基百科，自动配图需要联网");
  }
  const pages = (data.query?.pages ?? []).filter((p) => p.thumbnail?.source).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const seen = new Set<string>();
  const out: PictureHit[] = [];
  for (const p of pages) {
    const src = p.thumbnail!.source;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({ title: p.title, src, page: `https://fr.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}` });
    if (out.length >= limit) break;
  }
  return out;
}

/** Download a found picture and store-ready encode it (same size and format as an uploaded one). */
export async function pictureFromUrl(src: string): Promise<string> {
  let blob: Blob;
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    blob = await res.blob();
  } catch {
    throw new Error("图片下载失败，换一张试试");
  }
  return fileToImage(new File([blob], "picture", { type: blob.type || "image/jpeg" }));
}
