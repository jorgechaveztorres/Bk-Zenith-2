import { spawn } from 'node:child_process';

const PROJECT_ID = 'gen-lang-client-0838883154';
const DATABASE_ID = 'ai-studio-c005ecfa-a6b8-4b3b-952e-e9f3a6061d74';
const PASSWORD = 'ZenithSandboxVirtual2026!';
const EXPECTED_ENDPOINTS = {
	auth: '127.0.0.1:9099',
	firestore: '127.0.0.1:8080',
	storage: '127.0.0.1:9199'
};

type Driver = {
	driverId: string;
	driverName: string;
	driverPhone: string;
	driverPlate: string;
	driverVehicle: string;
	email: string;
};

const drivers: Driver[] = [
	{
		driverId: 'sandbox-virtual-driver-01',
		driverName: 'Motorizado Virtual Sandbox (Test)',
		driverPhone: '+51 900 000 002',
		driverPlate: 'VIRT-999-SBX',
		driverVehicle: 'Honda Wave 110 Virtual',
		email: 'driver.sandbox@zenith.virtual.test'
	},
	{
		driverId: 'sandbox-virtual-driver-02',
		driverName: 'Motorizado Virtual Sandbox 02 (Test)',
		driverPhone: '+51 900 000 004',
		driverPlate: 'VIRT-998-SBX',
		driverVehicle: 'Yamaha Crypton 110 Virtual',
		email: 'driver2.sandbox@zenith.virtual.test'
	}
];

function assertSandboxEndpoints(): void {
	const endpoints = {
		auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
		firestore: process.env.FIRESTORE_EMULATOR_HOST,
		storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST
			?? process.env.STORAGE_EMULATOR_HOST
	};

	if (endpoints.auth !== EXPECTED_ENDPOINTS.auth
		|| endpoints.firestore !== EXPECTED_ENDPOINTS.firestore
		|| endpoints.storage !== EXPECTED_ENDPOINTS.storage) {
		throw new Error(
			`[SECURITY_VIOLATION] Producción o endpoint no autorizado detectado: ${JSON.stringify(endpoints)}`
		);
	}
}

async function ensureDriverAccount(
	adminAuth: { createUser: (properties: { uid: string; email: string; password: string; displayName: string }) => Promise<unknown>; updateUser: (uid: string, properties: { email: string; password: string; displayName: string }) => Promise<unknown> },
	driver: Driver
): Promise<void> {
	try {
		await adminAuth.createUser({
			uid: driver.driverId,
			email: driver.email,
			password: PASSWORD,
			displayName: driver.driverName
		});
	} catch (error: unknown) {
		const code = (error as { code?: string }).code;
		if (code !== 'auth/uid-already-exists' && code !== 'auth/email-already-exists') {
			throw error;
		}
		await adminAuth.updateUser(driver.driverId, {
			email: driver.email,
			password: PASSWORD,
			displayName: driver.driverName
		});
	}
}

type FirestoreValue = Record<string, string | boolean>;

function firestoreValue(value: string | number | boolean): FirestoreValue {
	if (typeof value === 'string') return { stringValue: value };
	if (typeof value === 'number') return { integerValue: String(value) };
	return { booleanValue: value };
}

async function writeOrder(orderId: string): Promise<void> {
	const fields: Record<string, FirestoreValue> = {
		id: firestoreValue(orderId),
		isTestOperation: firestoreValue(true),
		status: firestoreValue('PUBLICADO'),
		passengerId: firestoreValue('sandbox-virtual-client-01'),
		passengerName: firestoreValue('Cliente Virtual Sandbox (Test)'),
		passengerPhone: firestoreValue('+51 900 000 001'),
		originAddress: firestoreValue('Sandbox Origin'),
		originLat: firestoreValue(-16.39889),
		originLng: firestoreValue(-71.535),
		destinationAddress: firestoreValue('Sandbox Destination'),
		destLat: firestoreValue(-16.385),
		destLng: firestoreValue(-71.542),
		distanceText: firestoreValue('3.4 km'),
		durationText: firestoreValue('11 min'),
		distanceMeters: firestoreValue(3400),
		durationSeconds: firestoreValue(660),
		polylinePointsCount: firestoreValue(2),
		createdAt: firestoreValue(new Date().toISOString()),
		publishedAt: firestoreValue(new Date().toISOString()),
		updatedAt: firestoreValue(new Date().toISOString())
	};
	const response = await fetch(
		`http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/rides/${orderId}`,
		{
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fields })
		}
	);
	if (!response.ok) {
		throw new Error(`No se pudo crear el pedido en Firestore Emulator: ${await response.text()}`);
	}
}

async function readOrder(orderId: string): Promise<{ status?: string; driverId?: string }> {
	const response = await fetch(
		`http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/rides/${orderId}`
	);
	if (!response.ok) {
		throw new Error(`No se pudo leer el pedido final en Firestore Emulator: ${await response.text()}`);
	}
	const document = await response.json() as {
		fields?: {
			status?: { stringValue?: string };
			driverId?: { stringValue?: string };
		};
	};
	return {
		status: document.fields?.status?.stringValue,
		driverId: document.fields?.driverId?.stringValue
	};
}


