import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { bootstrap } from '../scripts/ensure-db.mjs';
import { seed, shouldAutoSeed } from './seed.js';

const target = await bootstrap();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = target.url;
}

const prisma = new PrismaClient();

const [ingCount, recCount] = await Promise.all([
  prisma.ingredient.count(),
  prisma.recipe.count(),
]);
if (shouldAutoSeed({ ingredientCount: ingCount, recipeCount: recCount })) {
  await seed(prisma);
}

const port = Number(process.env.PORT ?? 3001);
const app = createApp(prisma);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});