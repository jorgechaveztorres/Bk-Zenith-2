// ============================================================================
// ZÉNITH
// Module : Financial / Wallet Service V2
// Layer  : Domain / Services
// File   : WalletService.ts
// ============================================================================

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Wallet, WalletMovement } from '../types';

export const WalletService = {
  // Initialize wallet V2 for any user (passenger or driver)
  getOrCreateWallet: async (userId: string): Promise<Wallet> => {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.wallet) {
        const loadedWallet = data.wallet as Wallet;
        return {
          availableBalance: loadedWallet.availableBalance !== undefined ? loadedWallet.availableBalance : 0.00,
          retainedBalance: loadedWallet.retainedBalance !== undefined ? loadedWallet.retainedBalance : 0.00,
          dailyEarnings: loadedWallet.dailyEarnings !== undefined ? loadedWallet.dailyEarnings : 0.00,
          weeklyEarnings: loadedWallet.weeklyEarnings !== undefined ? loadedWallet.weeklyEarnings : 0.00,
          pendingSettlement: loadedWallet.pendingSettlement !== undefined ? loadedWallet.pendingSettlement : 0.00,
          digitalBalance: loadedWallet.digitalBalance !== undefined ? loadedWallet.digitalBalance : 0.00,
          cashDebt: loadedWallet.cashDebt !== undefined ? loadedWallet.cashDebt : 0.00,
          todaySettlements: loadedWallet.todaySettlements !== undefined ? loadedWallet.todaySettlements : 0,
          nextSettlementDate: loadedWallet.nextSettlementDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          movements: loadedWallet.movements || [],
          
          // Wallet V2 extensions
          pendingBalance: loadedWallet.pendingBalance !== undefined ? loadedWallet.pendingBalance : 0.00,
          promotionalBalance: loadedWallet.promotionalBalance !== undefined ? loadedWallet.promotionalBalance : 25.00, // starting promo balance S/. 25
          compensationBalance: loadedWallet.compensationBalance !== undefined ? loadedWallet.compensationBalance : 0.00,
          accumulatedCommission: loadedWallet.accumulatedCommission !== undefined ? loadedWallet.accumulatedCommission : 0.00,
          monthlyEarnings: loadedWallet.monthlyEarnings !== undefined ? loadedWallet.monthlyEarnings : 0.00,
          dailyBalanceHist: loadedWallet.dailyBalanceHist || {
            Lunes: 120, Martes: 155, Miercoles: 190, Jueves: 240, Viernes: 320, Sabado: 410, Domingo: 480
          },
          weeklyBalanceHist: loadedWallet.weeklyBalanceHist || {
            'Semana 1': 480, 'Semana 2': 610, 'Semana 3': 850, 'Semana 4': 1100
          },
          monthlyBalanceHist: loadedWallet.monthlyBalanceHist || {
            Enero: 1100, Febrero: 1450, Marzo: 1980, Abril: 2450, Mayo: 3100, Junio: 4200
          }
        };
      }
    }
    
    // Default initial wallet with default starting credit (S/. 120 + S/. 25 promo)
    const defaultWallet: Wallet = {
      availableBalance: 120.00,
      retainedBalance: 0.00,
      dailyEarnings: 0.00,
      weeklyEarnings: 0.00,
      pendingSettlement: 0.00,
      digitalBalance: 120.00,
      cashDebt: 0.00,
      todaySettlements: 0,
      nextSettlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      
      // Wallet V2 extensions
      pendingBalance: 0.00,
      promotionalBalance: 25.00,
      compensationBalance: 0.00,
      accumulatedCommission: 0.00,
      monthlyEarnings: 0.00,
      dailyBalanceHist: { Lunes: 120, Martes: 120, Miercoles: 120, Jueves: 120, Viernes: 120, Sabado: 120, Domingo: 120 },
      weeklyBalanceHist: { 'Semana 1': 120, 'Semana 2': 120, 'Semana 3': 120, 'Semana 4': 120 },
      monthlyBalanceHist: { Enero: 120, Febrero: 120, Marzo: 120, Abril: 120, Mayo: 120, Junio: 120 },
      
      movements: [
        {
          id: `mov_init_${Date.now()}`,
          type: 'deposit',
          amount: 120.00,
          description: 'Bono táctico de bienvenida a la red Zénith',
          createdAt: Timestamp.now()
        }
      ]
    };
    
    await updateDoc(userDocRef, {
      wallet: defaultWallet
    });
    
    return defaultWallet;
  },

  // Credit ride earnings to driver's wallet with exact commissions and daily/weekly/monthly statistics logging
  creditRideEarnings: async (driverId: string, amount: number, rideId: string, passengerName: string) => {
    try {
      const userDocRef = doc(db, 'users', driverId);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) return;

      const userData = snap.data();
      let currentWallet = userData.wallet as Wallet;

      if (!currentWallet) {
        currentWallet = await WalletService.getOrCreateWallet(driverId);
      }

      const commission = Number((amount * 0.15).toFixed(2)); // 15% platform commission
      const netEarning = Number((amount - commission).toFixed(2));

      const rideEarningMovement: WalletMovement = {
        id: `mov_earning_${Date.now()}_1`,
        type: 'ride_earning',
        amount: amount,
        description: `Ganancia viaje #${rideId.substring(0, 6)} - Cliente: ${passengerName}`,
        createdAt: Timestamp.now()
      };

      const feeMovement: WalletMovement = {
        id: `mov_fee_${Date.now()}_2`,
        type: 'fee',
        amount: commission,
        description: `Comisión de Red Táctica Zénith (15%) - Viaje #${rideId.substring(0, 6)}`,
        createdAt: Timestamp.now()
      };

      // Update historical data
      const dailyHist = { ...(currentWallet.dailyBalanceHist || {}) };
      const currentDay = new Date().toLocaleDateString('es-ES', { weekday: 'long' });
      const capitalizedDay = currentDay.charAt(0).toUpperCase() + currentDay.slice(1);
      const prevDayVal = dailyHist[capitalizedDay] || 0;
      dailyHist[capitalizedDay] = Number((prevDayVal + netEarning).toFixed(2));

      const updatedWallet: Wallet = {
        availableBalance: Number((currentWallet.availableBalance + netEarning).toFixed(2)),
        retainedBalance: currentWallet.retainedBalance,
        dailyEarnings: Number((currentWallet.dailyEarnings + netEarning).toFixed(2)),
        weeklyEarnings: Number((currentWallet.weeklyEarnings + netEarning).toFixed(2)),
        pendingSettlement: currentWallet.pendingSettlement !== undefined ? currentWallet.pendingSettlement : 0.00,
        digitalBalance: currentWallet.digitalBalance !== undefined ? Number((currentWallet.digitalBalance + netEarning).toFixed(2)) : Number((currentWallet.availableBalance + netEarning).toFixed(2)),
        cashDebt: currentWallet.cashDebt !== undefined ? currentWallet.cashDebt : 0.00,
        todaySettlements: currentWallet.todaySettlements !== undefined ? currentWallet.todaySettlements : 0,
        nextSettlementDate: currentWallet.nextSettlementDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        
        // Wallet V2 properties
        pendingBalance: currentWallet.pendingBalance || 0.00,
        promotionalBalance: currentWallet.promotionalBalance || 0.00,
        compensationBalance: currentWallet.compensationBalance || 0.00,
        accumulatedCommission: Number(((currentWallet.accumulatedCommission || 0) + commission).toFixed(2)),
        monthlyEarnings: Number(((currentWallet.monthlyEarnings || 0) + netEarning).toFixed(2)),
        dailyBalanceHist: dailyHist,
        weeklyBalanceHist: currentWallet.weeklyBalanceHist,
        monthlyBalanceHist: currentWallet.monthlyBalanceHist,
        movements: [rideEarningMovement, feeMovement, ...(currentWallet.movements || [])]
      };

      await updateDoc(userDocRef, {
        wallet: updatedWallet
      });

    } catch (error) {
      console.error("[ZENITH-WALLET-ERROR] Error crediting ride earnings:", error);
    }
  },

  // Record Deposit
  depositFunds: async (userId: string, amount: number, method: string): Promise<Wallet> => {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error("User profile not found");

    const userData = snap.data();
    const currentWallet = userData.wallet as Wallet;

    const newMov: WalletMovement = {
      id: `mov_dep_${Date.now()}`,
      type: 'deposit',
      amount: amount,
      description: `Depósito centralizado vía ${method}`,
      createdAt: Timestamp.now()
    };

    const updatedWallet: Wallet = {
      ...currentWallet,
      availableBalance: Number((currentWallet.availableBalance + amount).toFixed(2)),
      digitalBalance: currentWallet.digitalBalance !== undefined ? Number((currentWallet.digitalBalance + amount).toFixed(2)) : Number((currentWallet.availableBalance + amount).toFixed(2)),
      movements: [newMov, ...(currentWallet.movements || [])]
    };

    await updateDoc(userDocRef, {
      wallet: updatedWallet
    });

    return updatedWallet;
  },

  // Record Withdrawal
  withdrawFunds: async (userId: string, amount: number, bankDetails: string): Promise<Wallet> => {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error("User profile not found");

    const userData = snap.data();
    const currentWallet = userData.wallet as Wallet;
    if (!currentWallet || currentWallet.availableBalance < amount) {
      throw new Error("Saldo disponible insuficiente");
    }

    const newMov: WalletMovement = {
      id: `mov_wtd_${Date.now()}`,
      type: 'withdrawal',
      amount: amount,
      description: `Retiro procesado a: ${bankDetails}`,
      createdAt: Timestamp.now()
    };

    const updatedWallet: Wallet = {
      ...currentWallet,
      availableBalance: Number((currentWallet.availableBalance - amount).toFixed(2)),
      digitalBalance: currentWallet.digitalBalance !== undefined ? Number((currentWallet.digitalBalance - amount).toFixed(2)) : Number((currentWallet.availableBalance - amount).toFixed(2)),
      movements: [newMov, ...(currentWallet.movements || [])]
    };

    await updateDoc(userDocRef, {
      wallet: updatedWallet
    });

    return updatedWallet;
  }
};
