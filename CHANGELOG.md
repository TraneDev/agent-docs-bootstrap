# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow semver (rules in `AGENTS.md`).

## [Unreleased]

## [0.4.1] - 2026-10-27

### Fixed
- A `.DS_Store` or other OS file inside an installed folder counted as a change: the first run skipped the path and dropped its marker line, and later runs called it "not installed by this kit", so updates stopped for the whole team once the marker was committed. Dot files, `Thumbs.db` and `desktop.ini` are now left out of content hashes; a folder without them hashes exactly as in 0.4.0.
- A path that exists without a marker line but holds content a kit version wrote, byte for byte, is recognised, updated and listed again, so installs stuck on 0.4.0 recover with a normal run.
- A shipped path the user changed keeps its marker line and old hash, so every run reports the same thing about it instead of "changed" first and "not installed by this kit" afterwards.
- The installer exits non-zero and lists the paths it could not install when a shipped path is skipped, so an agent or CI notices an incomplete install. A changed path the kit no longer ships is only a warning.

## [0.4.0] - 2026-10-27

### Changed
- `.agent-docs-bootstrap` lines are `<path> <content hash>`. A path is replaced or removed only if its content still matches what the kit wrote; lines without a hash, from 0.3.0 and earlier, are checked against the hashes of everything those versions installed.

### Fixed
- An update or `--uninstall` removed a listed path whatever was in it, so a skill the user had replaced with their own version under the same name, such as `grilling` after 0.2.0, was deleted. A changed path is now left in place as the user's, with a warning, and drops out of the marker. Subagent files a 0.3.0 or earlier install rendered with `--scout-model` or `--reader-model` do not match the known hashes and are left in place too: delete them and run the installer again.

## [0.3.0] - 2026-10-27

### Changed
- Third-party skills are bundled inside `docs-bootstrap` as guides in `vendor/<name>/`, read by path, instead of being installed as separate skills. Each `SKILL.md` is renamed to `<name>.md`, content unchanged: Codex and OpenCode find a nested `SKILL.md` and register it as a skill, and OpenCode silently keeps one of two skills with the same name. A user's own `grilling` or `domain-modeling` no longer clashes with the kit's copy. The install now has two skills, `docs-bootstrap` and `docs-check`.
- The installer removes paths an earlier version installed into the same targets and this version no longer ships, so an update from 0.2.0 drops the old third-party skill folders.
- README, package description and keywords: a set of agent skills for any agent that runs them; the installer sets up Claude Code, Codex and OpenCode. New "Other agents" section. `docs-check` falls back to `--snapshot-only` for any other harness.
- `docs-scout` for OpenCode no longer needs the `diataxis-audit` skill permission; the brief gives it the guide's path.

### Fixed
- `--uninstall` and updates removed every path listed in `.agent-docs-bootstrap`, which is committed, so a line added by a bad merge (`src`, `../x`) deleted project or outside folders. Only lines shaped like a path the kit installs, `<layout folder>/<kit name>`, are now trusted; others are ignored with a warning and dropped from the marker. `reader-run.mjs` applies the same rule, so a stray `docs` line no longer hides every document from the snapshot.
- `docs-check` snapshot: a nested `CLAUDE.md` came from the parent commit instead of the working tree. `README` stays from the parent commit on purpose, now stated in the skill.
- README no longer says the Codex reader has no access to the repository: its read-only sandbox blocks writes, not reading other folders.
- `docs-check`: global instructions wording no longer claims `claude -p --restricted` loads `~/.claude/CLAUDE.md`.
- `reader-run.mjs`: `--timeout-min` is documented; on Windows the timeout stops the CLI, not only its shell; snapshot folders of two repositories with the same name no longer collide.
- `install.mjs` accepts `--flag=value` as well as `--flag value`.

### Removed
- `grill-with-docs`: the kit did not use it, and it only calls the `grilling` and `domain-modeling` skills, which are no longer installed as skills.

## [0.2.0] - 2026-10-27

### Added
- `docs-check` own-task mode: the human gives a task, a fresh reader plans it on a snapshot of the current commit with the current documents, and the human decides what the documents should have answered. No reference commit, no gap list.

