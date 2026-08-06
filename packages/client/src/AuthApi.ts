const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

interface PlayersResponse {
  players: string[];
}

interface ErrorResponse {
  error?: string;
}

export const fetchPlayerNames = async (): Promise<string[]> => {
  const response = await fetch(`${API_URL}/auth/players`, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to load player list');
  const data = (await response.json()) as PlayersResponse;
  return data.players;
};

export const login = async (
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ErrorResponse | null;
    return { ok: false, error: data?.error ?? 'Login failed' };
  }

  return { ok: true };
};

export const logout = async (): Promise<void> => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
};
