---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Follow `docs/BRANCHING.md`. Create a temporary `feature/<spec>` integration branch from `develop`. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR against `develop` after the first authorized commit, marked as closing the spec and tickets. Never use `main` or `develop` as a ticket worktree.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting; if not, preserves the existing work and creates a fresh worktree instead of resetting;
   - calls the Skill tool with `tdd` to build the ticket;
   - reports any required synchronization and requests explicit human approval before merging

5. Once an **implementer subagent** completes, review its changes and validation. Merge to the temporary integration branch only with explicit human approval. Without approval, leave the branch available for review and continue independent work.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. Fix all issues raised by the code review in a single **implementer subagent**.

8. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up only fully integrated, clean **implementer subagent** worktrees after the approved merge. Preserve uncommitted or unmerged work and never delete `main` or `develop`.
