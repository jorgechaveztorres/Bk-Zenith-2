import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError, AccessClaims } from '../services/auth.service';

/** Reemplazo de requireAuth (Firebase): valida el token propio de Zénith. */
export interface SessionRequest extends Request {
  session?: AccessClaims;
}

export const requireSession = (req: SessionRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });
  }
  try {
    req.session = verifyAccessToken(header.slice(7));
    next();
  } catch (err) {
    const status = err instanceof AuthError ? err.statusCode : 401;
    return res.status(status).json({ success: false, message: (err as Error).message });
  }
};

export const requireAppRole = (roles: Array<'passenger' | 'driver' | 'admin'>) =>
  (req: SessionRequest, res: Response, next: NextFunction) => {
    const s = req.session;
    if (!s) return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });
    const allowed = (s.adm && roles.includes('admin')) || roles.includes(s.role);
    if (!allowed) return res.status(403).json({ success: false, message: 'No tienes permiso para esto.' });
    next();
  };
