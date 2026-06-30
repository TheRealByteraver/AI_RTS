import { useState } from 'react';

interface Props {
  onLogin: (password: string) => void;
  isConnecting: boolean;
  error?: string;
}

export function LoginScreen({ onLogin, isConnecting, error }: Props) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div style={{ padding: 32 }}>
      <h1>RTS Engine</h1>
      <form onSubmit={handleSubmit}>
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
        <button type="submit" disabled={isConnecting || !password}>
          {isConnecting ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
