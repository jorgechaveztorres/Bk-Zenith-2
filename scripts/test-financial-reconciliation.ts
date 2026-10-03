import assert from 'node:assert/strict';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test requiere Firebase Firestore Emulator. Ejecuta: npm run test:financial-reconciliation');
}

const { db } = await import('../server/config/firebase');
const { RideSettlementService } = await import('../server/services/ride-settlement.service');
const { FinancialReconciliationService } = await import('../server/services/financial-reconciliation.service');

const suffix = Date.now().toString(36);
const driverId = 'recon-driver-' + suffix;
const passengerId = 'recon-passenger-' + suffix;
const healthyRideId = 'recon-healthy-' + suffix;
const brokenRideId = 'recon-broken-' + suffix;

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

async function seedRide(rideId: string) {
  await db.collection('rides').doc(rideId).set({
    passengerId,
    driverId,
    status: 'IN_PROGRESS',
    protectedPrice: 20,
    finalPrice: 20,
    currency: 'PEN',
    paymentMethod: 'wallet',
    paymentState: 'AUTHORIZED'
  });
}

async function main() {
  await db.collection('users').doc(driverId).set({ role: 'driver', wallet: { ...baseWallet } });
  await db.collection('users').doc(passengerId).set({ role: 'passenger', wallet: { ...baseWallet } });

  await seedRide(healthyRideId);
  await db.collection('drivers_online').doc(driverId).set({
    driverId,
    status: 'BUSY',
    currentRideId: healthyRideId
  });

  const settlement = await RideSettlementService.completeRide(healthyRideId, driverId);
  assert.equal(settlement._idempotent, false);

  let report = await FinancialReconciliationService.audit();
  assert.equal(report.ok, true);
  assert.equal(report.issues.length, 0);

  // 1. Completed ride without settlement.
  await seedRide(brokenRideId);
  await db.collection('rides').doc(brokenRideId).update({ status: 'COMPLETED' });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'COMPLETED_RIDE_WITHOUT_SETTLEMENT'));

  // 2. Orphan settlement.
  const orphanSettlementId = 'SETTLE_ORPHAN_' + suffix;
  await db.collection('ride_settlements').doc(orphanSettlementId).set({
    settlementId: orphanSettlementId,
    rideId: 'missing-ride-' + suffix,
    driverId,
    grossAmount: 10,
    commission: 1.3,
    driverNet: 8.7,
    settlementState: 'SETTLED'
  });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'SETTLEMENT_WITHOUT_RIDE'));

  // 3. Duplicate settlement for an existing ride.
  const duplicateSettlementId = 'SETTLE_DUP_' + suffix;
  await db.collection('ride_settlements').doc(duplicateSettlementId).set({
    settlementId: duplicateSettlementId,
    rideId: healthyRideId,
    driverId,
    grossAmount: 20,
    commission: 2.6,
    driverNet: 17.4,
    settlementState: 'SETTLED'
  });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'DUPLICATE_SETTLEMENT'));

  // 4. Orphan ride-settlement ledger.
  const orphanLedgerId = 'SETTLE_LEDGER_ORPHAN_' + suffix;
  await db.collection('accounting_ledger').doc(orphanLedgerId).set({
    id: orphanLedgerId,
    type: 'RIDE_SETTLEMENT',
    rideId: 'missing-ride-' + suffix,
    driverId,
    grossAmount: 10,
    commission: 1.3,
    driverNet: 8.7,
    debitTotal: 1.3,
    creditTotal: 1.3,
    balanced: true,
    lines: [
      { account: 'PASIVO_WALLET_MOTORIZADO', side: 'DEBIT', amount: 1.3 },
      { account: 'INGRESO_COMISION_ZENITH', side: 'CREDIT', amount: 1.3 }
    ]
  });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'LEDGER_WITHOUT_SETTLEMENT'));

  // 5. Settlement amount tampering.
  await db.collection('ride_settlements').doc('SETTLE_' + healthyRideId).update({
    commission: 9.99
  });

  report = await FinancialReconciliationService.audit();
  assert.ok(report.issues.some(issue => issue.code === 'COMMISSION_MISMATCH'));
  assert.ok(report.issues.some(issue => issue.code === 'UNBALANCED_LEDGER'));

  console.log('FINANCIAL RECONCILIATION TEST: PASS');
  console.log('PASS: real settlement contract + missing/orphan/duplicate/tampered financial records');
}

main().catch((error) => {
  console.error('FINANCIAL RECONCILIATION TEST: FAIL');
  console.error(error);
  process.exitCode = 1;
});
