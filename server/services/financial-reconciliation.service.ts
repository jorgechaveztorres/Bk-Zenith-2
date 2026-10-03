import { db } from '../config/firebase';
import { PLATFORM_COMMISSION_RATE } from './ride-settlement.service';

const money = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

const stringField = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const countBy = (items: string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return counts;
};

export type FinancialIssueCode =
  | 'COMPLETED_RIDE_WITHOUT_SETTLEMENT'
  | 'SETTLEMENT_WITHOUT_RIDE'
  | 'DUPLICATE_SETTLEMENT'
  | 'SETTLEMENT_STATE_MISMATCH'
  | 'SETTLEMENT_RIDE_MISMATCH'
  | 'SETTLEMENT_DRIVER_MISMATCH'
  | 'SETTLEMENT_GROSS_MISMATCH'
  | 'COMMISSION_MISMATCH'
  | 'DRIVER_NET_MISMATCH'
  | 'UNBALANCED_LEDGER'
  | 'LEDGER_WITHOUT_SETTLEMENT'
  | 'DUPLICATE_LEDGER'
  | 'MISSING_WALLET_MOVEMENT'
  | 'WALLET_MOVEMENT_MISMATCH';

export interface FinancialReconciliationIssue {
  code: FinancialIssueCode;
  severity: 'ERROR';
  rideId?: string;
  settlementId?: string;
  driverId?: string;
  message: string;
}

export interface FinancialReconciliationReport {
  ok: boolean;
  ridesScanned: number;
  settlementsScanned: number;
  ledgersScanned: number;
  issues: FinancialReconciliationIssue[];
}

