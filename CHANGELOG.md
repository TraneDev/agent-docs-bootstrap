# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow semver (rules in `AGENTS.md`).

## [Unreleased]

## [0.1.0] - 2026-10-19

### Added
- `docs-bootstrap` and `docs-check` skills: staged documentation build (glossary, ADRs, C4 architecture, how-tos, `AGENTS.md`) and the reader test: a fresh agent plans real past tasks, gaps against the real commits become doc fixes.
- `docs-scout` and `docs-reader` subagents, rendered for Claude Code, Codex and OpenCode from one source.
- `install.mjs --target claude|codex|opencode|all`, project or global, with ownership tracking in `.agent-docs-bootstrap`.
- npm package `agent-docs-bootstrap`: `npx agent-docs-bootstrap --target …`.
- Bundled third-party skills with their licenses (`THIRD_PARTY.md`).
- `scripts/check.mjs` and a GitHub Actions workflow.
