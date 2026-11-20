import type { LobbyPlayer, PlayerStatus } from '@rts/shared';
import { API_URL } from './config';

const LIST_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  padding: 0,
  listStyle: 'none',
};

const CARD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
  width: '6rem',
  textAlign: 'center',
};

const AVATAR_SIZE_PX = 64;

const AVATAR_STYLE: React.CSSProperties = {
  width: AVATAR_SIZE_PX,
  height: AVATAR_SIZE_PX,
  borderRadius: '50%',
  background: '#ddd',
};

const STATUS_STYLE: React.CSSProperties = {
  fontSize: '0.85em',
  color: '#555',
};

const STATUS_LABELS: Record<PlayerStatus, string> = {
  idle: 'idle',
  preparing: 'preparing to play',
  playing: 'playing',
};

type Props = {
  players: LobbyPlayer[];
};

// Everyone currently logged in: avatar, name and status.
const PlayerList = (props: Props) => {
  // PROPS
  const { players } = props;

  return (
    <ul style={LIST_STYLE} aria-label="Players in the lobby">
      {players.map((player) => (
        <li key={player.username} style={CARD_STYLE}>
          {player.avatarUrl ? (
            <img
              src={`${API_URL}${player.avatarUrl}`}
              alt=""
              width={AVATAR_SIZE_PX}
              height={AVATAR_SIZE_PX}
              style={AVATAR_STYLE}
            />
          ) : (
            <span style={AVATAR_STYLE} aria-hidden="true" />
          )}
          <strong>{player.username}</strong>
          <span style={STATUS_STYLE}>{STATUS_LABELS[player.status]}</span>
        </li>
      ))}
    </ul>
  );
};

export { PlayerList };
