import { WebSocket } from 'ws';
import type { LobbyState, ServerMessage } from '@rts/shared';

interface Connection {
  username: string;
  socket: WebSocket;
}

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

  getState = (): LobbyState => {
    return { players: [...this.connections.values()].map(connection => connection.username) };
  };

  broadcast = (): void => {
    const message: ServerMessage = { type: 'lobby_state', state: this.getState() };
    const payload = JSON.stringify(message);
    for (const { socket } of this.connections.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  };
}
