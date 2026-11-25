import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool, withTransaction } from '../config/mysql';
import { getEmailSender } from './email.service';

/**
 * LOGIN ZÉNITH (opción correo, sin costo de SMS):
 *  - Registro: correo -> código por email -> crea cuenta con clave.
 *  - Día a día: correo + clave (sin envío, sin costo).
 *  - Olvidó la clave: correo -> código por email -> clave nueva.
 *  El celular queda como dato opcional de contacto (Yape/Plin, pedidos), no como login.
 */

export type AppRole = 'passenger' | 'driver';
type OtpPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_15MIN = 3;
const OTP_MAX_PER_DAY = 6;
const ACCESS_TTL = '1h';
const REFRESH_TTL_DAYS = 30;
const MIN_PASSWORD = 6;

/**
 * Clave que firma las sesiones. Dos formas:
 *  - JWT_SECRET (variable de entorno), o
 *  - JWT_SECRET_FILE: ruta a un archivo privado. Si no existe, el servidor lo crea
 *    una sola vez con 64 bytes aleatorios (permiso 600). Así nadie tiene que inventarla ni verla.
 */
let cachedSecret: string | null = null;
const jwtSecret = (): string => {
  if (cachedSecret) return cachedSecret;
  let s = process.env.JWT_SECRET;
  const file = process.env.JWT_SECRET_FILE;
  if (!s && file) {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      fs.writeFileSync(file, crypto.randomBytes(64).toString('base64url'), { mode: 0o600, flag: 'wx' });
    }
    s = fs.readFileSync(file, 'utf8').trim();
  }
  if (!s || s.length < 32) throw new Error('Falta JWT_SECRET (o JWT_SECRET_FILE) de al menos 32 caracteres.');
  cachedSecret = s;
  return s;
};

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const hashOtp = (email: string, purpose: OtpPurpose, code: string) =>
  sha256(`${jwtSecret()}|${email}|${purpose}|${code}`);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (raw: unknown): string => {
  if (typeof raw !== 'string') throw new AuthError(400, 'Correo inválido.');
  const email = raw.trim().toLowerCase();
  if (email.length > 190 || !EMAIL_RE.test(email)) throw new AuthError(400, 'Escribe un correo válido.');
  return email;
};

/** Acepta 987654321, 51987654321, +51 987 654 321 -> +51987654321 (celular peruano). Opcional, solo contacto. */
export const normalizePhone = (raw: unknown): string => {
  if (typeof raw !== 'string') throw new AuthError(400, 'Número de celular inválido.');
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
  if (!/^9\d{8}$/.test(d)) throw new AuthError(400, 'El celular debe tener 9 dígitos y empezar con 9.');
  return `+51${d}`;
};

