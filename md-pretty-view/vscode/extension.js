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

// Match the ACTUAL lever rule (scoped by the `.crossnote.markdown-preview`
// selector) rather than any `color-scheme:` text that may appear in comments.
const SCHEME_RE = /(\.crossnote\.markdown-preview\s*\{\s*color-scheme:\s*)(dark|light)/;

// The 3 bundled accent hues, matching THE ACCENT LEVER block in style.less.
// Plain hex/rgba literals only (no color-mix()/division) — see that file's
// comment for why. Combined with the light/dark scheme lever, these give
// 3 light + 3 dark = 6 total theme combinations.
const ACCENTS = [
  {
    id: "blue",
    name: "Blue",
    swatch: "🔵",
    light: "#0969da",
    lightHover: "#0a5cc0",
    lightWashBq: "rgba(9, 105, 218, 0.06)",
    lightWashCode: "rgba(9, 105, 218, 0.08)",
    dark: "#4fc3f7",
    darkHover: "#81d4fa",
    darkWashBq: "rgba(79, 195, 247, 0.08)",
    darkWashCode: "rgba(79, 195, 247, 0.10)",
  },
  {
    // Same OKLCh lightness + chroma as blue, hue rotated to green — a true
    // "variant" of blue rather than an independently-picked color, and
    // verified to keep WCAG AA contrast (a naive HSL hue-rotation instead
    // breaks contrast badly here, e.g. green light drops to ~1.9:1 on white).
    id: "green",
    name: "Green",
    swatch: "🟢",
    light: "#008a1d",
    lightHover: "#007919",
    lightWashBq: "rgba(0, 138, 29, 0.06)",
    lightWashCode: "rgba(0, 138, 29, 0.08)",
    dark: "#79cb86",
    darkHover: "#9cd9a4",
    darkWashBq: "rgba(121, 203, 134, 0.08)",
    darkWashCode: "rgba(121, 203, 134, 0.10)",
  },
  {
    // Same OKLCh lightness + chroma as blue, hue rotated to purple.
    id: "purple",
    name: "Purple",
    swatch: "🟣",
    light: "#7a4ecf",
    lightHover: "#6b44b6",
    lightWashBq: "rgba(122, 78, 207, 0.06)",
    lightWashCode: "rgba(122, 78, 207, 0.08)",
    dark: "#bba4fd",
    darkHover: "#ccbbff",
    darkWashBq: "rgba(187, 164, 253, 0.08)",
    darkWashCode: "rgba(187, 164, 253, 0.10)",
  },
];

// Marks the start of the accent variable block in style.less; the block runs
// from this line to the next top-level `}` (see THE ACCENT LEVER there).
const ACCENT_MARKER = "/* md-pretty-accent:";

function buildAccentBlock(accent) {
  return `${ACCENT_MARKER} ${accent.id} */
    --md-pretty-accent-light:           ${accent.light};
    --md-pretty-accent-light-hover:     ${accent.lightHover};
    --md-pretty-accent-light-wash-bq:   ${accent.lightWashBq};
    --md-pretty-accent-light-wash-code: ${accent.lightWashCode};
    --md-pretty-accent-dark:            ${accent.dark};
    --md-pretty-accent-dark-hover:      ${accent.darkHover};
    --md-pretty-accent-dark-wash-bq:    ${accent.darkWashBq};
    --md-pretty-accent-dark-wash-code:  ${accent.darkWashCode};`;
}

/** Current accent id from the marker comment, or undefined if not found. */
function readAccentId(css) {
  const start = css.indexOf(ACCENT_MARKER);
  if (start === -1) return undefined;
  const m = css.slice(start, start + 60).match(/\/\*\s*md-pretty-accent:\s*(\w+)\s*\*\//);
  return m ? m[1] : undefined;
}

/** Replace the whole accent variable block (marker line through the next `}`). */
function writeAccentBlock(css, accent) {
  const start = css.indexOf(ACCENT_MARKER);
  if (start === -1) return null;
  const end = css.indexOf("\n}", start);
  if (end === -1) return null;
  return css.slice(0, start) + buildAccentBlock(accent) + css.slice(end);
}

// The 6 selectable combinations (3 accents × 2 schemes), in display order.
const THEMES = [];
for (const accent of ACCENTS) {
  for (const scheme of ["light", "dark"]) {
    THEMES.push({
      accent,
      scheme,
      label: `${accent.swatch} ${accent.name} · ${scheme === "light" ? "Light" : "Dark"}`,
    });
  }
}

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
  // Determine the current mode from the first file that has the lever.
  let current;
  for (const file of files) {
    const m = fs.readFileSync(file, "utf8").match(SCHEME_RE);
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
      if (SCHEME_RE.test(css)) fs.writeFileSync(file, css.replace(SCHEME_RE, `$1${next}`), "utf8");
    } catch {
      /* ignore individual file failures */
    }
  }
  vscode.window.showInformationMessage(
    `Markdown preview switched to ${next} mode. Reload the MPE preview to see it.`
  );
}

/**
 * Let the user pick one of the 6 bundled theme combinations (3 accents ×
 * light/dark) and write both levers — the `color-scheme` lever and the
 * `--md-pretty-accent-*` accent block — into the global style.less in one
 * pass. The accent lever is intentionally NOT duplicated into workspace
 * copies either, for the same reason the scheme lever isn't (see
 * `styleLessFiles`): a second copy would win over the global pick.
 */
async function chooseTheme() {
  const files = styleLessFiles();
  if (!files.length) {
    vscode.window.showWarningMessage(
      "Theme not installed yet. Run \"MD Pretty View: Apply Theme (Global)\" first."
    );
    return;
  }

  // Determine the current combo from the first file that has both levers.
  let currentScheme, currentAccentId;
  for (const file of files) {
    const css = fs.readFileSync(file, "utf8");
    const schemeMatch = css.match(SCHEME_RE);
    if (schemeMatch) currentScheme = schemeMatch[2];
    const accentId = readAccentId(css);
    if (accentId) currentAccentId = accentId;
    if (currentScheme && currentAccentId) break;
  }

  const items = THEMES.map((t) => ({
    label: t.label,
    description:
      t.scheme === currentScheme && t.accent.id === currentAccentId ? "current" : undefined,
    theme: t,
  }));

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: "Choose a MD Pretty View theme",
  });
  if (!pick) return;

  const { accent, scheme } = pick.theme;
  for (const file of files) {
    try {
      let css = fs.readFileSync(file, "utf8");
      if (SCHEME_RE.test(css)) css = css.replace(SCHEME_RE, `$1${scheme}`);
      const withAccent = writeAccentBlock(css, accent);
      if (withAccent) css = withAccent;
      fs.writeFileSync(file, css, "utf8");
    } catch {
      /* ignore individual file failures */
    }
  }
  vscode.window.showInformationMessage(
    `Markdown preview switched to ${pick.theme.label}. Reload the MPE preview to see it.`
  );
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("mdPrettyView.apply", () => applyTheme(context)),
    vscode.commands.registerCommand("mdPrettyView.remove", () => removeTheme()),
    vscode.commands.registerCommand("mdPrettyView.toggleMode", () => toggleMode()),
    vscode.commands.registerCommand("mdPrettyView.chooseTheme", () => chooseTheme())
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
