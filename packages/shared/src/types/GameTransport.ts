import type { ClientCommand } from './ClientCommand';
import type { LobbyState } from './LobbyState';
import type { GameMessage, InvitationMessage } from './ServerMessage';

export interface GameTransport {
  connect(): void;
  disconnect(): void;
  send(command: ClientCommand): void;
  onLobbyState(callback: (state: LobbyState) => void): void;
  onWelcome(callback: (username: string) => void): void;
  onInvitation(callback: (message: InvitationMessage) => void): void;
  onGame(callback: (message: GameMessage) => void): void;
}
