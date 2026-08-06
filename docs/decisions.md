# DECISIONS.md

Architecture & design decision log for the RTS game engine project.

This document is the **single source of truth** for settled decisions — not chat
history. Each entry records *what* was decided and *why*. Update it as decisions
change or new ones are made. Open questions are tracked at the bottom.

_Last updated: 2026-06-22_

---

## Project goals

- **Primary goal:** a learning exercise in **AI-first development** (built with Claude Code), and a **showcase / portfolio piece** for companies looking for that skillset.
- **Deliverable:** a browser-based, top-view, strictly 2D, real-time strategy (RTS) game.
- **First version target:** 4–8 weeks to a basic but functioning version.
- **Budget:** free / open-source tools only.

---

## Game concept

| Aspect | Decision |
|---|---|
| Genre | Top-view, strictly 2D, real-time strategy (RTS) |
| Grid | Grid-based, field **≤ 256×256 squares** (likely smaller) |
| Players | Strictly multiplayer; a player can also be **simulated (AI)** so one human can play vs. computer |
| Platform | Web browser, screens **≥ 12"** |
| Access | Behind **login + password**, restricted to a few friends |
| Scale target | Must handle **≥ 250 units** simultaneously, each with distinct properties/goals |
| Hardware target | Any device with a medium GPU (tablet built after ~2020, or gaming PC after ~2012) |

---

## Architecture decisions

### 1. Core stack
- **Language:** TypeScript (end to end).
- **Frontend framework:** React — used for **UI chrome only** (menus, HUD, login, panels). **NOT** for rendering the game world (React reconciliation is too slow for 250+ units/frame).
- **Backend:** Node.js + TypeScript (shares types with the client).

