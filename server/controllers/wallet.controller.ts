import { Request, Response } from 'express';
import { WalletService } from '../services/wallet.service';

export const walletController = {
  getOrCreateWallet: async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const uid = (req as any).user.uid;
      if (uid !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const wallet = await WalletService.getOrCreateWallet(userId);
      return res.json({ success: true, wallet });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  depositFunds: async (req: Request, res: Response) => {
    try {
      const { userId, amount, method } = req.body;
      const uid = (req as any).user.uid;
      if (uid !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const wallet = await WalletService.depositFunds(userId, amount, method);
      return res.json({ success: true, wallet });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  withdrawFunds: async (req: Request, res: Response) => {
    try {
      const { userId, amount, bankDetails } = req.body;
      const uid = (req as any).user.uid;
      if (uid !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const wallet = await WalletService.withdrawFunds(userId, amount, bankDetails);
      return res.json({ success: true, wallet });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
