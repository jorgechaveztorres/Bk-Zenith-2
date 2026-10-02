import { Wallet, TopupRequest } from '../types';
import { auth } from '../firebase/config';

/**
 * Obtiene el token JWT real del usuario autenticado en Firebase.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const currentUser = auth.currentUser;
  const token = currentUser ? await currentUser.getIdToken() : '';
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

export const WalletService = {
  getOrCreateWallet: async (userId: string): Promise<Wallet> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/wallet/getOrCreate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    return data.wallet;
  },

  creditRideEarnings: async (_userId: string, _amount: number, _rideId: string, _passengerName: string) => {
    return;
  },

  creditCompensation: async (userId: string, amount: number, rideId: string, reason: string): Promise<void> => {
    console.warn('[WALLET-COMPENSATION] La compensación directa debe registrarse mediante proceso auditado.');
  },

  /**
   * @deprecated El depósito arbitrario ha sido deshabilitado permanentemente.
   * Utilice requestTopup() para el flujo seguro de recarga vía Yape.
   */
  depositFunds: async (_userId: string, _amount: number, _method: string): Promise<Wallet> => {
    throw new Error('DEPRECATED: El depósito arbitrario está deshabilitado. Utilice WalletService.createTopupRequest() para el flujo seguro V1.');
  },

  withdrawFunds: async (userId: string, amount: number, bankDetails: string): Promise<Wallet> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, amount, bankDetails })
    });
    const data = await res.json();
    return data.wallet;
  },

  // ============================================================================
  // MÉTODOS DEL FLUJO V1 — RECARGAS WALLET CON YAPE PERSONAL
  // ============================================================================

  /**
   * 1. Motorizado solicita recarga con monto.
   * Backend genera referenceCode único no predecible y topupId.
   */
  createTopupRequest: async (amount: number): Promise<TopupRequest> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/request', {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error solicitando recarga.');
    }
    return data.topup;
  },

  /**
   * 2. Motorizado adjunta captura de pantalla del Yape.
   */
  submitReceipt: async (topupId: string, receiptBase64: string, receiptUrl?: string): Promise<TopupRequest> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/receipt', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topupId, receiptBase64, receiptUrl })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error enviando comprobante.');
    }
    return data.topup;
  },

  /**
   * 3. Consulta el estado de una recarga en tiempo real.
   */
  getTopupStatus: async (topupId: string): Promise<TopupRequest> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/topups/status/${topupId}`, {
      method: 'GET',
      headers
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error consultando recarga.');
    }
    return data.topup;
  },

  /**
   * 4. Historial de solicitudes del motorizado autenticado.
   */
  getMyTopupHistory: async (): Promise<TopupRequest[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/my-history', {
      method: 'GET',
      headers
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return [];
    }
    return data.history || [];
  },

  /**
   * 5. Conciliación de operador.
   */
  reconcileTopup: async (topupId: string, bankMovement: any): Promise<TopupRequest> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/reconcile', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topupId, bankMovement })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error en conciliación.');
    }
    return data.topup;
  },

  /**
   * 6. Aprobación manual de casos en REVIEW por operador.
   */
  approveReviewTopup: async (topupId: string, notes: string): Promise<TopupRequest> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/approve-review', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topupId, notes })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error aprobando revisión.');
    }
    return data.topup;
  },

  /**
   * 7. Acreditación atómica final.
   */
  creditVerifiedTopup: async (topupId: string): Promise<any> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/credit', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topupId })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error en acreditación atómica.');
    }
    return data.result;
  },

  /**
   * 8. Obtener solicitudes pendientes para el operador.
   */
  getPendingTopups: async (): Promise<TopupRequest[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/pending', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return [];
    }
    return data.topups || [];
  },

  /**
   * 9. Rechazo explícito de solicitud por el operador.
   */
  rejectTopup: async (topupId: string, reason: string): Promise<TopupRequest> => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/topups/reject', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topupId, reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error rechazando solicitud.');
    }
    return data.topup;
  }
};

