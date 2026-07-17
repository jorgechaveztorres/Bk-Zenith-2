import { TelemetryService } from './TelemetryService';

export type PaymentMethod = 'yape' | 'plin' | 'visa' | 'mastercard' | 'bank_transfer';

export interface PaymentDetails {
  method: PaymentMethod;
  amount: number;
  phone?: string;          // For Yape/Plin
  cardNumber?: string;     // For Card payments
  cardExpiry?: string;     // For Card payments
  cardCVV?: string;        // For Card payments
  accountNumber?: string;  // For Bank Transfer
  bankName?: string;       // For Bank Transfer
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  amount: number;
  method: PaymentMethod;
  message: string;
  timestamp: string;
}

export const PaymentService = {
  /**
   * Decoupled transaction processor.
   * This structure handles payment routing abstractly, keeping API credentials or keys detached.
   */
  processPayment: async (
    userId: string,
    details: PaymentDetails
  ): Promise<PaymentResponse> => {
    console.log(`[ZENITH-PAYMENT] Initializing decoupled payment routing for User: ${userId}`, details);
    
    // Log start event to telemetry
    await TelemetryService.logEvent('payment_started', userId, undefined, {
      method: details.method,
      amount: details.amount
    });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockTxId = `tx_${details.method.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Base validation
    if (details.amount <= 0) {
      return {
        success: false,
        transactionId: mockTxId,
        amount: details.amount,
        method: details.method,
        message: 'Monto de transacción inválido.',
        timestamp: new Date().toISOString()
      };
    }

    // Process specific payment types
    let isSuccess = true;
    let message = 'Transacción autorizada y liquidada por el procesador descentralizado.';

    switch (details.method) {
      case 'yape':
      case 'plin':
        if (!details.phone || details.phone.length < 9) {
          isSuccess = false;
          message = 'Número de celular inválido para pasarela digital.';
        } else {
          message = `Transferencia digital validada mediante token de red móvil para celular ${details.phone}.`;
        }
        break;

      case 'visa':
      case 'mastercard':
        if (!details.cardNumber || details.cardNumber.length < 16) {
          isSuccess = false;
          message = 'Tarjeta de crédito o débito rechazada por el banco emisor.';
        } else {
          message = `Autorización aprobada por adquirente local. Tarjeta terminada en ${details.cardNumber.slice(-4)}.`;
        }
        break;

      case 'bank_transfer':
        if (!details.accountNumber) {
          isSuccess = false;
          message = 'Número de cuenta o código interbancario faltante.';
        } else {
          message = `Transferencia interbancaria programada. Pendiente de verificación por ${details.bankName || 'Entidad Central'}.`;
        }
        break;
    }

    if (isSuccess) {
      // Log successful transaction to telemetry
      await TelemetryService.logEvent('payment_completed', userId, undefined, {
        method: details.method,
        amount: details.amount,
        transactionId: mockTxId
      });
    }

    return {
      success: isSuccess,
      transactionId: mockTxId,
      amount: details.amount,
      method: details.method,
      message,
      timestamp: new Date().toISOString()
    };
  }
};
