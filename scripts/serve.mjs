import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist", import.meta.url));
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json" };
const server = http.createServer(async (req, res) => {
  try {
    const raw = req.url === "/" ? "/index.html" : req.url ?? "/index.html";
    const path = normalize(join(root, raw.split("?")[0]));
    if (!path.startsWith(root)) throw new Error("bad path");
    const s = await stat(path);
    const file = s.isDirectory() ? join(path, "index.html") : path;
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control":"no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
server.listen(4173, "127.0.0.1", () => console.log("PetOS web preview: http://127.0.0.1:4173/"));
