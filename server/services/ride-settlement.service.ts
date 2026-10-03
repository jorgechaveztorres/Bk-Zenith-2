import { db } from '../config/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const PLATFORM_COMMISSION_RATE = 0.13;

type WalletData = Record<string, unknown>;

export interface RideSettlementResult {
  settlementId: string;
  rideId: string;
  grossAmount: number;
  commission: number;
  driverNet: number;
  _idempotent: boolean;
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

function numberField(wallet: WalletData, key: string): number {
  const value = wallet[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function arrayField(wallet: WalletData, key: string): unknown[] {
  return Array.isArray(wallet[key]) ? wallet[key] as unknown[] : [];
}

function updatedWallet(
  wallet: WalletData,
  commission: number,
  driverNet: number,
  rideId: string
): WalletData {
  const movement = {
    id: `settlement_${rideId}`,
    type: 'platform_commission',
    amount: money(-commission),
    description: `Comisión Zénith (13%) viaje #${rideId.substring(0, 8)}`,
    createdAt: Timestamp.now(),
    referenceId: rideId
  };

  return {
    ...wallet,
    availableBalance: money(numberField(wallet, 'availableBalance') - commission),
    digitalBalance: money(numberField(wallet, 'digitalBalance') - commission),
    dailyEarnings: money(numberField(wallet, 'dailyEarnings') + driverNet),
    weeklyEarnings: money(numberField(wallet, 'weeklyEarnings') + driverNet),
    monthlyEarnings: money(numberField(wallet, 'monthlyEarnings') + driverNet),
    accumulatedCommission: money(numberField(wallet, 'accumulatedCommission') + commission),
    movements: [movement, ...arrayField(wallet, 'movements').slice(0, 99)],
    updatedAt: FieldValue.serverTimestamp()
  };
}

export class RideSettlementService {
  /**
   * La tarifa del viaje es un acuerdo operativo de ZÉNITH.
   * El cobro cliente -> motorizado ocurre fuera de ZÉNITH y no es procesado,
   * retenido ni liquidado por la plataforma.
   *
   * ZÉNITH solo registra el resultado del servicio y carga al Wallet del
   * motorizado la comisión de plataforma del 13%.
   */
  static async completeRide(rideId: string, driverId: string): Promise<RideSettlementResult> {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideRef = db.collection('rides').doc(rideId);
    const settlementRef = db.collection('ride_settlements').doc(`SETTLE_${rideId}`);
    const driverRef = db.collection('users').doc(driverId);
    const driverPresenceRef = db.collection('drivers_online').doc(driverId);

    return db.runTransaction(async (transaction) => {
      const rideSnap = await transaction.get(rideRef);
      const settlementSnap = await transaction.get(settlementRef);
      const driverSnap = await transaction.get(driverRef);
      const driverPresenceSnap = await transaction.get(driverPresenceRef);

      if (!rideSnap.exists) {
        const error: Error & { statusCode?: number } = new Error('Viaje no encontrado.');
        error.statusCode = 404;
        throw error;
      }

      const ride = rideSnap.data() as Record<string, unknown>;

      if (settlementSnap.exists) {
        const existing = settlementSnap.data() as RideSettlementResult;
        if (ride.driverId !== driverId) {
          const error: Error & { statusCode?: number } = new Error('No tienes permiso para consultar esta liquidación.');
          error.statusCode = 403;
          throw error;
        }
        return { ...existing, _idempotent: true };
      }

      if (ride.driverId !== driverId) {
        const error: Error & { statusCode?: number } = new Error('No tienes permiso para completar este viaje.');
        error.statusCode = 403;
        throw error;
      }

      if (ride.status !== 'IN_PROGRESS') {
        const error: Error & { statusCode?: number } = new Error(
          `No se puede liquidar el viaje desde el estado '${String(ride.status)}'.`
        );
        error.statusCode = ride.status === 'COMPLETED' ? 409 : 400;
        throw error;
      }

      const grossAmount = money(
        typeof ride.protectedPrice === 'number'
          ? ride.protectedPrice
          : typeof ride.finalPrice === 'number' ? ride.finalPrice : 0
      );

      if (grossAmount <= 0) {
        const error: Error & { statusCode?: number } = new Error('Tarifa oficial inválida para liquidación.');
        error.statusCode = 400;
        throw error;
      }

      if (!driverSnap.exists) {
        const error: Error & { statusCode?: number } = new Error('Billetera del conductor no encontrada.');
        error.statusCode = 404;
        throw error;
      }

      const driverData = driverSnap.data() as Record<string, unknown>;
      const driverWallet = (driverData.wallet && typeof driverData.wallet === 'object')
        ? driverData.wallet as WalletData
        : {};

      const commission = money(grossAmount * PLATFORM_COMMISSION_RATE);
      const driverNet = money(grossAmount - commission);
      const newDriverWallet = updatedWallet(driverWallet, commission, driverNet, rideId);

      const ledgerLines = [
        {
          account: 'PASIVO_WALLET_MOTORIZADO',
          side: 'DEBIT',
          amount: commission
        },
        {
          account: 'INGRESO_COMISION_ZENITH',
          side: 'CREDIT',
          amount: commission
        }
      ];

      const totalDebit = money(
        ledgerLines.filter(line => line.side === 'DEBIT').reduce((sum, line) => sum + line.amount, 0)
      );
      const totalCredit = money(
        ledgerLines.filter(line => line.side === 'CREDIT').reduce((sum, line) => sum + line.amount, 0)
      );

      if (totalDebit !== totalCredit) {
        const error: Error & { statusCode?: number } = new Error('Asiento contable desequilibrado.');
        error.statusCode = 500;
        throw error;
      }

      const settlement: RideSettlementResult = {
        settlementId: `SETTLE_${rideId}`,
        rideId,
        grossAmount,
        commission,
        driverNet,
        _idempotent: false
      };

      const now = FieldValue.serverTimestamp();

      transaction.set(settlementRef, {
        ...settlement,
        passengerId: ride.passengerId || null,
        driverId,
        currency: 'PEN',
        settlementState: 'SETTLED',
        ledgerBalanced: true,
        totalDebit,
        totalCredit,
        createdAt: now,
        updatedAt: now
      });

      transaction.set(db.collection('accounting_ledger').doc(settlement.settlementId), {
        id: settlement.settlementId,
        type: 'RIDE_SETTLEMENT',
        rideId,
        passengerId: ride.passengerId || null,
        driverId,
        grossAmount,
        commission,
        driverNet,
        currency: 'PEN',
        debitTotal: totalDebit,
        creditTotal: totalCredit,
        balanced: true,
        lines: ledgerLines,
        createdAt: now
      });

      transaction.update(driverRef, { wallet: newDriverWallet });

      transaction.update(rideRef, {
        status: 'COMPLETED',
        completedAt: now,
        settlementId: settlement.settlementId,
        settlementState: 'SETTLED',
        updatedAt: now
      });

      if (driverPresenceSnap.exists) {
        transaction.update(driverPresenceRef, {
          status: 'AVAILABLE',
          currentRideId: null,
          lastActive: now
        });
      }

      return settlement;
    });
  }
}
