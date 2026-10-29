// Serves out/ (the built site) the way Cloudflare Pages does: addresses with a trailing slash find their index.html,
// "/" goes to "/en/" (public/_redirects), and anything unknown gets 404.html with a 404 status.
//
//   npm run build && npm run preview          then open http://localhost:4173
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "out");
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };

/** Answers one request from out/ (used by the preview server below and by the browser tests' server). */
export function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    res.writeHead(302, { Location: "/en/" }).end();
    return;
  }
  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith("/")) return void res.writeHead(308, { Location: `${pathname}/${url.search}` }).end();
    file = path.join(file, "index.html");
  }
  let status = 200;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = path.join(ROOT, "404.html");
    status = 404;
  }
  res.writeHead(status, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}

if (process.argv[1]?.endsWith("preview.mjs")) {
  createServer(serveStatic).listen(PORT, () => console.log(`Quest Board TPK preview: http://localhost:${PORT}`));
}
