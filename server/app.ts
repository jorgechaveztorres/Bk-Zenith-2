import express, { Router } from 'express';
import { configureSecurity } from './middlewares/security.middleware';
import apiRoutes from './routes/index';

export const createApp = () => {
  const app = express();

  // Detrás del proxy de LiteSpeed/cPanel: necesario para leer la IP real (límite de intentos).
  app.set('trust proxy', 1);

  // 1. Parsing Middleware
  app.use(express.json({ limit: '1mb' })); // Body size limit to prevent payload attacks
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 2. Security Middleware
  configureSecurity(app);

  const api = Router();

  // 3. Health Check
  api.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Zénith Enterprise Backend Running' });
  });

  // 4. API Routes
  api.use('/api', apiRoutes);

  // En cPanel la app vive en una subcarpeta (ej. /zenith-api) y LiteSpeed entrega
  // la ruta completa. BASE_PATH permite responder en /zenith-api/api/... y en /api/...
  const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  if (basePath) app.use(basePath, api);
  app.use(api);

  return app;
};
