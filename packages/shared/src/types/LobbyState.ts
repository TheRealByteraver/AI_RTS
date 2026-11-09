import { z } from 'zod';

// 'idle': in the lobby, free to be invited. 'playing': in a game.
export const PlayerStatusSchema = z.enum(['idle', 'playing']);

export type PlayerStatus = z.infer<typeof PlayerStatusSchema>;

export const LobbyPlayerSchema = z.object({
  username: z.string(),
  status: PlayerStatusSchema,
});

export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;

export const LobbyStateSchema = z.object({
  players: z.array(LobbyPlayerSchema),
});

export type LobbyState = z.infer<typeof LobbyStateSchema>;
