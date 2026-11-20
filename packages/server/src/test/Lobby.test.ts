import { describe, expect, it } from 'vitest';
import { Lobby } from '../Lobby';
import { createFakeSocket } from './fixtures';

describe('Lobby', () => {
  it('tracks connected players in connection order', () => {
    const lobby = new Lobby();
    lobby.add('c1', 'alice', createFakeSocket().socket);
    lobby.add('c2', 'bob', createFakeSocket().socket);

    expect(lobby.usernames()).toEqual(['alice', 'bob']);
    expect(lobby.hasPlayer('alice')).toBe(true);
    expect(lobby.hasPlayer('carol')).toBe(false);
  });

  it('removes a player by connection id', () => {
    const lobby = new Lobby();
    lobby.add('c1', 'alice', createFakeSocket().socket);
    lobby.remove('c1');

    expect(lobby.hasPlayer('alice')).toBe(false);
    expect(lobby.usernames()).toEqual([]);
  });

  it('keeps a player present while another of their connections is open', () => {
    const lobby = new Lobby();
    lobby.add('tab-1', 'alice', createFakeSocket().socket);
    lobby.add('tab-2', 'alice', createFakeSocket().socket);
    lobby.remove('tab-1');

    expect(lobby.hasPlayer('alice')).toBe(true);
  });

  describe('sendTo', () => {
    it('delivers only to the addressed player', () => {
      const lobby = new Lobby();
      const alice = createFakeSocket();
      const bob = createFakeSocket();
      lobby.add('c1', 'alice', alice.socket);
      lobby.add('c2', 'bob', bob.socket);

      lobby.sendTo('alice', { type: 'error', message: 'hello' });

      expect(alice.sentMessages()).toEqual([
        { type: 'error', message: 'hello' },
      ]);
      expect(bob.sentMessages()).toEqual([]);
    });

    it('delivers to every open connection of that player', () => {
      const lobby = new Lobby();
      const firstTab = createFakeSocket();
      const secondTab = createFakeSocket();
      lobby.add('tab-1', 'alice', firstTab.socket);
      lobby.add('tab-2', 'alice', secondTab.socket);

      lobby.sendTo('alice', { type: 'welcome', username: 'alice' });

      expect(firstTab.sentMessages()).toHaveLength(1);
      expect(secondTab.sentMessages()).toHaveLength(1);
    });

    it('skips sockets that are no longer open', () => {
      const lobby = new Lobby();
      const alice = createFakeSocket();
      lobby.add('c1', 'alice', alice.socket);
      alice.close();

      lobby.sendTo('alice', { type: 'error', message: 'lost' });

      expect(alice.sentMessages()).toEqual([]);
    });

    it('does nothing for an unknown player', () => {
      const lobby = new Lobby();
      expect(() =>
        lobby.sendTo('nobody', { type: 'error', message: 'x' }),
      ).not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('sends the lobby state to every open connection', () => {
      const lobby = new Lobby();
      const alice = createFakeSocket();
      const bob = createFakeSocket();
      lobby.add('c1', 'alice', alice.socket);
      lobby.add('c2', 'bob', bob.socket);
      const state = {
        players: [
          { username: 'alice', status: 'idle' as const, avatarUrl: null },
        ],
      };

      lobby.broadcast(state);

      expect(alice.sentMessages()).toEqual([{ type: 'lobby_state', state }]);
      expect(bob.sentMessages()).toEqual([{ type: 'lobby_state', state }]);
    });

    it('skips closed sockets', () => {
      const lobby = new Lobby();
      const alice = createFakeSocket();
      const bob = createFakeSocket();
      lobby.add('c1', 'alice', alice.socket);
      lobby.add('c2', 'bob', bob.socket);
      bob.close();

      lobby.broadcast({ players: [] });

      expect(alice.sentMessages()).toHaveLength(1);
      expect(bob.sentMessages()).toHaveLength(0);
    });
  });
});
