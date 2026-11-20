import {
  type ClientCommand,
  type GameMessage,
  type GameTransport,
  type InvitationMessage,
  type LobbyState,
  ServerMessageSchema,
} from '@rts/shared';
import { checkConnectionStatus } from './AuthApi';

const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  'ws://localhost:3000/ws';

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 6;

export type ConnectionStatus =
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unauthenticated'
  | 'already_connected';
type StatusCallback = (status: ConnectionStatus) => void;

export class WebSocketTransport implements GameTransport {
  private socket: WebSocket | null = null;
  private lobbyCallbacks = new Set<(state: LobbyState) => void>();
  private welcomeCallbacks = new Set<(username: string) => void>();
  private invitationCallbacks = new Set<(message: InvitationMessage) => void>();
  private gameCallbacks = new Set<(message: GameMessage) => void>();
  private statusCallback: StatusCallback | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private hasConnectedOnce = false;

  onStatus = (callback: StatusCallback): void => {
    this.statusCallback = callback;
  };

  connect = (): void => {
    this.intentionalDisconnect = false;
    this.hasConnectedOnce = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.openSocket();
  };

  private openSocket = (): void => {
    const socket = new WebSocket(WS_URL);
    this.socket = socket;
    let thisSocketOpened = false;

    socket.onopen = () => {
      thisSocketOpened = true;
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;
      this.statusCallback?.('connected');
    };

    socket.onmessage = (event) => {
      let json: unknown;
      try {
        json = JSON.parse(String(event.data));
      } catch (error) {
        console.error('Malformed server message:', error);
        return;
      }

      const parsed = ServerMessageSchema.safeParse(json);
      if (!parsed.success) {
        console.error('Invalid server message:', parsed.error.issues);
        return;
      }

      const message = parsed.data;
      switch (message.type) {
        case 'welcome':
          for (const callback of this.welcomeCallbacks)
            callback(message.username);
          break;
        case 'lobby_state':
          for (const callback of this.lobbyCallbacks) callback(message.state);
          break;
        case 'error':
          console.error('Server error:', message.message);
          break;
        case 'game_started':
        case 'player_left_game':
          for (const callback of this.gameCallbacks) callback(message);
          break;
        default:
          for (const callback of this.invitationCallbacks) callback(message);
      }
    };

    socket.onclose = () => {
      if (this.intentionalDisconnect) return;
      if (!thisSocketOpened && !this.hasConnectedOnce) {
        void checkConnectionStatus()
          .then((statusCheck) => {
            if (statusCheck === 'already_connected') {
              this.statusCallback?.('already_connected');
            } else {
              this.statusCallback?.('unauthenticated');
            }
          })
          .catch(() => this.statusCallback?.('unauthenticated'));
        return;
      }
      this.scheduleReconnect();
    };
  };

  private scheduleReconnect = (): void => {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.statusCallback?.('disconnected');
      return;
    }

    this.statusCallback?.('reconnecting');
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  };

  disconnect = (): void => {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  };

  send = (command: ClientCommand): void => {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
    }
  };

  onLobbyState = (callback: (state: LobbyState) => void): void => {
    this.lobbyCallbacks.add(callback);
  };

  onWelcome = (callback: (username: string) => void): void => {
    this.welcomeCallbacks.add(callback);
  };

  onInvitation = (callback: (message: InvitationMessage) => void): void => {
    this.invitationCallbacks.add(callback);
  };

  onGame = (callback: (message: GameMessage) => void): void => {
    this.gameCallbacks.add(callback);
  };
}
