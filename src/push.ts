/**
 * ZÉNITH — Suscripción a Web Push (reemplazo de Firebase Cloud Messaging).
 * Mejor esfuerzo: si el navegador no soporta push, o el usuario no da permiso,
 * la app sigue funcionando igual por WebSocket/consulta normal.
 */
import { PushApi } from './api/endpoints';

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Se llama una vez tras iniciar sesión. No lanza errores: si algo falla, solo se registra en consola. */
export async function enablePushNotifications(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    const publicKey = await PushApi.vapidPublicKey();
    if (!publicKey) return; // servidor sin claves VAPID configuradas: nada que hacer.

    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await PushApi.subscribe(subscription.toJSON() as PushSubscriptionJSON);
  } catch (err) {
    console.warn('[PUSH] No se pudo activar notificaciones:', err);
  }
}

/** Al cerrar sesión: deja de recibir avisos en este celular/navegador. */
export async function disablePushNotifications(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await PushApi.unsubscribe(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('[PUSH] No se pudo desactivar notificaciones:', err);
  }
}
