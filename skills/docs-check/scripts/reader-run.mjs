#!/usr/bin/env node
// docs-check steps 2–3: a history-free snapshot outside the repository and a fresh reader started as a
// separate process of your harness. Works the same from bash, PowerShell and cmd; needs git and Node 18+.
//
//   node <skills>/docs-check/scripts/reader-run.mjs <run dir> <N> --harness claude|codex|opencode [--reader <path>] [--timeout-min <m>]
//   node <skills>/docs-check/scripts/reader-run.mjs <run dir> <N> --snapshot-only
//
// <run dir> holds tasks.json: { "tasks": [ { "n": 1, "parent": "<hash>", "task": "<wording>" } ] }.
// Writes rt-<N>-plan.md (the reader's answer) and rt-<N>-log.md there; prints a short summary.
// --timeout-min stops the reader after that many minutes (default 12).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const a = parseArgs(process.argv.slice(2));
if (a.help || a._.length < 2) {
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1);
  console.log(src.slice(0, src.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(a.help ? 0 : 1);
}

const ROOT = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
const RUN = path.resolve(a._[0]);
const N = Number(a._[1]);
const spec = JSON.parse(read(path.join(RUN, 'tasks.json'), 'no tasks.json in the run directory'));
const task = (spec.tasks || []).find(t => Number(t.n) === N) || die(`tasks.json has no task n=${N}`);
if (!task.parent || !task.task) die(`task ${N} has no parent or task`);

// The path hash keeps two repositories with the same folder name apart.
const SNAPS = path.join(os.tmpdir(), `agent-docs-check-${path.basename(ROOT)}-${createHash('sha1').update(ROOT).digest('hex').slice(0, 8)}`);
const SNAP = path.join(SNAPS, `rt-${N}`);
const TIMEOUT_MS = Number(a['timeout-min'] || 12) * 60 * 1000;
const win = process.platform === 'win32';

// Documents the kit builds; kit-installed paths and its run files never reach the reader. The marker is committed
// and could hold any line, so only lines shaped like an installed path count (a line `docs` would hide every document).
const KIT_DIRS = ['.claude/skills', '.claude/agents', '.agents/skills', '.codex/agents', '.opencode/agents', '.opencode/commands'];
const kitPaths = read(path.join(ROOT, '.agent-docs-bootstrap'), '', true).split('\n').map(l => l.trim().split(/\s+/)[0])
  .filter(l => KIT_DIRS.includes(path.posix.dirname(l)) && /^[a-z0-9-]+(\.md|\.toml)?$/.test(path.posix.basename(l)));
const isKit = (p) => p === '.agent-docs-bootstrap' || p.startsWith('docs/agents/') || kitPaths.some(k => p === k || p.startsWith(k + '/'));
// README and other files stay as they were in the parent commit, like the code: they are the project as it was,
// not the documents under test, and today's README may already describe the solution.
const isDoc = (p) => /(^|\/)(AGENTS\.md|CLAUDE\.md|CONTEXT[^/]*\.md)$/.test(p) || p.startsWith('docs/');

// ---------- snapshot: the parent's code without documents, today's documents from the working tree on top
fs.rmSync(SNAP, { recursive: true, force: true });
fs.mkdirSync(SNAP, { recursive: true });
exportParent(p => !isKit(p) && !isDoc(p));
// Tracked and new documents, committed or not; git-ignored and deleted ones are skipped.
const docs = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], ROOT).split('\0')
  .filter(p => p && isDoc(p) && !isKit(p) && fs.existsSync(path.join(ROOT, p)));
for (const p of docs) {
  fs.mkdirSync(path.dirname(path.join(SNAP, p)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, p), path.join(SNAP, p));
}
// An empty repository stops harnesses from loading AGENTS.md / CLAUDE.md from parent directories.
git(['init', '-q', SNAP], SNAP);

const files = walk(SNAP).filter(p => !p.startsWith('.git/'));
const leaked = files.filter(isKit);
if (leaked.length) die(`kit files in the snapshot: ${leaked.slice(0, 5).join(', ')}`);
if (a['snapshot-only']) { console.log(SNAP); process.exit(0); }

// ---------- reader
const harness = a.harness || die('pass --harness claude|codex|opencode: the harness you are running in');
const defaults = { claude: '.claude/agents/docs-reader.md', codex: '.codex/agents/docs-reader.toml', opencode: '.opencode/agents/docs-reader.md' };
if (!defaults[harness]) die(`unknown harness '${harness}'`);
const readerFile = path.resolve(ROOT, a.reader || defaults[harness]);
const reader = parseReader(read(readerFile, `no docs-reader for ${harness} (installed with --target ${harness}? pass --reader <path>)`));
const ask = `Task: ${task.task.trim()}\n\nMake a plan: files, changes, verification commands. Do not edit anything. Separately list everything you had to search the code for or guess, and your questions to the team.`;
const plan = path.join(RUN, `rt-${N}-plan.md`);
fs.mkdirSync(RUN, { recursive: true });

let cmd, args, env = { ...process.env }, input, fromFile = false;
if (harness === 'claude') {
  // --restricted: no shell tools, file tools confined to the snapshot, no settings files; no MCP servers.
  cmd = 'claude';
  args = ['-p', '--restricted', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'text',
    ...(reader.model ? ['--model', reader.model] : []), '--tools', 'Read,Grep,Glob'];
  input = `${reader.prompt}\n\n${ask}`;
} else if (harness === 'codex') {
  cmd = 'codex';
  args = ['exec', '-C', SNAP, '-s', 'read-only', '--skip-git-repo-check', '--ephemeral', ...codexMcpOff(),
    ...(reader.model ? ['-m', reader.model] : []), '-o', plan, '-'];
  input = `${reader.prompt}\n\n${ask}`;
  fromFile = true;
} else {
  // The agent definition goes to a config dir outside the snapshot; its permissions do the confining.
  const cfg = path.join(SNAPS, 'opencode');
  fs.mkdirSync(path.join(cfg, 'agents'), { recursive: true });
  fs.copyFileSync(readerFile, path.join(cfg, 'agents', 'docs-reader.md'));
  env = { ...env, OPENCODE_CONFIG_DIR: cfg, OPENCODE_DISABLE_CLAUDE_CODE: '1' };
  cmd = 'opencode';
  args = ['run', '--pure', '--dir', SNAP, '--agent', 'docs-reader'];
  input = ask;
}

