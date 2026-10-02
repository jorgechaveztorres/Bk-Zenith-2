import { db } from '../config/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const PLATFORM_COMMISSION_RATE = 0.15;
const INTERNAL_WALLET_METHODS = new Set(['wallet', 'zenith_wallet']);

type WalletData = Record<string, unknown>;

export interface RideSettlementResult {
  settlementId: string;
  rideId: string;
  grossAmount: number;
  commission: number;
  driverNet: number;
  paymentMethod: string;
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
  adjustment: number,
  commission: number,
  driverNet: number,
  rideId: string,
  description: string,
  cashCollected: number
): WalletData {
  const movement = {
    id: `settlement_${rideId}`,
    type: adjustment < 0 ? 'platform_commission' : 'ride_earning',
    amount: money(adjustment),
    description,
    createdAt: Timestamp.now(),
    referenceId: rideId
  };

  return {
    ...wallet,
    availableBalance: money(numberField(wallet, 'availableBalance') + adjustment),
    digitalBalance: money(numberField(wallet, 'digitalBalance') + adjustment),
    dailyEarnings: money(numberField(wallet, 'dailyEarnings') + driverNet),
    weeklyEarnings: money(numberField(wallet, 'weeklyEarnings') + driverNet),
    monthlyEarnings: money(numberField(wallet, 'monthlyEarnings') + driverNet),
    accumulatedCommission: money(numberField(wallet, 'accumulatedCommission') + commission),
    cashDebt: money(numberField(wallet, 'cashDebt') + cashCollected),
    movements: [movement, ...arrayField(wallet, 'movements').slice(0, 99)],
    updatedAt: FieldValue.serverTimestamp()
  };
}

export class RideSettlementService {
  static async completeRide(rideId: string, driverId: string): Promise<RideSettlementResult> {
    if (!db) throw new Error('Base de datos no disponible.');

    const rideRef = db.collection('rides').doc(rideId);
    const settlementRef = db.collection('ride_settlements').doc(`SETTLE_${rideId}`);
    const driverRef = db.collection('users').doc(driverId);

    return db.runTransaction(async (transaction) => {
      const rideSnap = await transaction.get(rideRef);
      const settlementSnap = await transaction.get(settlementRef);

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

      const paymentMethod = String(ride.paymentMethod || 'cash').trim().toLowerCase();
      const commission = money(grossAmount * PLATFORM_COMMISSION_RATE);
      const driverNet = money(grossAmount - commission);

      const passengerId = String(ride.passengerId || '');
      const passengerRef = db.collection('users').doc(passengerId);
      const driverSnap = await transaction.get(driverRef);
      const passengerSnap = INTERNAL_WALLET_METHODS.has(paymentMethod)
        ? await transaction.get(passengerRef)
        : null;

      if (!driverSnap.exists) {
        const error: Error & { statusCode?: number } = new Error('Billetera del conductor no encontrada.');
        error.statusCode = 404;
        throw error;
      }

      const driverData = driverSnap.data() as Record<string, unknown>;
      const driverWallet = (driverData.wallet && typeof driverData.wallet === 'object')
        ? driverData.wallet as WalletData
        : {};

      let passengerWallet: WalletData | null = null;
      if (INTERNAL_WALLET_METHODS.has(paymentMethod)) {
        if (!passengerSnap || !passengerSnap.exists) {
          const error: Error & { statusCode?: number } = new Error('Billetera del pasajero no encontrada.');
          error.statusCode = 404;
          throw error;
        }

        const passengerData = passengerSnap.data() as Record<string, unknown>;
        passengerWallet = (passengerData.wallet && typeof passengerData.wallet === 'object')
          ? passengerData.wallet as WalletData
          : {};

        const passengerBalance = numberField(passengerWallet, 'availableBalance');
        if (passengerBalance < grossAmount) {
          const error: Error & { statusCode?: number } = new Error('Saldo insuficiente del pasajero para liquidar el viaje.');
          error.statusCode = 402;
          throw error;
        }
      }

      const isCash = paymentMethod === 'cash';
      const isInternalWallet = INTERNAL_WALLET_METHODS.has(paymentMethod);
      const driverAdjustment = isInternalWallet || !isCash
        ? driverNet
        : -commission;

      const cashCollected = paymentMethod === 'cash' ? grossAmount : 0;

      const newDriverWallet = updatedWallet(
        driverWallet,
        driverAdjustment,
        commission,
        driverNet,
        rideId,
        INTERNAL_WALLET_METHODS.has(paymentMethod)
          ? `Ganancia neta viaje #${rideId.substring(0, 8)}`
          : `Comisión Zénith (15%) viaje #${rideId.substring(0, 8)}`,
        cashCollected
      );

      const now = FieldValue.serverTimestamp();
      const ledgerLines = isInternalWallet
        ? [
            { account: 'PASIVO_WALLET_PASAJERO', side: 'DEBIT', amount: grossAmount },
            { account: 'PASIVO_WALLET_MOTORIZADO', side: 'CREDIT', amount: driverNet },
            { account: 'INGRESO_COMISION_ZENITH', side: 'CREDIT', amount: commission }
          ]
        : isCash
          ? [
              { account: 'PASIVO_WALLET_MOTORIZADO', side: 'DEBIT', amount: commission },
              { account: 'INGRESO_COMISION_ZENITH', side: 'CREDIT', amount: commission }
            ]
          : [
              { account: 'ACTIVO_PROCESADOR_PAGOS', side: 'DEBIT', amount: grossAmount },
              { account: 'PASIVO_WALLET_MOTORIZADO', side: 'CREDIT', amount: driverNet },
              { account: 'INGRESO_COMISION_ZENITH', side: 'CREDIT', amount: commission }
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
        paymentMethod,
        _idempotent: false
      };

      transaction.set(settlementRef, {
        ...settlement,
        passengerId,
        driverId,
        currency: 'PEN',
        paymentState: 'SETTLED',
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
        passengerId,
        driverId,
        paymentMethod,
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

      if (passengerWallet) {
        const newPassengerWallet: WalletData = {
          ...passengerWallet,
          availableBalance: money(numberField(passengerWallet, 'availableBalance') - grossAmount),
          digitalBalance: money(numberField(passengerWallet, 'digitalBalance') - grossAmount),
          movements: [
            {
              id: `settlement_passenger_${rideId}`,
              type: 'ride_payment',
              amount: -grossAmount,
              description: `Pago viaje #${rideId.substring(0, 8)}`,
              createdAt: Timestamp.now(),
              referenceId: rideId
            },
            ...arrayField(passengerWallet, 'movements').slice(0, 99)
          ],
          updatedAt: FieldValue.serverTimestamp()
        };

        transaction.update(passengerRef, { wallet: newPassengerWallet });
      }

      transaction.update(driverRef, { wallet: newDriverWallet });

      transaction.update(rideRef, {
        status: 'COMPLETED',
        completedAt: now,
        settlementId: settlement.settlementId,
        settlementState: 'SETTLED',
        paymentState: 'SETTLED',
        updatedAt: now
      });

      const driverPresenceRef = db.collection('drivers_online').doc(driverId);
      const driverPresenceSnap = await transaction.get(driverPresenceRef);

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
