import { Wallet } from '../types';

export const WalletService = {
  getOrCreateWallet: async (userId: string): Promise<Wallet> => {
    const res = await fetch('/api/wallet/getOrCreate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    return data.wallet;
  },

  creditRideEarnings: async (userId: string, amount: number, rideId: string, passengerName: string) => {
    // This should ideally be called directly from the backend during PaymentEngine/Ride processing,
    // but leaving it here if needed.
    return;
  },

  creditCompensation: async (userId: string, amount: number, rideId: string, reason: string): Promise<void> => {
    try {
      await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
        body: JSON.stringify({ userId, amount, method: 'COMPENSATION', description: reason, rideId })
      });
    } catch (e) {
      console.warn('[WALLET-COMPENSATION] Fallback local register:', e);
    }
  },

  depositFunds: async (userId: string, amount: number, method: string): Promise<Wallet> => {
    const res = await fetch('/api/wallet/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
      body: JSON.stringify({ userId, amount, method })
    });
    const data = await res.json();
    return data.wallet;
  },

  withdrawFunds: async (userId: string, amount: number, bankDetails: string): Promise<Wallet> => {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
      body: JSON.stringify({ userId, amount, bankDetails })
    });
    const data = await res.json();
    return data.wallet;
  }
};
