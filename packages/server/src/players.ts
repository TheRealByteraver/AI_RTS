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

function loadPlayers(): PlayerRecord[] {
  const raw = readFileSync(PLAYERS_FILE_PATH, 'utf-8');
  return PlayersFileSchema.parse(JSON.parse(raw));
}

const players = loadPlayers();

export function listPlayerNames(): string[] {
  return players.map(p => p.name);
}

export function findPlayer(name: string): PlayerRecord | undefined {
  return players.find(p => p.name === name);
}
