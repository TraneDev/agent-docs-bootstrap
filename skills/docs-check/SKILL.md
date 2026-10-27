---
name: docs-check
description: Optional reader test for project documentation — a fresh agent, started as a separate process, plans a task on a history-free code snapshot with the current docs. Two modes - history (real past tasks, the plan is compared with what the real commit changed, gaps become one list of doc fixes) and own task (the human gives a task and reads the plan). Use only when the user asks to check, test or measure a project's docs or AGENTS.md; docs-bootstrap does not run it.
---

# docs-check

Checks whether an agent can work from the project's documentation. It is optional: run it only when the human asks. It costs a reader process per task and several minutes each, and it diagnoses where a fresh agent stumbles rather than proving the documentation good.

Two modes. Ask once which one, unless the human already said or gave a task with the command:

- **History** — three real past tasks; the reader's plans are compared with what the real commits changed, and the gaps become one list of doc fixes. Steps 1–5 below.
- **Own task** — the human gives a task, for example a current ticket; the reader plans it from the documents, and the human reads the plan. See [Own task](#own-task).

You organise the test; you do not judge whether the documentation is good and do not defend it. In the history mode the reference is what the real commit changed, not your opinion.

No `docs/agents/reader-tests.md` → create it from this skill's template (`templates/reader-tests.md`). No `docs/agents/scratch/` line in the project's `.gitignore` → add it. Hand-written documentation can be checked too, not only documentation built with `docs-bootstrap`.

## Step 1. Tasks

Three tasks with status `ready` in `reader-tests.md` → leak check below, then step 2. A task marked `used` was the source of earlier fixes: the documents now hold its answer, so it tests nothing. Replace it.

Missing tasks → start the `docs-scout` subagent with the brief "Reader test task candidates" from `docs-bootstrap/references/scout-briefs.md`. Pick three from different areas yourself, preferring candidates with a clear commit message, a test in the diff and no unrelated files in `--stat`. Prefer commits made after the documents were written (the dates in `docs/agents/bootstrap-state.md`, or the documents' first commits): the documents could not know their solutions. Fewer than three such commits → say so in the report: older tasks may share material with the documents. Do not stop to ask the human: they see the tasks with the results in step 5 and can strike out what came from a poor commit.

Record in `reader-tests.md`: commit hash, parent commit, task wording, reference, status `ready`.

**Wording.** What a developer would understand without the ticket: what to do and where the user sees it. No file names, hashes, ticket numbers or tracker links. The reader gets it word for word.

**Reference.** Files and areas of code and tests from `git show --stat <hash>`, without unrelated changes in the commit. Verification commands only if the reader can find them in the repository (package scripts, CI jobs that run locally). No documentation files, CI scans or deploys: the reader cannot name them.

**Leak check.** Before every run, take from `git show <hash>` the names the solution introduced: new files, classes, functions, endpoints, keys. Search for them:

- in the parent's code (`git grep <name> <parent>`) → found: the solution is already in the snapshot. Mark the task `replaced` and pick another;
- in the current documents (`AGENTS.md`, `CLAUDE.md`, `CONTEXT*.md`, `docs/`) → found: the documents already know the answer and the task tests nothing. Mark it `used` and pick another.

## Steps 2–3. Snapshot and reader

The reader must not see the solution, the history, your session's instructions or the project's own repository. So it runs as a **separate process** of your harness, in a snapshot **outside the repository**, never as a subagent of this session: a subagent shares the session's working directory, where the solution sits in the current code. The kit's script builds the snapshot and starts the reader the same way in bash, PowerShell and cmd.

1. Write the run's tasks to `docs/agents/scratch/reader-runs/<date>/tasks.json`:

   ```json
   { "tasks": [ { "n": 1, "parent": "<parent>", "task": "<wording from reader-tests.md>" } ] }
   ```

2. Run the script once per task from the project root, with `--harness` set to the harness you are running in (`claude`, `codex` or `opencode`). The three runs are independent: start them in parallel if your harness can, one at a time only if the model provider rate-limits parallel requests. A reader takes several minutes: if your shell tool has a timeout, set it to 15 minutes.

   ```
   node <skills>/docs-check/scripts/reader-run.mjs docs/agents/scratch/reader-runs/<date> <N> --harness <harness>
   ```

   `<skills>` is where this skill is installed: `.claude/skills` or `.agents/skills`. Write the command exactly like this, with forward slashes and without `cd`, `&&`, pipes or redirects, so it works in any shell. For a global install, add `--reader <path to the installed docs-reader>`.

What the script does:

- the snapshot is the parent's code without the documents and the kit's installed files, with the current documents from the working tree on top, committed or not (git-ignored and deleted ones are skipped, `docs/agents/` never goes in). Do not keep unfinished hand edits in the documents during a run: the reader gets them as they are;
- the snapshot gets an empty `git init`, which stops the harness from loading `AGENTS.md` or `CLAUDE.md` from parent directories. No installed dependencies: the reader builds a plan, it does not execute it;
- the reader: Claude Code `claude -p --restricted` with only `Read`, `Grep`, `Glob` and no MCP servers; Codex `codex exec -s read-only` with every MCP server, plugin and app turned off; OpenCode `opencode run --pure` with the `docs-reader` agent, whose permissions deny everything but reading, MCP tools included. The prompt is the installed `docs-reader`, the task goes through stdin;
- it writes `rt-<N>-plan.md` and `rt-<N>-log.md` to the run directory and prints a three-line summary.

Non-zero exit or "plan EMPTY" → show the human the summary and `rt-<N>-log.md`; do not guess. A plan that cites files outside the snapshot, the history, a tracker or external docs is invalid: note why in `reader-tests.md` and rerun.

The user's global instructions (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`) cannot be switched off this way. If they are about this project, ask the human to move them aside for the test.

No `node`, or the harness CLI is not in PATH → do not play the reader yourself: you have seen the docs and the history. Run the script with `--snapshot-only` (it prints the snapshot path) and ask the human to start a new agent session with its working directory set to that path, paste the `docs-reader` prompt and the task, and save the answer to `rt-<N>-plan.md`.

## Step 4. Gaps

Compare each plan with the reference in `reader-tests.md`. Each of these is a gap, written down as is, without interpretation:

- an expected file or area is not named in the plan (a named directory of the area counts);
- an expected verification command is not named;
- a term listed under `_Avoid_` in the glossary is used (if `CONTEXT.md` exists);
- a directory outside the expected areas is proposed for change;
- a solution rejected in an ADR is proposed (if `docs/adr/` exists);
- an item under "had to search" whose answer is or should be in the documents.

Not gaps, but kept:

- "had to search" items only a human can answer (product clarifications) — candidates for how-tos and `AGENTS.md`;
- **snapshot artifacts** — the documents describe a newer layout than the parent's code (a moved directory, a new test runner). Many of them mean the task is too old: replace it next time.

An item where the reader says it found the answer in the documents is not a "had to search" item.

## Step 5. Fixes

**One list, no rerun loop.**

1. Group the gaps by the document that should hold the answer (`AGENTS.md`, glossary, a how-to, an ADR). For each fix, the gap it closes and the task it came from. Write a fix as general project knowledge ("new pages are registered in …"), not as this task's solution. A fix never contains passwords, tokens or keys: only where to get them. Product questions go to a separate block as open questions, not fixes.
2. Show the list with the three tasks and their commits. Say that some gaps may come from the commit rather than the docs (a commit the team would not repeat today, unrelated changes), and let the human strike those out. This is the only stop in the check.
3. Apply the approved fixes. Mark each task the documents were fixed for as `used`: they now hold its answer.
4. Do not rerun the same task to "confirm" the fix: it will pass because the answer is now in the documents, which proves nothing. The next check on new tasks shows whether the docs got better.

Add a row to the runs table in `reader-tests.md`: date, task, gaps found, snapshot artifacts, fixes applied.

Report to the human: per task, the gaps and the applied fixes, the open questions, and when to check again — after a few weeks of team work or notable changes, on new tasks.

## Own task

The human gives a task in their own words, for example a ticket they are about to start. There is no reference commit, so there is no leak check, no gap list and no task status: the human reads the plan and decides what the documents lack.

1. Take the wording as the human gave it. Remove file names, hashes and tracker links only with their consent: they hand the reader the answer. Record the task in the "Own tasks" table of `reader-tests.md` with the commit it runs on.
2. The snapshot is the current commit: write `tasks.json` as in steps 2–3 with `"parent"` set to the hash from `git rev-parse HEAD`, and run the script the same way. The code comes from that commit and the documents from the working tree, so uncommitted code changes are not in the snapshot: tell the human if `git status` shows any.
3. Show the plan as it is, then two lists from it: what the reader had to search the code for or guess, and its questions to the team. Do not grade the plan or argue with it.
4. The human says what the documents should have answered. Group those items by document as in step 5 and apply what they approve; secrets are never written, only where to get them. Add a row to the runs table.

Do not reuse an own task for the history mode later: its plan has already shaped the documents.

## Never

- Ask any agent to judge the plans or the documentation instead of comparing with the reference: an LLM judge prefers the longer, more confident plan.
- Start the reader as a subagent of this session, from inside the repository, or with your own commands instead of `reader-run.mjs`.
- Show the reader the project's git history or a tracker link, or mention the history. The empty repository that `reader-run.mjs` creates in the snapshot holds no history.
- Rerun a task after fixing the documents for it.
