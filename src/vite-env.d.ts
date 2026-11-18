/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FIREBASE_EMULATOR?: string;
  readonly VITE_FIRESTORE_EMULATOR_HOST?: string;
  readonly VITE_FIRESTORE_EMULATOR_PORT?: string;
  readonly VITE_AUTH_EMULATOR_URL?: string;
  readonly VITE_STORAGE_EMULATOR_HOST?: string;
  readonly VITE_STORAGE_EMULATOR_PORT?: string;
  readonly VITE_OTHER_KEY?: string;
  /** Dirección de la API Zénith, ej. https://shocos.nom.pe/zenith-api (sin / final). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
