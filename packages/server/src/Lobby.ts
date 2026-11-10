import { WebSocket } from 'ws';
import type { LobbyState, ServerMessage } from '@rts/shared';

interface Connection {
  username: string;
  socket: WebSocket;
}

// The set of connected players and their sockets. Player status and avatars
// are not stored here; GameServer derives them when building the lobby state.
export class Lobby {
  private connections = new Map<string, Connection>();

  add = (connectionId: string, username: string, socket: WebSocket): void => {
    this.connections.set(connectionId, { username, socket });
  };

  remove = (connectionId: string): void => {
    this.connections.delete(connectionId);
  };

  hasPlayer = (username: string): boolean => {
    for (const connection of this.connections.values()) {
      if (connection.username === username) return true;
    }
    return false;
  };

  // Connected usernames, in connection order.
  usernames = (): string[] => {
    return [...this.connections.values()].map(connection => connection.username);
  };

  sendTo = (username: string, message: ServerMessage): void => {
    const payload = JSON.stringify(message);
    for (const connection of this.connections.values()) {
      if (connection.username === username && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(payload);
      }
    }
  };

  broadcast = (state: LobbyState): void => {
    const message: ServerMessage = { type: 'lobby_state', state };
    const payload = JSON.stringify(message);
    for (const { socket } of this.connections.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  };
}
