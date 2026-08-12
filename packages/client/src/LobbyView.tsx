import type { LobbyState } from '@rts/shared';

interface Props {
  state: LobbyState;
  currentUsername: string;
  onLogout: () => void;
}

function LobbyView(props: Props) {
  // PROPS
  const { state, currentUsername, onLogout } = props;

  return (
    <div>
      <h1>Lobby</h1>
      <p>Logged in as {currentUsername}</p>
      <button type="button" onClick={onLogout}>
        Log out
      </button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}

export { LobbyView };
