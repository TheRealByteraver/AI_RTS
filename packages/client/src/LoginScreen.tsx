import { useState } from 'react';
import { PLAYER_NAMES } from './players';

interface Props {
  onLogin: (username: string, password: string) => void;
  isConnecting: boolean;
  error?: string;
}

// Keeps the field in the DOM and focusable-by-the-browser (so password
// managers still see and fill it) while hiding it from sighted users.
// display:none / visibility:hidden are avoided because some browsers skip
// autofill for elements hidden that way.
const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

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
            <select
              name="player-select"
              value={PLAYER_NAMES.includes(username) ? username : ''}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isConnecting}
            >
              <option value="">-- choose player --</option>
              {PLAYER_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={isConnecting}
          aria-hidden="true"
          tabIndex={-1}
          style={VISUALLY_HIDDEN_STYLE}
        />
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
