# Reader test tasks

Three typical project tasks from git history, picked by the agent. Used by the `docs-check` skill: at stage 6 of the build and on every later check.

Wording — what a developer would understand without the ticket: no file names, hashes or tracker links. Reference — files and areas of code and tests from `git show --stat`, without unrelated changes; commands only those the reader can find in the repository. Documentation, CI scans and deploys are not part of the reference.

Status: `ready` — goes into the next check; `used` — the documents hold its answer (they were fixed for it or mention the solution), replace it; `replaced` — the solution was already in the parent's code, or the task was swapped.

## Tasks

| # | Commit (hash) | Parent | Task (wording for the reader) | Expected files/areas | Expected commands | Area | Status |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | ready |
| 2 | | | | | | | ready |
| 3 | | | | | | | ready |

## Runs

Plans and reader logs are in `docs/agents/scratch/reader-runs/<date>/`.

| Date | Task | Gaps found | Snapshot artifacts | Fixes applied |
|---|---|---|---|---|
| | | | | |
