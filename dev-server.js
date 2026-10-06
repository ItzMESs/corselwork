// Local stand-in for Vercel: serves public/ and runs api/*.js with Vercel-style req/res helpers.
// Usage: npm run dev   (needs DATABASE_URL and ADMIN_PASSWORD in .env)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const PORT = process.env.PORT || 3000;
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".webp":"image/webp", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".json":"application/json" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    let handler;
    try { handler = (await import(pathToFileURL(join("api", name + ".js")).href)).default; }
    catch { res.writeHead(404).end("Not found"); return; }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw && (req.headers["content-type"] || "").includes("json") ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    return handler(req, res);
  }
  let path = normalize(url.pathname).replace(/^(\.\.[\\/])+/, "");
  if (path.endsWith("/") || path.endsWith("\\")) path += "index.html";
  if (!extname(path)) path += ".html";   // cleanUrls: /admin → admin.html
  try {
    const data = await readFile(join("public", path));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }).end(data);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
