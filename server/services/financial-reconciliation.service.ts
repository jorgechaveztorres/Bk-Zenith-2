import { db } from '../config/firebase';

const COMMISSION_RATE = 0.13;

export type FinancialIssueCode =
  | 'COMPLETED_RIDE_WITHOUT_SETTLEMENT'
  | 'SETTLEMENT_WITHOUT_RIDE'
  | 'DUPLICATE_SETTLEMENT'
  | 'UNBALANCED_LEDGER'
  | 'COMMISSION_MISMATCH'
  | 'DRIVER_NET_MISMATCH'
  | 'MISSING_WALLET_MOVEMENT';

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

function money(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : 0;
}

export const FinancialReconciliationService = {
  async audit(): Promise<FinancialReconciliationReport> {
    if (!db) throw new Error('Base de datos no disponible.');

    const [ridesSnap, settlementsSnap, ledgerSnap] = await Promise.all([
      db.collection('rides').get(),
      db.collection('ride_settlements').get(),
      db.collection('accounting_ledger').get()
    ]);

    const issues: FinancialReconciliationIssue[] = [];
    const rides = new Map<string, Record<string, unknown>>();
    const settlements = new Map<string, Record<string, unknown>>();
    const ledgerBySettlementId = new Map<string, Record<string, unknown>>();
    const settlementCountByRide = new Map<string, number>();

    ridesSnap.forEach((doc) => rides.set(doc.id, doc.data() as Record<string, unknown>));

    settlementsSnap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      settlements.set(doc.id, data);
      const rideId = typeof data.rideId === 'string' ? data.rideId : '';
      if (rideId) settlementCountByRide.set(rideId, (settlementCountByRide.get(rideId) || 0) + 1);
    });

    ledgerSnap.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const rideId = typeof data.rideId === 'string' ? data.rideId : '';
      const settlementId = typeof data.id === 'string'
        ? data.id
        : typeof data.settlementId === 'string' ? data.settlementId : doc.id;
      if (rideId) ledgerBySettlementId.set(settlementId, data);
    });

    for (const [rideId, ride] of rides) {
      if (ride.status !== 'COMPLETED') continue;

      const settlementId = typeof ride.settlementId === 'string' ? ride.settlementId : 'SETTLE_' + rideId;
      const settlement = settlements.get(settlementId);

      if (!settlement) {
        issues.push({
          code: 'COMPLETED_RIDE_WITHOUT_SETTLEMENT',
          severity: 'ERROR',
          rideId,
          message: 'Viaje completado sin liquidación ' + settlementId + '.'
        });
        continue;
      }

      const duplicateCount = settlementCountByRide.get(rideId) || 0;
      if (duplicateCount !== 1) {
        issues.push({
          code: 'DUPLICATE_SETTLEMENT',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'El viaje tiene ' + duplicateCount + ' liquidaciones.'
        });
      }

      const grossAmount = money(settlement.grossAmount);
      const expectedCommission = money(grossAmount * COMMISSION_RATE);
      const expectedDriverNet = money(grossAmount - expectedCommission);

      if (money(settlement.commission) !== expectedCommission) {
        issues.push({
          code: 'COMMISSION_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          driverId: typeof settlement.driverId === 'string' ? settlement.driverId : undefined,
          message: 'Comisión inválida.'
        });
      }

      if (money(settlement.driverNet) !== expectedDriverNet) {
        issues.push({
          code: 'DRIVER_NET_MISMATCH',
          severity: 'ERROR',
          rideId,
          settlementId,
          driverId: typeof settlement.driverId === 'string' ? settlement.driverId : undefined,
          message: 'Neto del motorizado inválido.'
        });
      }

      const ledger = ledgerBySettlementId.get(settlementId);
      if (!ledger || money(ledger.debitTotal) !== money(ledger.creditTotal) || money(ledger.debitTotal) !== expectedCommission) {
        issues.push({
          code: 'UNBALANCED_LEDGER',
          severity: 'ERROR',
          rideId,
          settlementId,
          message: 'Ledger inexistente o desequilibrado.'
        });
      }

      const driverId = typeof settlement.driverId === 'string' ? settlement.driverId : '';
      if (driverId) {
        const driverSnap = await db.collection('users').doc(driverId).get();
        const wallet = driverSnap.data()?.wallet as Record<string, unknown> | undefined;
        const movements = Array.isArray(wallet?.movements) ? wallet.movements : [];
        const movement = movements.find((item) => {
          if (!item || typeof item !== 'object') return false;
          const movementData = item as Record<string, unknown>;
          return movementData.referenceId === rideId && movementData.type === 'platform_commission';
        });

        if (!movement) {
          issues.push({
            code: 'MISSING_WALLET_MOVEMENT',
            severity: 'ERROR',
            rideId,
            settlementId,
            driverId,
            message: 'Falta el movimiento de comisión en el wallet.'
          });
        }
      }
    }

    for (const [settlementId, settlement] of settlements) {
      const rideId = typeof settlement.rideId === 'string' ? settlement.rideId : '';
      if (!rideId || !rides.has(rideId)) {
        issues.push({
          code: 'SETTLEMENT_WITHOUT_RIDE',
          severity: 'ERROR',
          settlementId,
          rideId: rideId || undefined,
          driverId: typeof settlement.driverId === 'string' ? settlement.driverId : undefined,
          message: 'Existe una liquidación sin viaje asociado.'
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
