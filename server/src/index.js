import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.routes.js';
import postsRoutes from './routes/posts.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
