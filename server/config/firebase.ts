import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Firebase queda OPCIONAL durante la migración a MySQL.
 * - FIREBASE_DISABLED=true  -> no se inicializa (producción en cPanel).
 * - Si falla la inicialización, el servidor igual arranca; solo los módulos
 *   que aún dependen de Firebase responden con error al usarse.
 * Antes, un fallo aquí tumbaba TODO el servidor al arrancar.
 */
const FIREBASE_OFF_MESSAGE = 'Este módulo todavía usa Firebase y está desactivado mientras se migra a MySQL.';

const unavailable = <T extends object>(name: string): T =>
  new Proxy({} as T, {
    get(_target, prop) {
      if (prop === 'then') return undefined; // evita que se trate como promesa
      throw new Error(`${FIREBASE_OFF_MESSAGE} (${name}.${String(prop)})`);
    },
  });

let adminApp: App | undefined;

if (process.env.FIREBASE_DISABLED !== 'true') {
  try {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      adminApp = initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        projectId: firebaseConfig.projectId,
      });
    } else {
      adminApp = initializeApp({ projectId: firebaseConfig.projectId });
    }
  } catch (e: unknown) {
    console.error('[FIREBASE_ADMIN_INIT_ERROR] Firebase desactivado:', (e as Error).message);
    adminApp = undefined;
  }
} else {
  console.log('[FIREBASE] Desactivado por FIREBASE_DISABLED=true (modo MySQL).');
}

export const firebaseEnabled = adminApp !== undefined;

export const db: Firestore = adminApp
  ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
  : unavailable<Firestore>('db');

export const auth: Auth = adminApp ? getAuth(adminApp) : unavailable<Auth>('auth');
