#!/usr/bin/env node
// Repository checks, run locally and in CI:  node scripts/check.mjs
//
// - every skill: SKILL.md frontmatter has name (= folder) and description; relative links resolve outside vendor/;
//   no SKILL.md below a skill's top level, since harnesses scan skill folders recursively;
// - every vendored guide (skills/docs-bootstrap/vendor/<name>/) has <name>.md and its LICENSE and is listed in THIRD_PARTY.md;
// - the packed npm tarball (`npm pack`) keeps every vendored LICENSE, and its install.mjs works for every target
//   into a temp project, removes paths an earlier version installed and this one no longer ships,
//   and uninstall leaves nothing behind;
// - generated agent files have the fields each harness requires;
// - docs-check's reader-run.mjs --snapshot-only, run on a temp git repo, builds the parent's code plus exactly the current documents;
// - every version pinned in README.md equals the package.json version;
// - no forbidden strings: patterns come from the FORBIDDEN_PATTERNS env var (one regex per line)
//   or the untracked file .forbidden-patterns, so the list itself never gets published.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const err = (s) => errors.push(s);
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);

// ---------- README pins the current version
const version = JSON.parse(read(path.join(ROOT, 'package.json'))).version;
for (const [pin, v] of read(path.join(ROOT, 'README.md')).matchAll(/(?:agent-docs-bootstrap@|#v|--branch v)(\d+\.\d+\.\d+)/g))
  if (v !== version) err(`README.md: ${pin} does not match package.json version ${version}`);

// ---------- skills
const vendor = path.join(ROOT, 'skills', 'docs-bootstrap', 'vendor');
const notices = read(path.join(ROOT, 'THIRD_PARTY.md'));
for (const e of fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })) {
  const d = path.join(ROOT, 'skills', e.name);
  if (!e.isDirectory()) continue;
  const skill = path.join(d, 'SKILL.md');
  if (!fs.existsSync(skill)) { err(`${rel(d)}: no SKILL.md`); continue; }
  const fm = (read(skill).match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
  const name = (fm.match(/^name:\s*(.+)$/m) || ['', ''])[1].trim();
  if (name !== e.name) err(`${rel(skill)}: name '${name}' must equal the folder name`);
  if (!/^description:\s*\S/m.test(fm)) err(`${rel(skill)}: no description`);
  for (const f of walk(d)) {
    if (path.basename(f) === 'SKILL.md' && f !== skill) err(`${rel(f)}: nested SKILL.md would be found as a separate skill`);
    if (!f.endsWith('.md') || f.startsWith(vendor + path.sep)) continue;
    for (const [, link] of read(f).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g))
      if (!/^[a-z]+:/.test(link) && !fs.existsSync(path.resolve(path.dirname(f), link))) err(`${rel(f)}: broken link ${link}`);
  }
}
const vendored = fs.readdirSync(vendor, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
for (const n of vendored) {
  const d = path.join(vendor, n);
  if (!fs.existsSync(path.join(d, `${n}.md`))) err(`${rel(d)}: no ${n}.md (the renamed SKILL.md)`);
  if (!fs.existsSync(path.join(d, 'LICENSE'))) err(`${rel(d)}: vendored guide without LICENSE`);
  if (!notices.includes(`\`${n}\``)) err(`${rel(d)}: not listed in THIRD_PARTY.md`);
}

// ---------- install / uninstall for every target
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-check-'));
const packed = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-pack-'));
try {
  const win = process.platform === 'win32';
  execFileSync(win ? 'npm.cmd' : 'npm', ['pack', '--pack-destination', packed], { cwd: ROOT, shell: win, stdio: ['ignore', 'ignore', 'pipe'] });
  const tgz = fs.readdirSync(packed).filter(f => f.endsWith('.tgz'));
  if (tgz.length !== 1) throw new Error(`npm pack produced [${tgz}], expected one .tgz`);
  execFileSync('tar', ['-xzf', tgz[0]], { cwd: packed, stdio: ['ignore', 'ignore', 'pipe'] });
  const pkg = path.join(packed, 'package');
  for (const f of ['package.json', 'install.mjs']) if (!fs.existsSync(path.join(pkg, f))) err(`package: missing ${f}`);
  for (const n of vendored) {
    const l = path.join('skills', 'docs-bootstrap', 'vendor', n, 'LICENSE');
    if (!fs.existsSync(path.join(pkg, l))) err(`package: missing ${l}`);
  }
  const install = (...args) => execFileSync(process.execPath, [path.join(pkg, 'install.mjs'), '--project', tmp, '--yes', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  // Listed in the marker without a hash, as 0.3.0 and earlier wrote it: grilling exactly as 0.2.0 installed it
  // (removed, no longer shipped), and a grilling the user replaced with their own (left in place).
  const v = path.join(ROOT, 'skills', 'docs-bootstrap', 'vendor', 'grilling');
  for (const f of ['LICENSE', 'agents/openai.yaml']) fs.cpSync(path.join(v, f), path.join(tmp, '.claude/skills/grilling', f), { recursive: true });
  fs.copyFileSync(path.join(v, 'grilling.md'), path.join(tmp, '.claude/skills/grilling/SKILL.md'));
  fs.mkdirSync(path.join(tmp, '.agents/skills/grilling'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.agents/skills/grilling/SKILL.md'), 'my own grilling\n');
  // Lines a bad merge could add to the committed marker: uninstall must never follow them.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-outside-'));
  fs.mkdirSync(path.join(tmp, 'src')); fs.writeFileSync(path.join(tmp, 'src', 'keep.js'), 'x\n');
  fs.writeFileSync(path.join(tmp, '.agent-docs-bootstrap'),
    `version=0.0.0\n.claude/skills/grilling\n.agents/skills/grilling\nsrc\n../${path.basename(outside)}\n${outside}\n.claude/skills/../../src\n`);
  install('--target', 'all');
  if (fs.existsSync(path.join(tmp, '.claude/skills/grilling'))) err('install: a path the earlier version installed and this one does not ship was kept');
  if (!fs.existsSync(path.join(tmp, '.agents/skills/grilling/SKILL.md'))) err('install: removed a listed path whose content the user changed');
  const marker = read(path.join(tmp, '.agent-docs-bootstrap'));
  if (/grilling/.test(marker)) err('install: a changed path the kit left in place is still listed in the marker');
  if (!/^\.claude\/skills\/docs-check [0-9a-f]{16}$/m.test(marker)) err('install: marker lines carry no content hash');
  // A file the user edits after installing is theirs: uninstall leaves it.
  fs.appendFileSync(path.join(tmp, '.claude/agents/docs-scout.md'), 'local rule\n');
  const expect = {
    '.claude/skills/docs-bootstrap/SKILL.md': [], '.agents/skills/docs-check/SKILL.md': [],
    '.agents/skills/docs-bootstrap/vendor/domain-modeling/ADR-FORMAT.md': [],
    '.claude/agents/docs-reader.md': [/^name: docs-reader$/m, /^description: /m, /^tools: Read, Grep, Glob$/m],
    '.claude/agents/docs-scout.md': [/^name: docs-scout$/m, /^disallowedTools: /m],
    '.codex/agents/docs-reader.toml': [/^name = "docs-reader"$/m, /^description = "/m, /^developer_instructions = '''$/m],
    '.codex/agents/docs-scout.toml': [/^name = "docs-scout"$/m],
    '.opencode/agents/docs-reader.md': [/^mode: all$/m, /^  "\*": deny$/m],
    '.agents/skills/docs-check/scripts/reader-run.mjs': [],
    '.opencode/agents/docs-scout.md': [/^mode: subagent$/m],
    '.opencode/commands/docs-check.md': [/\$ARGUMENTS/],
    '.agent-docs-bootstrap': [/^version=\d+\.\d+\.\d+$/m],
  };
  for (const [f, res] of Object.entries(expect)) {
    const p = path.join(tmp, f);
    if (!fs.existsSync(p)) { err(`install: missing ${f}`); continue; }
    for (const re of res) if (!re.test(read(p))) err(`install: ${f} does not match ${re}`);
  }
  install('--uninstall');
  if (!fs.existsSync(path.join(tmp, 'src', 'keep.js')) || !fs.existsSync(outside)) err('uninstall removed a path the marker lists but the kit never installs');
  if (!fs.existsSync(path.join(tmp, '.claude/agents/docs-scout.md'))) err('uninstall removed a file the user changed after installing');
  for (const d of ['src', '.agents/skills/grilling', '.claude/agents/docs-scout.md']) fs.rmSync(path.join(tmp, d), { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
  const left = walk(tmp);
  if (left.length) err(`uninstall left files behind: ${left.map(f => path.relative(tmp, f)).join(', ')}`);
} catch (e) {
  err(`packed install.mjs failed: ${e.stderr || e.message}`);
} finally { for (const d of [tmp, packed]) fs.rmSync(d, { recursive: true, force: true }); }

// ---------- docs-check snapshot (reader-run.mjs --snapshot-only) holds the parent's code and the current documents
const snap = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-snap-'));
let built = '';
try {
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: snap, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (f, s) => { fs.mkdirSync(path.dirname(path.join(snap, f)), { recursive: true }); fs.writeFileSync(path.join(snap, f), s); };
  git('init', '-q');
  for (const f of ['docs/x.md', 'docs/removed-later.md', 'src/AGENTS.md', 'docs/agents/state.md', 'src/a.js', '.claude/skills/docs-check/SKILL.md']) put(f, 'x\n');
  put('AGENTS.md', 'old\n'); put('app/CLAUDE.md', 'old\n'); put('README.md', 'old\n');
  put('.agent-docs-bootstrap', 'version=0.0.0\n.claude/skills/docs-check\ndocs\nsrc\n');
  git('add', '.'); git('commit', '-qm', 'parent');
  const parent = git('rev-parse', 'HEAD');
  git('rm', '-q', 'docs/removed-later.md', 'src/AGENTS.md'); put('src/b.js', 'x\n'); git('add', '.'); git('commit', '-qm', 'solution');
  put('AGENTS.md', 'new\n'); put('app/AGENTS.md', 'x\n'); put('app/CLAUDE.md', 'new\n'); put('README.md', 'new\n'); put('docs/new-howto.md', 'x\n'); put('docs/ignored.log', 'x\n');
  put('.gitignore', 'docs/*.log\n'); put('docs/agents/scratch/runs/tasks.json', JSON.stringify({ tasks: [{ n: 1, parent, task: 'x' }] }));
  built = execFileSync(process.execPath, [path.join(ROOT, 'skills', 'docs-check', 'scripts', 'reader-run.mjs'), 'docs/agents/scratch/runs', '1', '--snapshot-only'],
    { cwd: snap, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const got = walk(built).map(f => path.relative(built, f).split(path.sep).join('/')).sort();
  const want = ['AGENTS.md', 'README.md', 'app/AGENTS.md', 'app/CLAUDE.md', 'docs/new-howto.md', 'docs/x.md', 'src/a.js'];
  if (got.join() !== want.join()) err(`docs-check snapshot has [${got}], expected [${want}]`);
  else {
    for (const f of ['AGENTS.md', 'app/CLAUDE.md']) if (read(path.join(built, f)) !== 'new\n') err(`docs-check snapshot: ${f} is not the working-tree version`);
    if (read(path.join(built, 'README.md')) !== 'old\n') err('docs-check snapshot: README.md is not the parent version');
  }
  if (!fs.existsSync(path.join(built, '.git'))) err('docs-check snapshot: no empty git repository');
} catch (e) {
  err(`docs-check snapshot check failed: ${e.stderr || e.message}`);
} finally { for (const d of [snap, built && path.dirname(built)]) if (d) fs.rmSync(d, { recursive: true, force: true }); }

// ---------- forbidden strings
let patterns = process.env.FORBIDDEN_PATTERNS || '';
const pf = path.join(ROOT, '.forbidden-patterns');
if (!patterns && fs.existsSync(pf)) patterns = read(pf);
const res = patterns.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')).map(s => new RegExp(s, 'iu'));
if (res.length) {
  for (const f of walk(ROOT).filter(f => !f.endsWith('.forbidden-patterns'))) {
    const lines = read(f).split('\n');
    lines.forEach((l, i) => { for (const re of res) if (re.test(l)) err(`${rel(f)}:${i + 1}: forbidden pattern ${re}`); });
  }
} else console.log('Forbidden-pattern scan skipped: no FORBIDDEN_PATTERNS and no .forbidden-patterns.');

if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
console.log('All checks passed.');

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
