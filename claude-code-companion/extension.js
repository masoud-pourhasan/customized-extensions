"use strict";

const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const SETTINGS_PATH = path.join(HOME, ".claude", "settings.json");
const STATE_PATH = path.join(HOME, ".claude.json");
const PROJECTS_DIR = path.join(HOME, ".claude", "projects");

// ---------------------------------------------------------------------------
// Data readers
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
  // e.g. "claude-foo-2" -> "Foo 2"
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

const MODE_ICONS = {
  default: "$(shield)",
  auto: "$(zap)",
  acceptEdits: "$(edit)",
  plan: "$(checklist)",
  bypassPermissions: "$(unlock)",
  ultracode: "$(rocket)",
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

function activate(context) {
  const items = {
    model: vscode.window.createStatusBarItem("claudeCompanion.model", vscode.StatusBarAlignment.Right, 103),
    effort: vscode.window.createStatusBarItem("claudeCompanion.effort", vscode.StatusBarAlignment.Right, 102),
    mode: vscode.window.createStatusBarItem("claudeCompanion.mode", vscode.StatusBarAlignment.Right, 101),
    usage: vscode.window.createStatusBarItem("claudeCompanion.usage", vscode.StatusBarAlignment.Right, 100),
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

  const cfg = () => vscode.workspace.getConfiguration("claudeCompanion");
  const cwd = () =>
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : null;

  function refresh() {
    const settings = readGlobalSettings();
    const usage = readUsage();
    const session = cwd() ? readSessionState(cwd()) : null;
    const conf = cfg();

    // --- Model ---
    if (conf.get("showModel")) {
      const raw = (session && session.model) || settings.model;
      const { label, oneM } = prettyModel(settings.model || raw);
      items.model.text = `$(sparkle) ${label}${oneM ? " · 1M" : ""}`;
      const md = new vscode.MarkdownString(undefined, true);
      md.appendMarkdown(`**Claude Code model**\n\n`);
      md.appendMarkdown(`Configured: \`${settings.model || "default"}\`\n\n`);
      if (session && session.model) {
        md.appendMarkdown(`Last response in this project: \`${session.model}\`\n\n`);
      }
      md.appendMarkdown(`_Click to change (applies to new sessions)._`);
      items.model.tooltip = md;
      items.model.show();
    } else items.model.hide();

    // --- Effort ---
    if (conf.get("showEffort")) {
      const effort = (session && session.effort) || settings.effortLevel || "default";
      items.effort.text = `$(dashboard) ${effort}`;
      items.effort.tooltip = new vscode.MarkdownString(
        `**Effort level**: \`${effort}\`\n\n_Click to change (applies to new sessions)._`
      );
      items.effort.show();
    } else items.effort.hide();

    // --- Mode (per-session, from transcript) ---
    if (conf.get("showMode") && session && session.permissionMode) {
      const mode = session.permissionMode;
      const icon = MODE_ICONS[mode] || "$(shield)";
      items.mode.text = `${icon} ${mode}`;
      const md = new vscode.MarkdownString(undefined, true);
      md.appendMarkdown(`**Session permission mode**: \`${mode}\`\n\n`);
      if (session.contextTokens != null) {
        const windowSize = /\[1m\]/.test(settings.model || "") ? 1000000 : 200000;
        const pct = Math.round((session.contextTokens / windowSize) * 100);
        md.appendMarkdown(`Context: ~${kTokens(session.contextTokens)} tokens (${pct}% of window)\n\n`);
      }
      md.appendMarkdown(`Last activity: ${agoText(session.mtime)}\n\n`);
      md.appendMarkdown(`_Change it with Shift+Tab in the Claude Code input._`);
      items.mode.tooltip = md;
      items.mode.show();
    } else items.mode.hide();

    // --- Usage ---
    if (conf.get("showUsage") && usage && usage.utilization) {
      const u = usage.utilization;
      const five = u.five_hour ? u.five_hour.utilization : null;
      const week = u.seven_day ? u.seven_day.utilization : null;
      const parts = [];
      if (five != null) parts.push(`5h ${five}%`);
      if (week != null) parts.push(`7d ${week}%`);
      items.usage.text = `$(pulse) ${parts.join(" · ") || "usage n/a"}`;

      const worst = Math.max(five || 0, week || 0);
      const warnAt = conf.get("usageWarningPercent");
      const errAt = conf.get("usageErrorPercent");
      items.usage.backgroundColor =
        worst >= errAt
          ? new vscode.ThemeColor("statusBarItem.errorBackground")
          : worst >= warnAt
            ? new vscode.ThemeColor("statusBarItem.warningBackground")
            : undefined;

      const md = new vscode.MarkdownString(undefined, true);
      md.appendMarkdown(`**Claude usage limits**\n\n`);
      if (u.five_hour)
        md.appendMarkdown(`Session (5h): \`${bar(five)}\` ${five}% — ${untilText(u.five_hour.resets_at)}\n\n`);
      if (u.seven_day)
        md.appendMarkdown(`Weekly (7d): \`${bar(week)}\` ${week}% — ${untilText(u.seven_day.resets_at)}\n\n`);
      for (const lim of u.limits || []) {
        if (lim.kind === "session" || lim.kind === "weekly_all") continue; // already shown
        if (lim.percent == null) continue;
        md.appendMarkdown(`${lim.kind}: \`${bar(lim.percent)}\` ${lim.percent}% — ${untilText(lim.resets_at)}\n\n`);
      }
      if (usage.fetchedAtMs) md.appendMarkdown(`_Updated ${agoText(usage.fetchedAtMs)} by Claude Code._`);
      items.usage.tooltip = md;
      items.usage.show();
    } else items.usage.hide();
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
          label: (v === current ? "$(check) " : "") + v,
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
        (l) => `${l.kind}${l.scope ? ` (${l.scope})` : ""}: ${l.percent}% — ${untilText(l.resets_at)}`
      );
      vscode.window.showQuickPick(lines, { placeHolder: `Claude usage — updated ${agoText(usage.fetchedAtMs)}` });
    }),

    vscode.commands.registerCommand("claudeCompanion.refresh", refresh),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("claudeCompanion")) refresh();
    })
  );

  // --- Change detection -------------------------------------------------
  // Claude Code rewrites these files atomically, so watch directories and
  // also poll mtimes as a safety net.
  const debouncedRefresh = debounce(refresh, 300);
  for (const dir of [path.dirname(SETTINGS_PATH), cwd() ? projectDirFor(cwd()) : null]) {
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
