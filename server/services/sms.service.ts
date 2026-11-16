/**
 * Envío de SMS (códigos de verificación).
 *
 * SMS_PROVIDER=console  -> modo prueba: NO envía nada, solo escribe el código en el log del servidor.
 * Cuando se contrate un proveedor real se agrega aquí, sin tocar el resto del login.
 */
export interface SmsSender {
  send(phoneE164: string, text: string): Promise<void>;
}

class ConsoleSms implements SmsSender {
  async send(phoneE164: string, text: string) {
    console.log(`[SMS-PRUEBA] a ${phoneE164}: ${text}`);
  }
}

let sender: SmsSender | null = null;

export const getSmsSender = (): SmsSender => {
  if (sender) return sender;
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  switch (provider) {
    case 'console':
      sender = new ConsoleSms();
      break;
    default:
      throw new Error(`Proveedor de SMS no soportado: ${provider}`);
  }
  return sender;
};

/** Para pruebas automáticas. */
export const setSmsSender = (s: SmsSender | null) => {
  sender = s;
};
