import { useRef, useState } from 'react';
import type { LobbyState } from '@rts/shared';
import { login as loginRequest, logout as logoutRequest } from './AuthApi';
import { LobbyView } from './LobbyView';
import { LoginScreen } from './LoginScreen';
import { WebSocketTransport } from './WebSocketTransport';

type Status = 'idle' | 'connecting' | 'auth_failed' | 'connected' | 'reconnecting' | 'disconnected';

function App() {
  // STATE
  const [connectionStatus, setConnectionStatus] = useState<Status>('idle');
  const [username, setUsername] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);

  // METHODS
  const handleLogin = async (name: string, password: string) => {
    setConnectionStatus('connecting');
    const result = await loginRequest(name, password);
    if (!result.ok) {
      setConnectionStatus('auth_failed');
      return;
    }

    setUsername(name);
    const transport = new WebSocketTransport();
    transportRef.current = transport;

    transport.onStatus(status => {
      if (status === 'connected') setConnectionStatus('connected');
      else if (status === 'reconnecting') setConnectionStatus('reconnecting');
      else setConnectionStatus('disconnected');
    });
    transport.onLobbyState(state => setLobbyState(state));
    transport.connect();
  };

  const handleLogout = async () => {
    transportRef.current?.disconnect();
    transportRef.current = null;
    await logoutRequest();
    setUsername(null);
    setLobbyState(null);
    setConnectionStatus('idle');
  };

  // VARS
  const transportRef = useRef<WebSocketTransport | null>(null);

  if (connectionStatus === 'connected' || connectionStatus === 'reconnecting') {
    return (
      <div>
        {connectionStatus === 'reconnecting' && <p>Connection lost — reconnecting…</p>}
        {lobbyState && username ? (
          <LobbyView state={lobbyState} currentUsername={username} onLogout={handleLogout} />
        ) : (
          <p>Connecting to lobby…</p>
        )}
      </div>
    );
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
      isConnecting={connectionStatus === 'connecting'}
      error={connectionStatus === 'auth_failed' ? 'Invalid username or password' : undefined}
    />
  );
}

export { App };
