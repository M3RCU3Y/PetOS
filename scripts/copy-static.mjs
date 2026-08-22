import { cp, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const out = new URL("dist/", root);
await mkdir(out, { recursive: true });
await cp(new URL("web/index.html", root), new URL("index.html", out));
await cp(new URL("web/styles.css", root), new URL("styles.css", out));
await cp(new URL("web/packs", root), new URL("packs", out), { recursive: true });
await cp(new URL("web/sheets", root), new URL("sheets", out), { recursive: true });
