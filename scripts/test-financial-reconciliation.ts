import assert from 'node:assert/strict';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test requiere Firebase Firestore Emulator. Ejecuta: npm run test:financial-reconciliation');
}

const { db } = await import('../server/config/firebase');
const { FinancialReconciliationService } = await import('../server/services/financial-reconciliation.service');

const suffix = Date.now().toString(36);
const driverId = 'recon-driver-' + suffix;
const passengerId = 'recon-passenger-' + suffix;
const healthyRideId = 'recon-healthy-' + suffix;
const brokenRideId = 'recon-broken-' + suffix;

async function main() {
  await db.collection('users').doc(driverId).set({
    role: 'driver',
    wallet: {
      availableBalance: -2.6,
      digitalBalance: -2.6,
      dailyEarnings: 17.4,
      weeklyEarnings: 17.4,
      monthlyEarnings: 17.4,
      accumulatedCommission: 2.6,
      movements: [{
        id: 'settlement_' + healthyRideId,
        type: 'platform_commission',
        amount: -2.6,
        description: 'Comisión Zénith',
        referenceId: healthyRideId
      }]
    }
  });

  await db.collection('users').doc(passengerId).set({ role: 'passenger' });

  await db.collection('rides').doc(healthyRideId).set({
    passengerId,
    driverId,
    status: 'COMPLETED',
    protectedPrice: 20,
    settlementId: 'SETTLE_' + healthyRideId
  });

  await db.collection('ride_settlements').doc('SETTLE_' + healthyRideId).set({
    settlementId: 'SETTLE_' + healthyRideId,
    rideId: healthyRideId,
    driverId,
    grossAmount: 20,
    commission: 2.6,
    driverNet: 17.4,
    settlementState: 'SETTLED'
  });

  await db.collection('accounting_ledger').doc('SETTLE_' + healthyRideId).set({
    id: 'SETTLE_' + healthyRideId,
    type: 'RIDE_SETTLEMENT',
    rideId: healthyRideId,
    debitTotal: 2.6,
    creditTotal: 2.6
  });

  let report = await FinancialReconciliationService.audit();
  assert.equal(report.ok, true);
  assert.equal(report.issues.length, 0);

  await db.collection('rides').doc(brokenRideId).set({
    passengerId,
    driverId,
    status: 'COMPLETED',
    protectedPrice: 10,
    settlementId: 'SETTLE_' + brokenRideId
  });

  report = await FinancialReconciliationService.audit();
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.code === 'COMPLETED_RIDE_WITHOUT_SETTLEMENT'));

  await db.collection('ride_settlements').doc('SETTLE_ORPHAN_' + suffix).set({
    settlementId: 'SETTLE_ORPHAN_' + suffix,
    rideId: 'missing-ride-' + suffix,
    driverId,
    grossAmount: 10,
    commission: 1.3,
    driverNet: 8.7
  });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'SETTLEMENT_WITHOUT_RIDE'));

  await db.collection('ride_settlements').doc('SETTLE_DUP_' + suffix + '_A').set({
    settlementId: 'SETTLE_DUP_' + suffix + '_A',
    rideId: healthyRideId,
    driverId,
    grossAmount: 20,
    commission: 2.6,
    driverNet: 17.4
  });
  await db.collection('ride_settlements').doc('SETTLE_DUP_' + suffix + '_B').set({
    settlementId: 'SETTLE_DUP_' + suffix + '_B',
    rideId: healthyRideId,
    driverId,
    grossAmount: 20,
    commission: 2.6,
    driverNet: 17.4
  });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'DUPLICATE_SETTLEMENT'));

  console.log('FINANCIAL RECONCILIATION TEST: PASS');
  console.log('PASS: completed rides, orphan settlements, duplicate settlements, ledger and wallet integrity');
}

main().catch((error) => {
  console.error('FINANCIAL RECONCILIATION TEST: FAIL');
  console.error(error);
  process.exitCode = 1;
});
