import type { InviteeStatus } from '@rts/shared';
import { useState } from 'react';
import type { OutgoingInvitation } from './invitations';
import { FOOTER_STYLE, MODAL_STYLE, OVERLAY_STYLE } from './modalStyles';
import { Spinner } from './Spinner';

const PLAYER_LIST_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  margin: '1rem 0',
};

const PLAYER_BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
};

const PLAYER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1.5rem',
};

const CHECKMARK_STYLE: React.CSSProperties = {
  // Reserve the checkmark's width so the label doesn't shift when toggled.
  display: 'inline-block',
  width: '1em',
  marginLeft: '0.75rem',
};

const WAITING_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const STATUS_LABELS: Record<InviteeStatus, string> = {
  pending: 'waiting…',
  accepted: '✓ accepted',
  declined: '✗ declined',
};

type Props = {
  players: string[];
  outgoingInvitation: OutgoingInvitation | null;
  onInvite: (usernames: string[]) => void;
  onStartGame: () => void;
  onCancel: () => void;
};

const InvitePlayerModal = (props: Props) => {
  // PROPS
  const { players, outgoingInvitation, onInvite, onStartGame, onCancel } =
    props;

  // STATE
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  // METHODS
  const togglePlayer = (username: string) => {
    setSelectedPlayers((current) =>
      current.includes(username)
        ? current.filter((name) => name !== username)
        : [...current, username],
    );
  };

  const handleInvite = () => {
    // A selected player may have left the lobby while the modal was open.
    onInvite(selectedPlayers.filter((name) => players.includes(name)));
  };

  // VARS
  const selectedCount = selectedPlayers.filter((name) =>
    players.includes(name),
  ).length;
  const hasSelection = selectedCount > 0;
  const inviteLabel = selectedCount > 1 ? 'Invite Players' : 'Invite Player';
  const pendingCount =
    outgoingInvitation?.invitees.filter(
      (invitee) => invitee.status === 'pending',
    ).length ?? 0;
  const acceptedCount =
    outgoingInvitation?.invitees.filter(
      (invitee) => invitee.status === 'accepted',
    ).length ?? 0;
  // Startable once everyone answered and at least one player said yes.
  const canStartGame = pendingCount === 0 && acceptedCount > 0;
  const waitingText =
    pendingCount > 1
      ? 'Waiting for players to reply'
      : 'Waiting for player to reply';

  return (
    <div style={OVERLAY_STYLE}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-player-title"
        style={MODAL_STYLE}
      >
        <h2 id="invite-player-title">Invite Player</h2>
        {outgoingInvitation ? (
          <>
            <div aria-live="polite">
              {pendingCount > 0 ? (
                <p style={WAITING_STYLE}>
                  <Spinner />
                  {waitingText}
                </p>
              ) : canStartGame ? (
                <p>All players have replied.</p>
              ) : (
                <p>Nobody accepted the invitation.</p>
              )}
            </div>
            <ul style={{ ...PLAYER_LIST_STYLE, padding: 0, listStyle: 'none' }}>
              {outgoingInvitation.invitees.map((invitee) => (
                <li key={invitee.username} style={PLAYER_ROW_STYLE}>
                  <span>{invitee.username}</span>
                  <span>{STATUS_LABELS[invitee.status]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : players.length === 0 ? (
          <p>No other players are online.</p>
        ) : (
          <div style={PLAYER_LIST_STYLE}>
            {players.map((name) => {
              const isSelected = selectedPlayers.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => togglePlayer(name)}
                  style={PLAYER_BUTTON_STYLE}
                >
                  <span>{name}</span>
                  <span aria-hidden="true" style={CHECKMARK_STYLE}>
                    {isSelected ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div style={FOOTER_STYLE}>
          {outgoingInvitation ? (
            <button
              type="button"
              onClick={onStartGame}
              disabled={!canStartGame}
            >
              Start Game
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInvite}
              disabled={!hasSelection}
            >
              {inviteLabel}
            </button>
          )}
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export { InvitePlayerModal };
