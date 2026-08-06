import type { LobbyState } from './LobbyState';

export type ServerMessage =
  | { type: 'lobby_state'; state: LobbyState }
  | { type: 'error'; message: string };
