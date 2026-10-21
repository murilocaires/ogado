---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "code-review" to review the work.

Follow `docs/BRANCHING.md`. Before editing, verify that the current branch is a temporary branch based on `develop` (or `main` for an explicitly requested production hotfix). Preserve existing changes; use a separate worktree when needed. Commit only the task's changes when authorized. Open work PRs against `develop`; never merge without explicit human approval.
