import type { LobbyState } from '@rts/shared';

interface Props {
  state: LobbyState;
  currentUsername: string;
  onLogout: () => void;
}

export function LobbyView({ state, currentUsername, onLogout }: Props) {
  return (
    <div>
      <h1>Lobby</h1>
      <p>Logged in as {currentUsername}</p>
      <button onClick={onLogout}>Log out</button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
