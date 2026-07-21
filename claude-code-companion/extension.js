"use strict";

const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const HOME = os.homedir();
const SETTINGS_PATH = path.join(HOME, ".claude", "settings.json");
const STATE_PATH = path.join(HOME, ".claude.json");
const PROJECTS_DIR = path.join(HOME, ".claude", "projects");

// ---------------------------------------------------------------------------
// Data readers (unchanged from earlier version — Claude Code's own files)
// ---------------------------------------------------------------------------

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** Claude Code maps a project cwd to a transcript folder by replacing
 *  every character outside [a-zA-Z0-9-] with "-". */
function projectDirFor(cwd) {
  return path.join(PROJECTS_DIR, cwd.replace(/[^a-zA-Z0-9-]/g, "-"));
}

const MODEL_NAMES = [
  [/^claude-fable-5/, "Fable 5"],
  [/^claude-opus-4-8/, "Opus 4.8"],
  [/^claude-opus-4-7/, "Opus 4.7"],
  [/^claude-opus-4/, "Opus 4"],
  [/^claude-sonnet-5/, "Sonnet 5"],
  [/^claude-sonnet-4-5/, "Sonnet 4.5"],
  [/^claude-haiku-4-5/, "Haiku 4.5"],
  [/^opusplan$/, "Opus Plan"],
  [/^default$/, "Default"],
];

function prettyModel(raw) {
  if (!raw) return { label: "Default", oneM: false };
  const oneM = /\[1m\]$/.test(raw);
  const base = raw.replace(/\[1m\]$/, "");
  for (const [re, name] of MODEL_NAMES) {
    if (re.test(base)) return { label: name, oneM };
  }
  const guess = base
    .replace(/^claude-/, "")
    .replace(/-(\d)/g, " $1")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: guess || raw, oneM };
}

function readGlobalSettings() {
  const s = readJsonSafe(SETTINGS_PATH) || {};
  return { model: s.model || null, effortLevel: s.effortLevel || null };
}

function readUsage() {
  const s = readJsonSafe(STATE_PATH);
  return (s && s.cachedUsageUtilization) || null;
}

/** Scan the tail of the most recent session transcript for the current
 *  workspace: last permission mode, last assistant model/effort, and the
 *  last reported token usage (≈ context window fill). */
