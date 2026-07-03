// Renders icon.svg → icon.png (256×256) using @resvg/resvg-js (no system deps).
// Dev-only helper: run `npm run icon`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const svg = readFileSync(join(root, "icon.svg"), "utf8");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 256 } });
const png = resvg.render().asPng();
writeFileSync(join(root, "icon.png"), png);
console.log("Wrote icon.png (256x256)");