### 2. Rendering is a fully decoupled layer
- Simulation state is **plain data** (grid, units, buildings — numbers and IDs/enums, no rendering concerns).
- Rendering is a pure function of state: `render(gameState) → output`. The renderer can be swapped without touching the simulation.
- **MVP renderer:** fixed-width / monospace **text (ASCII) grid** to symbolize terrain, buildings, units.
- **Later renderer:** vector-art style via **Canvas / PixiJS** (WebGL). Assets *designed* as SVG (AI-generated from photos of tanks/planes etc.), but **rasterized / drawn to canvas at runtime** rather than rendered as live SVG DOM nodes (DOM SVG won't scale to hundreds of animated units).
- Benefit beyond deferral: the simulation is independently testable with no canvas/DOM needed.

### 3. Entity representation
- Use an **ECS (entity-component-system)** for units rather than 250 React components or hand-rolled classes — this is the key decision for hitting the 250-unit target.
- Candidate libraries: **bitECS** (tiny, very fast) or **miniplex** (simpler API). _(Final choice open — see open threads.)_

### 4. Networking
- **Transport:** WebSocket (TCP-based) for v1.
- **Strategy:** server is the **single source of truth**; sends **full game state every tick (~20 Hz)**. No deltas, no ack/baseline tracking for v1 — simpler and naturally tolerant of loss/reordering, which also makes it the most UDP-portable pattern if migrated later.
- **Isolation:** all networking sits behind a `GameTransport` interface so a future `WebRTCTransport` (UDP) can replace `WebSocketTransport` with **zero changes to game logic**.
- **AI opponent:** a bot issues commands through the *same* command interface as a real networked player (no special-cased AI code path).

### 5. Data-driven content (engine vs. content separation)
- The project is an **RTS *engine***: everything but core mechanics is defined in editable text files + media. In principle, two completely different RTS games should be buildable without changing engine code.
- **Data format:** **JSON5** (JSON with comments, trailing commas, unquoted keys). Chosen over `.ini` (no nesting/typing/arrays), YAML, and TOML — JSON5 keeps all data about an entity in one block, has the best TS-ecosystem tooling, and solves the comment problem natively (comments stripped at parse, never loaded as data).
- **Validation & types:** **Zod**. One schema = runtime validator + inferred TS type (`z.infer`), so compile-time types and runtime validation can't drift. Replaces the old INI `[Default]` section pattern via Zod `.default(...)`.
  - _Note:_ TypeScript types are erased at runtime, so a runtime validator (Zod) is required — a `as SomeType` cast is not a real check.
- A **Zod schema per definition type** (units, buildings, terrain, races) doubles as validation + documentation, and is what actually delivers "moddable without touching engine code."

### 6. Repository structure — monorepo
- **One repo**, multiple packages via **npm / pnpm workspaces** (not two separate repos).
- Rationale: client and server must share identical types (`GameState`, Zod schemas, `ClientCommand`, snapshot shapes). Two repos would force type duplication (drift) or a published shared package (overhead). Monorepo gives atomic cross-cutting commits and a single coherent thing to showcase.

```
/rts-engine
  /packages
    /shared      # GameState types, Zod schemas, transport interface
    /server      # Node.js game loop, WebSocket handling, auth
    /client      # React app (UI chrome only) + renderer
  /data
    /races       # JSON5 unit/building definitions
  /docs          # context for claude code
  claude.md      # main instructions for claude code
  package.json   # workspace root
```

### 7. Hosting
- **Client → Vercel.** Plain React SPA (likely Vite-built) deployed as **static output** — *not* a Next.js server app, so the "stateless serverless" limitation is irrelevant. Monorepo handled via Vercel's **Root Directory = `packages/client`** setting.
- **Server → existing 1 GB DigitalOcean droplet.** Vercel's stateless serverless model can't hold a persistent WebSocket connection or run an always-on tick loop, so the server needs a persistent-process host. 1 GB RAM is comfortably sufficient at this scale (game state is well under 1 MB per match); **CPU / tick-time is the thing to watch**, not RAM.
- _Deployment mechanics (how to get only the server onto the droplet) postponed — see open threads._

### 8. Authentication & session management
- **Method:** JWT in an httpOnly, Secure, SameSite=Strict cookie
- **Signing:** HS256 with a SECRET_KEY in env (upgrade path to RS256 exists if multi-server ever needed)
- **Expiry:** 24 hours, renewed on every successful WebSocket (re)connection
- **Logout:** server issues Max-Age=0 Set-Cookie; client cannot touch httpOnly cookies from JS
- **Presence:** WebSocket connection is the source of truth for who is online, not token validity
- **Credentials:** hardcoded username/bcrypt-hash list in env for M0

### 9. WebSocket design
- **One persistent connection per player** for the entire session (lobby + game + post-game)
- **Auth happens once** at the HTTP upgrade handshake; messages are not individually authenticated
- **Message identity:** derived from which socket a message arrived on, not from message contents
- **Multiplexed message types:** lobby_state, game_state, game_started, game_ended, error
- **Reconnection:** client-side exponential backoff; server re-validates JWT on each reconnect
- **Broadcast scope:** lobby_state → all connected players; game_state → 2 players in that game only

### 10. Lobby fundamentals
- **Lobby access** players must authenticate, after which the server will open a websocket connection with the player
- **Lobby state** any change to the lobby (i.e. new player logs in, starts a game, etc) will be broadcasted to all players in the lobby
- **lobby actions** players can start a game and invite other players to their game

---

## Milestones (ordered)

Principle: get the system working **end-to-end** as early as possible, then deepen. De-risk architecture (M0–M2) before building game content (M3–M6). Graphics last (M7).

| # | Milestone | Goal |
|---|---|---|
| **M0** | Skeleton: "hello multiplayer world", WebSocket + login, client dumps raw state | Prove the full pipe works before any game logic |
| **M0.5** | minimal GameState, 20 Hz server tick loop | mvp for an active, running game |
| **M1** | Static world, one controllable unit (real grid + terrain, command → move, ASCII renderer) | Prove client→command→server→state→render loop |
| **M2** | Movement & pathfinding; multiple units; **stress-test with synthetic units to validate ECS/perf at ~250** | De-risk the performance-sensitive core early |
| **M3** | Two-player interaction: distinct ownership, basic combat (attack, health, death) | First point it's actually an RTS |
| **M4** | Resource/economy loop: gathering, buildings, unit production | Closes the core gather→build→fight loop |
| **M5** | AI opponent (rule-based bot via the shared command interface) | Enables solo play/testing |
| **M6** | Win/loss conditions, match flow | Turns it into a startable/finishable match |
| **M7** | Polish & graphics: swap ASCII renderer for SVG/Pixi (purely additive given decoupled renderer) | Visual layer |

---

## Open threads (not yet decided)

1. **Entity type representation** — string-literal union types + a `Record<UnitType, UnitStats>` data table is the current lean, but explicitly **deferred for later decision** (vs. enums).
2. **ECS library** — bitECS vs. miniplex.
3. **Pathfinding algorithm** — A* vs. flow-field. (Note: A* itself is cheap on a ≤256×256 grid; the real cost is *number* of path recomputations and local unit avoidance. Mitigations: cache/reuse paths, recompute only when blocked, stagger across ticks, flow-fields for many-units-one-target.) Decide during M2.
4. **Resource / economy design** — what resources exist, how they're gathered, what buildings produce. Needs at least placeholder definition before M3–M4. _(An example INI from a prior attempt defined Soldier/Tank units with stats like MoveSpeed, MaxHealth, FiringRange, CostToProduce, Requires, CanHarvest — to be re-expressed in JSON5 + Zod.)_
5. **Concrete grid size & unit roster** — actual numbers, not just the format.
6. **Deployment mechanics** — how to deploy only `server` (+ `shared`) to the droplet without the frontend: accept it (cost ~nil) / sparse + shallow checkout / **build-artifact deploy (recommended: bundle with tsup/esbuild, rsync dist)** / Docker.