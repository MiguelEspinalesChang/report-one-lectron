# AI Agents & Skills Registry

Project-scoped tooling for AI-assisted development. Architecture source of truth: `docs/ARCHITECTURE.md`. Operating guide: `CLAUDE.md`.

## Agents (`.claude/agents/`)

| Agent | Purpose | When to use |
|---|---|---|
| `arch-guard` | Adversarial review of diffs against the architecture rules (§11). Read-only. | Before every commit/PR that touches more than one file or any process boundary |
| `modbus-sidecar` | Python data-core implementation (acquisition, scheduler, storage, imports, reports, RPC). | Any work inside `apps/python-service` |

## Skills (`.claude/skills/`)

| Skill | Trigger | What it does |
|---|---|---|
| `add-rpc-method` | new RPC method, sidecar command, push event, IPC channel | Wires a command/event across shared-types → core → electron → python, with tests |
| `add-island` | new island, new view, new screen | Creates a UI-only Vue island wired to `window.platform`, with lifecycle rules |
| `verify-stack` | verify app, run app, smoke test | Build + tests + lint + live smoke run of the three processes |

## Conventions for new skills/agents

- Skills: one directory per skill with `SKILL.md`; frontmatter requires `name`, one-line `description` starting with `Trigger:`, `license`, `metadata.author`, `metadata.version`. Imperative instructions, 180–450 tokens target.
- Agents: markdown with `name`, `description`, `tools` frontmatter; system prompt states domain rules that override generic practice.
- Register every addition in this file.
