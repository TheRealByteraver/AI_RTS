import type { GameState } from '@rts/shared';

interface Props {
  state: GameState;
}

export function GameView({ state }: Props) {
  return (
    <div style={{ padding: 32, fontFamily: 'monospace' }}>
      <h2>Connected — tick {state.tick}</h2>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
