# agent-docs-bootstrap — agent instructions

This is the kit's repository, not a project to document. First work out what is being asked:

- **install the kit into a project** → "Installing into a project", step by step;
- **change the kit itself** (skills, subagents, installer, a release) → "Developing the kit";
- **build or check a project's documentation** → that happens inside the project, with the `docs-bootstrap` or `docs-check` skill, not here.

## Installing into a project

Do exactly this:

1. Find the target project's root: the directory with `.git`. If it was not named, ask — do not guess.
2. Ask which harnesses the team uses if it is not clear: `claude`, `codex`, `opencode` (several are comma-separated, or `all`).
3. From the project root: `npx agent-docs-bootstrap@<version> --target <targets> --yes`, or `node <path-to-kit>/install.mjs --target <targets> --yes` from a clone.
4. Check the result: `<project>/.agent-docs-bootstrap` starts with `version=`, and the skills and agents listed in `README.md` for those targets exist.
5. Tell the human to commit `.agent-docs-bootstrap` and the installed folders, then restart the agent session.

Do not edit the kit's files during an install, do not create `docs/agents/` in the project (the skill does that on first run), and do not write anything to external documentation.

## Developing the kit

Skills and subagents are Markdown prompts with YAML frontmatter; the only code is `install.mjs`, `scripts/check.mjs` and `skills/docs-check/scripts/reader-run.mjs`, all dependency-free Node 18+. Everything in the repository is written in English.

```bash
node scripts/check.mjs                         # all repository checks; CI runs the same
node install.mjs --target all --project <dir> --yes
node install.mjs --project <dir> --uninstall
```

`scripts/check.mjs` also scans for forbidden strings from the untracked file `.forbidden-patterns` (one regex per line) or the `FORBIDDEN_PATTERNS` variable. Keep that list out of git.

### How it fits together

- **Skills are the portable layer.** `skills/docs-bootstrap` and `skills/docs-check` are the only skills and the entry points in every harness, including ones the installer does not know; there is no primary agent. Anything a harness-specific agent used to enforce must be stated in the skill text too.
- **Subagents have one source.** `agents/<name>.md` holds `name`, `description`, a `claude-code: |` and an `opencode: |` block of raw frontmatter, and the prompt. `install.mjs` renders `.claude/agents/*.md`, `.opencode/agents/*.md` and `.codex/agents/*.toml` (prompt as `developer_instructions`). Prompts must not contain `'''`.
- **Restrictions live in two places.** A limit set in a frontmatter block (tools, permissions) must also be stated in the prompt, because Codex has no per-subagent permissions and relies on the prompt alone. Change both together and keep the "Harness differences" table in `README.md` true.
- **Invariants repeat on purpose** ("code says what, people say why", "do not judge the docs yourself", "only confirmed content is committed") in `docs-bootstrap`, `docs-check` and the agent prompts. Change all places at once.
- **`docs-check` is optional.** `docs-bootstrap` never runs it and must not depend on it or on `reader-tests.md`; it only mentions the check in the wrap-up. The check's template lives in `skills/docs-check/templates/`.
- **The reader is a separate process, not a subagent.** `docs-check` starts it through `reader-run.mjs` with the harness's CLI (`claude -p --restricted`, `codex exec -s read-only`, `opencode run --pure`); `agents/docs-reader.md` is its prompt and, for OpenCode, its permissions (`mode: all`, because `opencode run --agent` falls back to the default agent for a subagent). A subagent shares the session's working directory and can find the solution in the current code. Change the CLI flags in the script, the skill and the README "Harness differences" table together.
- **Commands in skills run in any shell.** One command per call, no `cd`, `&&`, pipes, redirects or Unix-only tools: users run bash, PowerShell and cmd. Anything longer goes into a Node script inside the skill (`scripts/` is copied with the skill folder).
- **Harness-neutral wording.** Say "start the `docs-scout` subagent", not a tool name of one harness. Harness-specific facts belong in `README.md` or behind an explicit "in Claude Code…".
- **Installed paths are owned through `.agent-docs-bootstrap`.** Each line is `<path> <content hash>`. The installer replaces or removes a path only if its line is shaped like `<layout folder>/<kit name>` (the marker is committed, so any line may end up in it) and the content still matches the hash; a changed path is the user's and is left in place. Lines without a hash come from 0.3.0 and earlier and are checked against `LEGACY` in `install.mjs`, which never changes; content matching `LEGACY` or what this version writes is the kit's even if its line is missing. Files the OS adds (dot files, `Thumbs.db`, `desktop.ini`) are left out of the hash, so the kit ships none; the hash format must not change. When a skill, subagent or command is renamed or dropped, keep its old name in `SHIPPED` so updates can still remove it. Keep that guarantee when changing it.
- **Third-party guides** (`skills/docs-bootstrap/vendor/<name>/`) are never edited; the only change is `SKILL.md` renamed to `<name>.md`, because Codex and OpenCode find a nested `SKILL.md` and register it as a separate skill. `docs-bootstrap` reads them by path. The update procedure is in `THIRD_PARTY.md`.

### Changes and releases

Every change gets a line under `[Unreleased]` in `CHANGELOG.md`. Versions follow semver: major — the format of files the kit writes into projects (`docs/agents/*`, install layout) changes; minor — skill or subagent behaviour changes; patch — wording and fixes. To release: bump `version` in `package.json` and every pinned version in `README.md` (`check.mjs` fails on a mismatch), rename `[Unreleased]` to the version and date (keep an empty `[Unreleased]` above it), commit, tag `vX.Y.Z`, push with tags, then a human runs `npm publish`.
