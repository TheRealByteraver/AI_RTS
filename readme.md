# RTS Project

A browser-based, top-view, strictly 2D real-time strategy (RTS) game engine built as a learning exercise in AI-first development and as a portfolio piece. The project is structured as a TypeScript monorepo with three packages: `packages/shared` (types, Zod schemas, transport interface), `packages/server` (Node.js game loop, WebSocket handling, auth), and `packages/client` (React UI chrome + renderer). The game targets screens of 12 inches or larger and is restricted to a small set of invited players behind login and password. The server is the single source of truth; it broadcasts full game state at roughly 20 Hz rather than sending deltas. Rendering is a pure function of simulation state, so the ASCII MVP renderer and the future Canvas/PixiJS renderer share the same interface and can be swapped without touching simulation logic. Units are intended to be modelled with an ECS library (bitECS or miniplex) to hit the 250-simultaneous-unit performance target. Game content (units, buildings, terrain, races) is defined in JSON5 files validated with Zod, which means the data and the TypeScript types are derived from the same schema and can never drift.

---

## Authentication flow (HTTP and WebSocket)

### What it does

Authenticates players via a username/password form, issues a signed JWT stored in an httpOnly cookie, and re-validates that cookie on every WebSocket upgrade. The WebSocket connection itself then serves as the live presence signal for the duration of the session.

### Boundaries

The auth system is not responsible for authorising individual game actions (commands arriving over the WebSocket are trusted once the connection is open), for managing game rooms or lobby state, or for any client-side token storage (the cookie is httpOnly and the client JavaScript cannot touch it).

### Key design decisions and why

- **JWT in an httpOnly, Secure, SameSite=Strict cookie** — eliminates XSS token theft because JavaScript cannot read the value. SameSite=Strict prevents CSRF. The server never needs a token store; verification is stateless.
- **HS256 with `JWT_SECRET_KEY` from env** — simple to operate with a single server; an upgrade path to RS256 exists if multi-server coordination is ever needed.
- **24-hour expiry, renewed on every successful WebSocket (re)connect** — a player who stays active never gets logged out mid-session.
- **Player credentials in `players.json`, hashed with bcrypt** — avoids a database for M0. The file is loaded once at startup, validated with Zod, and kept in memory.
- **WebSocket connection as presence source of truth** — the lobby tracks who is online via live socket objects, not token validity. A duplicate-connection attempt returns HTTP 409 both at the `/auth/status` check and at the WebSocket upgrade, preventing two tabs from fighting over the same identity.
- **Auth happens once at upgrade; messages are not re-authenticated** — identity is derived from which socket a message arrived on, not from message contents.

### Logic flow

**HTTP login**

1. Client POSTs `{ username, password }` to `POST /auth/login`.
2. Server validates the body with Zod (`LoginBodySchema`), then calls `verifyCredentials`, which looks up the player record from `players.json` and compares the password against the stored bcrypt hash.
3. On success, `signToken(username)` produces a HS256 JWT valid for 24 hours. The server sets it as an httpOnly cookie (`rts_token`) with `Secure` and `SameSite=Strict` flags and responds `{ username }`.
4. On failure, the server responds 401 `{ error: "Invalid username or password" }`.

**Pre-connection status check**

1. Before opening a WebSocket, the client calls `GET /auth/status` (cookie sent automatically).
2. The server extracts and verifies the cookie. If invalid → 401 `unauthenticated`. If valid but the username already has an open socket in the lobby → 409 `already_connected`. Otherwise → 200 `available`.
3. The client maps the result to one of three `ConnectionStatus` values and updates the UI accordingly.

**WebSocket upgrade and token renewal**

1. The browser opens `ws://<host>/ws`. The cookie is sent automatically on the HTTP upgrade request.
2. The server's `verifyClient` hook extracts the cookie, calls `verifyToken`, and checks the lobby for a duplicate connection. If either check fails the upgrade is rejected (401 or 409).
3. On a successful upgrade the `headers` event fires: the server calls `signToken` again and pushes a fresh `Set-Cookie` header into the 101 Switching Protocols response, silently renewing the 24-hour window.
4. The `connection` event fires, the server assigns a `connectionId` (UUID), adds the player to the `Lobby`, and sends a `{ type: "welcome", username }` message.

**Reconnection**

1. If the socket closes unexpectedly the client (`WebSocketTransport`) checks whether it had ever successfully connected.
2. If it had → exponential backoff (1 s base, 30 s cap, 6 attempts maximum) with status reported as `reconnecting`.
3. If it had never connected (upgrade was rejected on the first attempt) → calls `/auth/status` to distinguish `unauthenticated` from `already_connected` and surfaces the appropriate status to the UI.

**Logout**

1. Client POSTs to `POST /auth/logout`.
2. Server calls `response.clearCookie` (sets `Max-Age=0`). Client JavaScript cannot delete the httpOnly cookie itself, so this server-side clear is the only logout mechanism.
