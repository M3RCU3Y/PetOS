import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist", import.meta.url));
const host = "127.0.0.1";
const port = 4173;
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".svg":"image/svg+xml", ".ico":"image/x-icon" };
function isPetOSPreviewRunning(){
  return new Promise(resolve => {
    const request = http.get({host,port,path:"/",timeout:700}, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve(response.statusCode === 200 && /<title>PetOS<\/title>/i.test(body)));
    });
    request.on("timeout", () => { request.destroy(); resolve(false); });
    request.on("error", () => resolve(false));
  });
}
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
server.once("error", async error => {
  if(error?.code !== "EADDRINUSE") throw error;
  if(await isPetOSPreviewRunning()){
    console.log(`PetOS web preview is already running: http://${host}:${port}/`);
    process.exit(0);
  }
  console.error(`PetOS web preview cannot start: ${host}:${port} is already in use by another process.`);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`PetOS web preview: http://${host}:${port}/`));
