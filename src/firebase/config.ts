import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Conexión segura a Firebase Local Emulator Suite para Sandbox / Testing aislado
export const isSandboxEmulatorActive = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (isSandboxEmulatorActive) {
  try {
    const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost';
    const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
    connectFirestoreEmulator(db, firestoreHost, firestorePort);

    const authUrl = import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });

    const storageHost = import.meta.env.VITE_STORAGE_EMULATOR_HOST || 'localhost';
    const storagePort = Number(import.meta.env.VITE_STORAGE_EMULATOR_PORT || 9199);
    connectStorageEmulator(storage, storageHost, storagePort);

    console.info('[ZENITH-SANDBOX] Conectado a Firebase Local Emulator Suite.');
  } catch (err) {
    console.warn('[ZENITH-SANDBOX] No se pudo conectar a Firebase Emulators:', err);
  }
}

/**
 * Salvaguarda de producción: Aborta si una prueba sintética / stress test intenta
 * ejecutarse sin el sandbox/emulador activo.
 */
export function assertSandboxIsolated(operationName: string = 'Simulación / Stress Test'): void {
  if (!isSandboxEmulatorActive) {
    throw new Error(
      `[SECURITY_VIOLATION] ${operationName} cancelada: El flag VITE_USE_FIREBASE_EMULATOR está inactivo. No se permite ejecutar pruebas de estrés en la base de datos de producción.`
    );
  }
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connected successfully");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
