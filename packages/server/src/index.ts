import { GameLoop } from './GameLoop';
import { GameServer } from './GameServer';

const PORT = Number(process.env.PORT ?? 3000);

const loop = new GameLoop();
new GameServer(PORT, loop);
loop.start();

console.log('RTS server started. Press Ctrl+C to stop.');
