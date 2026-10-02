import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let adminApp: App;

try {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      adminApp = initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        projectId: firebaseConfig.projectId
      });
    } else {
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId
      });
    }
  } else {
    adminApp = getApps()[0];
  }
} catch (e: any) {
  console.error('[FIREBASE_ADMIN_INIT_ERROR] Error inicializando Firebase Admin:', e.message);
  adminApp = getApps()[0];
}

// Inicializar Firestore apuntando explícitamente a la base de datos nombrada y Auth al proyecto configurado
export const db: Firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
export const auth: Auth = getAuth(adminApp);

