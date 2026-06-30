import type { GameState } from '@rts/shared';

export class GameLoop {
  private state: GameState = { tick: 0, timestamp: Date.now(), playerIds: [] };
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickCallbacks = new Set<(state: GameState) => void>();

  start(): void {
    this.intervalId = setInterval(() => {
      this.state = {
        tick: this.state.tick + 1,
        timestamp: Date.now(),
        playerIds: [...this.state.playerIds],
      };
      for (const callback of this.tickCallbacks) callback(this.state);
    }, 50); // 20 Hz
  }

  stop(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
  }

  onTick(callback: (state: GameState) => void): void {
    this.tickCallbacks.add(callback);
  }

  offTick(callback: (state: GameState) => void): void {
    this.tickCallbacks.delete(callback);
  }

  addPlayer(id: string): void {
    if (!this.state.playerIds.includes(id)) {
      this.state.playerIds.push(id);
    }
  }

  removePlayer(id: string): void {
    this.state.playerIds = this.state.playerIds.filter(p => p !== id);
  }

  getState(): GameState {
    return this.state;
  }
}
