import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findPlayer } from './players';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const JWT_SECRET: string = requireEnv('JWT_SECRET_KEY');

export const AUTH_COOKIE_NAME = 'rts_token';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const AUTH_COOKIE_MAX_AGE_MS = TOKEN_TTL_SECONDS * 1000;

export interface TokenPayload {
  username: string;
}

export const verifyCredentials = async (username: string, password: string): Promise<boolean> => {
  const player = findPlayer(username);
  if (!player) return false;
  return bcrypt.compare(password, player.passwordHash);
};

export const signToken = (username: string): string => {
  return jwt.sign({ username }, JWT_SECRET, { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS });
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.username === 'string') {
      return { username: decoded.username };
    }
    return null;
  } catch {
    return null;
  }
};
