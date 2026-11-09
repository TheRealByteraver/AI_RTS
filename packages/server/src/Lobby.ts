import { WebSocket } from 'ws';
import type { LobbyState, PlayerStatus, ServerMessage } from '@rts/shared';

interface Connection {
  username: string;
  socket: WebSocket;
  status: PlayerStatus;
}

export class Lobby {
  private connections = new Map<string, Connection>();

  add = (connectionId: string, username: string, socket: WebSocket): void => {
    this.connections.set(connectionId, { username, socket, status: 'idle' });
  };

  setStatus = (username: string, status: PlayerStatus): void => {
    for (const connection of this.connections.values()) {
      if (connection.username === username) connection.status = status;
    }
  };

  // Online and not in a game.
  isIdle = (username: string): boolean => {
    for (const connection of this.connections.values()) {
      if (connection.username === username && connection.status === 'idle') return true;
    }
    return false;
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

  sendTo = (username: string, message: ServerMessage): void => {
    const payload = JSON.stringify(message);
    for (const connection of this.connections.values()) {
      if (connection.username === username && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(payload);
      }
    }
  };

  getState = (): LobbyState => {
    return {
      players: [...this.connections.values()].map(connection => ({
        username: connection.username,
        status: connection.status,
      })),
    };
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
