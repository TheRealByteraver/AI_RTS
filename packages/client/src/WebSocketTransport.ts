import type { ClientCommand, GameState, GameTransport } from '@rts/shared';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3000';

type StatusCallback = (status: 'connected' | 'disconnected' | 'auth_failed') => void;

export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null;
  private readonly password: string;
  private stateCallbacks = new Set<(state: GameState) => void>();
  private statusCb: StatusCallback | null = null;

  constructor(password: string) {
    this.password = password;
  }

  onStatus(cb: StatusCallback): void {
    this.statusCb = cb;
  }

  connect(): void {
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'LOGIN', password: this.password }));
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as { type: string; state?: GameState };
      if (msg.type === 'LOGIN_OK') {
        this.statusCb?.('connected');
      } else if (msg.type === 'LOGIN_FAIL') {
        this.statusCb?.('auth_failed');
        this.ws?.close();
      } else if (msg.type === 'STATE' && msg.state) {
        for (const cb of this.stateCallbacks) cb(msg.state);
      }
    };

    this.ws.onclose = () => {
      this.statusCb?.('disconnected');
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  send(cmd: ClientCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }

  onState(cb: (state: GameState) => void): void {
    this.stateCallbacks.add(cb);
  }
}
