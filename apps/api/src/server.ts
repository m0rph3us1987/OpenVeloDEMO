import { createApp } from './app.js';
import { bootstrap } from '../scripts/ensure-db.mjs';

const target = await bootstrap();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = target.url;
}

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
