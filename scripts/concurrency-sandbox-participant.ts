import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

type DriverConfig = {
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverPlate: string;
  driverVehicle: string;
};

const orderId = process.env.CONCURRENCY_ORDER_ID;
const driver = JSON.parse(
  process.env.CONCURRENCY_DRIVER_JSON ?? '{}'
) as DriverConfig;

if (!orderId || !driver.driverId) {
  throw new Error('Missing concurrency env');
}

const data = new Map<string, string>();

const storage: Storage = {
  get length() {
    return data.size;
  },
  clear() {
    data.clear();
  },
  getItem(key) {
    return data.get(key) ?? null;
  },
  key(index) {
    return Array.from(data.keys())[index] ?? null;
  },
  removeItem(key) {
    data.delete(key);
  },
  setItem(key, value) {
    data.set(key, String(value));
  }
};

const listeners = new Map<string, EventListener[]>();

const windowShim = {
  localStorage: storage,

  dispatchEvent(event: Event) {
    for (const listener of listeners.get(event.type) ?? []) {
      listener(event);
    }
    return true;
  },

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null
  ) {
    if (!listener) return;

    const list = listeners.get(type) ?? [];

    list.push(
      typeof listener === 'function'
        ? listener
        : (event) => listener.handleEvent(event)
    );

    listeners.set(type, list);
  },

  removeEventListener() {}
} as unknown as Window & { localStorage: Storage };

const globalObject = globalThis as typeof globalThis & {
  localStorage?: Storage;
  window?: Window & typeof globalThis;
};

globalObject.localStorage = storage;
globalObject.window = windowShim as unknown as Window & typeof globalThis;

process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
process.env.VITE_FIRESTORE_EMULATOR_HOST = '127.0.0.1';
process.env.VITE_FIRESTORE_EMULATOR_PORT = '8080';
process.env.VITE_AUTH_EMULATOR_URL = 'http://127.0.0.1:9099'
process.env.VITE_STORAGE_EMULATOR_HOST = '127.0.0.1';
process.env.VITE_STORAGE_EMULATOR_PORT = '9199';

const requiredEndpoints = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  firestore: process.env.FIRESTORE_EMULATOR_HOST,
  storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ?? process.env.STORAGE_EMULATOR_HOST
};

if (requiredEndpoints.auth !== '127.0.0.1:9099'
  || requiredEndpoints.firestore !== '127.0.0.1:8080'
  || requiredEndpoints.storage !== '127.0.0.1:9199') {
  throw new Error(
    `[SECURITY_VIOLATION] Endpoints no aislados: ${JSON.stringify(requiredEndpoints)}`
  );
}

const { auth, db } = await import('../src/firebase/config');
const { acceptOrderAsMotorizado } =
  await import('../src/services/operationalOrdersService');

const email =
  driver.driverId === 'sandbox-virtual-driver-02'
    ? 'driver2.sandbox@zenith.virtual.test'
    : 'driver.sandbox@zenith.virtual.test';

await signInWithEmailAndPassword(
  auth,
  email,
  'ZenithSandboxVirtual2026!'
);

const orderRef = doc(db, 'rides', orderId);
const orderSnapshot = await getDoc(orderRef);

if (!orderSnapshot.exists()) {
  throw new Error(`Order ${orderId} not found`);
}

storage.setItem(
  'zenith_operational_orders_v1',
  JSON.stringify([orderSnapshot.data()])
);

try {
  const result = await acceptOrderAsMotorizado(orderId, driver);

  console.log(
    `CONCURRENCY_RESULT:WIN:${driver.driverId}:STATUS:${result.status}`
  );
    process.exit(0);
} catch (error) {
  const message =
    error instanceof Error ? error.message : String(error);

  if (message.includes('CONCURRENCY_CONFLICT')) {
    console.log(
      `CONCURRENCY_RESULT:CONFLICT:${driver.driverId}:SOURCE:FIRESTORE_TRANSACTION`
    );
    process.exit(0);
  }

  console.error(
    `CONCURRENCY_RESULT:ERROR:${driver.driverId}:${message}`
  );

  process.exit(1);
}