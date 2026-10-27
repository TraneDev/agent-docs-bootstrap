#!/usr/bin/env node
// Install agent-docs-bootstrap skills and subagents into a project (default) or your home directory.
//
//   cd <project> && npx agent-docs-bootstrap --target claude|codex|opencode|all[,…]
//   cd <project> && node <kit>/install.mjs --target claude|codex|opencode|all[,…]
//   node install.mjs --target … --project <path>      node install.mjs --target … --global
//   flags: --scout-model <id>  --reader-model <id>  --yes  --uninstall  --help
//
// What goes where (project mode):
//   claude    skills → .claude/skills/   agents → .claude/agents/*.md
//   codex     skills → .agents/skills/   agents → .codex/agents/*.toml
//   opencode  skills → .agents/skills/   agents → .opencode/agents/*.md   commands → .opencode/commands/*.md
// Installed paths are listed in .agent-docs-bootstrap with a hash of what was written. A path is replaced or removed
// only if its line has the shape of a path the kit writes (<layout folder>/<kit name>) and its content still matches
// that hash or something a version of the kit wrote. OS files such as .DS_Store do not count; a user's own file,
// hidden or not, does. A changed path is left in place and the run exits non-zero. On an update, listed paths this
// version no longer ships are removed under the same rule, or left to the user if changed.
// No network access, no changes to harness settings, no admin rights.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const TARGETS = ['claude', 'codex', 'opencode'];
const AGENTS = ['docs-scout', 'docs-reader'];
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const a = parseArgs(process.argv.slice(2));
if (a.help) usage(0);

const GLOBAL = !!a.global;
const BASE = GLOBAL ? os.homedir() : path.resolve(a.project || process.cwd());
const MARKER = path.join(BASE, '.agent-docs-bootstrap');
const VERSION = JSON.parse(read(path.join(KIT, 'package.json')) || '{}').version || 'unknown';
const abs = (r) => path.join(BASE, r);
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

if (!GLOBAL && (BASE === KIT || BASE.startsWith(KIT + path.sep)))
  die(`This is the kit's own directory (${BASE}). Run it from the project root: cd <project> && node ${path.join(KIT, 'install.mjs')} --target …`);

const codexHome = process.env.CODEX_HOME ? path.relative(BASE, process.env.CODEX_HOME) : '.codex';
const ocConfig = process.env.OPENCODE_CONFIG_DIR ? path.relative(BASE, process.env.OPENCODE_CONFIG_DIR) : path.join('.config', 'opencode');
const LAYOUT = {
  claude:   { skills: '.claude/skills', agents: '.claude/agents' },
  codex:    { skills: '.agents/skills', agents: GLOBAL ? path.join(codexHome, 'agents') : '.codex/agents' },
  opencode: { skills: '.agents/skills', agents: GLOBAL ? path.join(ocConfig, 'agents') : '.opencode/agents',
              commands: GLOBAL ? path.join(ocConfig, 'commands') : '.opencode/commands' },
};

// Every name any version of the kit installed. Add to it, never remove: an old install's marker may list them.
const SHIPPED = new Set(['docs-bootstrap', 'docs-check', 'docs-scout', 'docs-reader',
  'grilling', 'domain-modeling', 'writing-for-agents', 'doc-coauthoring', 'diataxis-audit', 'grill-with-docs']);
