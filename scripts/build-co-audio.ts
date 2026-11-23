/**
 * Pre-render multi-speaker neural MP3 files for built-in DELF B2 CO preset papers
 * into `public/materials/co/` using Azure AI Speech SSML.
 *
 * Manual opt-in only (uses paid Azure credentials; auto-loads `.env.local` if unset):
 *   npm run co:audio
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDialogueSsmlBatches } from "../src/ai/ssml";
import { ffmpegFilterForEnv, isAcousticEnv, type AcousticEnv } from "../src/lib/audio-env";
import { speechTurns } from "../src/lib/exam";
import { PRESET_PAPERS } from "../src/lib/exam-presets";

export function parseCliAcousticEnv(argv: readonly string[]): AcousticEnv {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--env=")) {
      const val = arg.slice("--env=".length).trim();
      if (isAcousticEnv(val)) return val;
      throw new Error(`Invalid --env value "${val}" (expected clean|studio|phone|street)`);
    }
    if (arg === "--env") {
      const val = (argv[i + 1] ?? "").trim();
      if (isAcousticEnv(val)) return val;
      throw new Error(`Invalid --env value "${val}" (expected clean|studio|phone|street)`);
    }
  }
  return "clean";
}

const PAPER_VOICES: Record<string, string[]> = {
  "preset-listen-1": ["fr-FR-DeniseNeural", "fr-CA-JeanNeural", "fr-FR-HenriNeural", "fr-CA-SylvieNeural"],
  "preset-listen-2": ["fr-FR-BrigitteNeural", "fr-BE-GerardNeural", "fr-BE-CharlineNeural", "fr-FR-AlainNeural"],
  "preset-listen-3": ["fr-FR-CoralieNeural", "fr-CH-FabriceNeural", "fr-CH-ArianeNeural", "fr-FR-JeromeNeural"],
  "preset-listen-4": ["fr-FR-CelesteNeural", "fr-CA-AntoineNeural", "fr-BE-CharlineNeural", "fr-FR-ClaudeNeural"],
  "preset-listen-5": ["fr-FR-JosephineNeural", "fr-CA-SylvieNeural", "fr-CH-FabriceNeural", "fr-FR-HenriNeural"],
};
const DEFAULT_VOICES = ["fr-FR-DeniseNeural", "fr-CA-JeanNeural", "fr-BE-CharlineNeural", "fr-CH-FabriceNeural"];

function loadDotEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

async function synthBatch(region: string, key: string, ssml: string): Promise<Uint8Array> {
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS failed (${res.status}): ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

let warnedNoFfmpeg = false;

/**
 * Remux multi-batch MP3 chunks cleanly without mid-stream ID3/Xing header glitches,
 * apply optional acoustic environment simulation, and normalize loudness (-16 LUFS).
 */
async function remuxAndNormalizeMp3(parts: Uint8Array[], outPath: string, env: AcousticEnv = "clean"): Promise<void> {
  if (!parts.length) return;
  const workDir = await mkdtemp(join(tmpdir(), "co-audio-"));
  try {
    const partFiles: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const f = join(workDir, `part-${i}.mp3`);
      await writeFile(f, parts[i]);
      partFiles.push(f);
    }
    const listFile = join(workDir, "concat.txt");
    const listBody = partFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listFile, listBody, "utf8");
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-af",
        ffmpegFilterForEnv(env),
        "-ar",
        "24000",
        "-ac",
        "1",
        "-b:a",
        "48k",
        outPath,
      ],
      { stdio: "pipe" },
    );
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      if (!warnedNoFfmpeg) {
        console.warn("[warn] ffmpeg not found in PATH; falling back to raw MP3 byte write without -16 LUFS normalization.");
        warnedNoFfmpeg = true;
      }
      await writeFile(outPath, concatBytes(parts));
      return;
    }
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const env = parseCliAcousticEnv(argv);
  loadDotEnvLocal();
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) {
    console.log("Skipping CO audio pre-render: set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to generate public/materials/co/*.mp3");
    return;
  }
  const force = argv.includes("--force");
  const outDir = join(process.cwd(), "public", "materials", "co");
  await mkdir(outDir, { recursive: true });
  const listenPapers = PRESET_PAPERS.filter((p) => p.kind === "listen");
  const envSuffix = env === "clean" ? "" : `-${env}`;

  for (const p of listenPapers) {
    const voices = PAPER_VOICES[p.id] ?? DEFAULT_VOICES;
    for (const [eIdx, ex] of p.exs.entries()) {
      for (const [dIdx, doc] of ex.docs.entries()) {
        const rel = `materials/co/${p.id}-e${eIdx + 1}-d${dIdx + 1}${envSuffix}.mp3`;
        const abs = join(process.cwd(), "public", rel);
        if (!force && (await stat(abs).catch(() => null))) {
          console.log(`[skip] ${rel} (already exists)`);
          continue;
        }
        const turns = speechTurns(doc.text);
        const batches = buildDialogueSsmlBatches(turns, voices, { style: p.style ?? "natural" });
        const parts: Uint8Array[] = [];
        for (const ssml of batches) parts.push(await synthBatch(region, key, ssml));
        await remuxAndNormalizeMp3(parts, abs, env);
        console.log(`[ok] ${rel} [env=${env}] (${voices.join(", ")})`);
      }
    }
  }
}

const isDirectCli = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectCli) {
  void main();
}
