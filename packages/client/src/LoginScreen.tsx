import { useEffect, useState } from 'react';
import { fetchPlayerNames } from './AuthApi';

interface Props {
  onLogin: (username: string, password: string) => void;
  isConnecting: boolean;
  error?: string;
}

export function LoginScreen({ onLogin, isConnecting, error }: Props) {
  const [players, setPlayers] = useState<string[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    fetchPlayerNames()
      .then(names => {
        setPlayers(names);
        setUsername(current => current || names[0] || '');
      })
      .catch(() => setLoadError('Could not load player list'));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    onLogin(username, password);
  };

  return (
    <div>
      <h1>RTS Engine</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Player:{' '}
            <select
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isConnecting || players.length === 0}
            >
              {players.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Password:{' '}
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isConnecting}
              autoFocus
            />
          </label>
        </div>
        <br />
        <button type="submit" disabled={isConnecting || !username || !password}>
          {isConnecting ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {loadError && <p>{loadError}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}
