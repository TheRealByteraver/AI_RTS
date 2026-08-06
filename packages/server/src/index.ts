import 'dotenv/config';
import { GameServer } from './GameServer';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

new GameServer(PORT, CLIENT_ORIGIN);

console.log('RTS server started. Press Ctrl+C to stop.');
