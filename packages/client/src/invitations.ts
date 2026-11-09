import type { InvitationMessage, InviteeStatus } from '@rts/shared';

export type OutgoingInvitation = {
  invitationId: string;
  invitees: { username: string; status: InviteeStatus }[];
};

export type IncomingInvitation = {
  invitationId: string;
  inviter: string;
  invitees: string[];
};

export type InvitationsState = {
  // The invitation this player sent and is waiting on (at most one).
  outgoing: OutgoingInvitation | null;
  // Invitations this player received and hasn't answered yet, oldest first.
  incoming: IncomingInvitation[];
};

export type InvitationsAction =
  | InvitationMessage
  | { type: 'outgoing_sent'; invitationId: string; invitees: string[] }
  | { type: 'outgoing_cleared' }
  | { type: 'incoming_answered'; invitationId: string }
  | { type: 'reset' };

export const INITIAL_INVITATIONS_STATE: InvitationsState = {
  outgoing: null,
  incoming: [],
};

export const invitationsReducer = (
  state: InvitationsState,
  action: InvitationsAction,
): InvitationsState => {
  switch (action.type) {
    case 'outgoing_sent':
      // Optimistically show everyone as pending until the server's first status.
      return {
        ...state,
        outgoing: {
          invitationId: action.invitationId,
          invitees: action.invitees.map((username) => ({
            username,
            status: 'pending',
          })),
        },
      };
    case 'invitation_status':
      // Ignore status for an invitation this player has since cancelled.
      if (state.outgoing?.invitationId !== action.invitationId) return state;
      return {
        ...state,
        outgoing: {
          invitationId: action.invitationId,
          invitees: action.invitees,
        },
      };
    case 'invitation_received':
      if (
        state.incoming.some(
          (invitation) => invitation.invitationId === action.invitationId,
        )
      ) {
        return state;
      }
      return {
        ...state,
        incoming: [
          ...state.incoming,
          {
            invitationId: action.invitationId,
            inviter: action.inviter,
            invitees: action.invitees,
          },
        ],
      };
    case 'invitation_cancelled':
      return {
        outgoing:
          state.outgoing?.invitationId === action.invitationId
            ? null
            : state.outgoing,
        incoming: state.incoming.filter(
          (invitation) => invitation.invitationId !== action.invitationId,
        ),
      };
    case 'outgoing_cleared':
      return { ...state, outgoing: null };
    case 'incoming_answered':
      return {
        ...state,
        incoming: state.incoming.filter(
          (invitation) => invitation.invitationId !== action.invitationId,
        ),
      };
    case 'reset':
      return INITIAL_INVITATIONS_STATE;
  }
};