function runParticipant(orderId: string, driver: Driver): Promise<{
	driverId: string;
	code: number;
	output: string;
}> {
	return new Promise((resolve, reject) => {
		const child = spawn('npx', ['tsx', 'scripts/concurrency-sandbox-participant.ts'], {
			cwd: process.cwd(),
			env: {
				...process.env,
				VITE_USE_FIREBASE_EMULATOR: 'true',
				FIREBASE_AUTH_EMULATOR_HOST: EXPECTED_ENDPOINTS.auth,
				FIRESTORE_EMULATOR_HOST: EXPECTED_ENDPOINTS.firestore,
				FIREBASE_STORAGE_EMULATOR_HOST: EXPECTED_ENDPOINTS.storage,
				VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
				VITE_FIRESTORE_EMULATOR_PORT: '8080',
				VITE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
				VITE_STORAGE_EMULATOR_HOST: '127.0.0.1',
				VITE_STORAGE_EMULATOR_PORT: '9199',
				CONCURRENCY_ORDER_ID: orderId,
				CONCURRENCY_DRIVER_JSON: JSON.stringify(driver)
			},
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let output = '';
		const timeout = setTimeout(() => {
			child.kill('SIGTERM');
			resolve({
				driverId: driver.driverId,
				code: 124,
				output: `${output}\nCONCURRENCY_RESULT:ERROR:${driver.driverId}:participant timeout`
			});
		}, 20000);
		child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
		child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
		child.on('error', reject);
		child.on('close', (code) => {
			clearTimeout(timeout);
			resolve({
				driverId: driver.driverId,
				code: code ?? 1,
				output
			});
		});
	});
}

async function main(): Promise<void> {
	assertSandboxEndpoints();
	process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
	process.env.FIRESTORE_EMULATOR_HOST = EXPECTED_ENDPOINTS.firestore;
	process.env.VITE_FIRESTORE_EMULATOR_HOST = '127.0.0.1';
	process.env.VITE_FIRESTORE_EMULATOR_PORT = '8080';
	process.env.VITE_AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
	process.env.VITE_STORAGE_EMULATOR_HOST = '127.0.0.1';
	process.env.VITE_STORAGE_EMULATOR_PORT = '9199';
	process.env.FIREBASE_AUTH_EMULATOR_HOST = EXPECTED_ENDPOINTS.auth;

	const { initializeApp, getApps } = await import('firebase-admin/app');
	const { getAuth } = await import('firebase-admin/auth');
	const { getFirestore } = await import('firebase-admin/firestore');
	const adminApp = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
	const adminAuth = getAuth(adminApp);
	const adminDb = getFirestore(adminApp, DATABASE_ID);

	for (const driver of drivers) {
		await ensureDriverAccount(adminAuth, driver);
	}

	const orderId = `CONCURRENCY-${Date.now()}`;
	await adminDb.collection('rides').doc(orderId).set({
		id: orderId,
		isTestOperation: true,
		status: 'PUBLICADO',
		passengerId: 'sandbox-virtual-client-01',
		passengerName: 'Cliente Virtual Sandbox (Test)',
		passengerPhone: '+51 900 000 001',
		originAddress: 'Sandbox Origin',
		originLat: -16.39889,
		originLng: -71.535,
		destinationAddress: 'Sandbox Destination',
		destLat: -16.385,
		destLng: -71.542,
		distanceText: '3.4 km',
		durationText: '11 min',
		distanceMeters: 3400,
		durationSeconds: 660,
		polylinePointsCount: 2,
		createdAt: new Date().toISOString(),
		publishedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	});

	const results = await Promise.all(drivers.map((driver) => runParticipant(orderId, driver)));
	const wins = results.filter((result) => result.output.includes('CONCURRENCY_RESULT:WIN:'));
	const conflicts = results.filter((result) => result.output.includes('CONCURRENCY_RESULT:CONFLICT:'));
	const errors = results.filter((result) => result.code !== 0 || result.output.includes('CONCURRENCY_RESULT:ERROR:'));
	const finalSnapshot = await adminDb.collection('rides').doc(orderId).get();
	const finalData = finalSnapshot.data() as { status?: string; driverId?: string } | undefined;

	console.log(`SANDBOX_ENDPOINTS:PASS:${JSON.stringify(EXPECTED_ENDPOINTS)}`);
	console.log(`ORDER_ID:${orderId}`);
	for (const result of results) {
		process.stdout.write(result.output);
	}
	console.log(`CONCURRENCY_WINNERS:${wins.length}`);
	console.log(`CONCURRENCY_CONFLICTS:${conflicts.length}`);
	console.log(`CONCURRENCY_ERRORS:${errors.length}`);
	console.log(`FIRESTORE_FINAL_STATUS:${finalData.status ?? 'MISSING'}`);
	console.log(`FIRESTORE_FINAL_DRIVER_ID:${finalData.driverId ?? 'MISSING'}`);

	const winnerId = wins.length === 1
		? wins[0].output.match(/CONCURRENCY_RESULT:WIN:([^:]+):/)?.[1]
		: undefined;
	const valid = results.length === 2
		&& wins.length === 1
		&& conflicts.length === 1
		&& errors.length === 0
		&& finalData.status === 'ACEPTADO'
		&& finalData.driverId === winnerId;

	console.log(`CONCURRENCY_TEST:${valid ? 'PASS' : 'FAIL'}`);
	if (!valid) {
		throw new Error('La prueba no demostró una única aceptación real y un único conflicto de Firestore.');
	}
}

main().catch((error: unknown) => {
	console.error(`CONCURRENCY_RUNNER_ERROR:${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
