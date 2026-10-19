# Third-party skills

Copies of skills by other authors, pinned to a commit and **not modified**. Each folder under `skills/third-party/` carries the license of its source, so a skill copied on its own keeps it.

| Skill | Source | Commit | Author | License |
|---|---|---|---|---|
| `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills), `skills/engineering/domain-modeling` | `3cca18b` | Matt Pocock | MIT |
| `grilling` | [mattpocock/skills](https://github.com/mattpocock/skills), `skills/productivity/grilling` | `3cca18b` | Matt Pocock | MIT |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills), `skills/engineering/grill-with-docs` | `3cca18b` | Matt Pocock | MIT |
| `writing-for-agents` | [mattpocock/skills](https://github.com/mattpocock/skills), `skills/productivity/writing-for-agents` | `3cca18b` | Matt Pocock | MIT |
| `diataxis-audit` | [jrjsmrtn/diataxis-skills](https://github.com/jrjsmrtn/diataxis-skills), `skills/diataxis-audit` | `4f36079` | Georges Martin | MIT |
| `doc-coauthoring` | [anthropics/skills](https://github.com/anthropics/skills), `skills/doc-coauthoring` | `34040c9` | Anthropic | Apache 2.0 |

Full commit hashes: `3cca18b368ae95cdbdebbff572ccafa662551015`, `4f36079fd36e49803575200273fd39065fa28c44`, `34040c9c568585f6929bedeaad110ad08f079624`.

`doc-coauthoring`: the anthropics/skills README states that its skills are open source under Apache 2.0, except the document skills (`docx`, `pdf`, `pptx`, `xlsx`), which are source-available; the source folder has no license file of its own, so the Apache 2.0 text is included here.

## Updating

Fresh clone of the source at the new commit → diff against the copy → review for harmful or harness-specific instructions → replace the folder (keep its `LICENSE`) → update the table. `node scripts/check.mjs` verifies every folder has a `LICENSE` and a row here.

## Known quirks

- `grill-with-docs` sets `disable-model-invocation: true`: Claude Code and Codex (via `agents/openai.yaml`) only run it when the user asks; OpenCode ignores the field. The kit's own workflow does not depend on it.
- `doc-coauthoring`: its "Reader Testing" step suggests opening a new chat on claude.ai. In this kit `docs-check` replaces that step; only the Context Gathering and Refinement stages are used.
- `diataxis-audit` links to `diataxis-create`, `diataxis-convert` and `diataxis-plan`, which are not bundled; those links do not resolve, which is expected.
- `agents/openai.yaml` inside Matt Pocock's skills is Codex UI metadata; other harnesses ignore it.

## Considered and not bundled

- `setup-matt-pocock-skills` — writes its own config and creates issues via `gh`/`glab`; its role (wiring docs into the other skills) is played by `AGENTS.md` here.
- `improve-codebase-architecture`, `codebase-design` — not about documentation; they work well on top of a finished `CONTEXT.md` and ADRs.
- `diataxis-create`, `diataxis-convert`, `diataxis-plan` — not needed by the workflow.
