import { useState } from 'react';
import { PLAYER_NAMES } from './players';

interface Props {
  onLogin: (username: string, password: string) => void;
  isConnecting: boolean;
  error?: string;
}

function LoginScreen(props: Props) {
  // PROPS
  const { onLogin, isConnecting, error } = props;

  // STATE
  const [username, setUsername] = useState(PLAYER_NAMES[0] ?? '');
  const [password, setPassword] = useState('');

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
            <input
              list="players"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isConnecting}
            />
            <datalist id="players">
              {PLAYER_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>
        <div>
          <label>
            Password:{' '}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
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
      {error && <p>{error}</p>}
    </div>
  );
}

export { LoginScreen };
