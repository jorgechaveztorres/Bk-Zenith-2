/**
 * ZÉNITH // HEADLESS VIRTUAL SANDBOX RUNNER
 * Ejecuta el ciclo de vida del Sandbox dentro de `firebase emulators:exec`.
 * 
 * Requisitos de Seguridad:
 * - Requiere VITE_USE_FIREBASE_EMULATOR="true"
 * - Invoca assertSandboxIsolated()
 * - Aborta inmediatamente si intenta apuntar a producción
 */

// Inyección de entorno para Node.js / tsx
process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.VITE_FIRESTORE_EMULATOR_HOST = process.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
process.env.VITE_FIRESTORE_EMULATOR_PORT = process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080';
process.env.VITE_AUTH_EMULATOR_URL = process.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';

// Asegurar compatibilidad con import.meta.env en entorno Node sin Vite bundler si aplica
if (typeof globalThis !== 'undefined') {
  const g = globalThis as Record<string, unknown>;
  if (!g.import) {
    g.import = { meta: { env: process.env } };
  }
}

/**
 * Headless localStorage shim for the Node/tsx sandbox runner.
 * Must be installed before importing services that access window.localStorage.
 */
function installHeadlessLocalStorageShim(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return;
  }

  const storage = new Map<string, string>();
  const headlessLocalStorage: Storage = {
    get length() { return storage.size; },
    clear() { storage.clear(); },
    getItem(key: string) { return storage.has(key) ? storage.get(key)! : null; },
    key(index: number) { return index >= 0 && index < storage.size ? Array.from(storage.keys())[index] ?? null : null; },
    removeItem(key: string) { storage.delete(key); },
    setItem(key: string, value: string) { storage.set(String(key), String(value)); }
  };

  type HeadlessWindow = Pick<
    Window,
    'dispatchEvent' | 'addEventListener' | 'removeEventListener'
  > & {
    localStorage: Storage;
  };

  type HeadlessGlobal = Omit<typeof globalThis, 'localStorage' | 'window'> & {
    localStorage?: Storage;
    window?: HeadlessWindow;
  };

  const globalObject = globalThis as HeadlessGlobal;

  globalObject.localStorage = headlessLocalStorage;
  globalObject.window = globalObject.window ?? {
    localStorage: headlessLocalStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalObject.window.localStorage = headlessLocalStorage;

  console.log('[SANDBOX_STORAGE] Headless localStorage initialized.');
}

installHeadlessLocalStorageShim();

