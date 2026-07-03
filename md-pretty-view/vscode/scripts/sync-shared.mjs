// Syncs the shared theme assets into this VS Code extension's bundle.
// The single source of truth for the Markdown styling (crossnote theme) lives in
// ../../shared/crossnote so it can be reused by the browser extensions too. The
// VS Code extension loads its assets from `context.extensionPath/assets/crossnote`
// (see extension.js), which must live inside the packaged .vsix — so we copy the
// shared files here. Runs automatically on `postinstall` and `vscode:prepublish`.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const vscodeDir = dirname(dirname(fileURLToPath(import.meta.url))); // .../md-pretty-view/vscode
const sharedCrossnote = join(vscodeDir, "..", "shared", "crossnote");
const destCrossnote = join(vscodeDir, "assets", "crossnote");

rmSync(destCrossnote, { recursive: true, force: true });
mkdirSync(destCrossnote, { recursive: true });
cpSync(sharedCrossnote, destCrossnote, { recursive: true });
console.log("Synced shared/crossnote -> vscode/assets/crossnote");
