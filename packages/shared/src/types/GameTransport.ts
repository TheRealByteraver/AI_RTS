import type { ClientCommand } from './ClientCommand';
import type { LobbyState } from './LobbyState';

export interface GameTransport {
  connect(): void;
  disconnect(): void;
  send(command: ClientCommand): void;
  onLobbyState(callback: (state: LobbyState) => void): void;
  onWelcome(callback: (username: string) => void): void;
}
