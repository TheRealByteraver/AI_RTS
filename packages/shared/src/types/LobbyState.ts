import { z } from 'zod';

// 'idle': in the lobby, free to be invited.
// 'preparing': involved in an open invitation — waiting for others to answer
//   their invitation, or invited and not (yet) declined.
// 'playing': in a game.
export const PlayerStatusSchema = z.enum(['idle', 'preparing', 'playing']);

export type PlayerStatus = z.infer<typeof PlayerStatusSchema>;

export const LobbyPlayerSchema = z.object({
  username: z.string(),
  status: PlayerStatusSchema,
  // Path on the game server (e.g. "/avatars/name.svg"); null if unknown.
  avatarUrl: z.string().nullable(),
});

export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;

export const LobbyStateSchema = z.object({
  players: z.array(LobbyPlayerSchema),
});

export type LobbyState = z.infer<typeof LobbyStateSchema>;
