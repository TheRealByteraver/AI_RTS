import { useState } from 'react';
import { DialogModal } from './DialogModal';
import type { ActiveGame } from './game';

type Props = {
  game: ActiveGame;
  onLeaveGame: () => void;
};

// Placeholder page shown instead of the lobby while the player is 'playing'.
const GameView = (props: Props) => {
  // PROPS
  const { game, onLeaveGame } = props;

  // STATE
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);

  // VARS
  const departedPlayers = game.players.filter(
    (name) => !game.remainingPlayers.includes(name),
  );
  const isLastPlayer = game.remainingPlayers.length <= 1;
  const otherPlayerCount = game.players.length - 1;
  const lastPlayerMessage =
    otherPlayerCount > 1
      ? 'The other players left the game.'
      : 'The other player left the game.';

  return (
    <div>
      <h1>Playing the game</h1>
      <ul aria-live="polite">
        {departedPlayers.map((name) => (
          <li key={name}>Player {name} left the game.</li>
        ))}
      </ul>
      <button type="button" onClick={() => setIsConfirmingExit(true)}>
        Exit game
      </button>
      {isLastPlayer ? (
        <DialogModal
          id="last-player"
          title="Game over"
          message={lastPlayerMessage}
          actions={[{ label: 'Back to lobby', onClick: onLeaveGame }]}
        />
      ) : (
        isConfirmingExit && (
          <DialogModal
            id="confirm-exit"
            title="Exit game"
            message="Are you sure you want to exit the game?"
            actions={[
              { label: 'Yes', onClick: onLeaveGame },
              { label: 'No', onClick: () => setIsConfirmingExit(false) },
            ]}
          />
        )
      )}
    </div>
  );
};

export { GameView };