// On Windows the CLIs are often .cmd shims that only a shell can start. The task goes through stdin,
// so quotes and non-ASCII text never pass through the shell.
const child = spawn(win ? [cmd, ...args].map(q).join(' ') : cmd, win ? [] : args,
  { cwd: SNAP, env, shell: win, stdio: ['pipe', 'pipe', 'pipe'] });
child.stdin.end(input);
let out = '', err = '';
child.stdout.on('data', d => { out += d; });
child.stderr.on('data', d => { err += d; });
// With shell: true on Windows, child.kill() stops only cmd.exe; taskkill /T takes the CLI with it.
const stop = () => win ? spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) : child.kill();
const timer = setTimeout(() => { err += `\nstopped after ${TIMEOUT_MS / 60000} min`; stop(); }, TIMEOUT_MS);
child.on('error', e => die(`${cmd} did not start: ${e.message}`));
child.on('close', code => {
  clearTimeout(timer);
  if (!fromFile || !fs.existsSync(plan)) fs.writeFileSync(plan, out);
  const text = read(plan, '', true).trim();
  fs.writeFileSync(path.join(RUN, `rt-${N}-log.md`), `# rt-${N}: ${harness} reader output\n\n## stdout\n\n\`\`\`\n${out.trim()}\n\`\`\`\n\n## stderr\n\n\`\`\`\n${err.trim()}\n\`\`\`\n`);
  console.log([
    `task ${N}, parent ${task.parent}, harness ${harness}`,
    `snapshot: ${SNAP} (${files.length} files, ${docs.length} documents)`,
    `reader: exit ${code}, plan ${text ? 'written' : 'EMPTY'}: ${path.relative(ROOT, plan)}`,
  ].join('\n'));
  process.exit(code === 0 && text ? 0 : 1);
});

// ---------- helpers
function exportParent(keep) {
  const list = git(['ls-tree', '-r', '-z', '--name-only', task.parent], ROOT).split('\0').filter(Boolean).filter(keep);
  if (!list.length) return;
  const index = path.join(SNAPS, `index-${N}`);
  const genv = { ...process.env, GIT_INDEX_FILE: index };
  try {
    // A temporary index: the repository's own index and working tree are untouched, no tar needed.
    execFileSync('git', ['read-tree', task.parent], { cwd: ROOT, env: genv, stdio: ['ignore', 'ignore', 'pipe'] });
    execFileSync('git', ['checkout-index', '-f', '-z', '--stdin', `--prefix=${SNAP.split(path.sep).join('/')}/`],
      { cwd: ROOT, env: genv, input: list.join('\0'), stdio: ['pipe', 'ignore', 'pipe'] });
  } finally { fs.rmSync(index, { force: true }); }
}
// `-c mcp_servers={}` is merged into the user's table and disables nothing. Plugin and app servers go with
// their features; every server from config.toml is switched off by name. A name with a dot cannot be
// addressed in a `-c` path.
function codexMcpOff() {
  const off = ['--disable', 'plugins', '--disable', 'apps'];
  const ls = [...off, 'mcp', 'list', '--json'];
  let list;
  try {
    const out = execFileSync(win ? ['codex', ...ls].join(' ') : 'codex', win ? [] : ls,
      { cwd: SNAP, encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'pipe'] });
    list = JSON.parse(out);
  } catch (e) { die(`codex mcp list --json failed, cannot turn MCP servers off: ${(e.stderr || e.message).toString().trim()}`); }
  const names = list.filter(s => s.enabled !== false).map(s => s.name);
  const dotted = names.filter(n => n.includes('.'));
  if (dotted.length) die(`MCP server names with a dot cannot be turned off for the reader: ${dotted.join(', ')}`);
  return [...off, ...names.flatMap(n => ['-c', `mcp_servers.${n}.enabled=false`])];
}
// The installed docs-reader: Markdown with frontmatter (Claude Code, OpenCode) or TOML (Codex).
function parseReader(text) {
  if (readerFile.endsWith('.toml')) {
    return { prompt: (text.match(/developer_instructions = '''\n?([\s\S]*?)'''/) || die(`${readerFile}: no developer_instructions`))[1].trim(),
      model: (text.match(/^model = "(.*)"$/m) || [])[1] };
  }
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || die(`${readerFile}: no frontmatter`);
  return { prompt: m[2].trim(), model: (m[1].match(/^model: (.+)$/m) || [])[1] };
}
function git(args, cwd) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { die(`git ${args.join(' ')}: ${(e.stderr || e.message).toString().trim()}`); }
}
function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}
function q(s) { return /^[\w./:\\=,-]+$/.test(s) ? s : `"${s}"`; }
function read(p, msg, optional) { try { return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); } catch { return optional ? '' : die(`${msg}: ${p}`); } }
function die(msg) { console.error(`reader-run: ${msg}`); process.exit(1); }
function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '-h' || k === '--help') o.help = true;
    else if (k === '--snapshot-only') o['snapshot-only'] = true;
    else if (k.startsWith('--')) o[k.slice(2)] = argv[++i];
    else o._.push(k);
  }
  return o;
}