const layoutDirs = new Set(Object.values(LAYOUT).flatMap(L => Object.values(L)).map(d => path.normalize(d)));
// The marker is committed, so a bad merge or PR can add any line to it. Only a line shaped like a path the kit
// writes, <layout folder>/<shipped name>[.md|.toml], is trusted; nothing else is ever replaced or removed.
const isOwnedPath = (r) => layoutDirs.has(path.normalize(path.dirname(r))) && SHIPPED.has(path.basename(r).replace(/\.(md|toml)$/, ''));
// Marker lines are `<path> <hash>`; versions up to 0.3.0 wrote the path alone, so their content is checked
// against everything those versions installed (LEGACY).
const old = new Map();
for (const l of read(MARKER).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('version='))) {
  const [r, h] = l.split(/\s+/);
  if (isOwnedPath(r)) old.set(r, h);
  else warn(`ignored '${r}' in .agent-docs-bootstrap: not a path this kit installs`);
}
// Hashes of every path each released version installed (all targets, no model flags), so an install whose marker
// lost its lines is still recognised after the kit changes. Every release adds the outgoing version's hashes;
// nothing is ever removed. check.mjs installs each release tag and fails, listing the missing ones.
const LEGACY = new Set([
  '00ca80d7077c0e4b', '122ae594f7eb38bd', '185ec7d02d9cf70b', '1f5a0fe496f38dd6', '3798ad63dd954bac',
  '4c36074d70c5a88c', '562d1e8f3a090ffd', '698cadefe39cb46f', '6acf8481d4dd6a1a', '72bcff6d0e5476ba',
  '790d7e6ae5034b3e', '79d9da94af685633', '7cd7eeac11324b51', '855778c0459cea17', '8c5adb3f63300a43',
  '900cf27ab683e5d1', '96288a3e60126264', '9e0e5c30da22c059', 'b45162299d9aa78b', 'c5d47d8811aa61ee',
  'c87450584ed42c8b', 'cf2f8a40c91f3c45', 'dac09810ceb351f7', 'dc418221c7363caa', 'f741ba5711364c55',
  'fceff4c3b3159c80', 'fd975138dcda6b38', 'fe412d3c3c312f7a',
  // 0.4.0, 0.4.1
  '7f6ef4c3f161abfa',
]);

const skills = skillDirs();
const agents = AGENTS.map(n => parseAgent(path.join(KIT, 'agents', `${n}.md`)));
const models = { 'docs-scout': a['scout-model'], 'docs-reader': a['reader-model'] };
const COMMANDS = [['docs-bootstrap', "Build the project's reference documentation"], ['docs-check', "Optional: test the project's documentation with a fresh reader"]];
const commandBody = (name, what) => `---\ndescription: ${JSON.stringify(`${what} (${name})`)}\n---\nLoad the \`${name}\` skill and follow it. Arguments from the developer, if any: $ARGUMENTS\n`;
// What this version writes when no model is pinned. Content that matches it or LEGACY byte for byte is the kit's,
// even where the marker lost its line (0.4.0 counted a .DS_Store as a change and dropped the line).
const CURRENT = new Set([...skills.map(d => contentHash(d)),
  ...TARGETS.flatMap(t => agents.map(ag => textHash(render(t, ag)))), ...COMMANDS.map(([n, w]) => textHash(commandBody(n, w)))]);
const isKitContent = (h) => LEGACY.has(h) || CURRENT.has(h);
// The path is the kit's and nobody changed it since it was installed.
const isUnchanged = (r) => { const h = contentHash(abs(r)); return h === old.get(r) || isKitContent(h); };
const changedNote = (r) => `${r} changed since it was installed, so it is left in place as yours`;
if (a.uninstall) { uninstall(); process.exit(0); }

if (!a.target) usage(1, 'Missing --target.');
const targets = a.target === 'all' ? TARGETS : a.target.split(',');
for (const t of targets) if (!TARGETS.includes(t)) die(`Unknown target '${t}'. Use ${TARGETS.join(', ')} or all.`);

if (!GLOBAL) {
  console.log(`Project: ${BASE}`);
  if (!fs.existsSync(path.join(BASE, '.git')) && !a.yes)
    die(`No .git here (${BASE}) — is this the project root? Run from the root or add --yes.`);
}

