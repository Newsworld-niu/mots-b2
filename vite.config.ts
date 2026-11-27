import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { aiProxy } from "./ai-proxy";
import { dictionaryProxy } from "./dictionary-proxy";
// Local-only content is never copied into dist or the public archive.
function localMedia(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const route = (req.url || "").split("?")[0];
  const root = path.resolve(".local");
  if (route === "/local/catalog.json") {
    const file = path.join(root, "catalog.json");
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
    return;
  }
  const match = route.match(
    /^\/local\/media\/(image|uk|us|sentence)\/(\d{1,5})$/,
  );
  if (!match) {
    next();
    return;
  }
  try {
    const map = JSON.parse(
      fs.readFileSync(path.join(root, "media-map.json"), "utf8"),
    );
    const stored = map[match[2]]?.[match[1]];
    const file =
      typeof stored === "string"
        ? path.isAbsolute(stored)
          ? stored
          : path.resolve(root, stored)
        : undefined;
    if (!file || !fs.existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const types: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
    };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", "bytes");
    const size = fs.statSync(file).size;
    const range = req.headers.range;
    if (range) {
      const r = range.match(/^bytes=(\d+)-(\d*)$/);
      const start = r ? Number(r[1]) : -1;
      const end = r && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
      if (start < 0 || start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", end - start + 1);
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", size);
      fs.createReadStream(file).pipe(res);
    }
  } catch {
    res.statusCode = 404;
    res.end();
  }
}
function precacheManifest(): Plugin {
  return {
    name: "precache-manifest",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => /^assets\/.*\.(?:js|css)$/i.test(fileName))
        .sort();
      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.json",
        source: JSON.stringify({ assets }),
      });
    },
  };
}

function robotsHtml(): Plugin {
  const robots =
    process.env.VITE_ROBOTS ||
    (process.env.VITE_PUBLIC_SITE === "1" ? "index, follow" : "noindex, nofollow");
  return {
    name: "robots-meta",
    transformIndexHtml(html) {
      return html.replace("__VITE_ROBOTS__", robots);
    },
  };
}

function stripOffloadedMedia(): Plugin {
  let outDirAbs = path.resolve("dist");
  return {
    name: "strip-offloaded-media",
    configResolved(config) {
      outDirAbs = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const mediaBase = process.env.VITE_MEDIA_BASE_URL?.trim();
      const offloadLexdb = process.env.VITE_OFFLOAD_LEXDB === "1";
      if (!mediaBase && !offloadLexdb) return;
      let removedFiles = 0;
      let removedBytes = 0;
      const walkRemove = (dir: string, filter: (full: string) => boolean) => {
        if (!fs.existsSync(dir)) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) walkRemove(full, filter);
          else if (filter(full)) {
            removedFiles++;
            removedBytes += fs.statSync(full).size;
            fs.rmSync(full, { force: true });
          }
        }
      };
      if (mediaBase) {
        const audioDir = path.join(outDirAbs, "atlas", "audio");
        walkRemove(audioDir, () => true);
        fs.rmSync(audioDir, { recursive: true, force: true });
        const matDir = path.join(outDirAbs, "materials");
        walkRemove(matDir, (full) => /\.(?:mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)$/i.test(full));
      }
      if (offloadLexdb) {
        const lexdbDir = path.join(outDirAbs, "lexdb");
        walkRemove(lexdbDir, () => true);
        fs.rmSync(lexdbDir, { recursive: true, force: true });
      }
      const mb = (removedBytes / (1024 * 1024)).toFixed(1);
      console.log(
        `[strip-offloaded-media] VITE_MEDIA_BASE_URL=${mediaBase ?? ""} VITE_OFFLOAD_LEXDB=${offloadLexdb ? "1" : "0"} -> stripped ${removedFiles} files (${mb} MB) from ${path.relative(process.cwd(), outDirAbs)}`,
      );
    },
  };
}

export default defineConfig({
  // Deploy under a sub-path with ATLAS_BASE=/words/ npm run build
  base: process.env.ATLAS_BASE || "/",
  plugins: [
    react(),
    precacheManifest(),
    robotsHtml(),
    stripOffloadedMedia(),
    {
      name: "private-local-library",
      configureServer(server) {
        server.middlewares.use(localMedia);
        server.middlewares.use(aiProxy);
        server.middlewares.use(dictionaryProxy);
      },
      configurePreviewServer(server) {
        server.middlewares.use(localMedia);
        server.middlewares.use(aiProxy);
        server.middlewares.use(dictionaryProxy);
      },
    },
  ],
  server: { port: 5188, strictPort: true },
  preview: { port: 5188, strictPort: true },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
