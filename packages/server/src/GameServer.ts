import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import cors from 'cors';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import express, { type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { type ClientCommand, ClientCommandSchema } from '@rts/shared';
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, signToken, verifyCredentials, verifyToken } from './auth';
import { Games } from './Games';
import { Invitations } from './Invitations';
import { Lobby } from './Lobby';

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
  private invitations = new Invitations(this.lobby);
  private games = new Games(this.lobby);

  constructor(port: number, clientOrigin: string) {
    const expressApp = express();
    expressApp.use(cors({ origin: clientOrigin, credentials: true }));
    expressApp.use(express.json());

    expressApp.get('/auth/status', (request: Request, response: Response) => {
      const cookieHeader = request.headers.cookie;
      const token = cookieHeader ? parseCookie(cookieHeader)[AUTH_COOKIE_NAME] : undefined;
      const payload = token ? verifyToken(token) : null;

      if (!payload) {
        response.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (this.lobby.hasPlayer(payload.username)) {
        response.status(409).json({ error: 'Already connected' });
        return;
      }

      response.json({ ok: true });
    });

    expressApp.post('/auth/login', async (request: Request, response: Response) => {
      const parsed = LoginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: 'Invalid request' });
        return;
      }

      const { username, password } = parsed.data;
      const credentialsOk = await verifyCredentials(username, password);
      if (!credentialsOk) {
        response.status(401).json({ error: 'Invalid username or password' });
        return;
      }

      const token = signToken(username);
      response.cookie(AUTH_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: AUTH_COOKIE_MAX_AGE_MS });
      response.json({ username });
    });

    expressApp.post('/auth/logout', (_request: Request, response: Response) => {
      response.clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS);
      response.json({ ok: true });
    });

    const httpServer = createServer(expressApp);

    const webSocketServer = new WebSocketServer({
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

        if (this.lobby.hasPlayer(payload.username)) {
          callback(false, 409, 'Already connected');
          return;
        }

        (info.req as AuthenticatedRequest).username = payload.username;
        callback(true);
      },
    });

    // Renews the JWT cookie on every successful (re)connect, per DECISIONS.md §8.
    webSocketServer.on('headers', (headers, request) => {
      const username = (request as AuthenticatedRequest).username;
      if (!username) return;

      const refreshed = signToken(username);
      const cookie = serializeCookie(AUTH_COOKIE_NAME, refreshed, {
        ...COOKIE_OPTIONS,
        maxAge: AUTH_COOKIE_MAX_AGE_MS / 1000,
      });
      headers.push(`Set-Cookie: ${cookie}`);
    });

    webSocketServer.on('connection', (socket, request) => {
      const username = (request as AuthenticatedRequest).username;
      if (!username) {
        socket.close(1008, 'Unauthorized');
        return;
      }

      const connectionId = randomUUID();
      this.lobby.add(connectionId, username, socket);
      socket.send(JSON.stringify({ type: 'welcome', username }));
      console.log(`${username} joined the lobby`);
      this.lobby.broadcast();

      socket.on('message', rawMessage => {
        let json: unknown;
        try {
          json = JSON.parse(rawMessage.toString());
        } catch (error) {
          // ignore malformed messages
          console.error(error);
          return;
        }

        const parsed = ClientCommandSchema.safeParse(json);
        if (!parsed.success) {
          console.error('invalid command from player', username, parsed.error.issues);
          return;
        }

        console.log('received command', parsed.data, ' from player ', username);
        this.handleCommand(username, parsed.data);
      });

      socket.on('close', () => {
        this.lobby.remove(connectionId);
        this.games.leave(username);
        this.invitations.withdrawPlayer(username);
        console.log(`${username} left the lobby`);
        this.lobby.broadcast();
      });
    });

    httpServer.listen(port, () => {
      console.log(`Server listening on :${port}`);
    });
  }

  // Identity comes from the socket the command arrived on, never from its contents.
  private handleCommand = (username: string, command: ClientCommand): void => {
    switch (command.type) {
      case 'PING':
        break;
      case 'invite_players':
        this.invitations.create(username, command.invitationId, command.invitees);
        break;
      case 'respond_to_invitation':
        this.invitations.respond(username, command.invitationId, command.accepted);
        break;
      case 'cancel_invitation':
        this.invitations.cancel(username, command.invitationId);
        break;
      case 'start_game': {
        const players = this.invitations.claimForGame(username, command.invitationId);
        if (!players) break;
        this.games.start(players);
        // The new players are busy now: drop them from any other invitations.
        for (const player of players) this.invitations.withdrawPlayer(player);
        this.lobby.broadcast();
        break;
      }
      case 'leave_game':
        if (this.games.leave(username)) this.lobby.broadcast();
        break;
    }
  };
}
