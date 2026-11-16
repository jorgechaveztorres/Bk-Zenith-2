import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  AuthError, startRegistration, completeRegistration, login, refreshSession,
  logout, startPasswordReset, completePasswordReset, getUserById,
} from '../services/auth.service';
import { requireSession, SessionRequest } from '../middlewares/session.middleware';

const router = Router();

// Freno contra ataques de fuerza bruta (por IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Espera unos minutos.' },
});
router.use(authLimiter);

const device = (req: Request) => String(req.headers['user-agent'] || '').slice(0, 255);

const handle = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    console.error('[AUTH] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

// Registro (2 pasos)
router.post('/register/start', handle(async (req) => {
  await startRegistration(req.body?.phone);
  return { message: 'Te enviamos un código por SMS.' };
}));

router.post('/register/verify', handle((req) => completeRegistration({
  phone: req.body?.phone,
  code: req.body?.code,
  password: req.body?.password,
  fullName: req.body?.fullName,
  role: req.body?.role,
  deviceInfo: device(req),
})));

// Entrar con celular + clave
router.post('/login', handle((req) => login({
  phone: req.body?.phone,
  password: req.body?.password,
  deviceInfo: device(req),
})));

// Renovar sesión / salir
router.post('/refresh', handle((req) => refreshSession(req.body?.refreshToken)));
router.post('/logout', handle(async (req) => {
  await logout(req.body?.refreshToken);
  return {};
}));

// Olvidé mi clave (2 pasos)
router.post('/password/forgot', handle(async (req) => {
  await startPasswordReset(req.body?.phone);
  return { message: 'Si el celular está registrado, te llegará un código por SMS.' };
}));

router.post('/password/reset', handle((req) => completePasswordReset({
  phone: req.body?.phone,
  code: req.body?.code,
  newPassword: req.body?.newPassword,
  deviceInfo: device(req),
})));

// Quién soy
router.get('/me', requireSession, handle(async (req) => {
  const sub = (req as SessionRequest).session?.sub;
  const user = sub ? await getUserById(sub) : null;
  if (!user) throw new AuthError(404, 'Cuenta no encontrada.');
  return { user };
}));

export default router;
