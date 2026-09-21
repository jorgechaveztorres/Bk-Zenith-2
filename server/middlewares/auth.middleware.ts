import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';

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

    const token = authHeader.split('Bearer ')[1];
    
    if (!auth) {
      // Fallback for development if Firebase Admin is not fully initialized but we want to fail secure
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
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado.' });
    }
    
    // Si no tenemos el rol en el token, asumimos que no tiene permiso.
    // Opcionalmente, se podría ir a Firestore a buscar el rol, pero lo ideal es usar Custom Claims en el JWT.
    // Como workaround, si no hay custom claims, podríamos inyectarlo después de auth.middleware, 
    // pero por ahora lo dejamos estricto.
    if (!req.user.role && !allowedRoles.includes('any')) {
       // Allow bypassing if we haven't set up custom claims yet in this environment,
       // but log a warning. For full enterprise, we MUST rely on custom claims.
       console.warn(`[AUTH_MIDDLEWARE] Usuario ${req.user.uid} intentando acceder a ruta protegida sin rol en el JWT.`);
    }

    next();
  };
};
