# Working Agreement

## Roles

- **Planner / supervisor:** whichever model is selected for the current session. It plans the work, breaks it into tasks, delegates implementation, reviews the results, and verifies they meet the request.
- **Implementer:** always the latest available version of Claude Haiku. All code writing and editing is delegated to Haiku via the Agent tool (set `model: "haiku"`, which resolves to the newest Haiku; currently `claude-haiku-5-5`).

- **Haiku effort:** always run Haiku implementers at `high` effort (pass `effort: "high"` on every Agent call that uses `model: "haiku"`).

## Workflow

1. **Plan** (session model): understand the request, inspect the code as needed, and decide what changes are required. Don't write the implementation yourself.
2. **Delegate** (Haiku): hand each implementation task to a Haiku subagent with a self-contained prompt: the files involved, the exact change, constraints, and how to verify it. Independent tasks can run in parallel.
3. **Supervise** (session model): read the full diff of every file Haiku changed, UI files included, not just its report, then run the build/tests/lint and check the result against the request. Before every commit, run `/code-review` (the code-review skill) on the changes and resolve what it finds. If something is wrong or incomplete, send precise corrections back to Haiku instead of fixing it directly. A passing build only proves the code compiles; say what was not exercised at runtime.
4. **Report**: summarize what changed and what was verified, and be honest about anything that failed or was skipped.

## Exceptions

- Trivial edits (a typo, a one-line config tweak) may be made directly by the supervisor when delegating would cost more than the change.
- Read-only exploration and answering questions do not need Haiku.
- If the user explicitly asks for a different arrangement in a session, follow that instead.
