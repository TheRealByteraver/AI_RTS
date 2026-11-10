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
- **Player names hardcoded in the client (`packages/client/src/players.ts`)** — copied from the `name` fields in `players.json`. There is no `/auth/players` endpoint; the login form's player `select` is populated from this local list rather than an HTTP round trip, since the roster is small and fixed for M0.
- **Login form: visible `select` drives a visually-hidden `username` input** — `LoginScreen` lets the player pick a name from a `<select>` (so no free-text typos against the fixed roster), and that choice is mirrored into a plain `<input name="username" autoComplete="username">` kept in the DOM but off-screen (clipped/1px, not `display:none`) so the browser's password manager can still see, autofill, and associate a saved password with the chosen player name.
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

---

## Game invitations (client and server)

### What it does

Lets a logged-in player invite other idle players to a game and collect their answers. In `LobbyView`, "Start Game" opens `InvitePlayerModal`, which lists every other player whose status is `idle` as a toggle button (or "No other idle players available."); clicking one toggles a checkmark (✓). The invite button reads "Invite Player" or "Invite Players" depending on how many are selected (disabled at zero). Sending the invitation keeps the modal open and switches it to a waiting view: a spinner with "Waiting for player to reply" / "Waiting for players to reply" while anyone is still pending (then "All players have replied." or "Nobody accepted the invitation."), plus a row per invitee showing `waiting…`, `✓ accepted`, or `✗ declined`. In the waiting view the invite button is replaced by a "Start Game" button, greyed out until every invitee has answered and at least one accepted. Each invited player sees `InvitationReceivedModal`: who invited them, who else was invited, and "Yes" / "No" buttons. Their answer goes to the server, which forwards the updated status to the inviter. "Cancel" in the inviter's modal withdraws the invitation and closes the invitees' modals.

### Boundaries

Invitations end where a game begins: clicking "Start Game" hands the inviter and accepted players to the game system (see "Player status and games"). Invitations are only kept in server memory and are dropped when the inviter disconnects or starts playing, so nothing survives a server restart or a reconnect. A player can be in several invitations at once; the client shows received invitations one at a time, oldest first.

### Key design decisions and why

