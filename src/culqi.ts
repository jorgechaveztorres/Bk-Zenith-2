/**
 * ZÉNITH — Botón de pago Culqi (tarjeta/Yape), carga el script oficial al vuelo.
 * No se instala por npm: es el widget que aloja Culqi, igual que lo pide su doc.
 */
declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      settings: (opts: { title: string; currency: string; amount: number }) => void;
      options: (opts: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
      token?: { id: string };
      error?: { user_message?: string };
    };
    culqi?: () => void;
  }
}

let scriptLoading: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (window.Culqi) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = 'https://checkout.culqi.com/js/v4';
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error('No se pudo cargar Culqi. Revisa tu conexión.'));
    document.head.appendChild(tag);
  });
  return scriptLoading;
};

/** Abre el botón de pago y devuelve el token para mandarlo al servidor. Rechaza si el usuario cancela o falla. */
export async function openCulqiCheckout(publicKey: string, amountSoles: number): Promise<string> {
  await loadScript();
  const Culqi = window.Culqi;
  if (!Culqi) throw new Error('Culqi no está disponible.');

  return new Promise((resolve, reject) => {
    Culqi.publicKey = publicKey;
    Culqi.settings({ title: 'ZÉNITH', currency: 'PEN', amount: Math.round(amountSoles * 100) });
    Culqi.options({
      lang: 'auto',
      style: { logo: '/zenith-eagle-marker.svg' },
      paymentMethods: { tarjeta: true, yape: true, bancaMovil: false, agente: false, billetera: false, cuotealo: false },
    });
    window.culqi = () => {
      if (Culqi.token?.id) resolve(Culqi.token.id);
      else reject(new Error(Culqi.error?.user_message || 'Pago cancelado o rechazado.'));
    };
    Culqi.open();
  });
}
