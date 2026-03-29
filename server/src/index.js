import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.routes.js';
import postsRoutes from './routes/posts.routes.js';
import usersRoutes from './routes/users.routes.js';
import { getFeed } from './controllers/posts.controller.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:19006'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.get('/api/feed', getFeed);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
