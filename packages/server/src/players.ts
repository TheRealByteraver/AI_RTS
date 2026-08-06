import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const PlayerRecordSchema = z.object({
  name: z.string().min(1),
  passwordHash: z.string().min(1),
});

const PlayersFileSchema = z.array(PlayerRecordSchema);

export type PlayerRecord = z.infer<typeof PlayerRecordSchema>;

const PLAYERS_FILE_PATH = join(__dirname, '../../../players.json');

const loadPlayers = (): PlayerRecord[] => {
  const rawPlayersFile = readFileSync(PLAYERS_FILE_PATH, 'utf-8');
  return PlayersFileSchema.parse(JSON.parse(rawPlayersFile));
};

const players = loadPlayers();

export const listPlayerNames = (): string[] => {
  return players.map(player => player.name);
};

export const findPlayer = (name: string): PlayerRecord | undefined => {
  return players.find(player => player.name === name);
};
