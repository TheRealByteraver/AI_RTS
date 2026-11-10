import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const PlayerRecordSchema = z.object({
  name: z.string().min(1),
  // File name of the player's headshot in AVATARS_DIRECTORY. Restricted to a
  // plain file name so it can't point outside that folder.
  avatar: z.string().regex(/^[\w-]+\.svg$/),
  passwordHash: z.string().min(1),
});

const PlayersFileSchema = z.array(PlayerRecordSchema);

export type PlayerRecord = z.infer<typeof PlayerRecordSchema>;

const PLAYERS_FILE_PATH = join(__dirname, '../../../players.json');

export const AVATARS_DIRECTORY = join(__dirname, '../../../data/avatars');

// URL path (relative to the server origin) the client loads an avatar from.
export const AVATARS_URL_PATH = '/avatars';

const loadPlayers = (): PlayerRecord[] => {
  const rawPlayersFile = readFileSync(PLAYERS_FILE_PATH, 'utf-8');
  return PlayersFileSchema.parse(JSON.parse(rawPlayersFile));
};

const players = loadPlayers();

export const findPlayer = (name: string): PlayerRecord | undefined => {
  return players.find(player => player.name === name);
};

export const avatarUrlFor = (name: string): string | null => {
  const player = findPlayer(name);
  return player ? `${AVATARS_URL_PATH}/${player.avatar}` : null;
};
