# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow semver (rules in `AGENTS.md`).

## [Unreleased]

### Changed
- `docs-check`: the reader runs as a separate process of the harness (`claude -p --restricted`, `codex exec -s read-only`, `opencode run --pure`) in a snapshot outside the repository, built and started by the new `skills/docs-check/scripts/reader-run.mjs` the same way in bash, PowerShell and cmd. A subagent shared the session's working directory and could find the solution in the current code.
- `docs-check`: the agent picks the three tasks itself and checks each for leaks (the solution already in the parent's code or in the current documents); task statuses `ready` / `used` / `replaced`; wording and reference rules (no file names or tracker links; no documentation files in the reference).
- `docs-check`: one list of fixes grouped by document, approved once, instead of "fix and rerun until no gaps". A rerun of the same task after fixing the documents for it passes without proving anything; such tasks become `used` and the next check runs on new ones. Snapshot artifacts (docs describing a newer layout than the parent's code) are recorded separately from gaps.
- `docs-bootstrap`: stage 4 no longer defers missing how-tos to the reader test, and how-tos are not written from reader test tasks; stage 6 is done when the fix list is approved and applied, not when all tasks reach zero gaps.
- `docs-reader` for OpenCode: `mode: all`, `"*": deny` first, then read and search only; bash and `external_directory` denied.
- "Reader test task candidates" brief: excludes commits whose files the documents already mention; wording without file names or tickets; reference without documentation files.
- Independent subagent calls run in parallel by default (stage 1.5 batches, the three reader runs); one at a time only when the model provider rate-limits parallel requests.
- `docs-bootstrap`: stage 1.5 resumes after a break (an existing index and batches with `external-audit-N.md` are skipped); every stop starts with a three-line header (stage, what was done, the one action needed from the human); new invariant "secrets never reach the documents", also in `docs-check` fixes.
- `docs-scout` for OpenCode: shell `"*": deny` instead of `ask`, with git and lint/typecheck/build commands allowed; files are read with the harness's file tools; a refused command is marked unverified without a prompt. The stage 1 brief caches lint, typecheck and build results in `scratch/build-checks.md` and reuses them while manifests and lock files are unchanged.
- `reader-tests.md` template: status column, wording and reference rules, snapshot artifacts in the runs table; plans go to `docs/agents/scratch/reader-runs/`.
- README: quick start first, install from npm, a GitHub release tag or a clone, update and uninstall steps, all installer flags. `scripts/check.mjs` fails when a version pinned in the README differs from `package.json`.
- README credits link to each third-party skill's source repository.
- README title says what the kit gives you instead of repeating the package name.

## [0.1.0] - 2026-10-19

### Added
- `docs-bootstrap` and `docs-check` skills: staged documentation build (glossary, ADRs, C4 architecture, how-tos, `AGENTS.md`) and the reader test: a fresh agent plans real past tasks, gaps against the real commits become doc fixes.
- `docs-scout` and `docs-reader` subagents, rendered for Claude Code, Codex and OpenCode from one source.
- `install.mjs --target claude|codex|opencode|all`, project or global, with ownership tracking in `.agent-docs-bootstrap`.
- npm package `agent-docs-bootstrap`: `npx agent-docs-bootstrap --target …`.
- Bundled third-party skills with their licenses (`THIRD_PARTY.md`).
- `scripts/check.mjs` and a GitHub Actions workflow.
