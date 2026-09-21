export interface PaymentMethodDetails {
  method: 'cash' | 'yape' | 'plin' | 'card' | 'wallet' | 'mixed';
  amount: number;
  phone?: string;
  cardNumber?: string;
}

export const PaymentEngine = {
  processPayment: async (ride: any, details: PaymentMethodDetails) => {
    const res = await fetch('/api/payments/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
      body: JSON.stringify({ 
        rideId: ride.id, 
        passengerId: ride.passengerId, 
        driverId: ride.driverId || 'pending', 
        amount: details.amount, 
        details 
      })
    });
    return res.json();
  }
};
