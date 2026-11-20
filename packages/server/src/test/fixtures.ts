import type { ServerMessage } from '@rts/shared';
import { ServerMessageSchema } from '@rts/shared';
import { WebSocket } from 'ws';
import { Games } from '../Games';
import { Invitations } from '../Invitations';
import { Lobby } from '../Lobby';

export interface FakeSocket {
  socket: WebSocket;
  sentMessages: () => ServerMessage[];
  clearMessages: () => void;
  close: () => void;
}

// A stand-in for a ws WebSocket that records what was sent to it. Lobby only
// uses readyState and send(), so those are all that is faked. Everything sent
// is parsed back through ServerMessageSchema, so a test also fails if the
// server ever sends a message that breaks the shared protocol.
export const createFakeSocket = (): FakeSocket => {
  let sentPayloads: string[] = [];
  const fake = {
    readyState: WebSocket.OPEN as number,
    send: (payload: string): void => {
      sentPayloads.push(payload);
    },
  };
  return {
    // The one cast in the test code: the fake only implements the subset of
    // WebSocket that Lobby touches.
    socket: fake as unknown as WebSocket,
    sentMessages: () =>
      sentPayloads.map((payload) =>
        ServerMessageSchema.parse(JSON.parse(payload)),
      ),
    clearMessages: () => {
      sentPayloads = [];
    },
    close: () => {
      fake.readyState = WebSocket.CLOSED;
    },
  };
};

export interface Fixture {
  lobby: Lobby;
  games: Games;
  invitations: Invitations;
  sockets: Map<string, FakeSocket>;
  messagesFor: (username: string) => ServerMessage[];
  clearAllMessages: () => void;
}

// A lobby with one connected, idle player per username, wired up to a Games
// and an Invitations instance the way GameServer wires them.
export const createFixture = (usernames: string[]): Fixture => {
  const lobby = new Lobby();
  const games = new Games(lobby);
  const invitations = new Invitations(lobby, games);
  const sockets = new Map<string, FakeSocket>();

  for (const username of usernames) {
    const fakeSocket = createFakeSocket();
    sockets.set(username, fakeSocket);
    lobby.add(`connection-${username}`, username, fakeSocket.socket);
  }

  return {
    lobby,
    games,
    invitations,
    sockets,
    messagesFor: (username) => sockets.get(username)?.sentMessages() ?? [],
    clearAllMessages: () => {
      for (const fakeSocket of sockets.values()) fakeSocket.clearMessages();
    },
  };
};
