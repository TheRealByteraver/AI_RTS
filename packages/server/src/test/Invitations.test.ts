import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixture, type Fixture } from './fixtures';

describe('Invitations', () => {
  let fixture: Fixture;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    fixture = createFixture(['alice', 'bob', 'carol', 'dave']);
  });

  describe('create', () => {
    it('notifies each invitee and reports all-pending status to the inviter', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob', 'carol']);

      expect(fixture.messagesFor('bob')).toEqual([
        {
          type: 'invitation_received',
          invitationId: 'inv-1',
          inviter: 'alice',
          invitees: ['bob', 'carol'],
        },
      ]);
      expect(fixture.messagesFor('alice')).toEqual([
        {
          type: 'invitation_status',
          invitationId: 'inv-1',
          invitees: [
            { username: 'bob', status: 'pending' },
            { username: 'carol', status: 'pending' },
          ],
        },
      ]);
    });

    it('marks the inviter and pending invitees as preparing, others not', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob']);

      expect(fixture.invitations.isPreparing('alice')).toBe(true);
      expect(fixture.invitations.isPreparing('bob')).toBe(true);
      expect(fixture.invitations.isPreparing('carol')).toBe(false);
    });

    it('rejects a reused invitation id with an error to the inviter', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob']);
      fixture.clearAllMessages();

      fixture.invitations.create('carol', 'inv-1', ['dave']);

      expect(fixture.messagesFor('carol')).toEqual([
        { type: 'error', message: 'Invitation id already in use' },
      ]);
      expect(fixture.messagesFor('dave')).toEqual([]);
    });

    it('ignores an inviter who is not in the lobby', () => {
      fixture.invitations.create('ghost', 'inv-1', ['bob']);

      expect(fixture.messagesFor('bob')).toEqual([]);
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
    });

    it('ignores an inviter who is already in a game', () => {
      fixture.games.start(['alice', 'dave']);
      fixture.clearAllMessages();

      fixture.invitations.create('alice', 'inv-1', ['bob']);

      expect(fixture.messagesFor('bob')).toEqual([]);
    });

    it('drops duplicates, the inviter themself and offline players', () => {
      fixture.invitations.create('alice', 'inv-1', [
        'bob',
        'bob',
        'alice',
        'ghost',
      ]);

      expect(fixture.messagesFor('bob')).toEqual([
        expect.objectContaining({
          type: 'invitation_received',
          invitees: ['bob'],
        }),
      ]);
    });

    it('skips players in a game or in another invitation', () => {
      fixture.games.start(['bob', 'dave']);
      fixture.invitations.create('carol', 'inv-other', ['alice']);
      fixture.clearAllMessages();

      fixture.invitations.create('alice', 'inv-1', ['bob', 'carol', 'dave']);

      // bob and dave are playing; carol is busy with her own invitation.
      expect(fixture.messagesFor('alice')).toEqual([
        { type: 'invitation_cancelled', invitationId: 'inv-1' },
      ]);
    });

    it('tells the inviter to drop the invitation when nobody can be invited', () => {
      fixture.invitations.create('alice', 'inv-1', ['ghost']);

      expect(fixture.messagesFor('alice')).toEqual([
        { type: 'invitation_cancelled', invitationId: 'inv-1' },
      ]);
      expect(fixture.invitations.isPreparing('alice')).toBe(false);
    });

    it('replaces the inviter previous invitation and frees its invitees', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob']);
      fixture.clearAllMessages();

      fixture.invitations.create('alice', 'inv-2', ['carol']);

      expect(fixture.messagesFor('bob')).toEqual([
        { type: 'invitation_cancelled', invitationId: 'inv-1' },
      ]);
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
      expect(fixture.invitations.isPreparing('carol')).toBe(true);
    });
  });

  describe('respond', () => {
    beforeEach(() => {
      fixture.invitations.create('alice', 'inv-1', ['bob', 'carol']);
      fixture.clearAllMessages();
    });

    it('reports an acceptance to the inviter', () => {
      fixture.invitations.respond('bob', 'inv-1', true);

      expect(fixture.messagesFor('alice')).toEqual([
        {
          type: 'invitation_status',
          invitationId: 'inv-1',
          invitees: [
            { username: 'bob', status: 'accepted' },
            { username: 'carol', status: 'pending' },
          ],
        },
      ]);
      expect(fixture.invitations.isPreparing('bob')).toBe(true);
    });

    it('frees an invitee who declines', () => {
      fixture.invitations.respond('bob', 'inv-1', false);

      expect(fixture.messagesFor('alice')).toEqual([
        expect.objectContaining({
          invitees: [
            { username: 'bob', status: 'declined' },
            { username: 'carol', status: 'pending' },
          ],
        }),
      ]);
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
    });

    it('ignores a second answer from the same invitee', () => {
      fixture.invitations.respond('bob', 'inv-1', false);
      fixture.clearAllMessages();

      fixture.invitations.respond('bob', 'inv-1', true);

      expect(fixture.messagesFor('alice')).toEqual([]);
    });

    it('ignores answers from players who were not invited or to unknown invitations', () => {
      fixture.invitations.respond('dave', 'inv-1', true);
      fixture.invitations.respond('bob', 'no-such-invitation', true);

      expect(fixture.messagesFor('alice')).toEqual([]);
    });

    it('does not let a player who is now in a game accept', () => {
      fixture.games.start(['bob', 'dave']);
      fixture.clearAllMessages();

      fixture.invitations.respond('bob', 'inv-1', true);

      expect(fixture.messagesFor('alice')).toEqual([]);
    });
  });

  describe('cancel', () => {
    it('notifies the invitees and removes the invitation', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob']);
      fixture.clearAllMessages();

      fixture.invitations.cancel('alice', 'inv-1');

      expect(fixture.messagesFor('bob')).toEqual([
        { type: 'invitation_cancelled', invitationId: 'inv-1' },
      ]);
      expect(fixture.invitations.isPreparing('alice')).toBe(false);
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
    });

    it('ignores a cancel from someone other than the inviter', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob']);
      fixture.clearAllMessages();

      fixture.invitations.cancel('bob', 'inv-1');

      expect(fixture.messagesFor('bob')).toEqual([]);
      expect(fixture.invitations.isPreparing('alice')).toBe(true);
    });
  });

  describe('claimForGame', () => {
    beforeEach(() => {
      fixture.invitations.create('alice', 'inv-1', ['bob', 'carol']);
      fixture.clearAllMessages();
    });

    it('refuses while an invitee has not answered yet', () => {
      fixture.invitations.respond('bob', 'inv-1', true);
      fixture.clearAllMessages();

      expect(fixture.invitations.claimForGame('alice', 'inv-1')).toBeNull();
      expect(fixture.messagesFor('alice')).toEqual([
        { type: 'error', message: 'Not every invited player has answered yet' },
      ]);
    });

    it('refuses when nobody accepted', () => {
      fixture.invitations.respond('bob', 'inv-1', false);
      fixture.invitations.respond('carol', 'inv-1', false);
      fixture.clearAllMessages();

      expect(fixture.invitations.claimForGame('alice', 'inv-1')).toBeNull();
      expect(fixture.messagesFor('alice')).toEqual([
        { type: 'error', message: 'No invited player accepted' },
      ]);
    });

    it('returns the inviter first, then everyone who accepted', () => {
      fixture.invitations.respond('bob', 'inv-1', false);
      fixture.invitations.respond('carol', 'inv-1', true);

      expect(fixture.invitations.claimForGame('alice', 'inv-1')).toEqual([
        'alice',
        'carol',
      ]);
    });

    it('consumes the invitation so it cannot be claimed twice', () => {
      fixture.invitations.respond('bob', 'inv-1', true);
      fixture.invitations.respond('carol', 'inv-1', true);

      expect(fixture.invitations.claimForGame('alice', 'inv-1')).not.toBeNull();
      expect(fixture.invitations.claimForGame('alice', 'inv-1')).toBeNull();
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
    });

    it('refuses a claim from someone other than the inviter', () => {
      fixture.invitations.respond('bob', 'inv-1', true);
      fixture.invitations.respond('carol', 'inv-1', true);

      expect(fixture.invitations.claimForGame('bob', 'inv-1')).toBeNull();
    });

    it('leaves out an accepted invitee who has since started playing', () => {
      fixture.invitations.respond('bob', 'inv-1', true);
      fixture.invitations.respond('carol', 'inv-1', true);
      fixture.games.start(['bob', 'dave']);

      expect(fixture.invitations.claimForGame('alice', 'inv-1')).toEqual([
        'alice',
        'carol',
      ]);
    });
  });

  describe('withdrawPlayer', () => {
    it('cancels the invitations of a player who leaves', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob']);
      fixture.clearAllMessages();

      fixture.invitations.withdrawPlayer('alice');

      expect(fixture.messagesFor('bob')).toEqual([
        { type: 'invitation_cancelled', invitationId: 'inv-1' },
      ]);
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
    });

    it('turns a leaving invitee into a decline, even after they accepted', () => {
      fixture.invitations.create('alice', 'inv-1', ['bob', 'carol']);
      fixture.invitations.respond('bob', 'inv-1', true);
      fixture.clearAllMessages();

      fixture.invitations.withdrawPlayer('bob');

      expect(fixture.messagesFor('alice')).toEqual([
        expect.objectContaining({
          type: 'invitation_status',
          invitees: [
            { username: 'bob', status: 'declined' },
            { username: 'carol', status: 'pending' },
          ],
        }),
      ]);
      expect(fixture.invitations.isPreparing('bob')).toBe(false);
    });
  });
});
