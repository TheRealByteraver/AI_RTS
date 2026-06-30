import { useRef, useState } from 'react';
import type { GameState } from '@rts/shared';
import { WebSocketTransport } from './WebSocketTransport';
import { LoginScreen } from './LoginScreen';
import { GameView } from './GameView';

type Status = 'idle' | 'connecting' | 'auth_failed' | 'connected';

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const transportRef = useRef<WebSocketTransport | null>(null);

  const handleLogin = (password: string) => {
    setStatus('connecting');
    const t = new WebSocketTransport(password);
    transportRef.current = t;

    t.onStatus(s => {
      if (s === 'connected') setStatus('connected');
      else if (s === 'auth_failed') setStatus('auth_failed');
      else setStatus('idle');
    });

    t.onState(s => setGameState(s));
    t.connect();
  };

  if (status === 'connected' && gameState) {
    return <GameView state={gameState} />;
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
      isConnecting={status === 'connecting'}
      error={status === 'auth_failed' ? 'Wrong password' : undefined}
    />
  );
}
