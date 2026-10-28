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
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
// install.mjs leaves files the OS adds (.DS_Store, ._*, Thumbs.db, desktop.ini) out of content hashes, so the kit ships none.
for (const f of execFileSync('git', ['ls-files', '-z', 'skills', 'agents'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean))
  if (f.split('/').some(isOsFile)) err(`${f}: OS files are left out of install hashes; the kit must not ship them`);
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
    '.agents/skills/docs-check/scripts/reader-run.mjs': [], '.agents/skills/docs-check/scripts/leak-check.mjs': [],
    '.claude/skills/docs-check/scripts/docs-paths.mjs': [],
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
  // Repeated runs in a fresh project: OS files, a marker line 0.4.0 dropped, a shipped file the user changed.
  const p2 = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-rerun-'));
  try {
    const run = (...args) => spawnSync(process.execPath, [path.join(pkg, 'install.mjs'), '--project', p2, '--yes', '--target', 'claude', ...args], { encoding: 'utf8' });
    const m2 = () => read(path.join(p2, '.agent-docs-bootstrap'));
    const listed = (r) => new RegExp(`^${r.replace(/[./]/g, '\\$&')} [0-9a-f]{16}$`, 'm').test(m2());
    const junk = () => { for (const f of ['.DS_Store', '._SKILL.md', 'Thumbs.db', 'references/desktop.ini']) fs.writeFileSync(path.join(p2, '.claude/skills/docs-bootstrap', f), '\0\0\0\x01Bud1'); };
    run(); junk();
    for (const i of [1, 2]) { const r = run(); if (r.status !== 0 || /WARNING/.test(r.stderr)) err(`rerun ${i} with .DS_Store: exit ${r.status} ${r.stderr.trim()}`); }
    if (!listed('.claude/skills/docs-bootstrap')) err('rerun with .DS_Store: docs-bootstrap dropped out of the marker');
    fs.writeFileSync(path.join(p2, '.agent-docs-bootstrap'), m2().replace(/^\.claude\/skills\/docs-bootstrap .*\n/m, '')); junk();
    const rec = run();
    if (rec.status !== 0 || !listed('.claude/skills/docs-bootstrap')) err(`recovery of an unlisted path with kit content: exit ${rec.status}, listed ${listed('.claude/skills/docs-bootstrap')}`);
    const skill = path.join(p2, '.claude/skills/docs-check/SKILL.md');
    fs.appendFileSync(skill, 'local rule\n');
    const runs = [run(), run()];
    for (const r of runs) if (r.status === 0 || !/skipped \.claude\/skills\/docs-check: changed since it was installed/.test(r.stderr)) err(`changed shipped path: exit ${r.status} ${r.stderr.trim()}`);
    if (runs[0].stderr !== runs[1].stderr) err('changed shipped path: the two runs report different things');
    if (!read(skill).endsWith('local rule\n')) err('changed shipped path: the user edit was overwritten');
    if (!listed('.claude/skills/docs-check')) err('changed shipped path: its marker line was dropped');
    // The user's own hidden file in a kit folder is content, not OS noise: kept by an update and by uninstall.
    const notes = path.join(p2, '.claude/skills/docs-bootstrap/.notes.md');
    fs.writeFileSync(notes, 'mine\n');
    const hid = run();
    if (hid.status === 0 || !/skipped \.claude\/skills\/docs-bootstrap: changed since it was installed/.test(hid.stderr) || !fs.existsSync(notes))
      err(`own hidden file in a kit folder: exit ${hid.status}, kept ${fs.existsSync(notes)} ${hid.stderr.trim()}`);
    run('--uninstall');
    if (!fs.existsSync(notes)) err('own hidden file in a kit folder: removed by --uninstall');
  } finally { fs.rmSync(p2, { recursive: true, force: true }); }

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
  put('AGENTS.md', 'old\n'); put('app/CLAUDE.md', 'old\n'); put('README.md', 'old\n'); put('app/docs/adr/0001.md', 'old\n');
  put('site/docs/package.json', '{}\n'); put('site/docs/src/page.js', 'old\n');
  put('.agent-docs-bootstrap', 'version=0.0.0\n.claude/skills/docs-check\ndocs\nsrc\n');
  git('add', '.'); git('commit', '-qm', 'parent');
  const parent = git('rev-parse', 'HEAD');
  git('rm', '-q', 'docs/removed-later.md', 'src/AGENTS.md'); put('src/b.js', 'x\n'); git('add', '.'); git('commit', '-qm', 'solution');
  put('AGENTS.md', 'new\n'); put('app/AGENTS.md', 'x\n'); put('app/CLAUDE.md', 'new\n'); put('README.md', 'new\n');
  put('app/docs/adr/0001.md', 'new\n'); put('app/docs/adr/0002.md', 'new\n'); put('site/docs/src/page.js', 'new\n'); put('docs/new-howto.md', 'x\n'); put('docs/ignored.log', 'x\n');
  put('.gitignore', 'docs/*.log\n'); put('docs/agents/scratch/runs/tasks.json', JSON.stringify({ tasks: [{ n: 1, parent, task: 'x' }] }));
  built = execFileSync(process.execPath, [path.join(ROOT, 'skills', 'docs-check', 'scripts', 'reader-run.mjs'), 'docs/agents/scratch/runs', '1', '--snapshot-only'],
    { cwd: snap, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const got = walk(built).map(f => path.relative(built, f).split(path.sep).join('/')).sort();
  const want = ['AGENTS.md', 'README.md', 'app/AGENTS.md', 'app/CLAUDE.md', 'app/docs/adr/0001.md', 'app/docs/adr/0002.md',
    'docs/new-howto.md', 'docs/x.md', 'site/docs/package.json', 'site/docs/src/page.js', 'src/a.js'];
  if (got.join() !== want.join()) err(`docs-check snapshot has [${got}], expected [${want}]`);
  else {
    for (const f of ['AGENTS.md', 'app/CLAUDE.md', 'app/docs/adr/0001.md']) if (read(path.join(built, f)) !== 'new\n') err(`docs-check snapshot: ${f} is not the working-tree version`);
    // A nested docs/ with its own package manifest is a documentation site: code, from the parent.
    for (const f of ['README.md', 'site/docs/src/page.js']) if (read(path.join(built, f)) !== 'old\n') err(`docs-check snapshot: ${f} is not the parent version`);
  }
  if (!fs.existsSync(path.join(built, '.git'))) err('docs-check snapshot: no empty git repository');
} catch (e) {
  err(`docs-check snapshot check failed: ${e.stderr || e.message}`);
} finally { for (const d of [snap, built && path.dirname(built)]) if (d) fs.rmSync(d, { recursive: true, force: true }); }

// ---------- docs-check leak-check.mjs: names in the parent's code, in documents before and after, and the commit's doc diff
const leak = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-leak-'));
try {
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: leak, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (f, s) => { fs.mkdirSync(path.dirname(path.join(leak, f)), { recursive: true }); fs.writeFileSync(path.join(leak, f), s); };
  git('init', '-q');
  put('docs/api/orders.md', "status 'held' is allowed\n"); put('src/a.js', 'function oldHelper() {}\n'); put('app/docs/glossary.md', 'Terms\n');
  git('add', '.'); git('commit', '-qm', 'parent');
  put('src/b.js', 'function computeShipping() { oldHelper(); }\n'); put('app/docs/glossary.md', 'Terms\nLate order: its delivery window has closed.\n');
  git('add', '.'); git('commit', '-qm', 'solution');
  const hash = git('rev-parse', 'HEAD');
  put('docs/api/orders.md', "status 'held' is allowed\nUse computeShipping.\n"); git('commit', '-qam', 'docs later');
  const out = execFileSync(process.execPath, [path.join(ROOT, 'skills', 'docs-check', 'scripts', 'leak-check.mjs'), hash, 'oldHelper', 'held', 'computeShipping', 'absent'],
    { cwd: leak, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  for (const re of [/^oldHelper: replaced: /m, /^held: fine: in the parent's documents/m, /^computeShipping: used: /m, /^absent: fine: nowhere/m,
    /changed 1 document\(s\): app\/docs\/glossary\.md/, /^\+Late order: its delivery window/m])
    if (!re.test(out)) err(`docs-check leak-check.mjs output does not match ${re}:\n${out}`);
} catch (e) {
  err(`docs-check leak check failed: ${e.stderr || e.message}`);
} finally { fs.rmSync(leak, { recursive: true, force: true }); }

// ---------- every release's install stays recognised: LEGACY in install.mjs holds what each release tag installed
// An install whose marker lost its lines is recognised only by content, so the hashes of every released version must
// stay known after the kit changes. Each release adds the outgoing version's hashes; this lists what is missing.
const relTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-docs-bootstrap-releases-'));
try {
  const tags = execFileSync('git', ['tag', '-l', 'v*'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(t => /^v\d+\.\d+\.\d+$/.test(t));
  if (!tags.length) throw new Error('no release tags v*; fetch them (in CI: actions/checkout with fetch-depth: 0)');
  const legacy = new Set(((read(path.join(ROOT, 'install.mjs')).match(/const LEGACY = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '').match(/'[0-9a-f]{16}'/g)?.map(h => h.slice(1, -1)) || []);
  if (!legacy.size) throw new Error('no LEGACY set found in install.mjs');
  // Installs a kit into a fresh project and returns [path, recorded hash, content hash] for every marker line.
  const installFrom = (kit, name) => {
    const proj = path.join(relTmp, name);
    fs.mkdirSync(proj); execFileSync('git', ['init', '-q'], { cwd: proj });
    execFileSync(process.execPath, [path.join(kit, 'install.mjs'), '--target', 'all', '--project', proj, '--yes'], { stdio: ['ignore', 'ignore', 'pipe'] });
    return read(path.join(proj, '.agent-docs-bootstrap')).split('\n').filter(l => l && !l.startsWith('version='))
      .map(l => { const [r, h] = l.split(/\s+/); return [r, h, contentHash(path.join(proj, r))]; });
  };
  const current = installFrom(ROOT, 'current');
  for (const [r, h, c] of current) if (h !== c) err(`check.mjs contentHash differs from install.mjs for ${r} (${c} vs ${h}): keep the two copies the same`);
  const currentHashes = new Set(current.map(([, , c]) => c));
  for (const tag of tags) {
    const kit = path.join(relTmp, `${tag}-kit`);
    fs.mkdirSync(kit);
    execFileSync('git', ['archive', '--format=tar', '-o', path.join(relTmp, `${tag}.tar`), tag], { cwd: ROOT });
    execFileSync('tar', ['-xf', path.join(relTmp, `${tag}.tar`), '-C', kit]);
    // The release being prepared may still match what this tree installs; every earlier one must be in LEGACY.
    const missing = installFrom(kit, tag).filter(([, , c]) => !legacy.has(c) && !(tag === `v${version}` && currentHashes.has(c)));
    if (missing.length) err(`install.mjs LEGACY lacks what ${tag} installed; add ${[...new Set(missing.map(([, , c]) => `'${c}'`))].join(', ')} (${missing.map(([r]) => r).join(', ')})`);
  }
} catch (e) {
  err(`release hash check failed: ${e.stderr || e.message}`);
} finally { fs.rmSync(relTmp, { recursive: true, force: true }); }

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

// The same content hash as install.mjs; the release hash check compares the two on a fresh install.
function isOsFile(name) { return /^(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(name) || name.startsWith('._'); }
function contentHash(p) {
  const h = createHash('sha256');
  const files = fs.lstatSync(p).isDirectory() ? listFiles(p).sort() : [''];
  for (const f of files) h.update(`${f}\0${fs.readFileSync(path.join(p, f), 'utf8').replace(/\r\n/g, '\n')}\0`);
  return h.digest('hex').slice(0, 16);
}
function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => !isOsFile(e.name)).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}
function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