async function main() {
  const results = {
    sandboxEmulator: false,
    clienteVirtual: false,
    pedidoCreado: false,
    pedidoPublicado: false,
    aceptacion: false,
    driverId: false,
    multirrol: false,
    produccionTocada: 'NO',
    cicloCompleto: false
  };

  try {
    // Importar dinámicamente el servicio para respetar la inicialización de env vars
    const {
      runVirtualSandboxLifecycle,
      authenticateVirtualSandboxUser,
      VIRTUAL_SANDBOX_USERS
    } = await import('../src/services/virtualSandboxService.ts');
    const { auth, assertSandboxIsolated } = await import('../src/firebase/config.ts');

    // 1. Verificación de Seguridad y Aislamiento
    try {
      assertSandboxIsolated('Headless Sandbox Runner');
      results.sandboxEmulator = true;
    } catch (secErr) {
      results.sandboxEmulator = false;
      throw secErr;
    }

    // 2. Aprovisionamiento y autenticación canónica en Firebase Auth Emulator
    // Garantiza que los UIDs sintéticos existan en el Auth Emulator y se autentiquen mediante signInWithEmailAndPassword
    const { initializeApp: initAdminApp, getApps: getAdminApps } = await import('firebase-admin/app');
    const { getAuth: getAdminAuth } = await import('firebase-admin/auth');
    const { default: firebaseConfig } = await import('../firebase-applet-config.json');

    const adminApp = getAdminApps().length > 0
      ? getAdminApps()[0]
      : initAdminApp({ projectId: firebaseConfig.projectId });
    const adminAuth = getAdminAuth(adminApp);

    const usersToAuthenticate = [
      VIRTUAL_SANDBOX_USERS.CLIENT,
      VIRTUAL_SANDBOX_USERS.MOTORIZADO,
      VIRTUAL_SANDBOX_USERS.MULTIROLE_USER
    ];

    for (const virtualUser of usersToAuthenticate) {
      try {
        await adminAuth.createUser({
          uid: virtualUser.uid,
          email: virtualUser.email,
          password: 'ZenithSandboxVirtual2026!',
          displayName: virtualUser.fullName
        });
      } catch (adminErr: unknown) {
        const code = (adminErr as { code?: string })?.code;
        if (code === 'auth/uid-already-exists' || code === 'auth/email-already-exists') {
          await adminAuth.updateUser(virtualUser.uid, {
            email: virtualUser.email,
            password: 'ZenithSandboxVirtual2026!',
            displayName: virtualUser.fullName
          });
        }
      }

      await authenticateVirtualSandboxUser(virtualUser.uid);
      if (!auth.currentUser || auth.currentUser.uid !== virtualUser.uid) {
        throw new Error(
          `[AUTH_VERIFICATION_FAILED] auth.currentUser.uid (${auth.currentUser?.uid}) no coincide con UID esperado: ${virtualUser.uid}`
        );
      }
      console.log(`[AUTH_EMULATOR] Sesión canónica verificada en Firebase Auth SDK para UID: ${auth.currentUser.uid}`);
    }

    // Dejar la sesión activa con la identidad del cliente virtual antes del inicio del ciclo
    await authenticateVirtualSandboxUser(VIRTUAL_SANDBOX_USERS.CLIENT.uid);

    // 3. Ejecución del ciclo de vida virtual existente
    const execution = await runVirtualSandboxLifecycle();

    // Evaluar cada fase reportada en los logs del servicio existente
    for (const log of execution.logs) {
      if (log.step === 'SEED_VIRTUAL_CLIENT' && log.success) {
        results.clienteVirtual = true;
      }
      if (log.step === 'CREATE_DRAFT_ORDER' && log.success) {
        results.pedidoCreado = true;
      }
      if (log.step === 'PUBLISH_ORDER' && log.success) {
        results.pedidoPublicado = true;
      }
      if (log.step === 'ACCEPT_ORDER_ATOMIC' && log.success) {
        results.aceptacion = true;
      }
      if (log.step === 'VERIFY_MULTIROLE' && log.success) {
        results.multirrol = true;
      }
    }

    // Comprobación específica del driverId
    if (execution.order && execution.order.driverId === 'sandbox-virtual-driver-01') {
      results.driverId = true;
    }

    // Comprobación de multirrol confirmada
    if (execution.multiroleVerified) {
      results.multirrol = true;
    }

    if (execution.success && results.driverId && results.multirrol) {
      results.cicloCompleto = true;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SANDBOX_RUNNER_ERROR] ${message}`);
  } finally {
    // Imprimir resultado exacto estructurado requerido
    console.log(`SANDBOX EMULATOR: ${results.sandboxEmulator ? 'PASS' : 'FAIL'}`);
    console.log(`CLIENTE VIRTUAL: ${results.clienteVirtual ? 'PASS' : 'FAIL'}`);
    console.log(`PEDIDO CREADO: ${results.pedidoCreado ? 'PASS' : 'FAIL'}`);
    console.log(`PEDIDO PUBLICADO: ${results.pedidoPublicado ? 'PASS' : 'FAIL'}`);
    console.log(`ACEPTACIÓN: ${results.aceptacion ? 'PASS' : 'FAIL'}`);
    console.log(`DRIVER ID: ${results.driverId ? 'PASS' : 'FAIL'}`);
    console.log(`MULTIRROL: ${results.multirrol ? 'PASS' : 'FAIL'}`);
    console.log(`PRODUCCIÓN TOCADA: ${results.produccionTocada}`);
    console.log(`CICLO COMPLETO: ${results.cicloCompleto ? 'PASS' : 'FAIL'}`);

    if (!results.cicloCompleto) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

main();
