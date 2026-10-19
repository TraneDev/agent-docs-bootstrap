# agent-docs-bootstrap

Skills and subagents that build reference documentation for a codebase — so that coding agents and new developers can work in it — and then **test** it with a fresh agent.

Works with **Claude Code**, **Codex** and **OpenCode**. Skills follow the shared `SKILL.md` format; subagents are generated per harness from one source.

## What it does

`docs-bootstrap` walks you through staged work. Each stage ends with a stop for review:

| Stage | Result |
|---|---|
| 1. Inventory | confirmed stack, verified commands, existing docs |
| 1.5. External docs audit | what in Confluence/Notion/wiki is current, outdated or missing (skipped without external docs) |
| 2. Domain | `CONTEXT.md` glossary and ADRs, through a structured interview |
| 3. Architecture | `docs/architecture.md` with C4 Context and Container diagrams |
| 4. How-to | `docs/how-to/*.md` for recurring tasks |
| 5. AGENTS.md | root and nested `AGENTS.md`, wired up for Claude Code too |
| 6. Reader test | gaps a fresh agent hits, fixed |

New projects get a shorter track: interview the idea, plan the architecture, write a starter `AGENTS.md`, review after the first features.

The rules it keeps:

- **Code says "what", people say "why".** Reasons for decisions, canonical terms and boundaries come only from a human. The agent asks; it does not invent.
- **Only confirmed content is committed.** Scout drafts stay in a git-ignored scratch folder.
- **Existing docs are extended, never overwritten.**

### The reader test (`docs-check`)

The question "does this documentation help an agent?" is answered with an experiment, not an opinion:

1. Three real past tasks are taken from git history: the agent picks them, or you pick them from its candidates (optional, about 10 minutes, and the check gets more accurate).
2. For each, the kit extracts the code **as it was before the task** (`git archive` of the parent commit, no `.git`) and puts today's documents on top.
3. A fresh `docs-reader` subagent — no history, no git, no edits — plans the task.
4. Its plan is compared with what the real commit changed. Missed files, missed verification commands, wrong terms, rejected approaches and things it had to guess are **gaps**.
5. Each gap becomes a concrete fix in the docs, and the task is rerun until the plan has none.

No LLM judges the plans: an LLM judge prefers the longer, more confident plan. The real commit is the reference.

## Install

Requires Node.js 18+ for the installer. Run it from your project root:

```bash
cd <your project>
npx agent-docs-bootstrap@0.1.0 --target claude      # or codex, opencode, all, claude,codex
git add .agent-docs-bootstrap .claude && git commit -m "Add agent-docs-bootstrap"
```

Pin the version: the whole team then installs the same one, and npx does not serve an older copy from its cache. Alternatively, clone the kit anywhere and run `node ~/agent-docs-bootstrap/install.mjs --target claude` from the project root.

| Target | Skills | Subagents |
|---|---|---|
| `claude` | `.claude/skills/` | `.claude/agents/*.md` |
| `codex` | `.agents/skills/` | `.codex/agents/*.toml` |
| `opencode` | `.agents/skills/` | `.opencode/agents/*.md`, plus `/docs-bootstrap` and `/docs-check` commands |

Files are copied, so they get committed and the whole team runs the same version. `.agent-docs-bootstrap` lists what was installed; reinstalling replaces only those paths and never touches files the kit did not create. Remove everything with `--uninstall`.

Other flags: `--global` installs into your home directory instead of a project; `--scout-model <id>` and `--reader-model <id>` pin subagent models (by default they inherit the session model). A model flag applies to every target in that run, so to pin different models per harness, run the installer once per target.

Restart the agent session after installing.

## Use

| | Build the docs | Check the docs |
|---|---|---|
| Claude Code | `/docs-bootstrap` | `/docs-check` |
| Codex | `$docs-bootstrap` | `$docs-check` |
| OpenCode | `/docs-bootstrap` | `/docs-check` |

Or just ask: "document this project", "check our docs with a reader test". Progress is saved in `docs/agents/bootstrap-state.md`, so the work can stop and continue across sessions.

External documentation (Confluence, Notion, a wiki) is read through whatever MCP server your session has. The kit does not ship or configure one.

## Harness differences

The protocol is the same everywhere; how strictly each harness can enforce the subagent limits is not.

| Guarantee | Claude Code | Codex | OpenCode |
|---|---|---|---|
| Reader cannot see git history | snapshot has no `.git` | snapshot has no `.git` | snapshot has no `.git` + read deny |
| Reader cannot edit or run commands | tool allowlist (`Read, Grep, Glob`) | instructions only | permissions |
| Scout writes only to the scratch folder | instructions (edit tool removed) | instructions only | path permissions |
| External docs are never modified | instructions | instructions | instructions |

Where a guarantee is "instructions only", tighten it with your harness's own permission settings if you need to — for example, deny the write tools of your wiki's MCP server.

## Repository layout

```
skills/docs-bootstrap/   orchestrator: SKILL.md, references/ (formats, scout briefs), templates/
skills/docs-check/       the reader test
skills/third-party/      skills by other authors, unmodified, each with its LICENSE
agents/                  docs-scout, docs-reader: one prompt + per-harness frontmatter blocks
package.json             npm package metadata and the version
install.mjs              installer (the package's `bin`)
scripts/check.mjs        repository checks (CI)
```

## Credits

The workflow builds on skills by other authors, bundled unmodified under their licenses — see [THIRD_PARTY.md](THIRD_PARTY.md): Matt Pocock's `domain-modeling`, `grilling`, `grill-with-docs` and `writing-for-agents` (MIT), Georges Martin's `diataxis-audit` (MIT) and Anthropic's `doc-coauthoring` (Apache 2.0).

## License

[MIT](LICENSE) for the kit's own files. Third-party skills keep their own licenses.
