import { randomUUID } from 'node:crypto';
import type { Lobby } from './Lobby';

// Tracks running games: which players are in which game. A player who is in a
// game has lobby status 'playing'; leaving puts them back to 'idle'.
// A game is removed once its last player has left.
export class Games {
  private games = new Map<string, Set<string>>();

  constructor(private lobby: Lobby) {}

  start = (players: string[]): void => {
    const gameId = randomUUID();
    this.games.set(gameId, new Set(players));
    for (const username of players) {
      this.lobby.setStatus(username, 'playing');
      this.lobby.sendTo(username, { type: 'game_started', gameId, players });
    }
    console.log(`game ${gameId} started with ${players.join(', ')}`);
  };

  // Returns true if the player was in a game.
  leave = (username: string): boolean => {
    for (const [gameId, players] of this.games) {
      if (!players.has(username)) continue;

      players.delete(username);
      this.lobby.setStatus(username, 'idle');
      const remainingPlayers = [...players];
      for (const remaining of remainingPlayers) {
        this.lobby.sendTo(remaining, {
          type: 'player_left_game',
          gameId,
          username,
          remainingPlayers,
        });
      }
      if (players.size === 0) this.games.delete(gameId);
      console.log(`${username} left game ${gameId}`);
      return true;
    }
    return false;
  };
}
