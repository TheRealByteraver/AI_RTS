import type { LobbyState } from './LobbyState';

export type ServerMessage =
  | { type: 'welcome'; username: string }
  | { type: 'lobby_state'; state: LobbyState }
  | { type: 'error'; message: string };