- **Protocol defined as Zod schemas in `packages/shared`** — `ClientCommandSchema`, `ServerMessageSchema` and `LobbyStateSchema` are the single definition of each message; the TS types are `z.infer`'d from them. The server validates every incoming command with `ClientCommandSchema.safeParse` and the client validates every incoming message with `ServerMessageSchema.safeParse`, replacing the earlier `as` casts on `JSON.parse` output. `zod` is therefore now a dependency of `@rts/shared`.
- **Messages** — client → server: `invite_players { invitationId, invitees }`, `respond_to_invitation { invitationId, accepted }`, `cancel_invitation { invitationId }`, `start_game { invitationId }`. Server → client: `invitation_received { invitationId, inviter, invitees }` (to each invitee), `invitation_status { invitationId, invitees: { username, status }[] }` (to the inviter), `invitation_cancelled { invitationId }` (to invitees on cancel, or to the inviter if the invitation couldn't be created).
- **Full status list, not deltas** — `invitation_status` always carries every invitee's status, matching the project's full-state-every-time networking approach; the client just replaces what it had.
- **Client-generated `invitationId`** — the inviter's client creates the id with `crypto.randomUUID()` so it can show the waiting view immediately (everyone `pending`), cancel before the server has replied, and ignore late `invitation_status` messages for an invitation it already cancelled. The server rejects an id already in use.
- **Identity from the socket, not the message** — `GameServer.handleCommand` receives the username bound to the socket at upgrade. Only the inviter can cancel, only listed invitees can answer, and each invitee can answer once.
- **Server-side sanitising** — `Invitations.create` first cancels the inviter's previous invitation (a player has at most one outgoing), then removes duplicates, the inviter themselves, and anyone who isn't `idle` — offline, in a game, or already involved in another invitation. If nobody is left, it replies `invitation_cancelled` and the client's modal returns to the selection view. A player who is `playing` can't send invitations or accept one; a `preparing` player can still send one (e.g. while an invitation to them is pending).
- **Server re-checks "Start Game"** — the button's enabled state is only a convenience. `Invitations.claimForGame` independently requires that the sender is the inviter and not in a game, nobody is `pending`, and at least one invitee accepted and is still online and not in a game; otherwise it replies with an `error` and keeps the invitation.
- **Withdrawing unavailable players** — `Invitations.withdrawPlayer` runs when a player disconnects or starts playing: their own invitations are cancelled, and they're marked `declined` in every other invitation they were part of — even ones they had already accepted — and those inviters get a fresh `invitation_status`. That keeps every inviter's "Start Game" button honest about who is actually available. On the client, invitation state is reset whenever the connection status leaves `connected`, on logout, and when a game starts.
- **Client state as a pure reducer** — `invitations.ts` holds `invitationsReducer` (outgoing invitation plus a queue of incoming ones) and `App` feeds it both server messages (via `GameTransport.onInvitation`) and local actions. It sits in `App` because that's where the transport lives.
- **Shared modal styling, no modal library** — `modalStyles.ts` holds the overlay, dialog and footer styles used by every modal (`role="dialog"`, `aria-modal`); `DialogModal` is a generic title + message + buttons modal for simple confirmations. The spinner is a CSS-only `Spinner` component (`spinner.css`, keyframes can't be inline styles) and is `aria-hidden`; the waiting text sits in an `aria-live` region.
- **Visible only when logged in** — `LobbyView` only renders once the WebSocket is connected and a `welcome` username has arrived, so the "Start Game" button needs no separate auth check.

### Logic flow

1. Inviter clicks "Start Game" → `InvitePlayerModal` opens on the selection view; they toggle players and click "Invite Player(s)".
2. `App.handleSendInvitation` creates an `invitationId`, dispatches `outgoing_sent` (modal switches to the waiting view, all invitees `pending`), and sends `invite_players`.
3. Server: `ClientCommandSchema` validates the command, then `Invitations.create` sanitises the invitee list, stores the invitation, sends `invitation_received` to each invitee and `invitation_status` to the inviter.
4. Each invitee's client queues the invitation and shows `InvitationReceivedModal`. Clicking "Yes"/"No" removes it from the queue and sends `respond_to_invitation`.
5. Server: `Invitations.respond` updates that invitee's status and sends a fresh `invitation_status` to the inviter, whose modal updates the row and the waiting text; the spinner disappears once nobody is pending.
6. Once nobody is pending and someone accepted, the inviter's "Start Game" button enables; clicking it sends `start_game` (continued under "Player status and games").
7. Inviter clicks "Cancel" instead → client clears its outgoing invitation, closes the modal, and sends `cancel_invitation`; the server deletes the invitation and sends `invitation_cancelled` to every invitee, whose client drops it from the queue (closing the modal if it was showing).

---

## Lobby and player avatars (client and server)

### What it does

`LobbyView` greets the player ("Hi _name_, welcome to the lobby!") and shows `PlayerList`: one card per logged-in player with their avatar, name and status label (`idle`, `preparing to play`, `playing`). Each player in `players.json` has an `avatar` file name pointing at a cartoon-style SVG headshot in `data/avatars/`; the server serves that folder at `/avatars/*` and includes each player's `avatarUrl` (e.g. `/avatars/liesbeth.svg`) in every `lobby_state`.

### Boundaries

Avatars are static content files; there's no upload or per-player customisation. `PlayerList` only displays; inviting still happens through `InvitePlayerModal`.

### Key design decisions and why

- **Avatars as content files, referenced from `players.json`** — following the engine-vs-content split, the images live in `data/avatars/` and the player record only stores a file name. Zod restricts it to a plain `name.svg` file name, so a player record can't point outside that folder.
- **Served by the game server, not bundled in the client** — the server already owns the player roster (`players.json`), so it also hands out the avatar URL; the client just prefixes it with `API_URL` (now in `config.ts`, shared with `AuthApi`). The route is public: `<img>` requests from the client's origin don't carry the `SameSite=Strict` auth cookie, and the images aren't sensitive.
- **SVG** — small, crisp at any size, and in line with the vector-art direction for later graphics (decisions §2). The headshots share one generated style (round frame, same face geometry) and vary skin tone, hair, facial hair, glasses and colours; Liesbeth's has long hair, lashes, lipstick and earrings.
- **`avatarUrl` is nullable** — a connected user missing from `players.json` (not possible today, since login requires a record) gets a grey placeholder circle instead of a broken image.

---

## Player status and games (client and server)

### What it does

Every logged-in player has a status: `idle` (in the lobby, free to be invited), `preparing` (involved in an open invitation: they sent one that's still open, or they're invited and haven't declined) or `playing` (in a game). The server includes it in every `lobby_state` broadcast (`players: { username, status, avatarUrl }[]`); the lobby shows `preparing` as "preparing to play". `Games` tracks which players are in which game. When an inviter starts a game, the inviter and every accepted player switch to `playing`, and their clients replace the lobby with `GameView`: a placeholder page reading "Playing the game" with an "Exit game" button. "Exit game" asks "Are you sure you want to exit the game?" (Yes / No). On "Yes", the player returns to the lobby as `idle`, and every player still in the game sees "Player _name_ left the game." When only one player is left, they get a modal saying the other player (or players) left the game, with a "Back to lobby" button.

### Boundaries

There's no gameplay, game state or tick loop yet; `GameView` is a placeholder. A game ends only when every player has left it; there is no win/loss or rejoining. Games live only in server memory: a disconnect removes the player from their game, and they come back `idle` on reconnect.

### Key design decisions and why

- **Status is derived on the server, never stored** — `GameServer.statusOf` computes it on demand: `Games.isPlaying` → `playing`, else `Invitations.isPreparing` → `preparing`, else `idle`. Since it's computed from the game and invitation data, it can't drift out of sync with them. `Lobby` only tracks connections. `GameServer` re-broadcasts the full `lobby_state` after every connect, disconnect and non-`PING` command, because any of them can change someone's status, and the lobby is tiny. The client's own `playerStatus` in `App` is derived from whether it has an active game (`game ? 'playing' : 'idle'`) and picks between `GameView` and `LobbyView`.
- **Messages** — client → server: `start_game { invitationId }`, `leave_game` (no game id: the server knows which game the socket's player is in). Server → client: `game_started { gameId, players }` to every player of the new game, `player_left_game { gameId, username, remainingPlayers }` to everyone still in it. These match the `game_started` type planned in decisions §9; there's no separate `game_ended` message because a game simply ends when it's empty.
- **The last player stays `playing` until they click "Back to lobby"** — that click sends `leave_game` like any other exit, which empties the game and lets the server delete it. The server's view of the last player therefore matches their screen (still on the game page) until they actually leave, so nobody can invite them while the "everyone left" modal is showing.
- **"Last player" decided from `remainingPlayers`** — the client stores the original `players` and the latest `remainingPlayers`; it shows the modal when one player remains, and derives who left (for the notices) as `players` minus `remainingPlayers`. "player" vs "players" in the modal depends on how many others started the game.
- **Leaving is optimistic on the client** — on "Yes", `App.handleLeaveGame` sends `leave_game` and drops back to the lobby immediately; starting is not optimistic, the game page only appears on `game_started`.
- **Disconnect = leaving** — the `close` handler calls `Games.leave` before `Invitations.withdrawPlayer`, so the other players get `player_left_game` exactly as if the player had clicked "Exit game".

### Logic flow

1. Inviter clicks the enabled "Start Game" → `start_game { invitationId }`.
2. Server: `Invitations.claimForGame` validates and removes the invitation, returning `[inviter, ...accepted]`. `Games.start` creates the game (which makes each player `playing`) and sends them `game_started`. `Invitations.withdrawPlayer` runs for each player, then `lobby_state` is broadcast.
3. Each player's client stores the game, resets its invitation state, and shows `GameView`.
4. A player clicks "Exit game" → confirmation modal → "Yes" → `leave_game` sent, client returns to the lobby.
5. Server: `Games.leave` removes the player (they're `idle` again), sends `player_left_game` to the remaining players, deletes the game if it's empty, and `lobby_state` is broadcast.
6. Remaining clients update `remainingPlayers`: a "Player _name_ left the game." line appears, and if only this player is left, the "Game over" modal replaces the exit confirmation. "Back to lobby" sends `leave_game` (step 5), which removes the now-empty game.
