// Serves the preview: this repo's files from its root, and Foundry's own fonts,
// icons and system art passed through from the local Foundry. Foundry itself
// cannot host the page, because it sends .html from its data folder as
// text/plain.
//
//   node tools/preview/serve.mjs      then open http://localhost:30010/tools/preview/
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PREVIEW_PORT ?? 30010);
const FOUNDRY = process.env.FOUNDRY_URL ?? "http://localhost:30001";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FROM_FOUNDRY = ["/fonts/", "/icons/", "/systems/"];
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp"
};

// POST a PNG data URL here (threadworkPreview.snapshot() does) to save it under
// tools/preview/.snapshots/, for reviewing frames when the browser cannot be seen.
const SNAPSHOTS = join(ROOT, "tools", "preview", ".snapshots");

async function saveSnapshot(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const dataUrl = Buffer.concat(chunks).toString("utf8");
  const name = `${new URL(request.url, "http://x").searchParams.get("name") ?? "frame"}.png`.replace(/[^\w.-]/g, "_");
  await mkdir(SNAPSHOTS, { recursive: true });
  await writeFile(join(SNAPSHOTS, name), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end(join(SNAPSHOTS, name));
}

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://x").pathname);
  try {
    if (request.method === "POST" && path === "/__snapshot") return await saveSnapshot(request, response);
    if (FROM_FOUNDRY.some((prefix) => path.startsWith(prefix))) {
      const upstream = await fetch(FOUNDRY + path);
      response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream" });
      response.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const file = normalize(join(ROOT, path.endsWith("/") ? `${path}index.html` : path));
    if (!file.startsWith(normalize(ROOT)) || file.split(sep).includes(".git")) throw Object.assign(new Error("outside"), { code: "ENOENT" });
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 502, { "Content-Type": "text/plain" });
    response.end(error.code === "ENOENT" ? "Not found" : `Upstream failed: ${error.message}`);
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Threadwork preview: http://localhost:${PORT}/tools/preview/`));
