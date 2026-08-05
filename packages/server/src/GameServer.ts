import { WebSocketServer, WebSocket } from 'ws';
import type { ClientCommand, GameState } from '@rts/shared';
import { GameLoop } from './GameLoop';

const GAME_PASSWORD = process.env.GAME_PASSWORD ?? 'rts123';

interface LoginMessage {
  type: 'LOGIN';
  password: string;
}

export class GameServer {
  private webSocketServer: WebSocketServer;
  private loop: GameLoop;
  private nextPlayerId = 1;

  constructor(port: number, loop: GameLoop) {
    this.loop = loop;
    this.webSocketServer = new WebSocketServer({ port });
    this.webSocketServer.on('connection', socket => this.handleConnection(socket));
    console.log(`WebSocket server listening on :${port}`);
  }

  // this fn fires whenever a new client tries to connect
  private handleConnection(socket: WebSocket): void {
    let playerId: string | null = null;
    let tickCallback: ((state: GameState) => void) | null = null;

    const cleanup = () => {
      if (playerId) this.loop.removePlayer(playerId);
      if (tickCallback) this.loop.offTick(tickCallback);
    };

    socket.once('message', rawData => {
      try {
        const message = JSON.parse(rawData.toString()) as LoginMessage;
        if (message.type !== 'LOGIN' || message.password !== GAME_PASSWORD) {
          socket.send(JSON.stringify({ type: 'LOGIN_FAIL' }));
          socket.close();
          return;
        }

        playerId = `player-${this.nextPlayerId++}`;
        this.loop.addPlayer(playerId);
        socket.send(JSON.stringify({ type: 'LOGIN_OK', playerId }));
        console.log(`${playerId} authenticated`);

        tickCallback = (state: GameState) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'STATE', state }));
          }
        };
        this.loop.onTick(tickCallback);

        socket.on('message', rawMessage => {
          try {
            const command = JSON.parse(rawMessage.toString()) as ClientCommand;
            void command; // commands handled in M1+
          } catch {
            // ignore malformed messages
          }
        });

        socket.on('close', () => {
          console.log(`${playerId} disconnected`);
          cleanup();
        });

        socket.on('error', () => cleanup());
      } catch {
        socket.close();
      }
    });

    socket.on('close', () => {
      if (!playerId) cleanup(); // closed before login completed
    });
  }
}
