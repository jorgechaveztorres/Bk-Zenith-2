export const SettlementEngine = {
  processSettlement: async (driverId: string, bankDetails: string) => {
    const res = await fetch('/api/settlements/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer DUMMY_TOKEN_UNTIL_AUTH_IS_WIRED_ON_FRONTEND` },
      body: JSON.stringify({ driverId, bankDetails })
    });
    return res.json();
  },
  executeAutomaticSettlement: async (driverId: string, bankDetails: string) => {
    return await SettlementEngine.processSettlement(driverId, bankDetails);
  }
};
