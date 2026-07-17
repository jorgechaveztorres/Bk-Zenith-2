import { LoggingService } from './LoggingService';
import { Wallet, WalletMovement, FirestoreTimestamp } from '../types';
import { Timestamp } from 'firebase/firestore';

export interface FinancialTransaction {
  rideId: string;
  totalPrice: number;
  paymentMethod: 'digital' | 'cash';
  passengerId: string;
  driverId: string;
}

export interface SettlementBreakdown {
  driverEarnings: number; // Monto neto acreditado al conductor
  platformFee: number; // Tarifa de comisión de Zénith (p. ej., 15%)
  cashCollectedByUser: number; // Efectivo recaudado en mano por el conductor (0 si es digital)
  balanceAdjustment: number; // Compensación automática cargada a la billetera (negativo si cobró en efectivo)
}

export interface IFinancialEngine {
  processRideSettlement(transaction: FinancialTransaction): Promise<SettlementBreakdown>;
  applyBalanceCompensation(wallet: Wallet, breakdown: SettlementBreakdown, description: string): Wallet;
}

export class FinancialEngineClass implements IFinancialEngine {
  private readonly PLATFORM_COMMISSION_RATE = 0.15; // 15% de comisión fija de Zénith

  /**
   * Procesa la liquidación operativa de un viaje según el método de pago
   */
  async processRideSettlement(transaction: FinancialTransaction): Promise<SettlementBreakdown> {
    try {
      LoggingService.info('FINANCIAL_ENGINE', `Procesando liquidación financiera para viaje: ${transaction.rideId}`);

      const platformFee = Math.round((transaction.totalPrice * this.PLATFORM_COMMISSION_RATE) * 100) / 100;
      const driverEarnings = Math.round((transaction.totalPrice - platformFee) * 100) / 100;

      let cashCollectedByUser = 0;
      let balanceAdjustment = driverEarnings; // Si es digital, el saldo se incrementa en las ganancias netas

      if (transaction.paymentMethod === 'cash') {
        cashCollectedByUser = transaction.totalPrice;
        // Si cobró efectivo, el conductor ya se quedó con la ganancia Y con la comisión de la plataforma.
        // Por lo tanto, se descuenta de su saldo digital el monto de la comisión de la plataforma.
        // Balance Adjustment = Neto Conductor - Efectivo Recibido = (Precio - Comisión) - Precio = -Comisión.
        balanceAdjustment = -platformFee;
        LoggingService.info('FINANCIAL_ENGINE', `Viaje pagado en efectivo. Ajuste compensatorio de saldo digital: -$${platformFee}`);
      } else {
        LoggingService.info('FINANCIAL_ENGINE', `Viaje pagado digitalmente. Acreditación de saldo neto digital: +$${driverEarnings}`);
      }

      const settlement: SettlementBreakdown = {
        driverEarnings,
        platformFee,
        cashCollectedByUser,
        balanceAdjustment
      };

      return settlement;
    } catch (error) {
      LoggingService.error('FINANCIAL_ENGINE', 'Error al procesar la liquidación del viaje', error);
      throw error;
    }
  }

  /**
   * Aplica la compensación automática al estado de la billetera digital del conductor.
   * Si el cobro fue en efectivo, descuenta la comisión de la plataforma; si fue digital, acredita la ganancia.
   */
  applyBalanceCompensation(wallet: Wallet, breakdown: SettlementBreakdown, description: string): Wallet {
    try {
      const timestampNow: FirestoreTimestamp = Timestamp.now();

      const newMovements: WalletMovement[] = [...wallet.movements];

      // Añadir movimiento contable transparente
      const mainMovement: WalletMovement = {
        id: `move_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: breakdown.balanceAdjustment < 0 ? 'cash_compensation' : 'ride_earning',
        amount: breakdown.balanceAdjustment,
        description,
        createdAt: timestampNow
      };
      newMovements.push(mainMovement);

      // Calcular nuevos saldos de la billetera
      const newAvailableBalance = Math.round((wallet.availableBalance + breakdown.balanceAdjustment) * 100) / 100;
      
      // Sumar ganancias brutas o netas al acumulado diario/semanal
      const newDailyEarnings = Math.round((wallet.dailyEarnings + breakdown.driverEarnings) * 100) / 100;
      const newWeeklyEarnings = Math.round((wallet.weeklyEarnings + breakdown.driverEarnings) * 100) / 100;

      LoggingService.info('FINANCIAL_ENGINE', `Billetera actualizada. Balance anterior: $${wallet.availableBalance} | Nuevo: $${newAvailableBalance}`);

      return {
        availableBalance: newAvailableBalance,
        retainedBalance: wallet.retainedBalance,
        dailyEarnings: newDailyEarnings,
        weeklyEarnings: newWeeklyEarnings,
        movements: newMovements,
        pendingSettlement: wallet.pendingSettlement !== undefined ? wallet.pendingSettlement : 0,
        digitalBalance: wallet.digitalBalance !== undefined ? Math.round((wallet.digitalBalance + breakdown.balanceAdjustment) * 100) / 100 : newAvailableBalance,
        cashDebt: wallet.cashDebt !== undefined ? (breakdown.cashCollectedByUser > 0 ? Math.round((wallet.cashDebt + breakdown.cashCollectedByUser) * 100) / 100 : wallet.cashDebt) : 0,
        todaySettlements: wallet.todaySettlements !== undefined ? wallet.todaySettlements : 0,
        nextSettlementDate: wallet.nextSettlementDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      LoggingService.error('FINANCIAL_ENGINE', 'Error al aplicar compensación financiera a la billetera', error);
      throw error;
    }
  }
}

export const FinancialEngine = new FinancialEngineClass();
