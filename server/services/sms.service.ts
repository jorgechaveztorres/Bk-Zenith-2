/**
 * Envío de SMS (códigos de verificación).
 *
 * SMS_PROVIDER=console  -> modo prueba: NO envía nada, solo escribe el código en el log del servidor.
 * SMS_PROVIDER=twilio   -> envío real por Twilio (requiere TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *                          y TWILIO_FROM_NUMBER o TWILIO_MESSAGING_SERVICE_SID).
 * Para agregar otro proveedor (ej. Gamanet cuando se tenga su documentación), se agrega aquí
 * una clase más que implemente SmsSender, sin tocar el resto del login.
 */
export interface SmsSender {
  send(phoneE164: string, text: string): Promise<void>;
}

class ConsoleSms implements SmsSender {
  async send(phoneE164: string, text: string) {
    // console.error: en cPanel (LiteSpeed) solo stderr.log queda guardado en disco.
    console.error(`[SMS-PRUEBA] a ${phoneE164}: ${text}`);
  }
}

class TwilioSms implements SmsSender {
  private clientPromise: Promise<import('twilio').Twilio> | null = null;
  private readonly from: string | undefined;
  private readonly messagingServiceSid: string | undefined;

  constructor() {
    this.from = process.env.TWILIO_FROM_NUMBER;
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!this.from && !this.messagingServiceSid) {
      throw new Error('Configura TWILIO_FROM_NUMBER o TWILIO_MESSAGING_SERVICE_SID para enviar SMS con Twilio.');
    }
  }

  private async client(): Promise<import('twilio').Twilio> {
    if (!this.clientPromise) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!accountSid || !authToken) {
        throw new Error('Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN para enviar SMS con Twilio.');
      }
      // Import dinámico: así SMS_PROVIDER=console (pruebas y desarrollo) nunca necesita el paquete configurado.
      this.clientPromise = import('twilio').then(({ default: twilio }) => twilio(accountSid, authToken));
    }
    return this.clientPromise;
  }

  async send(phoneE164: string, text: string) {
    const client = await this.client();
    try {
      await client.messages.create({
        to: phoneE164,
        body: text,
        ...(this.messagingServiceSid ? { messagingServiceSid: this.messagingServiceSid } : { from: this.from }),
      });
    } catch (err) {
      console.error(`[SMS-TWILIO] No se pudo enviar a ${phoneE164}:`, (err as Error).message);
      throw new Error('No se pudo enviar el SMS. Intenta de nuevo en un momento.');
    }
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
    case 'twilio':
      sender = new TwilioSms();
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
