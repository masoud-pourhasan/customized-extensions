// Markdown Preview VS2019 Theme (for Markdown Preview Enhanced)
// -------------------------------------------------------------
// MPE reads per-user styling from ~/.crossnote/. VS Code extensions cannot
// hook another extension's theme system directly, so this extension ships the
// styling as bundled assets and copies them into the user's global
// ~/.crossnote/ folder on request. Existing files are backed up (never
// overwritten silently).

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Files bundled under assets/crossnote/ that make up the theme.
const ASSET_FILES = [
  "style.less",
  "parser.js",
  "mermaid-panzoom.js",
  "head.html",
  "config.js",
];

const DISMISS_KEY = "mdPrettyView.applyPromptDismissed";

function crossnoteDir() {
  return path.join(os.homedir(), ".crossnote");
}

function assetsDir(context) {
  return path.join(context.extensionPath, "assets", "crossnote");
}

/** True if every bundled asset already exists identically in ~/.crossnote. */
function isInstalled(context) {
  const dir = crossnoteDir();
  return ASSET_FILES.every((f) => {
    const dst = path.join(dir, f);
    const src = path.join(assetsDir(context), f);
    if (!fs.existsSync(dst)) return false;
    try {
      return fs.readFileSync(dst, "utf8") === fs.readFileSync(src, "utf8");
    } catch {
      return false;
    }
  });
}

/** Copy bundled assets into ~/.crossnote, backing up any differing files. */
async function applyTheme(context) {
  const dir = crossnoteDir();
  const src = assetsDir(context);

  // Detect files that already exist and differ from what we ship.
  const clashes = ASSET_FILES.filter((f) => {
    const dst = path.join(dir, f);
    if (!fs.existsSync(dst)) return false;
    try {
      return fs.readFileSync(dst, "utf8") !== fs.readFileSync(path.join(src, f), "utf8");
    } catch {
      return true;
    }
  });

  if (clashes.length) {
    const pick = await vscode.window.showWarningMessage(
      `~/.crossnote already contains custom files (${clashes.join(", ")}). ` +
        `Overwrite them? A timestamped .bak copy of each will be created first.`,
      { modal: true },
      "Overwrite (with backup)"
    );
    if (pick !== "Overwrite (with backup)") return;
  }

  try {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (const f of ASSET_FILES) {
      const dst = path.join(dir, f);
      if (
        fs.existsSync(dst) &&
        fs.readFileSync(dst, "utf8") !== fs.readFileSync(path.join(src, f), "utf8")
      ) {
        fs.copyFileSync(dst, `${dst}.${stamp}.bak`);
      }
      fs.copyFileSync(path.join(src, f), dst);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to write ~/.crossnote: ${err.message}`);
    return;
  }

  if (vscode.workspace.getConfiguration("mdPrettyView").get("applyMpeSettings", true)) {
    await applyMpeSettings();
  }

  const reload = await vscode.window.showInformationMessage(
    "MD Pretty View theme applied to ~/.crossnote. Reload window to see it in the MPE preview.",
    "Reload Window"
  );
  if (reload === "Reload Window") {
    vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}

/** Set the MPE settings the theme expects (global scope). */
async function applyMpeSettings() {
  const mpe = vscode.workspace.getConfiguration("markdown-preview-enhanced");
  const G = vscode.ConfigurationTarget.Global;
  await mpe.update("previewTheme", "none.css", G);
  await mpe.update("codeBlockTheme", "vscode.css", G);
  await mpe.update("previewColorScheme", "selectedPreviewTheme", G);
  // Required for the Mermaid pan/zoom script to run in the preview.
  await mpe.update("enableScriptExecution", true, G);
}

/** Remove the theme files we installed, restoring the most recent .bak if any. */
async function removeTheme() {
  const dir = crossnoteDir();
  const confirm = await vscode.window.showWarningMessage(
    "Remove the VS2019 theme files from ~/.crossnote? Any .bak backups are left in place.",
    { modal: true },
    "Remove"
  );
  if (confirm !== "Remove") return;
  for (const f of ASSET_FILES) {
    const dst = path.join(dir, f);
    try {
      if (fs.existsSync(dst)) fs.unlinkSync(dst);
    } catch {
      /* ignore */
    }
  }
  vscode.window.showInformationMessage(
    "VS2019 theme removed from ~/.crossnote. Reload the MPE preview to see the change."
  );
}

/** Flip the single `color-scheme` lever in ~/.crossnote/style.less. */
async function toggleMode() {
  const file = path.join(crossnoteDir(), "style.less");
  if (!fs.existsSync(file)) {
    vscode.window.showWarningMessage(
      "Theme not installed yet. Run \"MD Pretty View: Apply Theme (Global)\" first."
    );
    return;
  }
  let css = fs.readFileSync(file, "utf8");
  // The one lever line: `html, body, .crossnote.markdown-preview { color-scheme: dark; }`
  const re = /(color-scheme:\s*)(dark|light)(\s*;)/;
  const m = css.match(re);
  if (!m) {
    vscode.window.showWarningMessage("Could not find the color-scheme lever in style.less.");
    return;
  }
  const next = m[2] === "dark" ? "light" : "dark";
  css = css.replace(re, `$1${next}$3`);
  fs.writeFileSync(file, css, "utf8");
  vscode.window.showInformationMessage(
    `Markdown preview switched to ${next} mode. Reload the MPE preview to see it.`
  );
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("mdPrettyView.apply", () => applyTheme(context)),
    vscode.commands.registerCommand("mdPrettyView.remove", () => removeTheme()),
    vscode.commands.registerCommand("mdPrettyView.toggleMode", () => toggleMode())
  );

  // Prompt to apply on first run (common pattern; never writes without consent).
  if (!isInstalled(context) && !context.globalState.get(DISMISS_KEY)) {
    vscode.window
      .showInformationMessage(
        "Apply the Visual Studio 2019 theme to your Markdown Preview Enhanced previews?",
        "Apply",
        "Not now",
        "Don't ask again"
      )
      .then((choice) => {
        if (choice === "Apply") applyTheme(context);
        else if (choice === "Don't ask again") context.globalState.update(DISMISS_KEY, true);
      });
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
