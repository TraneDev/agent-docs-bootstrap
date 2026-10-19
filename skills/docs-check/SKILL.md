---
name: docs-check
description: Reader test for project documentation — a fresh agent plans real past tasks on a history-free code snapshot with the current docs; its plan is compared with what the real commit changed, and every gap becomes a concrete doc fix. Use when the user asks to check or test a project's docs or AGENTS.md, or after notable changes. Stage 6 of docs-bootstrap runs it too.
---

# docs-check

Checks whether an agent can work from the project's documentation, and turns what it misses into fixes. The reference is what the real commit changed, not your opinion: you organise the test and compare against the reference, you do not judge whether the documentation is good and do not defend it.

No `docs/agents/` → the project was not built with `docs-bootstrap`. Create `docs/agents/reader-tests.md` from the `docs-bootstrap` template (`templates/reader-tests.md`) and `docs/agents/scratch/` (add `docs/agents/scratch/` to `.gitignore`): hand-written documentation can be checked too.

## Step 1. Tasks

Three tasks in `reader-tests.md` → step 2.

None → start the `docs-scout` subagent with the brief "Reader test task candidates" from `docs-bootstrap/references/scout-briefs.md`. Then ask the human once who picks the tasks, with this warning:

> I can pick three tasks myself, or you can choose them from the candidates — about 10 minutes. Your choice makes the check more accurate: you know which tasks are typical for the project, can word them like a real ticket, and can drop commits the team would not repeat today (later reverted, or mixed with unrelated changes). Without that, some gaps may be false: the reader gets compared with a commit that is a poor example, not with good practice.

- **User** → show the candidates grouped by area; they pick three from different areas and may reword them.
- **Agent** → pick three from different areas yourself, preferring candidates with a clear commit message, a test in the diff and no unrelated files in `--stat`. Show the human the three tasks before running; they may swap any of them.

Record in `reader-tests.md`: who chose the tasks, commit hash, parent commit, task wording, expected files and commands from `--stat` and CI.

The task wording for the reader must not contain file names or hashes: only what a developer would see in a ticket.

## Step 2. Snapshot

The reader must not see the solution or the history: the code as it was before the task, with today's documents on top. For each task:

```
rm -rf docs/agents/scratch/rt-<N> && mkdir -p docs/agents/scratch/rt-<N>
git archive <parent> | tar -x -C docs/agents/scratch/rt-<N>
git archive HEAD AGENTS.md CLAUDE.md CONTEXT.md CONTEXT-MAP.md docs/ '**/AGENTS.md' '**/CONTEXT.md' 2>/dev/null | tar -x -C docs/agents/scratch/rt-<N>
rm -rf docs/agents/scratch/rt-<N>/docs/agents
```

`git archive` skips paths missing from HEAD; `docs/agents/` is removed so the reader does not see previous runs. The snapshot has no `.git` and no installed dependencies: the reader builds a plan, it does not execute it.

## Step 3. Reader

For each task a **new** `docs-reader` subagent (fresh context, knows nothing of the previous ones). Brief:

> Project directory: `<absolute path to rt-N>`. Work only inside it.
> Task: `<wording from reader-tests.md>`
> Make a plan: files, changes, verification commands. Do not edit anything. Separately list everything you had to search the code for or guess, and your questions to the team.

Not a word about this being a test, about the documentation being new, or about having to cite it. Save the reader's answer to `docs/agents/scratch/rt-<N>/plan-<date>.md`.

The harness cannot start the `docs-reader` subagent → do not play the reader yourself: you have seen the docs and the history. Ask the human to start a new agent session with its working directory set to the snapshot, paste the brief above, and save the answer to the plan file.

## Step 4. Gaps

Compare each plan with the reference in `reader-tests.md`. Each of these is a gap, written down as is, without interpretation:

- an expected file or area is not named in the plan;
- an expected verification command is not named;
- a term listed under `_Avoid_` in the glossary is used (if `CONTEXT.md` exists);
- a directory outside the expected areas is proposed for change;
- a solution rejected in an ADR is proposed (if `docs/adr/` exists);
- an item under "had to search" whose answer is or should be in the documents.

"Had to search" items that only a human can answer (product clarifications) are not gaps but are kept: they are candidates for how-tos and `AGENTS.md`.

## Step 5. Fixes

Each gap → a concrete fix: a line in `AGENTS.md`, a how-to, a glossary term. Show the list to the human. If the agent chose the tasks, say that some gaps may come from the commit itself rather than the docs, and let the human strike those out. After "ok", apply the fixes and rerun the same task (steps 2–4). Repeat until the plan has no gaps or the human stops.

Add a row to the runs table in `reader-tests.md`: date, task, gaps found, fixes applied.

Report to the human: per task, the gaps found and the fixes applied, plus the "only a human knows" items as documentation candidates.

## Never

- Ask any agent to judge the plans or the documentation instead of comparing with the reference: an LLM judge prefers the longer, more confident plan.
- Show the reader a repository with `.git` or mention the history.
