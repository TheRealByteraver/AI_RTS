import { z } from 'zod';

const PingCommandSchema = z.object({
  type: z.literal('PING'),
});

// The client picks the invitationId so it can cancel the invitation (and
// ignore stale replies) without waiting for a server round trip first.
const InvitePlayersCommandSchema = z.object({
  type: z.literal('invite_players'),
  invitationId: z.string().uuid(),
  invitees: z.array(z.string().min(1)).min(1),
});

const RespondToInvitationCommandSchema = z.object({
  type: z.literal('respond_to_invitation'),
  invitationId: z.string().min(1),
  accepted: z.boolean(),
});

const CancelInvitationCommandSchema = z.object({
  type: z.literal('cancel_invitation'),
  invitationId: z.string().min(1),
});

// Only the inviter can start, once every invitee answered and at least one accepted.
const StartGameCommandSchema = z.object({
  type: z.literal('start_game'),
  invitationId: z.string().min(1),
});

// The server knows which game the sender is in, so no gameId is needed.
const LeaveGameCommandSchema = z.object({
  type: z.literal('leave_game'),
});

export const ClientCommandSchema = z.discriminatedUnion('type', [
  PingCommandSchema,
  InvitePlayersCommandSchema,
  RespondToInvitationCommandSchema,
  CancelInvitationCommandSchema,
  StartGameCommandSchema,
  LeaveGameCommandSchema,
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;
