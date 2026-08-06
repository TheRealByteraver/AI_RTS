const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

interface PlayersResponse {
  players: string[];
}

interface ErrorResponse {
  error?: string;
}

export async function fetchPlayerNames(): Promise<string[]> {
  const res = await fetch(`${API_URL}/auth/players`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load player list');
  const data = (await res.json()) as PlayersResponse;
  return data.players;
}

export async function login(
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ErrorResponse | null;
    return { ok: false, error: data?.error ?? 'Login failed' };
  }

  return { ok: true };
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}
