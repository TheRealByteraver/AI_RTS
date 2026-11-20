import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { GameServer } from '../GameServer';
import {
  connectToLobby,
  findFreePort,
  type LobbyClient,
  loginAndGetCookie,
  TEST_PASSWORD,
} from './serverHarness';

vi.hoisted(() => {
  process.env.JWT_SECRET_KEY = 'integration-test-secret';
});

// Two known test players instead of the real players.json.
vi.mock('../players', async () => {
  const bcrypt = await import('bcryptjs');
  const passwordHash = bcrypt.default.hashSync('correct-horse', 4);
  const testPlayers = ['alice', 'bob'];
  return {
    AVATARS_DIRECTORY: '.',
    AVATARS_URL_PATH: '/avatars',
    findPlayer: (name: string) =>
      testPlayers.includes(name)
        ? { name, avatar: `${name}.svg`, passwordHash }
        : undefined,
    avatarUrlFor: (name: string) =>
      testPlayers.includes(name) ? `/avatars/${name}.svg` : null,
  };
});

describe('GameServer (real HTTP + WebSocket)', () => {
  let port: number;
  let openClients: LobbyClient[];

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    port = await findFreePort();
    new GameServer(port, 'http://localhost:5173');
  });

  beforeEach(() => {
    openClients = [];
  });

  afterEach(async () => {
    for (const client of openClients) client.socket.close();
    await Promise.all(openClients.map((client) => client.closed()));
  });

  const joinLobby = async (username: string): Promise<LobbyClient> => {
    const cookie = await loginAndGetCookie(port, username);
    const result = await connectToLobby(port, cookie);
    if (!result.accepted)
      throw new Error(`${username} was rejected: ${result.statusCode}`);
    openClients.push(result.client);
    return result.client;
  };

  describe('login', () => {
    it('rejects a wrong password without setting a cookie', async () => {
      const response = await fetch(`http://localhost:${port}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'wrong' }),
      });
      expect(response.status).toBe(401);
      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('sets an httpOnly, Secure, SameSite=Strict cookie on success', async () => {
      const response = await fetch(`http://localhost:${port}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: TEST_PASSWORD }),
      });
      const cookie = response.headers.get('set-cookie') ?? '';
      expect(response.status).toBe(200);
      expect(cookie).toMatch(/^rts_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
    });
  });

  describe('connecting to the lobby', () => {
    it('rejects a WebSocket without a cookie with 401', async () => {
      const result = await connectToLobby(port, null);
      expect(result).toEqual({ accepted: false, statusCode: 401 });
    });

    it('rejects a WebSocket with a bad token with 401', async () => {
      const result = await connectToLobby(port, 'rts_token=not-a-real-token');
      expect(result).toEqual({ accepted: false, statusCode: 401 });
    });

    it('sends welcome and then the lobby state to a newly connected player', async () => {
      const alice = await joinLobby('alice');

      const welcome = await alice.waitForMessage(
        (message) => message.type === 'welcome',
      );
      const lobbyState = await alice.waitForMessage(
        (message) => message.type === 'lobby_state',
      );

      expect(welcome).toEqual({ type: 'welcome', username: 'alice' });
      expect(lobbyState).toEqual({
        type: 'lobby_state',
        state: {
          players: [
            {
              username: 'alice',
              status: 'idle',
              avatarUrl: '/avatars/alice.svg',
            },
          ],
        },
      });
    });

    it('shows each player to the other as they join and leave', async () => {
      const alice = await joinLobby('alice');
      await alice.waitForMessage((message) => message.type === 'lobby_state');

      const bob = await joinLobby('bob');
      const bothOnline = (message: { type: string }): boolean =>
        message.type === 'lobby_state' &&
        'state' in message &&
        (message.state as { players: unknown[] }).players.length === 2;
      await alice.waitForMessage(bothOnline);
      await bob.waitForMessage(bothOnline);

      bob.socket.close();
      await alice.waitForMessage(
        (message) =>
          message.type === 'lobby_state' && message.state.players.length === 1,
      );
    });

    it('rejects a second connection for the same player with 409', async () => {
      const cookie = await loginAndGetCookie(port, 'alice');
      const first = await connectToLobby(port, cookie);
      if (!first.accepted)
        throw new Error('first connection should be accepted');
      openClients.push(first.client);

      const second = await connectToLobby(port, cookie);

      expect(second).toEqual({ accepted: false, statusCode: 409 });
      const status = await fetch(`http://localhost:${port}/auth/status`, {
        headers: { cookie },
      });
      expect(status.status).toBe(409);
    });

    it('lets a player reconnect once their first socket has closed', async () => {
      const cookie = await loginAndGetCookie(port, 'alice');
      const first = await connectToLobby(port, cookie);
      if (!first.accepted)
        throw new Error('first connection should be accepted');
      first.client.socket.close();
      await first.client.closed();

      const second = await connectToLobby(port, cookie);

      expect(second.accepted).toBe(true);
      if (second.accepted) openClients.push(second.client);
    });
  });
});
