# CLAUDE.md — RTS Engine Project

## Essential reading

Before doing anything in this repo, read the following files in full:

- @DOCS/DECISIONS.md — single source of truth for all architecture and design decisions

Do not suggest alternatives to settled decisions without explicitly flagging the conflict
and explaining why the settled decision should be reconsidered.

---

## Project overview

A browser-based, top-view, strictly 2D real-time strategy (RTS) game engine.
Built as a learning exercise in AI-first development and as a portfolio piece.
Target: a basic but functioning version in 4–8 weeks.

- **Monorepo** — packages/shared, packages/server, packages/client
- **Language** — TypeScript end to end
- **Runtime** — Node.js (server), browser (client)

---

## Repo structure

```
/rts-engine
  /packages
    /shared      # GameState types, Zod schemas, transport interface
    /server      # Node.js game loop, WebSocket handling, auth
    /client      # React app (UI chrome only) + renderer
  /data
    /races       # JSON5 unit/building definitions
  DECISIONS.md
  CLAUDE.md
```

---

## Settled decisions — do not relitigate

These are recorded in full in DECISIONS.md. Short-form reminders:

- **Rendering** — React for UI chrome only; game world rendered via ASCII (MVP) then Canvas/PixiJS. Never render game world in React.
- **ECS** — use an entity-component-system (bitECS or miniplex) for units. No 250 React components.
- **Networking** — WebSocket, server is authoritative, full state broadcast at ~20 Hz. No deltas in v1.
- **Data format** — JSON5 + Zod for all game content definitions.
- **Auth** — JWT in an httpOnly cookie (HS256). One persistent WebSocket per player per session. JWT verified once at upgrade handshake only.

---

## Coding conventions

- **TypeScript strict mode** — no `any`, no unchecked casts
- **Zod for all external data** — never use `as SomeType` on unvalidated input
- **Shared types live in /packages/shared** — never duplicate types across packages
- **No game logic in the renderer** — simulation state is plain data; renderer is a pure function of state
- **All networking behind GameTransport interface** — no direct WebSocket calls in game logic

---

## Current milestone

**M0 — "Hello multiplayer world"**

Goal: prove the full pipe works. No game logic, no grid, no units.

Scope:
- Login form → POST /auth/login → JWT cookie
- WebSocket connection opened immediately after login
- Lobby: see other logged in players
- Graceful disconnection message if WebSocket closes unexpectedly
- Automatic client-side reconnection with exponential backoff

Explicitly out of scope for M0: grid, units, game logic, chat, account creation UI.

---

## Running the project

_(To be filled in once M0 scaffolding is complete.)_

---

## Open questions

See the "Open threads" section in DECISIONS.md for unresolved decisions.
Do not make choices on open threads without flagging them for human review first.