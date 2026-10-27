# Signal categories

The scout does not know in advance where things live in a given stack. It determines the stack (stage 1) and then looks for the equivalents of six categories in it. Category not found → open question, not a guess.

| # | Category | What to look for | Typical sources (find the equivalent in the stack) |
|---|---|---|---|
| 1 | Commands | build, tests, lint, typecheck, run | package manifest, CI, Makefile, README, scripts in `scripts/` |
| 2 | Structure | how the code is split into parts and why this way | workspace and monorepo configs, modules, solutions, `apps/`, `libs/`, `packages/`, feature folders |
| 3 | Boundaries | what may not import or call what | linter import rules, module boundaries, dependency rules, contracts between modules |
| 4 | Test setup | runners, e2e, environments, test data | test framework configs, CI test jobs, `.env.example`, fixtures |
| 5 | Domain terms | entities, statuses, roles, operations | data types and models, DB and ORM schemas, UI string keys, API contracts (OpenAPI, GraphQL, protobuf), event and queue names, route and feature names |
| 6 | Decision traces | what was chosen unusually and where limits are set | lock-in dependencies (state, UI kit, ORM, broker, auth), configs with limits (budgets, CSP, browserslist), comments with `because`/`workaround`/`HACK`, `git log --grep` for `instead|dropped|migrate|revert`, CI with canaries and required reviewers |

## What is not a signal

- Framework concepts (component, service, store, guard, DTO as a pattern) are not domain terms.
- A code folder is not a container unless it deploys on its own.
- A dependency is not an ADR until it passes the three criteria in [ADR-FORMAT.md](../vendor/domain-modeling/ADR-FORMAT.md).

## Name conflict detector

One entity can be named differently in frontend and backend, in DTOs and UI text, in UI strings and code. The scout compares four vocabularies: data types, DB or API schema, UI string keys, route names. Each mismatch is a line under "Name conflicts".

## Stack hints

A `stack-hints/<stack>.md` file next to this one, if present, speeds up the search for a known stack. Its absence blocks nothing: the categories above are self-sufficient. Hints are added after a first run on a project with that stack.
