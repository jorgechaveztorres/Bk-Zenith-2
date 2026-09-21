import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express } from 'express';

export const configureSecurity = (app: Express) => {
  // 1. HTTP Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disabling temporarily if it breaks Vite HMR in dev
  }));

  // 2. CORS
  // Restrict to known origins in production
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || '*' : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // 3. Rate Limiting (General)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true, 
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas solicitudes, intente de nuevo más tarde.' }
  });
  app.use('/api', limiter);
  
  // Specific stricter rate limiter for sensitive endpoints like payments
  const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Límite de intentos de pago excedido.' }
  });
  app.use('/api/payments', paymentLimiter);
  app.use('/api/settlements', paymentLimiter);
};
