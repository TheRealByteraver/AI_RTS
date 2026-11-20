import type { LobbyState, PlayerStatus } from '@rts/shared';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AlreadyConnectedScreen } from './AlreadyConnectedScreen';
import { login as loginRequest, logout as logoutRequest } from './AuthApi';
import { GameView } from './GameView';
import type { ActiveGame } from './game';
import { INITIAL_INVITATIONS_STATE, invitationsReducer } from './invitations';
import { LobbyView } from './LobbyView';
import { LoginScreen } from './LoginScreen';
import { WebSocketTransport } from './WebSocketTransport';

type Status =
  | 'connecting'
  | 'unauthenticated'
  | 'auth_failed'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'already_connected';

function App() {
  // STATE
  const [connectionStatus, setConnectionStatus] =
    useState<Status>('connecting');
  const [username, setUsername] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [invitations, dispatchInvitations] = useReducer(
    invitationsReducer,
    INITIAL_INVITATIONS_STATE,
  );
  const [game, setGame] = useState<ActiveGame | null>(null);

  // VARS
  const transportRef = useRef<WebSocketTransport | null>(null);
  // Mirrors the status the server tracks for this player in the lobby.
  const playerStatus: PlayerStatus = game ? 'playing' : 'idle';

  // EFFECTS
  useEffect(() => {
    const transport = new WebSocketTransport();
    transportRef.current = transport;

    transport.onStatus((status) => {
      // The server drops a player's invitations and removes them from their
      // game when their socket closes, so that state is stale on reconnect.
      if (status !== 'connected') {
        dispatchInvitations({ type: 'reset' });
        setGame(null);
      }

      if (status === 'connected') setConnectionStatus('connected');
      else if (status === 'reconnecting') setConnectionStatus('reconnecting');
      else if (status === 'already_connected')
        setConnectionStatus('already_connected');
      else if (status === 'unauthenticated') {
        setUsername(null);
        setConnectionStatus('unauthenticated');
      } else {
        setConnectionStatus('disconnected');
      }
    });
    transport.onWelcome((name) => setUsername(name));
    transport.onLobbyState((state) => setLobbyState(state));
    transport.onInvitation((message) => dispatchInvitations(message));
    transport.onGame((message) => {
      if (message.type === 'game_started') {
        setGame({
          gameId: message.gameId,
          players: message.players,
          remainingPlayers: message.players,
        });
        // The server withdraws a player from all invitations once they play.
        dispatchInvitations({ type: 'reset' });
      } else {
        setGame((current) =>
          current?.gameId === message.gameId
            ? { ...current, remainingPlayers: message.remainingPlayers }
            : current,
        );
      }
    });
    transport.connect();

    return () => {
      transport.disconnect();
    };
  }, []);

  // METHODS
  const handleLogin = async (name: string, password: string) => {
    setConnectionStatus('connecting');
    const result = await loginRequest(name, password);
    if (!result.ok) {
      setConnectionStatus('auth_failed');
      return;
    }
    transportRef.current?.connect();
  };

  const handleRetry = () => {
    setConnectionStatus('connecting');
    transportRef.current?.connect();
  };

  const handleGoToLogin = async () => {
    await logoutRequest();
    setUsername(null);
    setConnectionStatus('unauthenticated');
  };

  const handleLogout = async () => {
    transportRef.current?.disconnect();
    await logoutRequest();
    setUsername(null);
    setLobbyState(null);
    dispatchInvitations({ type: 'reset' });
    setGame(null);
    setConnectionStatus('unauthenticated');
  };

  const handleStartGame = () => {
    const invitationId = invitations.outgoing?.invitationId;
    if (!invitationId) return;
    // The game page appears once the server confirms with game_started.
    transportRef.current?.send({ type: 'start_game', invitationId });
  };

  const handleLeaveGame = () => {
    transportRef.current?.send({ type: 'leave_game' });
    setGame(null);
  };

  const handleSendInvitation = (invitees: string[]) => {
    const invitationId = crypto.randomUUID();
    dispatchInvitations({ type: 'outgoing_sent', invitationId, invitees });
    transportRef.current?.send({
      type: 'invite_players',
      invitationId,
      invitees,
    });
  };

  const handleCancelInvitation = () => {
    const invitationId = invitations.outgoing?.invitationId;
    if (!invitationId) return;
    dispatchInvitations({ type: 'outgoing_cleared' });
    transportRef.current?.send({ type: 'cancel_invitation', invitationId });
  };

  const handleRespondToInvitation = (
    invitationId: string,
    accepted: boolean,
  ) => {
    dispatchInvitations({ type: 'incoming_answered', invitationId });
    transportRef.current?.send({
      type: 'respond_to_invitation',
      invitationId,
      accepted,
    });
  };

  if (connectionStatus === 'already_connected') {
    return (
      <AlreadyConnectedScreen
        onRetry={handleRetry}
        onGoToLogin={handleGoToLogin}
      />
    );
  }

  if (connectionStatus === 'connected' || connectionStatus === 'reconnecting') {
    return (
      <div>
        {connectionStatus === 'reconnecting' && (
          <p>Connection lost — reconnecting…</p>
        )}
        {playerStatus === 'playing' && game ? (
          <GameView game={game} onLeaveGame={handleLeaveGame} />
        ) : lobbyState && username ? (
          <LobbyView
            state={lobbyState}
            currentUsername={username}
            outgoingInvitation={invitations.outgoing}
            incomingInvitation={invitations.incoming[0] ?? null}
            onLogout={handleLogout}
            onSendInvitation={handleSendInvitation}
            onStartGame={handleStartGame}
            onCancelInvitation={handleCancelInvitation}
            onRespondToInvitation={handleRespondToInvitation}
          />
        ) : (
          <p>Connecting to lobby…</p>
        )}
      </div>
    );
  }

  if (connectionStatus === 'connecting') {
    return <p>Connecting…</p>;
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div>
        <p>Disconnected — please log in again.</p>
        <LoginScreen onLogin={handleLogin} isConnecting={false} />
      </div>
    );
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
      isConnecting={false}
      error={
        connectionStatus === 'auth_failed'
          ? 'Invalid username or password'
          : undefined
      }
    />
  );
}

export { App };
