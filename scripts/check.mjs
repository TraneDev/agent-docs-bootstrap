#!/usr/bin/env node
// Repository checks, run locally and in CI:  node scripts/check.mjs
//
// - every skill: SKILL.md frontmatter has name (= folder) and description; relative links resolve;
// - every third-party skill ships its LICENSE and is listed in THIRD_PARTY.md;
// - the packed npm tarball (`npm pack`) keeps every third-party LICENSE, and its install.mjs works for every target
//   into a temp project, and uninstall leaves nothing behind;
// - generated agent files have the fields each harness requires;
// - the docs-check Step 2 snapshot block, run on a temp git repo, copies exactly the current documents;
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

// ---------- skills
const thirdParty = path.join(ROOT, 'skills', 'third-party');
const notices = read(path.join(ROOT, 'THIRD_PARTY.md'));
for (const base of [path.join(ROOT, 'skills'), thirdParty])
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    const d = path.join(base, e.name);
    if (!e.isDirectory() || d === thirdParty) continue;
    const skill = path.join(d, 'SKILL.md');
    if (!fs.existsSync(skill)) { err(`${rel(d)}: no SKILL.md`); continue; }
    const fm = (read(skill).match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
    const name = (fm.match(/^name:\s*(.+)$/m) || ['', ''])[1].trim();
    if (name !== e.name) err(`${rel(skill)}: name '${name}' must equal the folder name`);
    if (!/^description:\s*\S/m.test(fm)) err(`${rel(skill)}: no description`);
    if (base === thirdParty) {
      if (!fs.existsSync(path.join(d, 'LICENSE'))) err(`${rel(d)}: third-party skill without LICENSE`);
      if (!notices.includes(`\`${e.name}\``)) err(`${rel(d)}: not listed in THIRD_PARTY.md`);
      continue;
    }
    for (const f of walk(d).filter(f => f.endsWith('.md')))
      for (const [, link] of read(f).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g))
        if (!/^[a-z]+:/.test(link) && !fs.existsSync(path.resolve(path.dirname(f), link))) err(`${rel(f)}: broken link ${link}`);
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
  for (const e of fs.readdirSync(thirdParty, { withFileTypes: true })) {
    const l = path.join('skills', 'third-party', e.name, 'LICENSE');
    if (e.isDirectory() && !fs.existsSync(path.join(pkg, l))) err(`package: missing ${l}`);
  }
  const install = (...args) => execFileSync(process.execPath, [path.join(pkg, 'install.mjs'), '--project', tmp, '--yes', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  install('--target', 'all');
  const expect = {
    '.claude/skills/docs-bootstrap/SKILL.md': [], '.agents/skills/docs-check/SKILL.md': [],
    '.claude/agents/docs-reader.md': [/^name: docs-reader$/m, /^description: /m, /^tools: Read, Grep, Glob$/m],
    '.claude/agents/docs-scout.md': [/^name: docs-scout$/m, /^disallowedTools: /m],
    '.codex/agents/docs-reader.toml': [/^name = "docs-reader"$/m, /^description = "/m, /^developer_instructions = '''$/m],
    '.codex/agents/docs-scout.toml': [/^name = "docs-scout"$/m],
    '.opencode/agents/docs-reader.md': [/^mode: subagent$/m, /^permission:$/m],
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
  const left = walk(tmp);
  if (left.length) err(`uninstall left files behind: ${left.map(f => path.relative(tmp, f)).join(', ')}`);
} catch (e) {
  err(`packed install.mjs failed: ${e.stderr || e.message}`);
} finally { for (const d of [tmp, packed]) fs.rmSync(d, { recursive: true, force: true }); }

// ---------- docs-check snapshot block (Step 2) produces the expected documents
const snap = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-snap-'));
try {
  const block = (read(path.join(ROOT, 'skills', 'docs-check', 'SKILL.md')).split(/^## Step 2\. Snapshot$/m)[1] || '').match(/```\n([\s\S]*?)```/);
  if (!block) throw new Error('no fenced block after "## Step 2. Snapshot" in skills/docs-check/SKILL.md');
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: snap, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (f, s) => { fs.mkdirSync(path.dirname(path.join(snap, f)), { recursive: true }); fs.writeFileSync(path.join(snap, f), s); };
  git('init', '-q');
  for (const f of ['docs/x.md', 'docs/removed-later.md', 'src/AGENTS.md', 'docs/agents/state.md', 'src/a.js']) put(f, 'x\n');
  put('AGENTS.md', 'old\n');
  git('add', '.'); git('commit', '-qm', 'parent');
  const parent = git('rev-parse', 'HEAD');
  git('rm', '-q', 'docs/removed-later.md', 'src/AGENTS.md'); git('commit', '-qm', 'drop docs');
  put('AGENTS.md', 'new\n'); put('app/AGENTS.md', 'x\n'); put('docs/new-howto.md', 'x\n'); put('docs/ignored.log', 'x\n');
  put('.gitignore', 'docs/*.log\n'); put('docs/agents/scratch/rt-0/plan.md', 'x\n');
  execFileSync('sh', ['-c', block[1].replaceAll('<parent>', parent).replaceAll('<N>', '1')], { cwd: snap, stdio: ['ignore', 'ignore', 'pipe'] });
  const root = path.join(snap, 'docs/agents/scratch/rt-1');
  const got = walk(root).map(f => path.relative(root, f).split(path.sep).join('/')).filter(f => f !== '.gitignore').sort();
  const want = ['AGENTS.md', 'app/AGENTS.md', 'docs/new-howto.md', 'docs/x.md', 'src/a.js'];
  if (got.join() !== want.join()) err(`docs-check Step 2 snapshot has [${got}], expected [${want}]`);
  else if (read(path.join(root, 'AGENTS.md')) !== 'new\n') err('docs-check Step 2 snapshot: AGENTS.md is not the working-tree version');
} catch (e) {
  err(`docs-check Step 2 snapshot check failed: ${e.stderr || e.message}`);
} finally { fs.rmSync(snap, { recursive: true, force: true }); }

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
