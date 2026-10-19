# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow semver (rules in `AGENTS.md`).

## [Unreleased]

### Added
- `docs-bootstrap` and `docs-check` skills: staged documentation build (glossary, ADRs, C4 architecture, how-tos, `AGENTS.md`) and the reader test: a fresh agent plans real past tasks, gaps against the real commits become doc fixes.
- `docs-scout` and `docs-reader` subagents, rendered for Claude Code, Codex and OpenCode from one source.
- `install.mjs --target claude|codex|opencode|all`, project or global, with ownership tracking in `.agent-docs-bootstrap`.
- npm package `agent-docs-bootstrap`: `npx agent-docs-bootstrap --target …`.
- Bundled third-party skills with their licenses (`THIRD_PARTY.md`).
- `scripts/check.mjs` and a GitHub Actions workflow.

### Fixed
- `docs-check`: the reader snapshot now takes the documents from the working tree. Before, `git archive HEAD` failed silently when any listed path (e.g. `CONTEXT-MAP.md`) was missing, so the reader saw no current documents and fixes were never rechecked. Documents deleted since the parent commit no longer reach the reader.
