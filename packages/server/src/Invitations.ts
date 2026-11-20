import type { InviteeStatus } from '@rts/shared';
import type { Games } from './Games';
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

  constructor(
    private lobby: Lobby,
    private games: Games,
  ) {}

  // Involved in an open invitation: as its inviter, or as an invitee who
  // hasn't declined. This is what makes a lobby status 'preparing'.
  isPreparing = (username: string): boolean => {
    for (const invitation of this.invitations.values()) {
      if (invitation.inviter === username) return true;
      const status = invitation.invitees.get(username);
      if (status === 'pending' || status === 'accepted') return true;
    }
    return false;
  };

  // Online and not in a game.
  private isAvailable = (username: string): boolean =>
    this.lobby.hasPlayer(username) && !this.games.isPlaying(username);

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

    if (!this.isAvailable(inviter)) return;

    // A player has at most one outgoing invitation at a time. Cancelling the
    // old one first also makes its invitees idle (invitable) again.
    for (const [existingId, existing] of this.invitations) {
      if (existing.inviter === inviter) this.cancel(inviter, existingId);
    }

    // Only idle players can be invited: not in a game, and not already
    // involved in another invitation.
    const invitees = [...new Set(requestedInvitees)].filter(
      (username) =>
        username !== inviter &&
        this.isAvailable(username) &&
        !this.isPreparing(username),
    );
    if (invitees.length === 0) {
      // Tell the inviter's client to drop its pending invitation.
      this.lobby.sendTo(inviter, {
        type: 'invitation_cancelled',
        invitationId,
      });
      return;
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
    if (accepted && !this.isAvailable(invitee)) return;

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
  // accepted who is still available), removes it and returns the game's
  // players (inviter first). Otherwise returns null and leaves it untouched.
  claimForGame = (inviter: string, invitationId: string): string[] | null => {
    const invitation = this.invitations.get(invitationId);
    if (invitation?.inviter !== inviter || !this.isAvailable(inviter))
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
          status === 'accepted' && this.isAvailable(username),
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