function readSessionState(cwd) {
  const dir = projectDirFor(cwd);
  let files;
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const full = path.join(dir, f);
        return { full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return null;
  }
  if (!files.length) return null;

  const target = files[0];
  let fd;
  try {
    fd = fs.openSync(target.full, "r");
    const size = fs.fstatSync(fd).size;
    const readLen = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, size - readLen);
    const lines = buf.toString("utf8").split("\n");

    const state = {
      mtime: target.mtime,
      permissionMode: null,
      model: null,
      effort: null,
      contextTokens: null,
    };
    for (let i = lines.length - 1; i >= 0; i--) {
      let obj;
      try {
        obj = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (!state.permissionMode && obj.type === "user" && obj.permissionMode) {
        state.permissionMode = obj.permissionMode;
      }
      if (!state.model && obj.type === "assistant" && obj.message) {
        state.model = obj.message.model || null;
        state.effort = obj.effort || null;
        const u = obj.message.usage;
        if (u) {
          state.contextTokens =
            (u.input_tokens || 0) +
            (u.cache_read_input_tokens || 0) +
            (u.cache_creation_input_tokens || 0);
        }
      }
      if (state.permissionMode && state.model) break;
    }
    return state;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function bar(percent) {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 10);
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

function untilText(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return "resetting…";
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  if (h >= 24) return `resets in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `resets in ${h}h ${m}m`;
  return `resets in ${m}m`;
}

function agoText(ms) {
  if (ms == null) return "never";
  const diff = Date.now() - ms;
  if (diff < 90000) return "just now";
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

function kTokens(n) {
  if (n == null) return "–";
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function titleCase(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> spaced (e.g. acceptEdits)
    .replace(/[_-]+/g, " ") // snake/kebab-case -> spaced
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Claude Code's usage-limit `scope` is an object (e.g. `{ model: { display_name }, surface }`),
 *  not a string — pick the most useful human-readable piece of it, if any. */
function describeScope(scope) {
  if (!scope) return null;
  if (typeof scope === "string") return scope;
  if (typeof scope === "object") {
    if (scope.model && scope.model.display_name) return scope.model.display_name;
    if (scope.surface) return String(scope.surface);
  }
  return null;
}

function limitLabel(kind, scope) {
  const scopeLabel = describeScope(scope);
  return scopeLabel ? `${titleCase(kind)} (${scopeLabel})` : titleCase(kind);
}

const MODE_ICONS = {
  default: "$(shield)",
  auto: "$(zap)",
  acceptEdits: "$(edit)",
  plan: "$(checklist)",
  bypassPermissions: "$(unlock)",
  ultracode: "$(rocket)",
};

// ---------------------------------------------------------------------------
// Central state — computed once per refresh, consumed by every surface
// (status bar, sidebar webview, editor title bar).
// ---------------------------------------------------------------------------

function currentCwd() {
  return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : null;
}

function computeState(cfg) {
  const settings = readGlobalSettings();
  const usageRaw = readUsage();
  const cwd = currentCwd();
  const session = cwd ? readSessionState(cwd) : null;

  const modelPretty = prettyModel(settings.model);
  const effort = (session && session.effort) || settings.effortLevel || "default";
  const mode = (session && session.permissionMode) || null;

  const windowSize = /\[1m\]$/.test(settings.model || "") ? 1000000 : 200000;
  const contextPct =
    session && session.contextTokens != null ? Math.round((session.contextTokens / windowSize) * 100) : null;

  let usageFive = null,
    usageWeek = null,
    usageLimits = [],
    usageFetchedAt = null;
  if (usageRaw && usageRaw.utilization) {
    const u = usageRaw.utilization;
    usageFive = u.five_hour ? u.five_hour.utilization : null;
    usageWeek = u.seven_day ? u.seven_day.utilization : null;
    usageLimits = u.limits || [];
    usageFetchedAt = usageRaw.fetchedAtMs || null;
    var fiveResetAt = u.five_hour ? u.five_hour.resets_at : null;
    var weekResetAt = u.seven_day ? u.seven_day.resets_at : null;
  }

  const worst = Math.max(usageFive || 0, usageWeek || 0);
  const warnAt = cfg.get("usageWarningPercent");
  const errAt = cfg.get("usageErrorPercent");
  const severity = worst >= errAt ? "error" : worst >= warnAt ? "warning" : "normal";

  return {
    settings,
    modelRaw: settings.model,
    modelPretty,
    effort,
    session,
    mode,
    contextPct,
    usageFive,
    usageWeek,
    usageLimits,
    usageFetchedAt,
    fiveResetAt: typeof fiveResetAt !== "undefined" ? fiveResetAt : null,
    weekResetAt: typeof weekResetAt !== "undefined" ? weekResetAt : null,
    worst,
    severity,
  };
}

// ---------------------------------------------------------------------------
// Sidebar webview
// ---------------------------------------------------------------------------

class ClaudeCompanionViewProvider {
  constructor() {
    this.view = null;
    this.lastState = null;
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg && msg.type === "exec" && typeof msg.command === "string") {
        vscode.commands.executeCommand(msg.command);
      }
    });
    webviewView.onDidDispose(() => {
      this.view = null;
    });
    if (this.lastState) this.render(this.lastState);
  }

  update(state) {
    this.lastState = state;
    if (this.view) this.render(state);
  }

  render(state) {
    this.view.webview.html = buildSidebarHtml(state);
  }
}

function buildSidebarHtml(state) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const { modelPretty, modelRaw, effort, mode, contextPct, usageFive, usageWeek, usageLimits, usageFetchedAt } = state;

  const modeRow = mode
    ? `<div class="row" data-command="claudeCompanion.explainMode" tabindex="0" role="button">
         <span class="icon">${MODE_ICONS[mode] ? codiconSpan(MODE_ICONS[mode]) : "🛡"}</span>
         <span class="label">Mode</span>
         <span class="value">${escapeHtml(titleCase(mode))}</span>
       </div>
       ${contextPct != null ? `<div class="subtle">Context ~${contextPct}% of window</div>` : ""}`
    : `<div class="row disabled"><span class="label">Mode</span><span class="value">no active session</span></div>`;

  function limitRow(label, pct, resetAt) {
    if (pct == null) return "";
    const cls = pct >= 90 ? "err" : pct >= 70 ? "warn" : "ok";
    return `<div class="limit">
      <div class="limit-head"><span>${escapeHtml(label)}</span><span>${pct}%</span></div>
      <div class="track"><div class="fill ${cls}" style="width:${Math.min(100, pct)}%"></div></div>
      <div class="subtle">${escapeHtml(untilText(resetAt))}</div>
    </div>`;
  }

  const extraLimits = (usageLimits || [])
    .filter((l) => l.kind !== "session" && l.kind !== "weekly_all" && l.percent != null)
    .map((l) => limitRow(limitLabel(l.kind, l.scope), l.percent, l.resets_at))
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 8px 12px; font-size: 13px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--vscode-descriptionForeground); margin: 16px 0 6px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 4px; cursor: pointer; }
  .row:hover, .row:focus { background: var(--vscode-list-hoverBackground); outline: none; }
  .row.disabled { opacity: .6; cursor: default; }
  .row .icon { width: 16px; text-align: center; opacity: .8; }
  .row .label { flex: 1; color: var(--vscode-descriptionForeground); }
  .row .value { font-weight: 600; }
  .subtle { color: var(--vscode-descriptionForeground); font-size: 11px; padding: 0 4px 4px; }
  .limit { margin: 8px 4px 4px; }
  .limit-head { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .track { height: 6px; border-radius: 3px; background: var(--vscode-progressBar-background, rgba(128,128,128,.25)); overflow: hidden; }
  .fill { height: 100%; }
  .fill.ok { background: var(--vscode-charts-green, #3fb950); }
  .fill.warn { background: var(--vscode-charts-yellow, #d29922); }
  .fill.err { background: var(--vscode-charts-red, #f85149); }
  .actions { display: flex; gap: 6px; margin-top: 14px; }
  button { flex: 1; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .footer { margin-top: 14px; font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; }
</style>
</head>
<body>

<h2>Model &amp; effort</h2>
<div class="row" data-command="claudeCompanion.pickModel" tabindex="0" role="button">
  <span class="icon">✦</span>
  <span class="label">Model</span>
  <span class="value">${escapeHtml(modelPretty.label)}${modelPretty.oneM ? " · 1M" : ""}</span>
</div>
<div class="subtle">${escapeHtml(modelRaw || "default")}</div>
<div class="row" data-command="claudeCompanion.pickEffort" tabindex="0" role="button">
  <span class="icon">⏱</span>
  <span class="label">Effort</span>
  <span class="value">${escapeHtml(titleCase(effort))}</span>
</div>

<h2>Session</h2>
${modeRow}

<h2>Usage limits</h2>
${limitRow("Session (5h)", usageFive, state.fiveResetAt)}
${limitRow("Weekly (7d)", usageWeek, state.weekResetAt)}
${extraLimits}
${usageFive == null && usageWeek == null ? `<div class="subtle">No usage data yet — use Claude Code once to populate it.</div>` : ""}

<div class="actions">
  <button data-command="claudeCompanion.refresh">Refresh</button>
  <button data-command="claudeCompanion.chooseSurfaces">Surfaces…</button>
</div>
<div class="footer">Usage updated ${escapeHtml(agoText(usageFetchedAt))}</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-command]');
    if (el) vscode.postMessage({ type: 'exec', command: el.getAttribute('data-command') });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('[data-command]');
    if (el) { e.preventDefault(); vscode.postMessage({ type: 'exec', command: el.getAttribute('data-command') }); }
  });
</script>
</body>
</html>`;
}

function codiconSpan(id) {
  // id looks like "$(zap)"; sidebar HTML has no codicon font loaded, so just
  // fall back to the raw name — kept as a hook if a codicon font is added later.
  return id.replace(/^\$\(|\)$/g, "");
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

function activate(context) {
  const cfg = () => vscode.workspace.getConfiguration("claudeCompanion");

  // Status bar items
  const items = {
    // High, tightly-spaced priorities so these four stay grouped together and
    // ahead of other extensions' status bar items (e.g. Copilot), which
    // typically use much lower priority values. Higher priority = further left.
    model: vscode.window.createStatusBarItem("claudeCompanion.model", vscode.StatusBarAlignment.Right, 1004),
    effort: vscode.window.createStatusBarItem("claudeCompanion.effort", vscode.StatusBarAlignment.Right, 1003),
    mode: vscode.window.createStatusBarItem("claudeCompanion.mode", vscode.StatusBarAlignment.Right, 1002),
    usage: vscode.window.createStatusBarItem("claudeCompanion.usage", vscode.StatusBarAlignment.Right, 1001),
  };
  items.model.name = "Claude: Model";
  items.effort.name = "Claude: Effort";
  items.mode.name = "Claude: Mode";
  items.usage.name = "Claude: Usage";
  items.model.command = "claudeCompanion.pickModel";
  items.effort.command = "claudeCompanion.pickEffort";
  items.mode.command = "claudeCompanion.explainMode";
  items.usage.command = "claudeCompanion.showUsage";
  for (const item of Object.values(items)) context.subscriptions.push(item);

  // Sidebar webview
  const sidebarProvider = new ClaudeCompanionViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("claudeCompanion.sidebarView", sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Editor title bar starts with a known context value so the icon shows
  // immediately, before the first refresh() runs.
  vscode.commands.executeCommand("setContext", "claudeCompanion.usageSeverity", "normal");

  function refresh() {
    const conf = cfg();
    const state = computeState(conf);
    const { modelPretty, modelRaw, effort, mode, contextPct, usageFive, usageWeek, usageLimits, usageFetchedAt, severity } =
      state;

    const onStatusBar = conf.get("surface.statusBar");

    // --- Model ---
    if (onStatusBar && conf.get("showModel")) {
      items.model.text = `$(sparkle) ${modelPretty.label}${modelPretty.oneM ? " · 1M" : ""}`;
      const md = new vscode.MarkdownString(undefined, true);
      md.appendMarkdown(`**Claude Code model**\n\n`);
      md.appendMarkdown(`Configured: \`${modelRaw || "default"}\`\n\n`);
      if (state.session && state.session.model) {
        md.appendMarkdown(`Last response in this project: \`${state.session.model}\`\n\n`);
      }
      md.appendMarkdown(`_Click to change (applies to new sessions)._`);
      items.model.tooltip = md;
      items.model.show();
    } else items.model.hide();

    // --- Effort ---
    if (onStatusBar && conf.get("showEffort")) {
      items.effort.text = `$(dashboard) ${titleCase(effort)}`;
      items.effort.tooltip = new vscode.MarkdownString(
        `**Effort level**: \`${effort}\`\n\n_Click to change (applies to new sessions)._`
      );
      items.effort.show();
    } else items.effort.hide();

    // --- Mode ---
    if (onStatusBar && conf.get("showMode") && mode) {
      const icon = MODE_ICONS[mode] || "$(shield)";
      items.mode.text = `${icon} ${titleCase(mode)}`;
      const md = new vscode.MarkdownString(undefined, true);
      md.appendMarkdown(`**Session permission mode**: \`${mode}\`\n\n`);
      if (contextPct != null) md.appendMarkdown(`Context: ~${kTokens(state.session.contextTokens)} tokens (${contextPct}% of window)\n\n`);
      md.appendMarkdown(`Last activity: ${agoText(state.session.mtime)}\n\n`);
      md.appendMarkdown(`_Change it with Shift+Tab in the Claude Code input._`);
      items.mode.tooltip = md;
      items.mode.show();
    } else items.mode.hide();

    // --- Usage ---
    if (onStatusBar && conf.get("showUsage") && (usageFive != null || usageWeek != null)) {
      const parts = [];
      if (usageFive != null) parts.push(`5h ${usageFive}%`);
      if (usageWeek != null) parts.push(`7d ${usageWeek}%`);
      items.usage.text = `$(pulse) ${parts.join(" · ") || "usage n/a"}`;
      items.usage.backgroundColor =
        severity === "error"
          ? new vscode.ThemeColor("statusBarItem.errorBackground")
          : severity === "warning"
            ? new vscode.ThemeColor("statusBarItem.warningBackground")
            : undefined;

      const md = new vscode.MarkdownString(undefined, true);
      md.appendMarkdown(`**Claude usage limits**\n\n`);
      if (usageFive != null) md.appendMarkdown(`Session (5h): \`${bar(usageFive)}\` ${usageFive}% — ${untilText(state.fiveResetAt)}\n\n`);
      if (usageWeek != null) md.appendMarkdown(`Weekly (7d): \`${bar(usageWeek)}\` ${usageWeek}% — ${untilText(state.weekResetAt)}\n\n`);
      for (const lim of usageLimits || []) {
        if (lim.kind === "session" || lim.kind === "weekly_all") continue;
        if (lim.percent == null) continue;
        md.appendMarkdown(`${limitLabel(lim.kind, lim.scope)}: \`${bar(lim.percent)}\` ${lim.percent}% — ${untilText(lim.resets_at)}\n\n`);
      }
      if (usageFetchedAt) md.appendMarkdown(`_Updated ${agoText(usageFetchedAt)} by Claude Code._`);
      items.usage.tooltip = md;
      items.usage.show();
    } else items.usage.hide();

    // --- Sidebar ---
    if (conf.get("surface.sidebar")) sidebarProvider.update(state);

    // --- Editor title bar (icon-only; severity drives which button shows) ---
    vscode.commands.executeCommand("setContext", "claudeCompanion.usageSeverity", severity);
  }

  // --- Commands ---------------------------------------------------------

  async function writeGlobalSetting(key, value) {
    const current = readJsonSafe(SETTINGS_PATH) || {};
    if (value === undefined) delete current[key];
    else current[key] = value;
    try {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2) + "\n");
    } catch (e) {
      vscode.window.showErrorMessage(`Claude Companion: could not write ${SETTINGS_PATH}: ${e.message}`);
      return;
    }
    refresh();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeCompanion.pickModel", async () => {
      const current = readGlobalSettings().model;
      const options = [
        { label: "Fable 5", value: "claude-fable-5" },
        { label: "Fable 5 · 1M context", value: "claude-fable-5[1m]" },
        { label: "Opus 4.8", value: "claude-opus-4-8" },
        { label: "Sonnet 5", value: "claude-sonnet-5" },
        { label: "Haiku 4.5", value: "claude-haiku-4-5" },
        { label: "Default (let Claude Code decide)", value: undefined },
        { label: "Custom model id…", value: "__custom__" },
      ].map((o) => ({
        ...o,
        description: o.value && o.value !== "__custom__" ? o.value : "",
        picked: o.value === current,
        label: (o.value === current ? "$(check) " : "") + o.label,
      }));
      const pick = await vscode.window.showQuickPick(options, {
        placeHolder: `Model for new Claude Code sessions (current: ${current || "default"})`,
      });
      if (!pick) return;
      let value = pick.value;
      if (value === "__custom__") {
        value = await vscode.window.showInputBox({
          prompt: "Model id (e.g. claude-fable-5[1m])",
          value: current || "",
        });
        if (!value) return;
      }
      await writeGlobalSetting("model", value);
    }),

    vscode.commands.registerCommand("claudeCompanion.pickEffort", async () => {
      const current = readGlobalSettings().effortLevel;
      const pick = await vscode.window.showQuickPick(
        ["high", "medium", "low"].map((v) => ({
          label: (v === current ? "$(check) " : "") + titleCase(v),
          value: v,
        })),
        { placeHolder: `Effort level for new sessions (current: ${current || "default"})` }
      );
      if (!pick) return;
      await writeGlobalSetting("effortLevel", pick.value);
    }),

    vscode.commands.registerCommand("claudeCompanion.explainMode", () => {
      vscode.window.showInformationMessage(
        "The permission mode is set per session inside Claude Code (press Shift+Tab in its input to cycle: default → auto-accept edits → plan …). This indicator reflects the most recent session in this workspace."
      );
    }),

    vscode.commands.registerCommand("claudeCompanion.showUsage", () => {
      const usage = readUsage();
      if (!usage || !usage.utilization) {
        vscode.window.showInformationMessage("No cached usage data found (~/.claude.json). Use Claude Code once to populate it.");
        return;
      }
      const u = usage.utilization;
      const lines = (u.limits || []).map(
        (l) => `${limitLabel(l.kind, l.scope)}: ${l.percent}% — ${untilText(l.resets_at)}`
      );
      vscode.window.showQuickPick(lines, { placeHolder: `Claude usage — updated ${agoText(usage.fetchedAtMs)}` });
    }),

    vscode.commands.registerCommand("claudeCompanion.refresh", refresh),

    // Single quick-actions entry point, shared by the editor-title-bar
    // buttons (which can only carry an icon, not live text).
    vscode.commands.registerCommand("claudeCompanion.openQuickActions", async () => {
      const state = computeState(cfg());
      const items2 = [
        {
          label: `$(sparkle) Model: ${state.modelPretty.label}${state.modelPretty.oneM ? " · 1M" : ""}`,
          description: state.modelRaw || "default",
          action: "claudeCompanion.pickModel",
        },
        { label: `$(dashboard) Effort: ${titleCase(state.effort)}`, action: "claudeCompanion.pickEffort" },
        {
          label: `$(shield) Mode: ${state.mode || "no active session"}`,
          description: state.contextPct != null ? `${state.contextPct}% context` : "",
          action: "claudeCompanion.explainMode",
        },
        {
          label: `$(pulse) Usage: 5h ${state.usageFive ?? "–"}% · 7d ${state.usageWeek ?? "–"}%`,
          action: "claudeCompanion.showUsage",
        },
        { label: `$(layout) Choose where indicators appear…`, action: "claudeCompanion.chooseSurfaces" },
      ];
      const pick = await vscode.window.showQuickPick(items2, { placeHolder: "Claude Code Companion" });
      if (pick) vscode.commands.executeCommand(pick.action);
    }),

    // Editor-title-bar variants: same handler, different declared icon so
    // that only one (matched by the usageSeverity context key) is visible.
    vscode.commands.registerCommand("claudeCompanion.editorTitleNormal", () =>
      vscode.commands.executeCommand("claudeCompanion.openQuickActions")
    ),
    vscode.commands.registerCommand("claudeCompanion.editorTitleWarning", () =>
      vscode.commands.executeCommand("claudeCompanion.openQuickActions")
    ),
    vscode.commands.registerCommand("claudeCompanion.editorTitleError", () =>
      vscode.commands.executeCommand("claudeCompanion.openQuickActions")
    ),

    vscode.commands.registerCommand("claudeCompanion.chooseSurfaces", async () => {
      const conf = cfg();
      const options = [
        { label: "Status bar", key: "surface.statusBar", picked: !!conf.get("surface.statusBar") },
        { label: "Sidebar panel", key: "surface.sidebar", picked: !!conf.get("surface.sidebar") },
        { label: "Editor title bar", key: "surface.editorTitle", picked: !!conf.get("surface.editorTitle") },
      ];
      const picks = await vscode.window.showQuickPick(
        options.map((o) => ({ label: o.label, picked: o.picked })),
        {
          canPickMany: true,
          placeHolder: "Choose where Claude Companion indicators appear — pick any combination",
        }
      );
      if (!picks) return; // cancelled
      const chosen = new Set(picks.map((p) => p.label));
      for (const o of options) {
        await conf.update(o.key, chosen.has(o.label), vscode.ConfigurationTarget.Global);
      }
      if (!picks.length) {
        vscode.window.showInformationMessage("Claude Companion: all surfaces hidden. Run this command again to bring one back.");
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("claudeCompanion")) refresh();
    })
  );

  // --- Change detection -------------------------------------------------
  // Claude Code rewrites these files atomically, so watch directories and
  // also poll mtimes as a safety net.
  const debouncedRefresh = debounce(refresh, 300);
  const cwd = currentCwd();
  for (const dir of [path.dirname(SETTINGS_PATH), cwd ? projectDirFor(cwd) : null]) {
    if (!dir) continue;
    try {
      const w = fs.watch(dir, debouncedRefresh);
      context.subscriptions.push({ dispose: () => w.close() });
    } catch {
      /* directory may not exist yet */
    }
  }
  const interval = setInterval(refresh, Math.max(2, cfg().get("pollIntervalSeconds")) * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });

  refresh();
}

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
