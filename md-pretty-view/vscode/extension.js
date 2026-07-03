// MD Pretty View — a styling theme for Markdown Preview Enhanced
// -------------------------------------------------------------
// MPE reads per-user styling from its global config folder. VS Code extensions
// cannot hook another extension's theme system directly, so this extension ships
// the styling as bundled assets and copies them into that folder on request.
// The folder location is resolved by crossnoteDir() to match MPE's own logic
// (it is NOT always ~/.crossnote — on macOS/Linux it is ~/.local/state/crossnote
// unless XDG_CONFIG_HOME or the configPath setting is set). Existing files are
// backed up (never overwritten silently).

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

// Files copied into each workspace's `.crossnote/`. Deliberately EXCLUDES
// style.less: the light/dark lever lives ONLY in the global style.less so it has
// a single source of truth. MPE concatenates a workspace style.less AFTER the
// global one, so a second copy of the lever would override the global toggle
// (last declaration wins) — making "Toggle Light/Dark" appear stuck. The
// workspace still needs the pan/zoom script plus parser/head/config so MPE's
// per-workspace config override doesn't clobber the global parser/head/mermaid.
const WORKSPACE_ASSET_FILES = ASSET_FILES.filter((f) => f !== "style.less");

const DISMISS_KEY = "mdPrettyView.applyPromptDismissed";

/**
 * Resolve the folder MPE actually reads its global config from.
 * This MUST mirror crossnote's own resolution logic, otherwise we write
 * files MPE never loads. As of MPE 0.8.x the order is:
 *   1. `markdown-preview-enhanced.configPath` setting (with ~ expansion)
 *   2. Windows            -> ~/.crossnote
 *   3. $XDG_CONFIG_HOME    -> $XDG_CONFIG_HOME/crossnote
 *   4. otherwise (mac/*nix) -> ~/.local/state/crossnote
 */
function crossnoteDir() {
  const configPath = vscode.workspace
    .getConfiguration("markdown-preview-enhanced")
    .get("configPath", "");
  if (typeof configPath === "string" && configPath !== "") {
    return configPath.replace(/^~/, os.homedir());
  }
  if (process.platform === "win32") {
    return path.join(os.homedir(), ".crossnote");
  }
  if (typeof process.env.XDG_CONFIG_HOME === "string" && process.env.XDG_CONFIG_HOME !== "") {
    return path.resolve(process.env.XDG_CONFIG_HOME, "crossnote");
  }
  return path.resolve(os.homedir(), ".local/state/crossnote");
}

function assetsDir(context) {
  return path.join(context.extensionPath, "assets", "crossnote");
}

/** Ensure `.crossnote/` is git-ignored in the given workspace folder (best-effort). */
function ensureGitignore(folderFsPath) {
  const gi = path.join(folderFsPath, ".gitignore");
  try {
    let content = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
    const alreadyIgnored = content.split(/\r?\n/).some((l) => {
      const t = l.trim();
      return t === ".crossnote" || t === ".crossnote/" || t === "/.crossnote" || t === "/.crossnote/";
    });
    if (alreadyIgnored) return;
    const sep = content.length === 0 || content.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(gi, `${sep}\n# Added by MD Pretty View — Markdown Preview Enhanced pan/zoom assets\n.crossnote/\n`);
  } catch {
    /* gitignore update is best-effort */
  }
}

/**
 * Copy the FULL theme folder into each open workspace folder's `.crossnote/`.
 *
 * WHY: MPE loads a workspace-local `.crossnote/` config in ADDITION to the global
 * one and merges it OVER the global config — `parserConfig`, `head.html` and the
 * mermaid/katex/mathjax configs are overridden by the workspace copy (only CSS is
 * concatenated). So a partial folder would clobber those globals; the folder must
 * contain the complete set. Placing the assets at the workspace root is ALSO what
 * makes the pan/zoom `@import "/.crossnote/mermaid-panzoom.js"` resolve: MPE only
 * builds a loadable webview URI for imports under the project root or the markdown
 * file's folder, never the global config folder. Existing differing files are
 * backed up. `.crossnote/` is added to the workspace `.gitignore`.
 *
 * NOTE: style.less is intentionally NOT copied here (see WORKSPACE_ASSET_FILES) so
 * the light/dark lever stays single-sourced in the global style.less; any old
 * workspace style.less is removed to undo the earlier behavior.
 *
 * @returns {string[]} absolute paths of workspace folders written to
 */
