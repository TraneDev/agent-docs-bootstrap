# AGENTS.md format

## Root file

Up to 150 lines. Only what an agent needs on every turn. Sections in this order, skip the ones that do not apply:

```
# <project>

Two sentences: what it is and for whom. Link to docs/architecture.md.

## Commands

3–5 commands: build, unit tests, lint/typecheck, local run, e2e (if it runs locally).
Only those verified at stage 1. Non-standard flags and environment variables go here;
the agent finds the rest in the manifest itself.

## Where things are

Map of top-level directories: path → one line. From stage 3 and the stage 1 structure.

## Terms

One line: "Glossary — CONTEXT.md. Use its terms; do not use the synonyms listed under _Avoid_."

## Decisions

One line: "Decisions — docs/adr/. Before proposing an architectural change, check it was not rejected. A new decision made in conversation becomes a new ADR right away."

## How to do common tasks

List of links to docs/how-to/*.md, one line per task title.

## Keeping docs current

Insert this block as is into every root file; drop lines about documents the project does not have.

Docs change in the same change as the code, otherwise they fall behind it:
- a new domain term or a rename → CONTEXT.md;
- a build, test or run command or its flags changed → the "Commands" section of this file;
- a top-level directory appeared or disappeared → "Where things are";
- a service, deployment unit or external system appeared or disappeared → docs/architecture.md;
- the steps of a task that has a how-to changed → that file in docs/how-to/.
At the end of a task, list the documents you updated, or say none were needed. Do not invent the
reason for a decision: if a human did not give it, ask instead of writing it down.

## Rules

Only from a human. What not to do, what to always check, what not to touch.
Phrase each as a rule with a reason: "Don't run e2e locally: they hit the shared staging environment."
```

## Nested files

`<area>/AGENTS.md` for an app in a monorepo or a large module. Most harnesses load it when working with files in that area. It holds only what is specific to the area: local commands, local rules, differences from the root. It does not repeat the root file or link to it.

## Claude Code

Claude Code reads `AGENTS.md` only when the project has no `CLAUDE.md`. With a `CLAUDE.md` present, it must contain the line `@AGENTS.md`; otherwise Claude Code never sees the file. Keep one source: rules go into `AGENTS.md`, `CLAUDE.md` only imports it (plus anything Claude-specific).

## What must not go in

- Copies of scripts from the manifest, dependency lists, versions — they go stale and are in the source.
- Descriptions of how the code works — that is `docs/architecture.md` and code comments.
- Project history, reasons for decisions — that is ADRs.
- "Be careful", "write good code" — not checkable, does not work.

## Check before writing

Each line answers "yes" to at least one question: would the agent fail to find this with one command? Is this a rule not visible from the code? Is this a pointer to a document the agent would not open otherwise?