const installed = new Map();
const released = new Set();
const shipped = new Set();
const skipped = [];
// A shipped path the user changed keeps its marker line and old hash, so every run says the same thing about it.
function writeOwned(r, fn) {
  if (shipped.has(r)) return false;
  shipped.add(r);
  const dst = abs(r);
  if (exists(dst)) {
    const why = !old.has(r) && !isKitContent(contentHash(dst)) ? 'exists and was not installed by this kit'
      : old.has(r) && !isUnchanged(r) ? 'changed since it was installed' : '';
    if (why) { warn(`skipped ${r}: ${why}`); skipped.push(r); return false; }
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fn(dst);
  installed.set(r, contentHash(dst));
  return true;
}

for (const t of targets) {
  const L = LAYOUT[t];
  console.log(`\n${t}`);
  for (const d of skills) {
    const r = `${L.skills}/${path.basename(d)}`;
    if (writeOwned(r, dst => fs.cpSync(d, dst, { recursive: true }))) log(`skill  ${r}`);
  }
  for (const ag of agents) {
    const ext = t === 'codex' ? 'toml' : 'md';
    const r = `${L.agents}/${ag.name}.${ext}`;
    if (writeOwned(r, dst => fs.writeFileSync(dst, render(t, ag, models[ag.name])))) log(`agent  ${r}`);
  }
  if (L.commands) for (const [name, what] of COMMANDS) {
    const r = `${L.commands}/${name}.md`;
    if (writeOwned(r, dst => fs.writeFileSync(dst, commandBody(name, what)))) log(`command /${name}`);
  }
}

// Paths an earlier version installed into these targets' folders and this version no longer ships.
const ownDirs = new Set(targets.flatMap(t => Object.values(LAYOUT[t])));
for (const r of old.keys()) {
  if (shipped.has(r) || !ownDirs.has(path.dirname(r)) || !exists(abs(r))) continue;
  if (isUnchanged(r)) { fs.rmSync(abs(r), { recursive: true, force: true }); log(`removed  ${r} (no longer shipped)`); }
  else { warn(`not removed: ${changedNote(r)}`); released.add(r); }
}

// Keep entries of earlier installs (e.g. another target) and skipped shipped paths that are still on disk; a changed
// path this version no longer ships is the user's and is no longer listed.
const keep = [...old].filter(([r]) => !installed.has(r) && !released.has(r) && exists(abs(r)));
fs.writeFileSync(MARKER, [`version=${VERSION}`, ...[...keep, ...installed].map(([r, h]) => h ? `${r} ${h}` : r)].join('\n') + '\n');

if (skipped.length) {
  console.error(`\nIncomplete: agent-docs-bootstrap ${VERSION} could not install ${skipped.length} path(s):`);
  for (const r of skipped) console.error(`  ${r}`);
  console.error('They hold content this kit did not write. To get this version, move or delete them, then run the installer again.');
  process.exitCode = 1;
} else {
  console.log(`\nDone: agent-docs-bootstrap ${VERSION}, ${targets.join(', ')}${GLOBAL ? ' (global)' : ''}.`);
  if (!GLOBAL) log(`commit the installed folders and .agent-docs-bootstrap so the whole team gets the same version`);
  log('restart the agent session so it picks up the new skills and subagents');
  log('start with the docs-bootstrap skill (Claude Code /docs-bootstrap, Codex $docs-bootstrap, OpenCode /docs-bootstrap)');
}

// ---------- rendering
function render(target, ag, model) {
  if (target === 'codex') {
    if (ag.body.includes("'''")) die(`${ag.name}: prompt contains ''' and cannot be a TOML literal string`);
    return [`name = ${JSON.stringify(ag.name)}`, `description = ${JSON.stringify(ag.description)}`,
      ...(model ? [`model = ${JSON.stringify(model)}`] : []),
      `developer_instructions = '''`, ag.body.trim(), `'''`, ''].join('\n');
  }
  const extra = target === 'claude' ? ag['claude-code'] : ag.opencode;
  return ['---', ...(target === 'claude' ? [`name: ${ag.name}`] : []), `description: ${JSON.stringify(ag.description)}`,
    ...(extra ? [extra.trimEnd()] : []), ...(model ? [`model: ${model}`] : []), '---', '', ag.body.trim(), ''].join('\n');
}

// Canonical agent file: frontmatter with name, description and per-harness `key: |` blocks, then the prompt.
function parseAgent(file) {
  const text = read(file);
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || die(`${file}: no frontmatter`);
  const out = { body: m[2] };
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-z-]+):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2] === '|') {
      const block = [];
      while (i + 1 < lines.length && (/^  /.test(lines[i + 1]) || lines[i + 1] === '')) block.push(lines[++i].slice(2));
      out[kv[1]] = block.join('\n');
    } else out[kv[1]] = kv[2];
  }
  if (out.name !== path.basename(file, '.md')) die(`${file}: name '${out.name}' does not match the file name`);
  if (!out.description) die(`${file}: no description`);
  return out;
}

