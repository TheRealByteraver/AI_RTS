# CLAUDE.md — RTS Engine Project

## Generated outputs — do not use as source of truth

Do NOT use `readme.md` as a source of truth. It is a generated artifact 
that describes the code. It may be outdated. Never make decisions based on it.

## Essential reading

### Before changing or adding code

Before doing anything in this repo, read the following files in full:

- @docs/decisions.md — single source of truth for all architecture and design decisions
- @docs/conventions.md - coding conventions to follow

Do not suggest alternatives to settled decisions without explicitly flagging the conflict
and explaining why the settled decision should be reconsidered.

### After every task

After completing any task, perform all actions described in this section.

#### Update the readme.md file
1. Re-read all the files you created or modified
2. Update `readme.md` to accurately reflect the current state of the code
   - Add or update the section for any system you changed
   - Remove descriptions of anything you deleted
   - Base your description on the actual code, not on what was in readme.md before

Use the following structure for the `readme.md` file:
- Main title: `RTS Project`
- A paragraph of 120 to 400 words describing the project
- sections describing each system

Write sections for every system in the list below:
- authentication flow (http and websocket)

Use the structure below for every section describing a system:
  - A title with the name of the system
  - What it does (one paragraph)
  - Its boundaries (what it is not responsible for)
  - Key design decisions and why
  - If appropriate, logic flow in steps

## Pull request descriptions

- When opening a pull request, always write a complete description in the
PR body itself — not just in issue comments. Include: what changed and why,
how you tested it, and any risks or follow-ups. Assume the reviewer will
only read the PR, not the originating issue thread.
- Link the PR to the corresponding issue on github

## Project overview

A browser-based, top-view, strictly 2D real-time strategy (RTS) game engine.
Built as a learning exercise in AI-first development and as a portfolio piece.
Target: a basic but functioning version in 4–8 weeks.

- **Monorepo** — packages/shared, packages/server, packages/client
- **Language** — TypeScript end to end
- **Runtime** — Node.js (server), browser (client)
