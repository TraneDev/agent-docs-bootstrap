---
name: docs-bootstrap
description: Build reference documentation for a codebase so coding agents and new developers can work in it — glossary (CONTEXT.md), ADRs, C4 architecture, how-to guides, AGENTS.md — through staged interviews with the team, then checks them with a reader test. Use when the user wants to document a project, write or rebuild AGENTS.md from scratch, or onboard agents to an existing or brand-new repository.
---

# docs-bootstrap

You guide a developer through building the project's reference documentation in stages. Every stage ends with a stop: show the result, wait for an explicit "ok", update `docs/agents/bootstrap-state.md`. Exploration goes to the `docs-scout` subagent, the reader test to the `docs-reader` subagent; you talk to the human and write down what they confirm.

## Invariants

They hold at every stage.

- **Code says "what", people say "why".** A decision's reason, a canonical term, a context boundary come only from a human. No answer → open question in the state file, never a guess in a document.
- **External docs are dated hypotheses.** A fact from a wiki page is accepted without a human only if the code agrees. A mismatch becomes a question for the interview. Every transferred fact keeps its source and date.
- **Only confirmed content reaches the repository.** Scout drafts live in `docs/agents/scratch/` (git-ignored), not in documents.
- **Existing files are extended, not overwritten.** Found `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, ADRs → add to them and record contradictions under "Discrepancies" in the state file.
- **Questions to the user wait for stage 2.** At stages 1 and 1.5 do not interrupt the human except to confirm the stack and fill in `sources.md`. At stage 2 the backlog joins the interview and is asked by its rules, in rounds (see "Combining with grilling").
- **Keep your own context for the conversation.** Do not read external docs or scan the whole repository yourself: delegate to `docs-scout` and read its results from `docs/agents/scratch/` in parts.
- **Do not judge documentation quality yourself.** The reader test finds gaps by comparing a fresh agent's plan with the real commit.
- **Formats are not duplicated.** Glossary and ADRs follow the `domain-modeling` skill (its `CONTEXT-FORMAT.md`, `ADR-FORMAT.md`). Diagrams — [references/c4-format.md](references/c4-format.md). `AGENTS.md` — [references/agents-md-format.md](references/agents-md-format.md). Reader test — the `docs-check` skill.
- **Language.** Documents are written in the language recorded in the state file; identifiers and code terms stay as they are, and a glossary term carries its code name: "**Order request** (`Request`)". Templates in this skill are in English: translate headings and text when the documents language differs, keep file names.

## Subagents

Start a subagent with your harness's tool for it (a subagent, agent or task tool). Each call gets a **fresh** subagent: it knows only the brief you give it. Copy the needed brief from [references/scout-briefs.md](references/scout-briefs.md) into the call in full.

If the user's model provider rate-limits parallel requests, run subagents one at a time: one call, wait for the result, then the next. Otherwise independent batches may run in parallel.

If the harness cannot start the `docs-scout` subagent, do the brief yourself but write the result to the scratch file and keep only a summary in the conversation. The reader test cannot run without a separate agent — see `docs-check`.

## Stage 0. Session start

1. Read `docs/agents/bootstrap-state.md`. No file → ask the questions below, create `docs/agents/` and copy the templates from [templates/](templates/) into it: `bootstrap-state.md`, `sources.md`, `reader-tests.md`. Create `docs/agents/scratch/` and add the line `docs/agents/scratch/` to the project's `.gitignore`. Record the mode, the documents language and the kit version (first line of `.agent-docs-kit` in the project root, if present) in the state file.
2. Find the first stage not marked `done` and continue from it. Do not start over if work has already begun.
3. Tell the human which stage you are at and what you need from them now.

**Questions on first start**, one message:
- "Is this an existing project (there is code to describe) or a new one (no code yet, or just started)?" *Existing* → stages 1–6 below. *New* → [New project track](#new-project-track) at the end.
- "Which language should the documents be in?" Suggest the language the user writes in.

## Stage 1. Inventory and stack

**Scout.** Brief "Stage 1" in [references/scout-briefs.md](references/scout-briefs.md).

**You.** Show the detected stack in one sentence: "I see Django 5 with Celery, a React frontend, Playwright for e2e. Correct?" Wait for confirmation or a correction. Then fill in `docs/agents/sources.md` together: external documentation (wiki, Confluence, Notion, Google Docs), root pages, exclusions. No external docs → write "none" and stage 1.5 is skipped.

**Done when:** the stack is confirmed and recorded in the state file; every command from the scout report either ran successfully or is marked unverified; `sources.md` is filled in; the list of documents found in the repository is recorded.

## Stage 1.5. External documentation audit

Skipped when `sources.md` lists no external sources, or the agent has no tools to read them (record which in the state file).

**Scout, in a loop.** The "Stage 1.5" brief works in batches so that no context overflows:
1. Batch 0: a new `docs-scout` builds an index of all pages without reading bodies → `docs/agents/scratch/external-index.md`. One line comes back with the page count.
2. Read the index and split it into batches of 5–10 pages. More than 100 pages → ask the human which subtrees matter and skip the rest with a note in the state file.
3. For each batch start a **new** `docs-scout` with the batch number and the list of page ids. Result: file `external-audit-N.md`, one line in the conversation.
4. Do not read the batch files into your context whole: build the summary with `grep` on the type column, or ask the last scout to merge them into `external-audit-summary.md`.

**You.** Build a "present / outdated / missing" table across the four Diátaxis types. Show it to the human. This maps the work: what to transfer, what to verify, what to write from scratch.

**Done when:** every indexed page is classified or explicitly skipped; the summary is written to `docs/agents/external-audit.md` (committed; `scratch/` is not); the human agrees with what counts as outdated.

## Stage 2. Domain: CONTEXT.md and ADRs

**Scout.** Brief "Stage 2": draft terms from code with evidence and synonyms; name conflicts; ADR candidates from traces of decisions with reasons marked `ASSUMPTION`; comparison with facts from external docs (matches / differs / not in code).

**You.**
1. Load the `grilling` and `domain-modeling` skills.
2. First decide single- or multi-context — the rule is in `CONTEXT-FORMAT.md`.
3. Interview along the tree: term conflicts → definitions → each ADR candidate (reason, rejected alternatives, still valid?) → open questions accumulated at stages 1–1.5.
4. Write as you go: `CONTEXT.md` (or `CONTEXT-MAP.md` + one `CONTEXT.md` per context), `docs/adr/NNNN-slug.md`. No ADR without a confirmed reason.

**Combining with grilling.** The `grilling` rules win: it works in rounds, as many as needed. A round is one message with numbered questions and a recommended answer for each. A round takes the whole current frontier but no more than 7 questions: if more are open, those others depend on go first (context structure → key terms → ADRs), the rest wait for the next round. Do not deliberate with yourself about how to split the frontier — split it and ask. This is the only mandatory stop of the stage; after the answer, go straight to the next round or to writing.

**Done when:** each term has a code name and an evidence file; each ADR candidate is either written with a reason from a human or listed as an open question with an addressee; `CONTEXT.md` has no implementation details; the interview frontier is empty.

## Stage 3. Architecture: C4 Context and Container

Two levels only. Component and Code are not done: they are expensive and go stale faster than they are read.

**Scout.** Brief "Stage 3": external systems and users (Context); deployment units and their links (Container) from Dockerfiles, CI, deployment configs, environment variables; the technology of each container.

**You.** Build the two diagrams per `c4-format.md` and show them to the human. Check: each container is a real deployment unit, not a folder in the code.

**Done when:** diagram containers match the Dockerfiles, CI and deployment configs; external systems are confirmed by the human; written to `docs/architecture.md`.

## Stage 4. How-to guides

A how-to is a step-by-step procedure for a recurring task: "add a migration", "add a feature flag", "run e2e against staging".

**Scout.** Brief "Stage 4": recurring tasks from `git log` hot spots over 6–12 months; which are already described in external docs (from the 1.5 audit); for those, whether the steps match the current code.

**You.** Show the list; the human picks the 3–7 most frequent. For each:
- an up-to-date external page exists → transfer it to `docs/how-to/<slug>.md`, checking every step against the code;
- an outdated one exists → load `doc-coauthoring` and rewrite it with the human (stages Context Gathering and Refinement; its Reader Testing is replaced by `docs-check`);
- none → do not write it from memory. Defer it to stage 6: where the reader has to guess is where a how-to is missing.

**Done when:** every step of every how-to points to an existing file or a command verified at stage 1; the deferred how-tos are listed in the state file.

## Stage 5. AGENTS.md

**You.** Load `writing-for-agents`. Format — `agents-md-format.md`. Order:
1. Root `AGENTS.md`: up to 150 lines, only what is needed on every turn. Commands from stage 1, directory map from stage 3, pointers to `CONTEXT.md`, `docs/adr/`, `docs/how-to/`, `docs/architecture.md`.
2. Nested `AGENTS.md` in large areas (an app in a monorepo, a big module): only rules specific to that area.
3. Behaviour rules only from the human ("don't run e2e locally", "don't touch generated code").
4. Claude Code reads `AGENTS.md` only when the project has no `CLAUDE.md`. If a `CLAUDE.md` exists, propose adding the line `@AGENTS.md` to it; if the team uses Claude Code and there is none, propose a `CLAUDE.md` containing only that line. Do it after the human's "ok".

Do not cache in `AGENTS.md` what an agent finds in the package manifest with one command.

**Done when:** the root file is within 150 lines; every pointer leads to an existing file; every rule is confirmed by the human; nested files do not repeat the root one; Claude Code will see `AGENTS.md` (or the human declined).

## Stage 6. Reader test

Load the `docs-check` skill and run it. It takes tasks from `reader-tests.md` (or proposes candidates from git if there are none), builds snapshots, starts `docs-reader` and compares its plans with the real commits.

Each gap → a fix in the documents (stages 4–5) → a rerun of the same task.

**Done when:** all three tasks have no gaps left, or the human accepted the remaining ones; the runs are recorded in `reader-tests.md`.

## Wrap-up

Final report to the human: what was written (terms, ADRs, diagrams, how-tos, `AGENTS.md`), open questions with addressees, code/document mismatches as rename candidates, gaps the reader test found and how they were fixed. Say that the check can be repeated with the `docs-check` skill after notable changes to the project.

## New project track

There is no code, or very little, so there is nothing to reverse-engineer: all the knowledge is in the team, and it has to be written down before it settles in people's heads. Stages 1 and 1.5 are not run. The scout is needed only at N3.

### N1. Interview the idea

Load `grilling` and `domain-modeling`. Tree: what the system does and for whom → the main entities and their names → boundaries (single- or multi-context per `CONTEXT-FORMAT.md`) → decisions already made before the start (stack, state, storage, integrations) with reasons and rejected alternatives. Rounds as in stage 2.

**Write:** `CONTEXT.md` (or `CONTEXT-MAP.md`), `docs/adr/0001-…` onwards — only with a reason from a human. Also `docs/agents/sources.md` if the project already has external pages (spec, design).

**Done when:** the frontier is empty; each term has a code name (planned is fine); each up-front decision has an ADR.

### N2. Architecture

From the design, not the code: C4 Context and Container per `c4-format.md`. A container here is what is *planned* to deploy separately; label the diagram "plan, <date>". Revisit at N4.

**Done when:** external systems and containers are confirmed by the human; written to `docs/architecture.md`.

### N3. Starter AGENTS.md

Load `writing-for-agents`. Use [templates/AGENTS.starter.md](templates/AGENTS.starter.md): commands already in the manifest (the scout verifies them by running, brief "Stage 1", sections 1–2), the planned directory map, rules from the human, pointers to `CONTEXT.md`, `docs/adr/`, `docs/architecture.md`. The how-to section stays empty with the note "will appear after the first features". Handle `CLAUDE.md` as in stage 5, step 4.

**Done when:** the file is within 80 lines; every command is verified; every rule is confirmed.

### N4. First review

Runs at the human's request after 2–3 implemented features or a month, whichever comes first. Order: stage 4 (how-tos from tasks that have already repeated) → stage 5 (update `AGENTS.md`, add nested ones) → stage 6 (`docs-check`) → review `architecture.md`: the "plan" becomes fact from the Dockerfiles and CI. From then on the project lives as an existing one: a decision made in conversation → an ADR right away, `docs-check` after notable changes.
