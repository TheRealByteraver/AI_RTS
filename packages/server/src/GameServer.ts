import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import cors from 'cors';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import express, { type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import type { ClientCommand } from '@rts/shared';
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, signToken, verifyCredentials, verifyToken } from './auth';
import { Lobby } from './Lobby';
import { listPlayerNames } from './players';

const LoginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/',
};

type AuthenticatedRequest = IncomingMessage & { username?: string };

export class GameServer {
  private lobby = new Lobby();

  constructor(port: number, clientOrigin: string) {
    const app = express();
    app.use(cors({ origin: clientOrigin, credentials: true }));
    app.use(express.json());

    app.get('/auth/players', (_req: Request, res: Response) => {
      res.json({ players: listPlayerNames() });
    });

    app.post('/auth/login', async (req: Request, res: Response) => {
      const parsed = LoginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      const { username, password } = parsed.data;
      const credentialsOk = await verifyCredentials(username, password);
      if (!credentialsOk) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }

      const token = signToken(username);
      res.cookie(AUTH_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: AUTH_COOKIE_MAX_AGE_MS });
      res.json({ username });
    });

    app.post('/auth/logout', (_req: Request, res: Response) => {
      res.clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS);
      res.json({ ok: true });
    });

    const httpServer = createServer(app);

    const wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      verifyClient: (info, callback) => {
        const cookieHeader = info.req.headers.cookie;
        const token = cookieHeader ? parseCookie(cookieHeader)[AUTH_COOKIE_NAME] : undefined;
        const payload = token ? verifyToken(token) : null;

        if (!payload) {
          callback(false, 401, 'Unauthorized');
          return;
        }

        (info.req as AuthenticatedRequest).username = payload.username;
        callback(true);
      },
    });

    // Renews the JWT cookie on every successful (re)connect, per DECISIONS.md §8.
    wss.on('headers', (headers, req) => {
      const username = (req as AuthenticatedRequest).username;
      if (!username) return;

      const refreshed = signToken(username);
      const cookie = serializeCookie(AUTH_COOKIE_NAME, refreshed, {
        ...COOKIE_OPTIONS,
        maxAge: AUTH_COOKIE_MAX_AGE_MS / 1000,
      });
      headers.push(`Set-Cookie: ${cookie}`);
    });

    wss.on('connection', (socket, req) => {
      const username = (req as AuthenticatedRequest).username;
      if (!username) {
        socket.close(1008, 'Unauthorized');
        return;
      }

      const connectionId = randomUUID();
      this.lobby.add(connectionId, username, socket);
      console.log(`${username} joined the lobby`);
      this.lobby.broadcast();

      socket.on('message', rawMessage => {
        try {
          const command = JSON.parse(rawMessage.toString()) as ClientCommand;
          void command; // no commands handled in M0
        } catch {
          // ignore malformed messages
        }
      });

      socket.on('close', () => {
        this.lobby.remove(connectionId);
        console.log(`${username} left the lobby`);
        this.lobby.broadcast();
      });
    });

    httpServer.listen(port, () => {
      console.log(`Server listening on :${port}`);
    });
  }
}
