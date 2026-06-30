import type { ClientCommand } from './ClientCommand';
import type { GameState } from './GameState';

export interface GameTransport {
  connect(): void;
  disconnect(): void;
  send(command: ClientCommand): void;
  onState(callback: (state: GameState) => void): void;
}
