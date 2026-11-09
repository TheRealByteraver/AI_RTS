import { z } from 'zod';
import { LobbyStateSchema } from './LobbyState';

export const InviteeStatusSchema = z.enum(['pending', 'accepted', 'declined']);

export type InviteeStatus = z.infer<typeof InviteeStatusSchema>;

// Sent to the inviter whenever their invitation changes (created, or an
// invitee replied / left). Carries the full status list rather than a delta,
// in line with the full-state-every-time networking strategy.
const InvitationStatusMessageSchema = z.object({
  type: z.literal('invitation_status'),
  invitationId: z.string(),
  invitees: z.array(
    z.object({
      username: z.string(),
      status: InviteeStatusSchema,
    }),
  ),
});

// Sent to each invitee when an invitation is created.
const InvitationReceivedMessageSchema = z.object({
  type: z.literal('invitation_received'),
  invitationId: z.string(),
  inviter: z.string(),
  invitees: z.array(z.string()),
});

// Sent to every invitee when the inviter cancels or leaves the lobby, and to
// the inviter when the server could not create the invitation at all.
const InvitationCancelledMessageSchema = z.object({
  type: z.literal('invitation_cancelled'),
  invitationId: z.string(),
});

export const InvitationMessageSchema = z.discriminatedUnion('type', [
  InvitationStatusMessageSchema,
  InvitationReceivedMessageSchema,
  InvitationCancelledMessageSchema,
]);

export type InvitationMessage = z.infer<typeof InvitationMessageSchema>;

// Sent to every player of a newly started game (the inviter plus everyone
// who accepted the invitation).
const GameStartedMessageSchema = z.object({
  type: z.literal('game_started'),
  gameId: z.string(),
  players: z.array(z.string()),
});

// Sent to the players still in a game when someone leaves it (by choice or
// by disconnecting). remainingPlayers includes the recipient.
const PlayerLeftGameMessageSchema = z.object({
  type: z.literal('player_left_game'),
  gameId: z.string(),
  username: z.string(),
  remainingPlayers: z.array(z.string()),
});

export const GameMessageSchema = z.discriminatedUnion('type', [
  GameStartedMessageSchema,
  PlayerLeftGameMessageSchema,
]);

export type GameMessage = z.infer<typeof GameMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), username: z.string() }),
  z.object({ type: z.literal('lobby_state'), state: LobbyStateSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
  ...InvitationMessageSchema.options,
  ...GameMessageSchema.options,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
