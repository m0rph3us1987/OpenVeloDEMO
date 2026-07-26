import cors from 'cors';
import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.use(
    cors({
      origin: webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
}