import type { InviteeStatus } from '@rts/shared';
import type { Lobby } from './Lobby';

interface Invitation {
  inviter: string;
  // Insertion order = order the inviter listed the invitees.
  invitees: Map<string, InviteeStatus>;
}

// Tracks open game invitations and relays them between inviter and invitees.
// Invitations live only in memory and only while the inviter is connected.
export class Invitations {
  private invitations = new Map<string, Invitation>();

  constructor(private lobby: Lobby) {}

  create = (
    inviter: string,
    invitationId: string,
    requestedInvitees: string[],
  ): void => {
    if (this.invitations.has(invitationId)) {
      this.lobby.sendTo(inviter, {
        type: 'error',
        message: 'Invitation id already in use',
      });
      return;
    }

    if (!this.lobby.isIdle(inviter)) return;

    // Only players sitting idle in the lobby can be invited.
    const invitees = [...new Set(requestedInvitees)].filter(
      (username) => username !== inviter && this.lobby.isIdle(username),
    );
    if (invitees.length === 0) {
      // Tell the inviter's client to drop its pending invitation.
      this.lobby.sendTo(inviter, {
        type: 'invitation_cancelled',
        invitationId,
      });
      return;
    }

    // A player has at most one outgoing invitation at a time.
    for (const [existingId, existing] of this.invitations) {
      if (existing.inviter === inviter) this.cancel(inviter, existingId);
    }

    const invitation: Invitation = {
      inviter,
      invitees: new Map(invitees.map((username) => [username, 'pending'])),
    };
    this.invitations.set(invitationId, invitation);

    for (const username of invitees) {
      this.lobby.sendTo(username, {
        type: 'invitation_received',
        invitationId,
        inviter,
        invitees,
      });
    }
    this.sendStatus(invitationId, invitation);
    console.log(`${inviter} invited ${invitees.join(', ')} (${invitationId})`);
  };

  respond = (
    invitee: string,
    invitationId: string,
    accepted: boolean,
  ): void => {
    const invitation = this.invitations.get(invitationId);
    if (invitation?.invitees.get(invitee) !== 'pending') return;
    if (accepted && !this.lobby.isIdle(invitee)) return;

    invitation.invitees.set(invitee, accepted ? 'accepted' : 'declined');
    this.sendStatus(invitationId, invitation);
    console.log(
      `${invitee} ${accepted ? 'accepted' : 'declined'} invitation ${invitationId}`,
    );
  };

  cancel = (inviter: string, invitationId: string): void => {
    const invitation = this.invitations.get(invitationId);
    if (invitation?.inviter !== inviter) return;

    this.invitations.delete(invitationId);
    for (const username of invitation.invitees.keys()) {
      this.lobby.sendTo(username, {
        type: 'invitation_cancelled',
        invitationId,
      });
    }
    console.log(`${inviter} cancelled invitation ${invitationId}`);
  };

  // If the invitation is ready to start (every invitee answered, at least one
  // accepted who is still idle), removes it and returns the game's players
  // (inviter first). Otherwise returns null and leaves it untouched.
  claimForGame = (inviter: string, invitationId: string): string[] | null => {
    const invitation = this.invitations.get(invitationId);
    if (invitation?.inviter !== inviter || !this.lobby.isIdle(inviter))
      return null;

    if ([...invitation.invitees.values()].includes('pending')) {
      this.lobby.sendTo(inviter, {
        type: 'error',
        message: 'Not every invited player has answered yet',
      });
      return null;
    }

    const accepted = [...invitation.invitees]
      .filter(
        ([username, status]) =>
          status === 'accepted' && this.lobby.isIdle(username),
      )
      .map(([username]) => username);
    if (accepted.length === 0) {
      this.lobby.sendTo(inviter, {
        type: 'error',
        message: 'No invited player accepted',
      });
      return null;
    }

    this.invitations.delete(invitationId);
    return [inviter, ...accepted];
  };

  // Called when a player stops being available for invitations: they left the
  // lobby or started playing. Their own invitations are cancelled, and they
  // count as having declined every invitation they were part of, even ones
  // they had already accepted, so no other inviter can start a game with them.
  withdrawPlayer = (username: string): void => {
    for (const [invitationId, invitation] of this.invitations) {
      if (invitation.inviter === username) {
        this.cancel(username, invitationId);
        continue;
      }
      const status = invitation.invitees.get(username);
      if (status === 'pending' || status === 'accepted') {
        invitation.invitees.set(username, 'declined');
        this.sendStatus(invitationId, invitation);
      }
    }
  };

  private sendStatus = (invitationId: string, invitation: Invitation): void => {
    this.lobby.sendTo(invitation.inviter, {
      type: 'invitation_status',
      invitationId,
      invitees: [...invitation.invitees].map(([username, status]) => ({
        username,
        status,
      })),
    });
  };
}
