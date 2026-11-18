import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { requireSession, requireAppRole, SessionRequest } from '../middlewares/session.middleware';
import { DriverDocumentsService, DocumentKind, UPLOAD_ROOT } from '../services/driver-documents.service';
import { HttpError } from '../services/http-error';

const router = Router();

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[DRIVER_DOCS] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const driverId = uid(req);
    const dir = path.join(UPLOAD_ROOT, driverId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || 'bin';
    const kind = file.fieldname === 'vehiclePhoto' ? 'vehicle' : 'license';
    cb(null, `${kind}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('Solo se aceptan fotos JPG, PNG o WEBP.'));
    cb(null, true);
  },
});

router.use(requireSession);

router.get('/profile', requireAppRole(['driver']), handle(async (req) => ({
  profile: await DriverDocumentsService.getProfile(uid(req)),
})));

router.post(
  '/profile',
  requireAppRole(['driver']),
  (req, res, next) => upload.fields([{ name: 'licensePhoto', maxCount: 1 }, { name: 'vehiclePhoto', maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'No se pudo subir la foto.' });
    next();
  }),
  handle(async (req) => {
    const files = (req as Request & { files?: Record<string, Express.Multer.File[]> }).files || {};
    const driverId = uid(req);
    const licenseFile = files.licensePhoto?.[0];
    const vehicleFile = files.vehiclePhoto?.[0];
    return {
      profile: await DriverDocumentsService.submit(driverId, {
        ...req.body,
        licensePhotoPath: licenseFile ? `${driverId}/${licenseFile.filename}` : null,
        vehiclePhotoPath: vehicleFile ? `${driverId}/${vehicleFile.filename}` : null,
      }),
    };
  })
);

/** Foto propia (del motorizado) o, si es admin, de cualquier motorizado — nunca pública. */
router.get('/documents/:driverId/:kind', async (req: Request, res: Response) => {
  try {
    const session = (req as SessionRequest).session;
    const { driverId, kind } = req.params;
    if (!session) return res.status(401).json({ success: false, message: 'Debes iniciar sesión.' });
    const isOwner = session.sub === driverId;
    const isAdmin = Boolean(session.adm);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'No tienes permiso para ver este documento.' });
    if (kind !== 'license' && kind !== 'vehicle') return res.status(400).json({ success: false, message: 'Documento inválido.' });
    const full = await DriverDocumentsService.resolveDocumentPath(driverId, kind as DocumentKind);
    res.sendFile(full);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[DRIVER_DOCS] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
});

export default router;