export const FinancialReconciliationService = {
  async audit(): Promise<FinancialReconciliationReport> {
    if (!db) throw new Error('Base de datos no disponible.');

    const [ridesSnap, settlementsSnap, ledgerSnap] = await Promise.all([
      db.collection('rides').get(),
      db.collection('ride_settlements').get(),
      db.collection('accounting_ledger').where('type', '==', 'RIDE_SETTLEMENT').get()
    ]);

    const issues: FinancialReconciliationIssue[] = [];
    const rides = new Map<string, Record<string, unknown>>();
    const settlements = new Map<string, Record<string, unknown>>();
    const settlementIdsByRide = new Map<string, string[]>();
    const ledgers = new Map<string, Record<string, unknown>>();
    const ledgerIdsByRide = new Map<string, string[]>();

    ridesSnap.forEach((doc) => rides.set(doc.id, doc.data() as Record<string, unknown>));

    settlementsSnap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      settlements.set(doc.id, data);
      const rideId = stringField(data.rideId);
      if (rideId) {
        const ids = settlementIdsByRide.get(rideId) || [];
        ids.push(doc.id);
        settlementIdsByRide.set(rideId, ids);
      }
    });

    ledgerSnap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      ledgers.set(doc.id, data);
      const rideId = stringField(data.rideId);
      if (rideId) {
        const ids = ledgerIdsByRide.get(rideId) || [];
        ids.push(doc.id);
        ledgerIdsByRide.set(rideId, ids);
      }
    });

    for (const [rideId, ride] of rides) {
      if (ride.status !== 'COMPLETED') continue;

      const settlementId = stringField(ride.settlementId) || 'SETTLE_' + rideId;
      const settlement = settlements.get(settlementId);

      if (!settlement) {
        issues.push({
          code: 'COMPLETED_RIDE_WITHOUT_SETTLEMENT',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'Viaje completado sin liquidación asociada.'
        });
        continue;
      }

      const settlementIds = settlementIdsByRide.get(rideId) || [];
      if (settlementIds.length !== 1 || settlementIds[0] !== settlementId) {
        issues.push({
          code: 'DUPLICATE_SETTLEMENT',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'La relación viaje-liquidación no es uno a uno.'
        });
      }

      if (settlement.settlementState !== 'SETTLED') {
        issues.push({
          code: 'SETTLEMENT_STATE_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'La liquidación no está en estado SETTLED.'
        });
      }

      if (stringField(settlement.rideId) !== rideId) {
        issues.push({
          code: 'SETTLEMENT_RIDE_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'La liquidación apunta a otro viaje.'
        });
      }

      const rideDriverId = stringField(ride.driverId);
      const settlementDriverId = stringField(settlement.driverId);
      if (!rideDriverId || settlementDriverId !== rideDriverId) {
        issues.push({
          code: 'SETTLEMENT_DRIVER_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          driverId: settlementDriverId || rideDriverId,
          message: 'El conductor del viaje y de la liquidación no coinciden.'
        });
      }

      const expectedGross = money(
        typeof ride.protectedPrice === 'number'
          ? ride.protectedPrice
          : typeof ride.finalPrice === 'number' ? ride.finalPrice : 0
      );
      const grossAmount = money(settlement.grossAmount);
      if (grossAmount !== expectedGross) {
        issues.push({
          code: 'SETTLEMENT_GROSS_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'El importe bruto de la liquidación no coincide con la tarifa oficial del viaje.'
        });
      }

      const expectedCommission = money(grossAmount * PLATFORM_COMMISSION_RATE);
      const expectedDriverNet = money(grossAmount - expectedCommission);

      if (money(settlement.commission) !== expectedCommission) {
        issues.push({
          code: 'COMMISSION_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          driverId: settlementDriverId,
          message: 'La comisión de plataforma no coincide con el contrato vigente.'
        });
      }

      if (money(settlement.driverNet) !== expectedDriverNet) {
        issues.push({
          code: 'DRIVER_NET_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          driverId: settlementDriverId,
          message: 'El neto del motorizado no coincide con bruto menos comisión.'
        });
      }

      const ledgerIds = ledgerIdsByRide.get(rideId) || [];
      if (ledgerIds.length > 1) {
        issues.push({
          code: 'DUPLICATE_LEDGER',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'El viaje tiene más de un asiento contable de liquidación.'
        });
      }

      const ledger = ledgers.get(settlementId);
      if (!ledger) {
        issues.push({
          code: 'UNBALANCED_LEDGER',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'No existe el asiento contable de la liquidación.'
        });
      } else {
        const debit = money(ledger.debitTotal);
        const credit = money(ledger.creditTotal);
        const lines = Array.isArray(ledger.lines) ? ledger.lines : [];
        const lineDebit = money(lines
          .filter((line) => line && typeof line === 'object' && (line as Record<string, unknown>).side === 'DEBIT')
          .reduce((sum, line) => sum + money((line as Record<string, unknown>).amount), 0));
        const lineCredit = money(lines
          .filter((line) => line && typeof line === 'object' && (line as Record<string, unknown>).side === 'CREDIT')
          .reduce((sum, line) => sum + money((line as Record<string, unknown>).amount), 0));

        if (
          ledger.type !== 'RIDE_SETTLEMENT' ||
          stringField(ledger.id) !== settlementId ||
          stringField(ledger.rideId) !== rideId ||
          stringField(ledger.driverId) !== settlementDriverId ||
          money(ledger.grossAmount) !== grossAmount ||
          money(ledger.commission) !== money(settlement.commission) ||
          money(ledger.driverNet) !== money(settlement.driverNet) ||
          ledger.balanced !== true ||
          debit !== credit ||
          debit !== money(settlement.commission) ||
          lineDebit !== debit ||
          lineCredit !== credit
        ) {
          issues.push({
            code: 'UNBALANCED_LEDGER',
            severity: 'ERROR',
            rideId,
            settlementId,
            driverId: settlementDriverId,
            message: 'El asiento contable no coincide con la liquidación o está desequilibrado.'
          });
        }
      }

      if (settlementDriverId) {
        const driverSnap = await db.collection('users').doc(settlementDriverId).get();
        const wallet = driverSnap.data()?.wallet as Record<string, unknown> | undefined;
        const movements = Array.isArray(wallet?.movements) ? wallet.movements : [];
        const matching = movements.filter((item) => {
          if (!item || typeof item !== 'object') return false;
          const movement = item as Record<string, unknown>;
          return movement.referenceId === rideId && movement.type === 'platform_commission';
        });

        if (matching.length === 0) {
          issues.push({
            code: 'MISSING_WALLET_MOVEMENT',
            severity: 'ERROR',
            rideId,
            settlementId,
            driverId: settlementDriverId,
            message: 'Falta el movimiento de comisión en el wallet del motorizado.'
          });
        } else if (
          matching.length !== 1 ||
          money((matching[0] as Record<string, unknown>).amount) !== -money(settlement.commission)
        ) {
          issues.push({
            code: 'WALLET_MOVEMENT_MISMATCH',
            severity: 'ERROR',
            rideId,
            settlementId,
            driverId: settlementDriverId,
            message: 'El movimiento de comisión del wallet no coincide con la liquidación.'
          });
        }
      }
    }

    for (const [settlementId, settlement] of settlements) {
      const rideId = stringField(settlement.rideId);
      if (!rideId || !rides.has(rideId)) {
        issues.push({
          code: 'SETTLEMENT_WITHOUT_RIDE',
          severity: 'ERROR',
          settlementId,
          rideId,
          driverId: stringField(settlement.driverId),
          message: 'Existe una liquidación sin viaje asociado.'
        });
      }
    }

    for (const [ledgerId, ledger] of ledgers) {
      const rideId = stringField(ledger.rideId);
      const settlementId = ledgerId;
      if (!rideId || !settlements.has(settlementId)) {
        issues.push({
          code: 'LEDGER_WITHOUT_SETTLEMENT',
          severity: 'ERROR',
          rideId,
          settlementId,
          driverId: stringField(ledger.driverId),
          message: 'Existe un asiento RIDE_SETTLEMENT sin liquidación asociada.'
        });
      }
    }

    return {
      ok: issues.length === 0,
      ridesScanned: rides.size,
      settlementsScanned: settlements.size,
      ledgersScanned: ledgerSnap.size,
      issues
    };
  }
};