const validatePassword = (p: unknown): string => {
  if (typeof p !== 'string' || p.length < MIN_PASSWORD) {
    throw new AuthError(400, `La clave debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  if (p.length > 72) throw new AuthError(400, 'La clave es demasiado larga.');
  return p;
};

const validateName = (n: unknown): string => {
  if (typeof n !== 'string' || n.trim().length < 3) throw new AuthError(400, 'Escribe tu nombre completo.');
  return n.trim().slice(0, 150);
};

const validateRole = (r: unknown): AppRole => {
  if (r === 'driver' || r === 'MOTORIZADO') return 'driver';
  if (r === 'passenger' || r === 'CLIENTE' || r === undefined) return 'passenger';
  throw new AuthError(400, 'Rol inválido.');
};

interface UserRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  password_hash: string | null;
  role: AppRole;
  is_admin: number;
  is_blocked: number;
  email_verified: number;
  kyc_status: string;
}

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: AppRole;
  isAdmin: boolean;
  kycStatus: string;
}

const toPublic = (u: UserRow): PublicUser => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  isAdmin: u.is_admin === 1,
  kycStatus: u.kyc_status,
});

const USER_FIELDS = 'id, full_name, email, phone, password_hash, role, is_admin, is_blocked, email_verified, kyc_status';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

export interface AccessClaims {
  sub: string;
  role: AppRole;
  adm: boolean;
}

// ---------------------------------------------------------------- OTP

// Nota: la columna `phone` de otp_codes ahora guarda el identificador de OTP (el correo),
// ampliada a VARCHAR(190) en la migración 009. No se renombró para evitar tocar más tablas.
const issueOtp = async (email: string, purpose: OtpPurpose): Promise<void> => {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       SUM(created_at > NOW(3) - INTERVAL 15 MINUTE) AS last15,
       COUNT(*) AS lastDay
     FROM otp_codes WHERE phone = ? AND created_at > NOW(3) - INTERVAL 1 DAY`,
    [email]
  );
  const last15 = Number(rows[0]?.last15 || 0);
  const lastDay = Number(rows[0]?.lastDay || 0);
  if (last15 >= OTP_MAX_PER_15MIN || lastDay >= OTP_MAX_PER_DAY) {
    throw new AuthError(429, 'Pediste muchos códigos. Espera unos minutos e inténtalo de nuevo.');
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await pool.execute(
    `INSERT INTO otp_codes (phone, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, NOW(3) + INTERVAL ${OTP_TTL_MIN} MINUTE)`,
    [email, purpose, hashOtp(email, purpose, code)]
  );
  await getEmailSender().send(email, 'Tu código Zénith', `Tu código es ${code}. Vence en ${OTP_TTL_MIN} minutos. No lo compartas.`);
};

/** Verifica y CONSUME el código (solo sirve una vez). Debe llamarse dentro de una transacción. */
const consumeOtp = async (
  conn: import('mysql2/promise').PoolConnection,
  email: string,
  purpose: OtpPurpose,
  code: unknown
): Promise<void> => {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new AuthError(400, 'El código tiene 6 números.');

  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE phone = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW(3)
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [email, purpose]
  );
  const otp = rows[0];
  if (!otp) throw new AuthError(400, 'El código venció o no existe. Pide uno nuevo.');
  if (Number(otp.attempts) >= OTP_MAX_ATTEMPTS) throw new AuthError(429, 'Demasiados intentos. Pide un código nuevo.');

  const expected = Buffer.from(String(otp.code_hash), 'hex');
  const given = Buffer.from(hashOtp(email, purpose, code), 'hex');
  if (!crypto.timingSafeEqual(expected, given)) {
    await conn.execute('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [otp.id]);
    throw new AuthError(400, 'Código incorrecto.');
  }
  await conn.execute('UPDATE otp_codes SET used_at = NOW(3) WHERE id = ?', [otp.id]);
};

// ---------------------------------------------------------------- Tokens

const createSession = async (
  conn: import('mysql2/promise').PoolConnection | null,
  user: UserRow,
  deviceInfo?: string
): Promise<Session> => {
  const claims: AccessClaims = { sub: user.id, role: user.role, adm: user.is_admin === 1 };
  const accessToken = jwt.sign(claims, jwtSecret(), { expiresIn: ACCESS_TTL, issuer: 'zenith' });
  const refreshToken = crypto.randomBytes(48).toString('base64url');

  const exec = conn ?? getPool();
  await exec.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
     VALUES (?, ?, ?, NOW(3) + INTERVAL ${REFRESH_TTL_DAYS} DAY)`,
    [user.id, sha256(refreshToken), deviceInfo ? deviceInfo.slice(0, 255) : null]
  );
  return { accessToken, refreshToken, expiresIn: 3600, user: toPublic(user) };
};

export const verifyAccessToken = (token: string): AccessClaims => {
  try {
    const decoded = jwt.verify(token, jwtSecret(), { issuer: 'zenith' });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') throw new Error('token');
    return { sub: decoded.sub, role: decoded.role as AppRole, adm: decoded.adm === true };
  } catch {
    throw new AuthError(401, 'Sesión vencida. Vuelve a entrar.');
  }
};

const findByEmail = async (
  exec: Pick<import('mysql2/promise').Pool, 'query'>,
  email: string,
  lock = false
): Promise<UserRow | undefined> => {
  const [rows] = await exec.query<UserRow[]>(
    `SELECT ${USER_FIELDS} FROM users WHERE email = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [email]
  );
  return rows[0];
};

// ---------------------------------------------------------------- Casos de uso

/** Paso 1 del registro: manda el código por correo. */
export const startRegistration = async (rawEmail: unknown): Promise<void> => {
  const email = normalizeEmail(rawEmail);
  const existing = await findByEmail(getPool(), email);
  if (existing) throw new AuthError(409, 'Este correo ya tiene cuenta. Entra con tu clave.');
  await issueOtp(email, 'VERIFY_EMAIL');
};

/** Paso 2 del registro: código correcto -> crea la cuenta y entra. El celular es opcional (solo contacto). */
export const completeRegistration = async (input: {
  email: unknown; code: unknown; password: unknown; fullName: unknown; role: unknown; phone?: unknown; deviceInfo?: string;
}): Promise<Session> => {
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const fullName = validateName(input.fullName);
  const role = validateRole(input.role);
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const passwordHash = await bcrypt.hash(password, 10);

  return withTransaction(async (conn) => {
    await consumeOtp(conn, email, 'VERIFY_EMAIL', input.code);
    if (await findByEmail(conn, email, true)) throw new AuthError(409, 'Este correo ya tiene cuenta.');

    const id = crypto.randomUUID();
    const roleLabel = role === 'driver' ? 'MOTORIZADO' : 'CLIENTE';
    await conn.execute(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role, roles_enabled, active_role, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, JSON_ARRAY(?), ?, 1)`,
      [id, fullName, email, phone, passwordHash, role, roleLabel, roleLabel]
    );
    if (role === 'driver') {
      await conn.execute('INSERT INTO driver_profiles (user_id) VALUES (?)', [id]);
      await conn.execute('INSERT INTO wallets (driver_id) VALUES (?)', [id]);
    }
    await conn.execute(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id) VALUES (?, ?, 'USER_REGISTERED', 'user', ?)`,
      [id, role, id]
    );
    const user = await findByEmail(conn, email);
    if (!user) throw new AuthError(500, 'No se pudo crear la cuenta.');
    return createSession(conn, user, input.deviceInfo);
  });
};

