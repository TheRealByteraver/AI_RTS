import { createServer } from 'node:net';
import { type ServerMessage, ServerMessageSchema } from '@rts/shared';
import { WebSocket } from 'ws';

export const TEST_PASSWORD = 'correct-horse';

// A port nothing is listening on right now.
export const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

// Logs in over HTTP like the client does and returns the "name=value" part of
// the auth cookie, which is what a browser sends back on later requests.
export const loginAndGetCookie = async (
  port: number,
  username: string,
  password: string = TEST_PASSWORD,
): Promise<string> => {
  const response = await fetch(`http://localhost:${port}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = response.headers.get('set-cookie');
  if (!response.ok || !setCookie) {
    throw new Error(`login failed for ${username}: ${response.status}`);
  }
  return setCookie.split(';')[0];
};

export type ConnectResult =
  | { accepted: true; client: LobbyClient }
  | { accepted: false; statusCode: number };

export interface LobbyClient {
  socket: WebSocket;
  messages: ServerMessage[];
  waitForMessage: (
    predicate: (message: ServerMessage) => boolean,
  ) => Promise<ServerMessage>;
  closed: () => Promise<void>;
}

const createLobbyClient = (socket: WebSocket): LobbyClient => {
  const messages: ServerMessage[] = [];
  const listeners = new Set<() => void>();

  socket.on('message', (rawMessage) => {
    messages.push(ServerMessageSchema.parse(JSON.parse(rawMessage.toString())));
    for (const listener of listeners) listener();
  });

  return {
    socket,
    messages,
    waitForMessage: (predicate) =>
      new Promise((resolve, reject) => {
        const check = (): boolean => {
          const found = messages.find(predicate);
          if (found) resolve(found);
          return found !== undefined;
        };
        if (check()) return;
        const timer = setTimeout(
          () => reject(new Error('timed out waiting for a server message')),
          2000,
        );
        const listener = (): void => {
          if (!check()) return;
          clearTimeout(timer);
          listeners.delete(listener);
        };
        listeners.add(listener);
      }),
    closed: () =>
      new Promise((resolve) => {
        if (socket.readyState === WebSocket.CLOSED) resolve();
        else socket.once('close', () => resolve());
      }),
  };
};

// Opens the lobby WebSocket the way the browser does (auth cookie on the
// upgrade request) and reports whether the server accepted it.
export const connectToLobby = (
  port: number,
  cookie: string | null,
): Promise<ConnectResult> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: cookie ? { cookie } : {},
    });
    // Attached before the socket opens so no early message is missed.
    const client = createLobbyClient(socket);
    socket.once('open', () => resolve({ accepted: true, client }));
    socket.once('unexpected-response', (_request, response) => {
      response.resume();
      resolve({ accepted: false, statusCode: response.statusCode ?? 0 });
    });
    socket.once('error', (error) => {
      if (socket.readyState !== WebSocket.CONNECTING) reject(error);
    });
  });
