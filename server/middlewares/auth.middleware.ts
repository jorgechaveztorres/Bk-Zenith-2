import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
    isAdmin?: boolean;
    [key: string]: any;
  };
}

/**
 * This email is already the explicitly configured administrator in firestore.rules.
 * Keep the server-side allowlist aligned with that existing policy.
 */
const ADMIN_EMAILS = new Set(['bkheelsec@gmail.com']);

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No se proporcionó token de autenticación.' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token || !auth) {
      return res.status(401).json({ success: false, message: 'Servicio de autenticación no disponible.' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: typeof decodedToken.role === 'string' ? decodedToken.role : undefined,
      isAdmin: decodedToken.isAdmin === true
    };

    return next();
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Error verificando token:', error);
    return res.status(401).json({ success: false, message: 'Token de autenticación inválido o expirado.' });
  }
};

/**
 * Enforces authorization instead of merely logging missing roles.
 * Role claims are trusted only after Firebase Admin verifies the ID token.
 * For legacy users without custom claims, the server reads the protected profile.
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user?.uid) {
        return res.status(401).json({ success: false, message: 'No autenticado.' });
      }

      // The allowlist is checked against the email from a verified Firebase ID token.
      const isAllowlistedAdmin = !!user.email && ADMIN_EMAILS.has(user.email.toLowerCase());
      let profile: Record<string, any> = {};

      if (!isAllowlistedAdmin && db) {
        const profileSnap = await db.collection('users').doc(user.uid).get();
        if (profileSnap.exists) profile = profileSnap.data() || {};
      }

      const isAdmin = isAllowlistedAdmin ||
        user.isAdmin === true ||
        user.role === 'admin' ||
        profile.isAdmin === true ||
        profile.role === 'admin';

      const effectiveRole = isAdmin ? 'admin' : (user.role || profile.role);
      const permitted = allowedRoles.includes('any') ||
        (isAdmin && allowedRoles.includes('admin')) ||
        (!!effectiveRole && allowedRoles.includes(effectiveRole));

      if (!permitted) {
        return res.status(403).json({ success: false, message: 'Permisos insuficientes para realizar esta operación.' });
      }

      return next();
    } catch (error) {
      console.error('[AUTH_MIDDLEWARE] Error comprobando permisos:', error);
      return res.status(503).json({ success: false, message: 'No se pudieron verificar los permisos. Operación bloqueada.' });
    }
  };
};
