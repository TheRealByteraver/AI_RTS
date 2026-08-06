import type { ClientCommand, GameTransport, LobbyState, ServerMessage } from '@rts/shared';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3000/ws';

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 6;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
type StatusCallback = (status: ConnectionStatus) => void;

export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null;
  private lobbyCallbacks = new Set<(state: LobbyState) => void>();
  private statusCb: StatusCallback | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  onStatus(cb: StatusCallback): void {
    this.statusCb = cb;
  }

  connect(): void {
    this.intentionalDisconnect = false;
    this.openSocket();
  }

  private openSocket(): void {
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.statusCb?.('connected');
    };

    ws.onmessage = event => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      if (message.type === 'lobby_state') {
        for (const cb of this.lobbyCallbacks) cb(message.state);
      } else if (message.type === 'error') {
        console.error('Server error:', message.message);
      }
    };

    ws.onclose = () => {
      if (this.intentionalDisconnect) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.statusCb?.('disconnected');
      return;
    }

    this.statusCb?.('reconnecting');
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(cmd: ClientCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }

  onLobbyState(cb: (state: LobbyState) => void): void {
    this.lobbyCallbacks.add(cb);
  }
}
