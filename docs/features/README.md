# Feature docs pipeline

Each feature plan lives in exactly one folder. **The folder is the status**, so file names carry no status suffix (no `-done`, `-wip`).

| Folder | Meaning | Enters when | Leaves when |
|---|---|---|---|
| `docs/features/` (root) | Backlog: defined, not started | The plan is written | Work starts → `in-progress/` |
| `in-progress/` | Actively being implemented or verified | The first task starts | All tasks and acceptance criteria are verified → `done/`; work stops → `paused/` |
| `paused/` | Started, intentionally on hold | Work is stopped, with a reason | Work resumes → `in-progress/`; it is dropped → `rejected/` |
| `rejected/` | Decided not to do (kept as a record) | A decision is made not to build it | — |
| `done/` | Implemented and verified | Tasks and acceptance criteria are checked with evidence | — (follow-ups get a new doc) |

## Rules

- Move files with `git mv` so history follows the doc.
- When moving, update the `Estado` / `Status` line at the top of the doc: `paused` and `rejected` must state the reason and date.
- Reference docs by full path (`docs/features/<folder>/<name>.md`). After a move, update every reference: `rg 'docs/features/' --hidden -g '!node_modules'`.
- A doc in `done/` may list pending **manual** checks (for example a UI smoke) in its status line, but no pending implementation tasks.
