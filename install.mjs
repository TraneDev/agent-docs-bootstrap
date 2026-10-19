#!/usr/bin/env node
// Install agent-docs-kit skills and subagents into a project (default) or your home directory.
//
//   cd <project> && node <kit>/install.mjs --target claude|codex|opencode|all[,…]
//   node install.mjs --target … --project <path>      node install.mjs --target … --global
//   flags: --scout-model <id>  --reader-model <id>  --yes  --uninstall  --help
//
// What goes where (project mode):
//   claude    skills → .claude/skills/   agents → .claude/agents/*.md
//   codex     skills → .agents/skills/   agents → .codex/agents/*.toml
//   opencode  skills → .agents/skills/   agents → .opencode/agents/*.md   commands → .opencode/commands/*.md
// Installed paths are listed in .agent-docs-kit; only those are ever replaced or removed.
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
const MARKER = path.join(BASE, '.agent-docs-kit');
const VERSION = read(path.join(KIT, 'VERSION')).trim() || 'unknown';
const abs = (r) => path.join(BASE, r);
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

if (!GLOBAL && (BASE === KIT || BASE.startsWith(KIT + path.sep)))
  die(`This is the kit's own directory (${BASE}). Run it from the project root: cd <project> && node ${path.join(KIT, 'install.mjs')} --target …`);

const oldList = read(MARKER).split('\n').filter(l => l && !l.startsWith('version='));
if (a.uninstall) { uninstall(); process.exit(0); }

if (!a.target) usage(1, 'Missing --target.');
const targets = a.target === 'all' ? TARGETS : a.target.split(',');
for (const t of targets) if (!TARGETS.includes(t)) die(`Unknown target '${t}'. Use ${TARGETS.join(', ')} or all.`);

if (!GLOBAL) {
  console.log(`Project: ${BASE}`);
  if (!fs.existsSync(path.join(BASE, '.git')) && !a.yes)
    die(`No .git here (${BASE}) — is this the project root? Run from the root or add --yes.`);
}

const codexHome = process.env.CODEX_HOME ? path.relative(BASE, process.env.CODEX_HOME) : '.codex';
const ocConfig = process.env.OPENCODE_CONFIG_DIR ? path.relative(BASE, process.env.OPENCODE_CONFIG_DIR) : path.join('.config', 'opencode');
const LAYOUT = {
  claude:   { skills: '.claude/skills', agents: '.claude/agents' },
  codex:    { skills: '.agents/skills', agents: GLOBAL ? path.join(codexHome, 'agents') : '.codex/agents' },
  opencode: { skills: '.agents/skills', agents: GLOBAL ? path.join(ocConfig, 'agents') : '.opencode/agents',
              commands: GLOBAL ? path.join(ocConfig, 'commands') : '.opencode/commands' },
};

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
  if (L.commands) for (const [name, what] of [['docs-bootstrap', "Build the project's reference documentation"], ['docs-check', "Check the project's documentation with a reader test"]]) {
    const r = `${L.commands}/${name}.md`;
    const body = `---\ndescription: ${JSON.stringify(`${what} (${name})`)}\n---\nLoad the \`${name}\` skill and follow it. Arguments from the developer, if any: $ARGUMENTS\n`;
    if (writeOwned(r, dst => fs.writeFileSync(dst, body))) log(`command /${name}`);
  }
}

// Keep entries of earlier installs (e.g. another target) that are still on disk.
const keep = oldList.filter(r => !installed.has(r) && exists(abs(r)));
fs.writeFileSync(MARKER, [`version=${VERSION}`, ...keep, ...installed].join('\n') + '\n');

console.log(`\nDone: agent-docs-kit ${VERSION}, ${targets.join(', ')}${GLOBAL ? ' (global)' : ''}.`);
if (!GLOBAL) log(`commit the installed folders and .agent-docs-kit so the whole team gets the same version`);
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
  for (const base of [path.join(KIT, 'skills'), path.join(KIT, 'skills', 'third-party')])
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
  console.log(`Removing agent-docs-kit from ${BASE}`);
  for (const r of oldList) if (exists(abs(r))) { fs.rmSync(abs(r), { recursive: true, force: true }); log(`removed ${r}`); }
  fs.rmSync(MARKER, { force: true });
  const dirs = new Set(oldList.flatMap(r => [path.dirname(r), path.dirname(path.dirname(r))]));
  for (const d of [...dirs].sort((x, y) => y.length - x.length)) try { fs.rmdirSync(abs(d)); } catch {}
}
function parseArgs(argv) {
  const o = {}; const withVal = new Set(['target', 'project', 'scout-model', 'reader-model']);
  for (let i = 0; i < argv.length; i++) {
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
  console.log(read(fileURLToPath(import.meta.url)).split('\n').slice(1, 14).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(code);
}
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function log(s) { console.log(`  ${s}`); }
function warn(s) { console.error(`WARNING: ${s}`); }
function die(s) { console.error(s); process.exit(1); }