function applyWorkspaceCopies(context) {
  const src = assetsDir(context);
  const folders = vscode.workspace.workspaceFolders || [];
  const written = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const dst = path.join(root, ".crossnote");
    try {
      fs.mkdirSync(dst, { recursive: true });
      for (const f of WORKSPACE_ASSET_FILES) {
        const dstFile = path.join(dst, f);
        const srcFile = path.join(src, f);
        if (
          fs.existsSync(dstFile) &&
          fs.readFileSync(dstFile, "utf8") !== fs.readFileSync(srcFile, "utf8")
        ) {
          fs.copyFileSync(dstFile, `${dstFile}.${stamp}.bak`);
        }
        fs.copyFileSync(srcFile, dstFile);
      }
      // Migration: remove any real workspace style.less shipped by older versions
      // — its duplicate color-scheme lever would override the global toggle.
      try {
        const wsStyle = path.join(dst, "style.less");
        if (fs.existsSync(wsStyle)) fs.unlinkSync(wsStyle);
      } catch {
        /* ignore */
      }
      ensureGitignore(root);
      written.push(root);
    } catch {
      /* skip workspace folders we cannot write to */
    }
  }
  return written;
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
      `${dir} already contains custom files (${clashes.join(", ")}). ` +
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
    vscode.window.showErrorMessage(`Failed to write ${dir}: ${err.message}`);
    return;
  }

  if (vscode.workspace.getConfiguration("mdPrettyView").get("applyMpeSettings", true)) {
    await applyMpeSettings();
  }

  // Mermaid pan/zoom needs its script at the workspace root (the global folder is
  // unreachable by MPE's `@import` path resolution), so copy the full theme into
  // each open workspace's `.crossnote/`. Without an open workspace, styling still
  // works from the global folder but pan/zoom will not.
  const workspaces = applyWorkspaceCopies(context);
  const zoomNote = workspaces.length
    ? ` Mermaid pan/zoom enabled in ${workspaces.length} workspace folder(s).`
    : " Open a workspace folder and re-run Apply to enable Mermaid pan/zoom there.";

  const reload = await vscode.window.showInformationMessage(
    `MD Pretty View theme applied to ${dir}.${zoomNote} Reload window to see it in the MPE preview.`,
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
    `Remove the MD Pretty View theme files from ${dir}? Any .bak backups are left in place.`,
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

  // Remove workspace-local copies too (leave any .bak backups and .gitignore).
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const wsDir = path.join(folder.uri.fsPath, ".crossnote");
    for (const f of ASSET_FILES) {
      try {
        const p = path.join(wsDir, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
    try {
      if (fs.existsSync(wsDir) && fs.readdirSync(wsDir).length === 0) fs.rmdirSync(wsDir);
    } catch {
      /* ignore — folder not empty (e.g. leftover .bak) */
    }
  }

  vscode.window.showInformationMessage(
    `MD Pretty View theme removed from ${dir} and open workspace folders. Reload the MPE preview to see the change.`
  );
}

/**
 * The single style.less that owns the light/dark lever: the GLOBAL copy.
 * The lever is intentionally NOT duplicated into workspace `.crossnote/` copies
 * (MPE concatenates those after the global CSS, so a second lever would win and
 * make this toggle appear stuck). Kept as an array for the existing callers.
 */
function styleLessFiles() {
  const f = path.join(crossnoteDir(), "style.less");
  return fs.existsSync(f) ? [f] : [];
}

/**
 * Flip the single `color-scheme` lever in the global style.less. Because the
 * lever lives only in the global copy, this is the one source of truth and the
 * toggle is independent of the VS Code editor theme.
 */
async function toggleMode() {
  const files = styleLessFiles();
  if (!files.length) {
    vscode.window.showWarningMessage(
      "Theme not installed yet. Run \"MD Pretty View: Apply Theme (Global)\" first."
    );
    return;
  }
  // Match the ACTUAL lever rule (scoped by the `.crossnote.markdown-preview`
  // selector) rather than any `color-scheme:` text that may appear in comments.
  const re = /(\.crossnote\.markdown-preview\s*\{\s*color-scheme:\s*)(dark|light)/;
  // Determine the current mode from the first file that has the lever.
  let current;
  for (const file of files) {
    const m = fs.readFileSync(file, "utf8").match(re);
    if (m) {
      current = m[2];
      break;
    }
  }
  if (!current) {
    vscode.window.showWarningMessage("Could not find the color-scheme lever in style.less.");
    return;
  }
  const next = current === "dark" ? "light" : "dark";
  for (const file of files) {
    try {
      const css = fs.readFileSync(file, "utf8");
      if (re.test(css)) fs.writeFileSync(file, css.replace(re, `$1${next}`), "utf8");
    } catch {
      /* ignore individual file failures */
    }
  }
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
        "Apply the MD Pretty View theme to your Markdown Preview Enhanced previews?",
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
