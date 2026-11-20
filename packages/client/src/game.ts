// The game this player is currently in, as far as the client knows.
export type ActiveGame = {
  gameId: string;
  // Everyone who started the game, in the order the server sent them.
  players: string[];
  // Who is still in the game, including this player.
  remainingPlayers: string[];
};
