import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express, Request, Response, NextFunction, RequestHandler } from 'express';

// Aplica el límite también cuando la app vive bajo una subcarpeta (BASE_PATH), ej. /zenith-api/api/...
const onPath = (segment: string, handler: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    req.path.includes(segment) ? handler(req, res, next) : next();

export const configureSecurity = (app: Express) => {
  // 1. HTTP Security Headers
  // Frameguard and COOP/COEP must be disabled so the applet renders in the AI Studio iframe preview
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }));

  // 2. CORS
  // Restrict to known origins in production
  // FRONTEND_URL admite varias direcciones separadas por coma. La app Android (Capacitor)
  // llama desde https://localhost, así que ese origen se acepta siempre.
  const allowed = (process.env.FRONTEND_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origins = allowed.length ? [...allowed, 'https://localhost', 'capacitor://localhost', 'http://localhost'] : '*';
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? origins : '*',
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
  app.use(onPath('/api/', limiter));
  
  // Specific stricter rate limiter for sensitive endpoints like payments
  const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Límite de intentos de pago excedido.' }
  });
  app.use(onPath('/api/payments', paymentLimiter));
  app.use(onPath('/api/settlements', paymentLimiter));
};
