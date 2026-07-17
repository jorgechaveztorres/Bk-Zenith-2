import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type TelemetryEventType =
  | 'login'
  | 'logout'
  | 'ride_created'
  | 'ride_accepted'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'offer_sent'
  | 'offer_accepted'
  | 'payment_started'
  | 'payment_completed'
  | 'rating_sent'
  | 'favorite_created'
  | 'wallet_deposit'
  | 'wallet_withdraw';

export interface TelemetryLog {
  event: TelemetryEventType;
  userId?: string;
  role?: string;
  metadata?: any;
  timestamp: string;
}

export const TelemetryService = {
  logEvent: async (event: TelemetryEventType, userId?: string, role?: string, metadata: any = {}) => {
    const timestamp = new Date().toISOString();
    const logData: TelemetryLog = {
      event,
      userId,
      role,
      metadata,
      timestamp
    };

    // Print to console for debug/audit in dev environment
    console.log(`[ZENITH-TELEMETRY] Logged Event: ${event}`, logData);

    // Save to Firestore under 'telemetry_events'
    try {
      await addDoc(collection(db, 'telemetry_events'), {
        ...logData,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn('[ZENITH-TELEMETRY-ERROR] Failed to save telemetry remotely:', error);
      // Fallback: save to localStorage (Offline Capability)
      try {
        const cached = JSON.parse(localStorage.getItem('zenith_telemetry_cache') || '[]');
        cached.push(logData);
        localStorage.setItem('zenith_telemetry_cache', JSON.stringify(cached));
      } catch (e) {
        console.error('[ZENITH-OFFLINE-ERROR] Failed to save to localStorage:', e);
      }
    }
  },

  logCrash: async (error: Error, componentStack?: string, userId?: string) => {
    const crashData = {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack,
      userId,
      timestamp: new Date().toISOString()
    };

    console.error('[ZENITH-CRASHLYTICS] Logged Crash:', crashData);

    try {
      await addDoc(collection(db, 'crash_events'), {
        ...crashData,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('[ZENITH-CRASH-ERROR] Failed to write crash to Firestore:', e);
    }
  },

  // Sync offline telemetry logs back to Firestore
  syncOfflineLogs: async () => {
    try {
      const cached = JSON.parse(localStorage.getItem('zenith_telemetry_cache') || '[]');
      if (cached.length === 0) return;

      console.log(`[ZENITH-TELEMETRY] Syncing ${cached.length} offline logs...`);
      for (const log of cached) {
        await addDoc(collection(db, 'telemetry_events'), {
          ...log,
          createdAt: serverTimestamp()
        });
      }
      localStorage.removeItem('zenith_telemetry_cache');
      console.log('[ZENITH-TELEMETRY] Offline logs synchronized.');
    } catch (error) {
      console.error('[ZENITH-TELEMETRY] Offline logs synchronization failed:', error);
    }
  }
};