/** Entrar con correo + clave. Mensaje igual si falla el correo o la clave (no revela si existe). */
export const login = async (input: { email: unknown; password: unknown; deviceInfo?: string }): Promise<Session> => {
  const email = normalizeEmail(input.email);
  if (typeof input.password !== 'string') throw new AuthError(400, 'Escribe tu clave.');
  const user = await findByEmail(getPool(), email);
  const ok = user?.password_hash ? await bcrypt.compare(input.password, user.password_hash) : false;
  if (!user || !ok) throw new AuthError(401, 'Correo o clave incorrectos.');
  if (user.is_blocked === 1) throw new AuthError(403, 'Tu cuenta está bloqueada. Escribe a soporte.');
  return createSession(null, user, input.deviceInfo);
};

/** Renueva la sesión sin volver a pedir clave. El token viejo deja de servir (rotación). */
export const refreshSession = async (rawToken: unknown): Promise<Session> => {
  if (typeof rawToken !== 'string' || rawToken.length < 20) throw new AuthError(401, 'Sesión inválida.');

  // Reuso de un token ya rotado = posible robo. Se cierran TODAS las sesiones del usuario.
  // Va fuera de la transacción para que el cierre no se deshaga al lanzar el error.
  const [reused] = await getPool().query<RowDataPacket[]>(
    'SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL',
    [sha256(rawToken)]
  );
  if (reused[0]) {
    await getPool().execute(
      'UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL',
      [reused[0].user_id]
    );
    throw new AuthError(401, 'Sesión cerrada por seguridad. Vuelve a entrar.');
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, device_info, revoked_at, expires_at > NOW(3) AS alive
       FROM refresh_tokens WHERE token_hash = ? FOR UPDATE`,
      [sha256(rawToken)]
    );
    const rt = rows[0];
    if (!rt) throw new AuthError(401, 'Sesión inválida.');
    if (rt.revoked_at) throw new AuthError(401, 'Sesión cerrada por seguridad. Vuelve a entrar.');
    if (!Number(rt.alive)) throw new AuthError(401, 'Sesión vencida. Vuelve a entrar.');

    await conn.execute('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE id = ?', [rt.id]);
    const [urows] = await conn.query<UserRow[]>(
      `SELECT ${USER_FIELDS} FROM users WHERE id = ?`,
      [rt.user_id]
    );
    const user = urows[0];
    if (!user || user.is_blocked === 1) throw new AuthError(403, 'Cuenta no disponible.');
    return createSession(conn, user, rt.device_info ?? undefined);
  });
};

export const logout = async (rawToken: unknown): Promise<void> => {
  if (typeof rawToken !== 'string') return;
  await getPool().execute('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE token_hash = ? AND revoked_at IS NULL', [sha256(rawToken)]);
};

/** Olvidé mi clave, paso 1. Siempre responde OK para no revelar qué correos existen. */
export const startPasswordReset = async (rawEmail: unknown): Promise<void> => {
  const email = normalizeEmail(rawEmail);
  const user = await findByEmail(getPool(), email);
  if (!user || user.is_blocked === 1) return;
  await issueOtp(email, 'RESET_PASSWORD');
};

/** Olvidé mi clave, paso 2: código + clave nueva. Cierra todas las sesiones abiertas. */
export const completePasswordReset = async (input: {
  email: unknown; code: unknown; newPassword: unknown; deviceInfo?: string;
}): Promise<Session> => {
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.newPassword);
  const passwordHash = await bcrypt.hash(password, 10);

  return withTransaction(async (conn) => {
    await consumeOtp(conn, email, 'RESET_PASSWORD', input.code);
    const user = await findByEmail(conn, email, true);
    if (!user) throw new AuthError(400, 'Código incorrecto.');
    await conn.execute<ResultSetHeader>('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await conn.execute('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL', [user.id]);
    await conn.execute(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id) VALUES (?, ?, 'PASSWORD_RESET', 'user', ?)`,
      [user.id, user.role, user.id]
    );
    return createSession(conn, user, input.deviceInfo);
  });
};

export const getUserById = async (id: string): Promise<PublicUser | null> => {
  const [rows] = await getPool().query<UserRow[]>(
    `SELECT ${USER_FIELDS} FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] ? toPublic(rows[0]) : null;
};
