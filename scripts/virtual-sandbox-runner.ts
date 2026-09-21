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
    const { runVirtualSandboxLifecycle } = await import('../src/services/virtualSandboxService.ts');
    const { assertSandboxIsolated } = await import('../src/firebase/config.ts');

    // 1. Verificación de Seguridad y Aislamiento
    try {
      assertSandboxIsolated('Headless Sandbox Runner');
      results.sandboxEmulator = true;
    } catch (secErr) {
      results.sandboxEmulator = false;
      throw secErr;
    }

    // 2. Ejecución del ciclo de vida virtual existente
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
