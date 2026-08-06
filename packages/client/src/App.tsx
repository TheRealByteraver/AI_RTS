import { useRef, useState } from 'react';
import type { LobbyState } from '@rts/shared';
import { login as loginRequest, logout as logoutRequest } from './AuthApi';
import { LobbyView } from './LobbyView';
import { LoginScreen } from './LoginScreen';
import { WebSocketTransport } from './WebSocketTransport';

type Status = 'idle' | 'connecting' | 'auth_failed' | 'connected' | 'reconnecting' | 'disconnected';

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [username, setUsername] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const transportRef = useRef<WebSocketTransport | null>(null);

  const handleLogin = async (name: string, password: string) => {
    setStatus('connecting');
    const result = await loginRequest(name, password);
    if (!result.ok) {
      setStatus('auth_failed');
      return;
    }

    setUsername(name);
    const transport = new WebSocketTransport();
    transportRef.current = transport;

    transport.onStatus(s => {
      if (s === 'connected') setStatus('connected');
      else if (s === 'reconnecting') setStatus('reconnecting');
      else setStatus('disconnected');
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
    setStatus('idle');
  };

  if (status === 'connected' || status === 'reconnecting') {
    return (
      <div>
        {status === 'reconnecting' && <p>Connection lost — reconnecting…</p>}
        {lobbyState && username ? (
          <LobbyView state={lobbyState} currentUsername={username} onLogout={handleLogout} />
        ) : (
          <p>Connecting to lobby…</p>
        )}
      </div>
    );
  }

  if (status === 'disconnected') {
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
      isConnecting={status === 'connecting'}
      error={status === 'auth_failed' ? 'Invalid username or password' : undefined}
    />
  );
}
