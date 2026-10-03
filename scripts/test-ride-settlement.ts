import assert from 'node:assert/strict';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'Este test requiere Firebase Firestore Emulator. Ejecuta: npm run test:settlement'
  );
}

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const { db } = await import('../server/config/firebase');
const { RideSettlementService } = await import('../server/services/ride-settlement.service');

const suffix = Date.now().toString(36);
const rideId = `settlement-test-${suffix}`;
const driverId = `driver-${suffix}`;
const passengerId = `passenger-${suffix}`;
const cashRideId = `settlement-cash-${suffix}`;

const baseWallet = {
  availableBalance: 0,
  digitalBalance: 0,
  dailyEarnings: 0,
  weeklyEarnings: 0,
  monthlyEarnings: 0,
  accumulatedCommission: 0,
  cashDebt: 0,
  movements: []
};

async function main() {
  const driverRef = db.collection('users').doc(driverId);
  const passengerRef = db.collection('users').doc(passengerId);
  const presenceRef = db.collection('drivers_online').doc(driverId);
  const rideRef = db.collection('rides').doc(rideId);
  const settlementRef = db.collection('ride_settlements').doc(`SETTLE_${rideId}`);
  const ledgerRef = db.collection('accounting_ledger').doc(`SETTLE_${rideId}`);

  await driverRef.set({ role: 'driver', wallet: { ...baseWallet } });
  await passengerRef.set({
    role: 'passenger',
    wallet: {
      ...baseWallet,
      availableBalance: 100,
      digitalBalance: 100
    }
  });
  await presenceRef.set({
    driverId,
    status: 'BUSY',
    currentRideId: rideId,
    lastActive: new Date()
  });
  await rideRef.set({
    passengerId,
    driverId,
    status: 'IN_PROGRESS',
    protectedPrice: 20,
    finalPrice: 20,
    currency: 'PEN',
    paymentMethod: 'wallet',
    paymentState: 'AUTHORIZED'
  });

  const results = await Promise.all([
    RideSettlementService.completeRide(rideId, driverId),
    RideSettlementService.completeRide(rideId, driverId)
  ]);

  assert.equal(results.length, 2);
  assert.equal(results.filter(result => result._idempotent === false).length, 1);
  assert.equal(results.filter(result => result._idempotent === true).length, 1);

  const [rideSnap, settlementSnap, ledgerSnap, driverSnap, passengerSnap, presenceSnap] =
    await Promise.all([
      rideRef.get(),
      settlementRef.get(),
      ledgerRef.get(),
      driverRef.get(),
      passengerRef.get(),
      presenceRef.get()
    ]);

  assert.equal(rideSnap.data()?.status, 'COMPLETED');
  assert.equal(rideSnap.data()?.settlementState, 'SETTLED');
  assert.equal(rideSnap.data()?.paymentState, 'SETTLED');
  assert.equal(settlementSnap.exists, true);
  assert.equal(ledgerSnap.exists, true);
  assert.equal(driverSnap.data()?.wallet?.availableBalance, 17.4);
  assert.equal(driverSnap.data()?.wallet?.digitalBalance, 17.4);
  assert.equal(driverSnap.data()?.wallet?.dailyEarnings, 17.4);
  assert.equal(driverSnap.data()?.wallet?.accumulatedCommission, 2.6);
  assert.equal(passengerSnap.data()?.wallet?.availableBalance, 80);
  assert.equal(passengerSnap.data()?.wallet?.digitalBalance, 80);
  assert.equal(presenceSnap.data()?.status, 'AVAILABLE');
  assert.equal(presenceSnap.data()?.currentRideId, null);

  const ledger = ledgerSnap.data();
  assert.equal(ledger?.balanced, true);
  assert.equal(ledger?.debitTotal, 20);
  assert.equal(ledger?.creditTotal, 20);
  assert.equal(ledger?.lines?.length, 3);

  const retry = await RideSettlementService.completeRide(rideId, driverId);
  assert.equal(retry._idempotent, true);

  await db.collection('users').doc(driverId).set({
    role: 'driver',
    wallet: { ...baseWallet }
  });
  await db.collection('drivers_online').doc(driverId).set({
    driverId,
    status: 'BUSY',
    currentRideId: cashRideId,
    lastActive: new Date()
  });
  await db.collection('rides').doc(cashRideId).set({
    passengerId,
    driverId,
    status: 'IN_PROGRESS',
    protectedPrice: 20,
    finalPrice: 20,
    currency: 'PEN',
    paymentMethod: 'cash',
    paymentState: 'AUTHORIZED'
  });

  const cashResult = await RideSettlementService.completeRide(cashRideId, driverId);
  assert.equal(cashResult.driverNet, 17.4);
  assert.equal(cashResult.commission, 2.6);

  const cashDriver = await driverRef.get();
  assert.equal(cashDriver.data()?.wallet?.availableBalance, -2.6);
  assert.equal(cashDriver.data()?.wallet?.digitalBalance, -2.6);
  assert.equal(cashDriver.data()?.wallet?.cashDebt, 20);
  assert.equal(cashDriver.data()?.wallet?.dailyEarnings, 17.4);

  const cashLedger = await db.collection('accounting_ledger').doc(`SETTLE_${cashRideId}`).get();
  assert.equal(cashLedger.data()?.debitTotal, 2.6);
  assert.equal(cashLedger.data()?.creditTotal, 2.6);
  assert.equal(cashLedger.data()?.lines?.length, 2);


  console.log('RIDE SETTLEMENT TEST: PASS');
  console.log('PASS: concurrent idempotency + internal wallet + accounting balance + cash settlement');
}

main().catch((error) => {
  console.error('RIDE SETTLEMENT TEST: FAIL');
  console.error(error);
  process.exitCode = 1;
});
