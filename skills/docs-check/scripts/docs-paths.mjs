// Which files are the documents under test. Shared by reader-run.mjs (the snapshot takes them from the working tree,
// everything else from the parent commit) and leak-check.mjs (it searches the same set), so the two never disagree.
//
// Documents: AGENTS.md, CLAUDE.md and CONTEXT*.md at any depth, the root docs/ folder, and a docs/ folder at any
// depth unless it holds a package manifest at its top: then it is a documentation site, i.e. code, and stays as the
// parent commit had it. The root docs/ is always documents: the kit writes there.

const MANIFEST = /^(package\.json|pyproject\.toml|setup\.py|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(\.kts)?|[^/]+\.csproj|[^/]+\.fsproj)$/;

// files: every path (forward slashes) of the tree the path comes from; used to spot documentation sites.
export function documentsOf(files) {
  const sites = new Set();
  for (const f of files) {
    const m = f.match(/^(.+\/docs)\/([^/]+)$/);
    if (m && MANIFEST.test(m[2])) sites.add(m[1]);
  }
  return (p) => {
    if (/(^|\/)(AGENTS\.md|CLAUDE\.md|CONTEXT[^/]*\.md)$/.test(p) || p.startsWith('docs/')) return true;
    const m = p.match(/^(.+?\/docs)\//);
    return !!m && !sites.has(m[1]);
  };
}

// Paths the kit installed, from the committed marker, plus its own files: they never reach the reader and are not
// searched. Only marker lines shaped like an installed path count, so a stray line `docs` hides nothing.
const KIT_DIRS = ['.claude/skills', '.claude/agents', '.agents/skills', '.codex/agents', '.opencode/agents', '.opencode/commands'];
export function kitPathsOf(marker) {
  const listed = marker.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(l => {
    const i = l.lastIndexOf('/');
    return KIT_DIRS.includes(l.slice(0, i)) && /^[a-z0-9-]+(\.md|\.toml)?$/.test(l.slice(i + 1));
  });
  return (p) => p === '.agent-docs-bootstrap' || p.startsWith('docs/agents/') || listed.some(k => p === k || p.startsWith(k + '/'));
}