// ---------- helpers
function skillDirs() {
  const out = [];
  const base = path.join(KIT, 'skills');
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    const d = path.join(base, e.name);
    if (!e.isDirectory() || !fs.existsSync(path.join(d, 'SKILL.md'))) continue;
    const fm = (read(path.join(d, 'SKILL.md')).match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m) || ['', ''])[1].trim();
    if (!NAME_RE.test(e.name) || fm !== e.name) { warn(`skipped skill ${e.name}: frontmatter name '${fm}' must match the folder`); continue; }
    out.push(d);
  }
  return out;
}
function uninstall() {
  if (!old.size) die(`Nothing to remove: no ${MARKER}.`);
  console.log(`Removing agent-docs-bootstrap from ${BASE}`);
  for (const r of old.keys()) {
    if (!exists(abs(r))) continue;
    if (isUnchanged(r)) { fs.rmSync(abs(r), { recursive: true, force: true }); log(`removed ${r}`); }
    else warn(`not removed: ${changedNote(r)}`);
  }
  fs.rmSync(MARKER, { force: true });
  const dirs = new Set([...old.keys()].flatMap(r => [path.dirname(r), path.dirname(path.dirname(r))]));
  for (const d of [...dirs].sort((x, y) => y.length - x.length)) try { fs.rmdirSync(abs(d)); } catch {}
}
function parseArgs(argv) {
  const o = {}; const withVal = new Set(['target', 'project', 'scout-model', 'reader-model']);
  for (let i = 0; i < argv.length; i++) {
    const eq = argv[i].match(/^--([a-z-]+)=(.*)$/);
    if (eq && withVal.has(eq[1])) { o[eq[1]] = eq[2]; continue; }
    const k = argv[i].replace(/^--/, '');
    if (argv[i] === '-h' || k === 'help') o.help = true;
    else if (withVal.has(k)) { if (i + 1 >= argv.length) die(`--${k} needs a value`); o[k] = argv[++i]; }
    else if (['global', 'yes', 'uninstall'].includes(k)) o[k] = true;
    else die(`Unknown argument: ${argv[i]}`);
  }
  return o;
}
function usage(code, msg) {
  if (msg) console.error(msg + '\n');
  const src = read(fileURLToPath(import.meta.url)).split('\n').slice(1);
  console.log(src.slice(0, src.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(code);
}
// Content hash of an installed file or folder: relative names and text with line endings normalised, so a
// checkout with CRLF line endings still matches. Files the OS adds (.DS_Store, ._*, Thumbs.db, desktop.ini) are
// left out; the kit ships none (check.mjs makes sure). The format must not change: markers and LEGACY depend on it.
function contentHash(p) {
  const h = createHash('sha256');
  const files = fs.lstatSync(p).isDirectory() ? listFiles(p).sort() : [''];
  for (const f of files) h.update(`${f}\0${read(path.join(p, f)).replace(/\r\n/g, '\n')}\0`);
  return h.digest('hex').slice(0, 16);
}
// Only files the OS adds on its own. A user's own hidden file, such as .notes.md, is content and counts as a change.
function isOsFile(name) { return /^(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(name) || name.startsWith('._'); }
// The same hash for text about to be written as a file.
function textHash(text) {
  return createHash('sha256').update(`\0${text.replace(/\r\n/g, '\n')}\0`).digest('hex').slice(0, 16);
}
function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => !isOsFile(e.name)).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function log(s) { console.log(`  ${s}`); }
function warn(s) { console.error(`WARNING: ${s}`); }
function die(s) { console.error(s); process.exit(1); }
