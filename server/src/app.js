import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import feedRoutes from './routes/feed.routes.js';
import postsRoutes from './routes/posts.routes.js';
import safetyRoutes from './routes/safety.routes.js';
import statsRoutes from './routes/stats.routes.js';
import usersRoutes from './routes/users.routes.js';

const DEFAULT_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

export function createApp() {
  const app = express();

  // Behind Railway's proxy; needed for req.ip in the IP rate limiter.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;

  // Native apps send no Origin header and are unaffected; this only governs browsers.
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ['Authorization', 'Content-Type'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(express.json({ limit: '50kb' }));

  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

  app.use('/api/auth', authRoutes);
  app.use('/api/feed', feedRoutes);
  app.use('/api/posts', postsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api', statsRoutes);
  app.use('/api', safetyRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
