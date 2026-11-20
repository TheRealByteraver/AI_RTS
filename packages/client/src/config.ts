// Base URL of the game server's HTTP API (auth endpoints, avatar images).
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000';
