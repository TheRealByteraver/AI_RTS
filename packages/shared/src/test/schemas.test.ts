import { describe, expect, it } from 'vitest';
import {
  ClientCommandSchema,
  LobbyStateSchema,
  ServerMessageSchema,
} from '../index';

const validUuid = '3f2b8c1e-6a4d-4f7e-9b1a-2c5d7e8f9a0b';

describe('ClientCommandSchema', () => {
  it.each([
    { type: 'PING' },
    { type: 'invite_players', invitationId: validUuid, invitees: ['bob'] },
    { type: 'respond_to_invitation', invitationId: 'inv-1', accepted: true },
    { type: 'cancel_invitation', invitationId: 'inv-1' },
    { type: 'start_game', invitationId: 'inv-1' },
    { type: 'leave_game' },
  ])('accepts a valid $type command', (command) => {
    expect(ClientCommandSchema.safeParse(command).success).toBe(true);
  });

  it.each([
    ['an unknown type', { type: 'launch_nukes' }],
    ['a missing type', {}],
    ['a non-object', 'PING'],
    [
      'a non-uuid invitationId on invite_players',
      { type: 'invite_players', invitationId: 'inv-1', invitees: ['bob'] },
    ],
    [
      'an empty invitee list',
      { type: 'invite_players', invitationId: validUuid, invitees: [] },
    ],
    [
      'an empty invitee name',
      { type: 'invite_players', invitationId: validUuid, invitees: [''] },
    ],
    [
      'a non-boolean accepted flag',
      {
        type: 'respond_to_invitation',
        invitationId: 'inv-1',
        accepted: 'yes',
      },
    ],
    ['an empty invitationId', { type: 'cancel_invitation', invitationId: '' }],
    ['a missing invitationId', { type: 'start_game' }],
  ])('rejects %s', (_description, command) => {
    expect(ClientCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('LobbyStateSchema', () => {
  it('accepts players with and without an avatar', () => {
    const state = {
      players: [
        { username: 'alice', status: 'idle', avatarUrl: '/avatars/alice.svg' },
        { username: 'bob', status: 'playing', avatarUrl: null },
      ],
    };
    expect(LobbyStateSchema.safeParse(state).success).toBe(true);
  });

  it('rejects an unknown player status', () => {
    const state = {
      players: [{ username: 'alice', status: 'afk', avatarUrl: null }],
    };
    expect(LobbyStateSchema.safeParse(state).success).toBe(false);
  });

  it('rejects a player without an avatarUrl field', () => {
    const state = { players: [{ username: 'alice', status: 'idle' }] };
    expect(LobbyStateSchema.safeParse(state).success).toBe(false);
  });
});

describe('ServerMessageSchema', () => {
  it.each([
    { type: 'welcome', username: 'alice' },
    { type: 'lobby_state', state: { players: [] } },
    { type: 'error', message: 'nope' },
    {
      type: 'invitation_received',
      invitationId: 'inv-1',
      inviter: 'alice',
      invitees: ['bob'],
    },
    {
      type: 'invitation_status',
      invitationId: 'inv-1',
      invitees: [{ username: 'bob', status: 'pending' }],
    },
    { type: 'invitation_cancelled', invitationId: 'inv-1' },
    { type: 'game_started', gameId: 'game-1', players: ['alice', 'bob'] },
    {
      type: 'player_left_game',
      gameId: 'game-1',
      username: 'bob',
      remainingPlayers: ['alice'],
    },
  ])('accepts a valid $type message', (message) => {
    expect(ServerMessageSchema.safeParse(message).success).toBe(true);
  });

  it.each([
    ['an unknown type', { type: 'gossip' }],
    [
      'an invalid invitee status',
      {
        type: 'invitation_status',
        invitationId: 'inv-1',
        invitees: [{ username: 'bob', status: 'maybe' }],
      },
    ],
    ['a welcome without a username', { type: 'welcome' }],
    [
      'a lobby_state with a malformed state',
      { type: 'lobby_state', state: { players: 'alice' } },
    ],
  ])('rejects %s', (_description, message) => {
    expect(ServerMessageSchema.safeParse(message).success).toBe(false);
  });
});
