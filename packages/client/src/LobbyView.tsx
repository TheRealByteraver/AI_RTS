import type { LobbyState } from '@rts/shared';
import { useState } from 'react';
import { InvitationReceivedModal } from './InvitationReceivedModal';
import { InvitePlayerModal } from './InvitePlayerModal';
import type { IncomingInvitation, OutgoingInvitation } from './invitations';
import { PlayerList } from './PlayerList';

type Props = {
  state: LobbyState;
  currentUsername: string;
  outgoingInvitation: OutgoingInvitation | null;
  incomingInvitation: IncomingInvitation | null;
  onLogout: () => void;
  onSendInvitation: (usernames: string[]) => void;
  onStartGame: () => void;
  onCancelInvitation: () => void;
  onRespondToInvitation: (invitationId: string, accepted: boolean) => void;
};

const LobbyView = (props: Props) => {
  // PROPS
  const {
    state,
    currentUsername,
    outgoingInvitation,
    incomingInvitation,
    onLogout,
    onSendInvitation,
    onStartGame,
    onCancelInvitation,
    onRespondToInvitation,
  } = props;

  // STATE
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // METHODS
  const handleCancelInvite = () => {
    onCancelInvitation();
    setIsInviteModalOpen(false);
  };

  // VARS
  // Only idle players can be invited (not in a game or another invitation).
  const invitablePlayers = state.players
    .filter(
      (player) =>
        player.username !== currentUsername && player.status === 'idle',
    )
    .map((player) => player.username);

  return (
    <div>
      <h1>Lobby</h1>
      <p>Hi {currentUsername}, welcome to the lobby!</p>
      <button type="button" onClick={() => setIsInviteModalOpen(true)}>
        Start Game
      </button>{' '}
      <button type="button" onClick={onLogout}>
        Log out
      </button>
      <PlayerList players={state.players} />
      {isInviteModalOpen && (
        <InvitePlayerModal
          players={invitablePlayers}
          outgoingInvitation={outgoingInvitation}
          onInvite={onSendInvitation}
          onStartGame={onStartGame}
          onCancel={handleCancelInvite}
        />
      )}
      {incomingInvitation && (
        <InvitationReceivedModal
          key={incomingInvitation.invitationId}
          invitation={incomingInvitation}
          currentUsername={currentUsername}
          onRespond={(accepted) =>
            onRespondToInvitation(incomingInvitation.invitationId, accepted)
          }
        />
      )}
    </div>
  );
};

export { LobbyView };
