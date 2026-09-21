import express from 'express';
import { configureSecurity } from './middlewares/security.middleware';
import apiRoutes from './routes/index';

export const createApp = () => {
  const app = express();

  // 1. Parsing Middleware
  app.use(express.json({ limit: '1mb' })); // Body size limit to prevent payload attacks
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 2. Security Middleware
  configureSecurity(app);

  // 3. Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Zénith Enterprise Backend Running' });
  });

  // 4. API Routes
  app.use('/api', apiRoutes);

  return app;
};
