# Reader test tasks

Tasks for the `docs-check` skill, an optional check the team runs when it wants to. History tasks are three typical project tasks from git history, picked by the agent; own tasks are given by a human.

Wording — what a developer would understand without the ticket: no file names, hashes or tracker links. Reference — files and areas of code and tests from `git show --stat`, without unrelated changes; commands only those the reader can find in the repository. Documentation, CI scans and deploys are not part of the reference.

Status: `ready` — goes into the next check; `used` — the documents hold its answer (they were fixed for it or mention the solution), replace it; `replaced` — the solution was already in the parent's code, or the task was swapped.

## History tasks

| # | Commit (hash) | Parent | Task (wording for the reader) | Expected files/areas | Expected commands | Area | Status |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | ready |
| 2 | | | | | | | ready |
| 3 | | | | | | | ready |

## Own tasks

| Date | Commit the snapshot ran on | Task (wording for the reader) | Given by |
|---|---|---|---|
| | | | |

## Runs

Plans and reader logs are in `docs/agents/scratch/reader-runs/<date>/`. For an own task, the gaps are what the human said the documents should have answered; snapshot artifacts do not apply.

| Date | Task | Gaps found | Snapshot artifacts | Fixes applied |
|---|---|---|---|---|
| | | | | |
