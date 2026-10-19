# <project>

<Two sentences: what it is and for whom.> Architecture: `docs/architecture.md` (plan as of <date>).

## Commands

<!-- only those verified by running; non-standard flags and env go here -->
- Install: `…`
- Run: `…`
- Tests: `…`
- Lint/typecheck: `…`

## Where things are

<!-- planned structure; update at the first review -->
- `…/` — …

## Terms

Glossary — `CONTEXT.md`. Use its terms; do not use the synonyms listed under _Avoid_.

## Decisions

Decisions — `docs/adr/`. Before proposing an architectural change, check it was not rejected. A new decision made in conversation becomes a new ADR right away.

## How to do common tasks

Will appear after the first features (first review, new project track step N4).

## Keeping docs current

Docs change in the same change as the code, otherwise they fall behind it:
- a new domain term or a rename → `CONTEXT.md`;
- an install, run, test or lint command changed → the "Commands" section of this file;
- a top-level directory appeared or the structure diverged from the plan → "Where things are";
- a service, deployment unit or external system appeared or disappeared → `docs/architecture.md`.

At the end of a task, list the documents you updated, or say none were needed. Do not invent the reason for a decision: if a human did not give it, ask instead of writing it down.

## Rules

<!-- only from a human, with a reason -->
- …
