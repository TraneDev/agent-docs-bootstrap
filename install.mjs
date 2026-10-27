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
// Installed paths are listed in .agent-docs-bootstrap; only those are ever replaced or removed, and only if a line
// has the shape of a path the kit writes (<layout folder>/<kit name>). On an update, listed paths this version no
// longer ships are removed.
// No network access, no changes to harness settings, no admin rights.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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
const markerLines = read(MARKER).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('version='));
for (const l of markerLines) if (!isOwnedPath(l)) warn(`ignored '${l}' in .agent-docs-bootstrap: not a path this kit installs`);
const oldList = markerLines.filter(isOwnedPath);
if (a.uninstall) { uninstall(); process.exit(0); }

if (!a.target) usage(1, 'Missing --target.');
const targets = a.target === 'all' ? TARGETS : a.target.split(',');
for (const t of targets) if (!TARGETS.includes(t)) die(`Unknown target '${t}'. Use ${TARGETS.join(', ')} or all.`);

if (!GLOBAL) {
  console.log(`Project: ${BASE}`);
  if (!fs.existsSync(path.join(BASE, '.git')) && !a.yes)
    die(`No .git here (${BASE}) — is this the project root? Run from the root or add --yes.`);
}

const installed = new Set();
const ours = (r) => oldList.includes(r);
function writeOwned(r, fn) {
  if (installed.has(r)) return false;
  const dst = abs(r);
  if (exists(dst) && !ours(r)) { warn(`skipped ${r}: exists and was not installed by this kit`); return false; }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fn(dst);
  installed.add(r);
  return true;
}

const skills = skillDirs();
const agents = AGENTS.map(n => parseAgent(path.join(KIT, 'agents', `${n}.md`)));
const models = { 'docs-scout': a['scout-model'], 'docs-reader': a['reader-model'] };

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
  if (L.commands) for (const [name, what] of [['docs-bootstrap', "Build the project's reference documentation"], ['docs-check', "Optional: test the project's documentation with a fresh reader"]]) {
    const r = `${L.commands}/${name}.md`;
    const body = `---\ndescription: ${JSON.stringify(`${what} (${name})`)}\n---\nLoad the \`${name}\` skill and follow it. Arguments from the developer, if any: $ARGUMENTS\n`;
    if (writeOwned(r, dst => fs.writeFileSync(dst, body))) log(`command /${name}`);
  }
}

// Paths an earlier version installed into these targets' folders and this version no longer ships.
const ownDirs = new Set(targets.flatMap(t => Object.values(LAYOUT[t])));
for (const r of oldList)
  if (!installed.has(r) && ownDirs.has(path.dirname(r)) && exists(abs(r))) { fs.rmSync(abs(r), { recursive: true, force: true }); log(`removed  ${r} (no longer shipped)`); }

// Keep entries of earlier installs (e.g. another target) that are still on disk.
const keep = oldList.filter(r => !installed.has(r) && exists(abs(r)));
fs.writeFileSync(MARKER, [`version=${VERSION}`, ...keep, ...installed].join('\n') + '\n');

console.log(`\nDone: agent-docs-bootstrap ${VERSION}, ${targets.join(', ')}${GLOBAL ? ' (global)' : ''}.`);
if (!GLOBAL) log(`commit the installed folders and .agent-docs-bootstrap so the whole team gets the same version`);
log('restart the agent session so it picks up the new skills and subagents');
log('start with the docs-bootstrap skill (Claude Code /docs-bootstrap, Codex $docs-bootstrap, OpenCode /docs-bootstrap)');

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
  if (!oldList.length) die(`Nothing to remove: no ${MARKER}.`);
  console.log(`Removing agent-docs-bootstrap from ${BASE}`);
  for (const r of oldList) if (exists(abs(r))) { fs.rmSync(abs(r), { recursive: true, force: true }); log(`removed ${r}`); }
  fs.rmSync(MARKER, { force: true });
  const dirs = new Set(oldList.flatMap(r => [path.dirname(r), path.dirname(path.dirname(r))]));
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
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function log(s) { console.log(`  ${s}`); }
function warn(s) { console.error(`WARNING: ${s}`); }
function die(s) { console.error(s); process.exit(1); }
