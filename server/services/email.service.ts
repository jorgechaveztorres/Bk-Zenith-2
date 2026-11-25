/**
 * Envío de correo (códigos de verificación de cuenta).
 *
 * EMAIL_PROVIDER=console -> modo prueba: NO envía nada, solo escribe el código en el log del servidor.
 * EMAIL_PROVIDER=smtp    -> envío real vía SMTP (requiere SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *                           y EMAIL_FROM como remitente).
 */
export interface EmailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

class ConsoleEmail implements EmailSender {
  async send(to: string, subject: string, text: string) {
    console.error(`[EMAIL-PRUEBA] a ${to} | ${subject}: ${text}`);
  }
}

class SmtpEmail implements EmailSender {
  private transportPromise: Promise<import('nodemailer').Transporter> | null = null;
  private readonly from: string;

  constructor() {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error('Configura EMAIL_FROM (remitente) para enviar correos.');
    this.from = from;
  }

  private async transport(): Promise<import('nodemailer').Transporter> {
    if (!this.transportPromise) {
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT || 587);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!host || !user || !pass) {
        throw new Error('Configura SMTP_HOST, SMTP_USER y SMTP_PASS para enviar correos.');
      }
      // Import dinámico: así EMAIL_PROVIDER=console (pruebas y desarrollo) nunca necesita el paquete configurado.
      this.transportPromise = import('nodemailer').then(({ default: nodemailer }) =>
        nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
      );
    }
    return this.transportPromise;
  }

  async send(to: string, subject: string, text: string) {
    const transport = await this.transport();
    try {
      await transport.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      console.error(`[EMAIL-SMTP] No se pudo enviar a ${to}:`, (err as Error).message);
      throw new Error('No se pudo enviar el correo. Intenta de nuevo en un momento.');
    }
  }
}

let sender: EmailSender | null = null;

export const getEmailSender = (): EmailSender => {
  if (sender) return sender;
  const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();
  switch (provider) {
    case 'console':
      sender = new ConsoleEmail();
      break;
    case 'smtp':
      sender = new SmtpEmail();
      break;
    default:
      throw new Error(`Proveedor de correo no soportado: ${provider}`);
  }
  return sender;
};

/** Para pruebas automáticas. */
export const setEmailSender = (s: EmailSender | null) => {
  sender = s;
};