### Changed
- `docs-check` is an optional skill run on request, described as a diagnostic rather than proof that the documents are good. History tasks prefer commits made after the documents were written. The `reader-tests.md` template moved to `skills/docs-check/templates/` and gained an "Own tasks" table. The runs table row in the skill lists the snapshot artifacts column, and the "Never" rule says the snapshot's empty repository holds no history.
- `docs-check`: the reader runs as a separate process of the harness (`claude -p --restricted`, `codex exec -s read-only`, `opencode run --pure`) in a snapshot outside the repository, built and started by the new `skills/docs-check/scripts/reader-run.mjs` the same way in bash, PowerShell and cmd. For Codex the script turns off plugins, apps and every configured MCP server by name: `-c mcp_servers={}` is merged into the user's table and disables nothing. A subagent shared the session's working directory and could find the solution in the current code.
- `docs-check`: the agent picks the three tasks itself and checks each for leaks (the solution already in the parent's code or in the current documents); task statuses `ready` / `used` / `replaced`; wording and reference rules (no file names or tracker links; no documentation files in the reference).
- `docs-check`: one list of fixes grouped by document, approved once, instead of "fix and rerun until no gaps". A rerun of the same task after fixing the documents for it passes without proving anything; such tasks become `used` and the next check runs on new ones. Snapshot artifacts (docs describing a newer layout than the parent's code) are recorded separately from gaps.
- `docs-bootstrap`: stage 4 no longer defers missing how-tos to the reader test, and how-tos are not written from reader test tasks.
- `docs-reader` for OpenCode: `mode: all`, `"*": deny` first, then read and search only; bash and `external_directory` denied.
- "Reader test task candidates" brief: excludes commits whose files the documents already mention; wording without file names or tickets; reference without documentation files.
- Independent subagent calls run in parallel by default (stage 1.5 batches, the reader runs of `docs-check`); one at a time only when the model provider rate-limits parallel requests.
- `docs-bootstrap`: stage 1.5 resumes after a break (an existing index and batches with `external-audit-N.md` are skipped); every stop starts with a three-line header (stage, what was done, the one action needed from the human); new invariant "secrets never reach the documents", also in `docs-check` fixes.
- `docs-scout` for OpenCode: shell `"*": deny` instead of `ask`, with git and lint/typecheck/build commands allowed; files are read with the harness's file tools; a refused command is marked unverified without a prompt. The stage 1 brief caches lint, typecheck and build results in `scratch/build-checks.md` and reuses them while manifests and lock files are unchanged.
- `reader-tests.md` template: status column, wording and reference rules, snapshot artifacts in the runs table; plans go to `docs/agents/scratch/reader-runs/`.
- README: quick start first, install from npm, a GitHub release tag or a clone, update and uninstall steps, all installer flags. `scripts/check.mjs` fails when a version pinned in the README differs from `package.json`.
- README credits link to each third-party skill's source repository.
- README title says what the kit gives you instead of repeating the package name.

### Removed
- `docs-bootstrap` stage 6. The reader test is optional: `docs-bootstrap` no longer runs `docs-check` or creates `reader-tests.md`, and its wrap-up only mentions the check. A state file with a stage 6 row from an older version gets it marked `skipped`.

## [0.1.0] - 2026-10-19

### Added
- `docs-bootstrap` and `docs-check` skills: staged documentation build (glossary, ADRs, C4 architecture, how-tos, `AGENTS.md`) and the reader test: a fresh agent plans real past tasks, gaps against the real commits become doc fixes.
- `docs-scout` and `docs-reader` subagents, rendered for Claude Code, Codex and OpenCode from one source.
- `install.mjs --target claude|codex|opencode|all`, project or global, with ownership tracking in `.agent-docs-bootstrap`.
- npm package `agent-docs-bootstrap`: `npx agent-docs-bootstrap --target …`.
- Bundled third-party skills with their licenses (`THIRD_PARTY.md`).
- `scripts/check.mjs` and a GitHub Actions workflow.
