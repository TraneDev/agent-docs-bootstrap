#!/usr/bin/env node
// docs-check leak check: does the snapshot or today's documents already hold a task's solution? Same documents as
// the snapshot (docs-paths.mjs). Works the same from bash, PowerShell and cmd; needs git and Node 18+.
//
//   node <skills>/docs-check/scripts/leak-check.mjs <commit> <name> [<name> ...]
//
// <commit> is the task's real commit; its first parent is the snapshot's code. Each <name> is something the
// solution introduced (a new file, class, function, endpoint, key). For each name it prints one verdict:
//   in the parent's code        → replaced: the solution is already in the snapshot
//   in today's documents only   → used: the documents learned it from the solution
//   in the parent's documents   → fine: the developer knew it at the start (a contract written before the code)
//   nowhere                     → fine
// Then it prints what the commit itself wrote into documents, for you to judge whether it describes the solution.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { documentsOf, kitPathsOf } from './docs-paths.mjs';

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1);
  console.log(src.slice(0, src.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(args.length < 2 && !args.includes('--help') && !args.includes('-h') ? 1 : 0);
}
const [commit, ...names] = args;
let ROOT = '';
ROOT = git(['rev-parse', '--show-toplevel']).trim();
const hash = git(['rev-parse', '--verify', `${commit}^{commit}`]).trim();
const parent = git(['rev-parse', '--verify', `${hash}^`]).trim();

const isKit = kitPathsOf(read(path.join(ROOT, '.agent-docs-bootstrap')));
const treeOf = (rev) => git(['ls-tree', '-r', '-z', '--name-only', rev]).split('\0').filter(Boolean);
const isParentDoc = documentsOf(treeOf(parent));
const isDoc = documentsOf(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean));

console.log(`commit ${hash.slice(0, 10)}, parent ${parent.slice(0, 10)}`);
for (const name of names) {
  const atParent = grep(['-F', '-e', name, parent]).map(l => l.slice(parent.length + 1)).filter(p => !isKit(p));
  const code = atParent.filter(p => !isParentDoc(p));
  const parentDocs = atParent.filter(isParentDoc);
  const docsNow = grep(['--untracked', '-F', '-e', name]).filter(p => isDoc(p) && !isKit(p));
  const verdict = code.length ? `replaced: in the parent's code (${list(code)})`
    : docsNow.length && !parentDocs.length ? `used: in today's documents only (${list(docsNow)})`
    : parentDocs.length ? `fine: in the parent's documents too (${list(parentDocs)}), known at the start`
    : 'fine: nowhere';
  console.log(`${name}: ${verdict}`);
}

// What the solution wrote into documents: a glossary entry or contract can describe the solution without naming it.
const isCommitDoc = documentsOf(treeOf(hash));
const changed = git(['diff-tree', '--no-commit-id', '-r', '-z', '--name-only', hash]).split('\0').filter(p => p && isCommitDoc(p) && !isKit(p));
if (!changed.length) console.log('\nThe commit changed no documents.');
else {
  const diff = git(['show', '--format=', '--no-color', hash, '--', ...changed]).split('\n');
  console.log(`\nThe commit changed ${changed.length} document(s): ${list(changed)}. Read it: does it describe the solution?\n`);
  console.log(diff.slice(0, 400).join('\n'));
  if (diff.length > 400) console.log(`\n… ${diff.length - 400} more lines: git show ${hash.slice(0, 10)} -- <document>`);
}

function grep(a) {
  try { return git(['grep', '-l', '-I', ...a]).split('\n').filter(Boolean); }
  catch (e) { if (e.status === 1) return []; throw e; }
}
function git(a) {
  try { return execFileSync('git', a, { cwd: ROOT || process.cwd(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) {
    if (a[0] === 'grep' && e.status === 1) throw e;
    console.error(`leak-check: git ${a.join(' ')}: ${(e.stderr || e.message).toString().trim()}`); process.exit(2);
  }
}
function list(a) { return a.length > 5 ? `${a.slice(0, 5).join(', ')} and ${a.length - 5} more` : a.join(', '); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
