import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
    [key: string]: any;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No se proporcionó token de autenticación (Zero-Trust).' });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!auth) {
      return res.status(500).json({ success: false, message: 'Servicio de autenticación no disponible.' });
    }

    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role,
    };

    next();
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Error verificando token:', error);
    return res.status(401).json({ success: false, message: 'Token de autenticación inválido o expirado.' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado.' });
    }

    if (allowedRoles.includes('any')) {
      return next();
    }

    let role = req.user.role;

    // Firestore is the server-side role authority used by the security rules.
    // This fallback keeps the API secure when Firebase Custom Claims are not
    // present yet, without granting access merely because a role is missing.
    if (!role && db) {
      try {
        const userSnap = await db.collection('users').doc(req.user.uid).get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          if (userData?.isAdmin === true) {
            role = 'admin';
          } else if (typeof userData?.role === 'string') {
            role = userData.role;
          }
          req.user.role = role;
        }
      } catch (error) {
        console.error('[AUTH_MIDDLEWARE] Error consultando rol en Firestore:', error);
        return res.status(503).json({ success: false, message: 'No se pudo verificar el rol de acceso.' });
      }
    }

    if (!role || !allowedRoles.includes(role)) {
      console.warn(
        `[AUTH_MIDDLEWARE] Acceso denegado para usuario ${req.user.uid}. Rol: ${role || 'sin-rol'}. Roles permitidos: ${allowedRoles.join(', ')}`
      );
      return res.status(403).json({ success: false, message: 'No tiene permisos para realizar esta operación.' });
    }

    next();
  };
};
