import { useEffect, useState } from 'react';
import { fetchPlayerNames } from './AuthApi';

interface Props {
  onLogin: (username: string, password: string) => void;
  isConnecting: boolean;
  error?: string;
}

function LoginScreen(props: Props) {
  // PROPS
  const { onLogin, isConnecting, error } = props;

  // STATE
  const [players, setPlayers] = useState<string[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadError, setLoadError] = useState<string | undefined>();

  // EFFECTS
  useEffect(() => {
    fetchPlayerNames()
      .then((names) => {
        setPlayers(names);
        setUsername((current) => current || names[0] || '');
      })
      .catch(() => setLoadError('Could not load player list'));
  }, []);

  // METHODS
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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
              onChange={(event) => setUsername(event.target.value)}
              disabled={isConnecting || players.length === 0}
            >
              {players.map((name) => (
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
              onChange={(event) => setPassword(event.target.value)}
              disabled={isConnecting}
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

export { LoginScreen };
