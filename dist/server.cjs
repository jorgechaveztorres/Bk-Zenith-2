var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express13 = __toESM(require("express"), 1);
var import_path4 = __toESM(require("path"), 1);

// server/app.ts
var import_express12 = __toESM(require("express"), 1);

// server/middlewares/security.middleware.ts
var import_helmet = __toESM(require("helmet"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
var onPath = (segment, handler) => (req, res, next) => req.path.includes(segment) ? handler(req, res, next) : next();
var configureSecurity = (app) => {
  app.use((0, import_helmet.default)({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  }));
  const allowed = (process.env.FRONTEND_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origins = allowed.length ? [...allowed, "https://localhost", "capacitor://localhost", "http://localhost"] : "*";
  app.use((0, import_cors.default)({
    origin: process.env.NODE_ENV === "production" ? origins : "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  const limiter = (0, import_express_rate_limit.default)({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 100,
    // Limit each IP to 100 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Demasiadas solicitudes, intente de nuevo m\xE1s tarde." }
  });
  app.use(onPath("/api/", limiter));
  const paymentLimiter = (0, import_express_rate_limit.default)({
    windowMs: 15 * 60 * 1e3,
    max: 10,
    message: { success: false, message: "L\xEDmite de intentos de pago excedido." }
  });
  app.use(onPath("/api/payments", paymentLimiter));
  app.use(onPath("/api/settlements", paymentLimiter));
};

// server/routes/index.ts
var import_express11 = require("express");

// server/routes/ride.routes.ts
var import_express = require("express");

// server/services/auth.service.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);

// server/config/mysql.ts
var import_promise = __toESM(require("mysql2/promise"), 1);
var pool = null;
var getPool = () => {
  if (pool) return pool;
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error("Faltan variables DB_USER, DB_PASSWORD o DB_NAME para conectar a MySQL.");
  }
  pool = import_promise.default.createPool({
    host: DB_HOST || "localhost",
    port: DB_PORT ? parseInt(DB_PORT, 10) : 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 8,
    timezone: "Z",
    charset: "utf8mb4",
    dateStrings: false
  });
  pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
};
var withTransaction = async (fn) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// server/services/sms.service.ts
var ConsoleSms = class {
  async send(phoneE164, text) {
    console.error(`[SMS-PRUEBA] a ${phoneE164}: ${text}`);
  }
};
var TwilioSms = class {
  constructor() {
    this.clientPromise = null;
    this.from = process.env.TWILIO_FROM_NUMBER;
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!this.from && !this.messagingServiceSid) {
      throw new Error("Configura TWILIO_FROM_NUMBER o TWILIO_MESSAGING_SERVICE_SID para enviar SMS con Twilio.");
    }
  }
  async client() {
    if (!this.clientPromise) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!accountSid || !authToken) {
        throw new Error("Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN para enviar SMS con Twilio.");
      }
      this.clientPromise = import("twilio").then(({ default: twilio }) => twilio(accountSid, authToken));
    }
    return this.clientPromise;
  }
  async send(phoneE164, text) {
    const client = await this.client();
    try {
      await client.messages.create({
        to: phoneE164,
        body: text,
        ...this.messagingServiceSid ? { messagingServiceSid: this.messagingServiceSid } : { from: this.from }
      });
    } catch (err) {
      console.error(`[SMS-TWILIO] No se pudo enviar a ${phoneE164}:`, err.message);
      throw new Error("No se pudo enviar el SMS. Intenta de nuevo en un momento.");
    }
  }
};
var sender = null;
var getSmsSender = () => {
  if (sender) return sender;
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();
  switch (provider) {
    case "console":
      sender = new ConsoleSms();
      break;
    case "twilio":
      sender = new TwilioSms();
      break;
    default:
      throw new Error(`Proveedor de SMS no soportado: ${provider}`);
  }
  return sender;
};

// server/services/auth.service.ts
var AuthError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
};
var OTP_TTL_MIN = 5;
var OTP_MAX_ATTEMPTS = 5;
var OTP_MAX_PER_15MIN = 3;
var OTP_MAX_PER_DAY = 6;
var ACCESS_TTL = "1h";
var REFRESH_TTL_DAYS = 30;
var MIN_PASSWORD = 6;
var cachedSecret = null;
var jwtSecret = () => {
  if (cachedSecret) return cachedSecret;
  let s = process.env.JWT_SECRET;
  const file = process.env.JWT_SECRET_FILE;
  if (!s && file) {
    if (!import_fs.default.existsSync(file)) {
      import_fs.default.mkdirSync(import_path.default.dirname(file), { recursive: true, mode: 448 });
      import_fs.default.writeFileSync(file, import_crypto.default.randomBytes(64).toString("base64url"), { mode: 384, flag: "wx" });
    }
    s = import_fs.default.readFileSync(file, "utf8").trim();
  }
  if (!s || s.length < 32) throw new Error("Falta JWT_SECRET (o JWT_SECRET_FILE) de al menos 32 caracteres.");
  cachedSecret = s;
  return s;
};
var sha256 = (v) => import_crypto.default.createHash("sha256").update(v).digest("hex");
var hashOtp = (phone, purpose, code) => sha256(`${jwtSecret()}|${phone}|${purpose}|${code}`);
var normalizePhone = (raw) => {
  if (typeof raw !== "string") throw new AuthError(400, "N\xFAmero de celular inv\xE1lido.");
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("51")) d = d.slice(2);
  if (!/^9\d{8}$/.test(d)) throw new AuthError(400, "El celular debe tener 9 d\xEDgitos y empezar con 9.");
  return `+51${d}`;
};
var validatePassword = (p) => {
  if (typeof p !== "string" || p.length < MIN_PASSWORD) {
    throw new AuthError(400, `La clave debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  if (p.length > 72) throw new AuthError(400, "La clave es demasiado larga.");
  return p;
};
var validateName = (n) => {
  if (typeof n !== "string" || n.trim().length < 3) throw new AuthError(400, "Escribe tu nombre completo.");
  return n.trim().slice(0, 150);
};
var validateRole = (r) => {
  if (r === "driver" || r === "MOTORIZADO") return "driver";
  if (r === "passenger" || r === "CLIENTE" || r === void 0) return "passenger";
  throw new AuthError(400, "Rol inv\xE1lido.");
};
var toPublic = (u) => ({
  id: u.id,
  fullName: u.full_name,
  phone: u.phone,
  role: u.role,
  isAdmin: u.is_admin === 1,
  kycStatus: u.kyc_status
});
var issueOtp = async (phone, purpose) => {
  const pool2 = getPool();
  const [rows] = await pool2.query(
    `SELECT
       SUM(created_at > NOW(3) - INTERVAL 15 MINUTE) AS last15,
       COUNT(*) AS lastDay
     FROM otp_codes WHERE phone = ? AND created_at > NOW(3) - INTERVAL 1 DAY`,
    [phone]
  );
  const last15 = Number(rows[0]?.last15 || 0);
  const lastDay = Number(rows[0]?.lastDay || 0);
  if (last15 >= OTP_MAX_PER_15MIN || lastDay >= OTP_MAX_PER_DAY) {
    throw new AuthError(429, "Pediste muchos c\xF3digos. Espera unos minutos e int\xE9ntalo de nuevo.");
  }
  const code = import_crypto.default.randomInt(0, 1e6).toString().padStart(6, "0");
  await pool2.execute(
    `INSERT INTO otp_codes (phone, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, NOW(3) + INTERVAL ${OTP_TTL_MIN} MINUTE)`,
    [phone, purpose, hashOtp(phone, purpose, code)]
  );
  await getSmsSender().send(phone, `Zenith: tu codigo es ${code}. Vence en ${OTP_TTL_MIN} minutos. No lo compartas.`);
};
var consumeOtp = async (conn, phone, purpose, code) => {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new AuthError(400, "El c\xF3digo tiene 6 n\xFAmeros.");
  const [rows] = await conn.query(
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE phone = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW(3)
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [phone, purpose]
  );
  const otp = rows[0];
  if (!otp) throw new AuthError(400, "El c\xF3digo venci\xF3 o no existe. Pide uno nuevo.");
  if (Number(otp.attempts) >= OTP_MAX_ATTEMPTS) throw new AuthError(429, "Demasiados intentos. Pide un c\xF3digo nuevo.");
  const expected = Buffer.from(String(otp.code_hash), "hex");
  const given = Buffer.from(hashOtp(phone, purpose, code), "hex");
  if (!import_crypto.default.timingSafeEqual(expected, given)) {
    await conn.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [otp.id]);
    throw new AuthError(400, "C\xF3digo incorrecto.");
  }
  await conn.execute("UPDATE otp_codes SET used_at = NOW(3) WHERE id = ?", [otp.id]);
};
var createSession = async (conn, user, deviceInfo) => {
  const claims = { sub: user.id, role: user.role, adm: user.is_admin === 1 };
  const accessToken = import_jsonwebtoken.default.sign(claims, jwtSecret(), { expiresIn: ACCESS_TTL, issuer: "zenith" });
  const refreshToken = import_crypto.default.randomBytes(48).toString("base64url");
  const exec = conn ?? getPool();
  await exec.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
     VALUES (?, ?, ?, NOW(3) + INTERVAL ${REFRESH_TTL_DAYS} DAY)`,
    [user.id, sha256(refreshToken), deviceInfo ? deviceInfo.slice(0, 255) : null]
  );
  return { accessToken, refreshToken, expiresIn: 3600, user: toPublic(user) };
};
var verifyAccessToken = (token) => {
  try {
    const decoded = import_jsonwebtoken.default.verify(token, jwtSecret(), { issuer: "zenith" });
    if (typeof decoded === "string" || typeof decoded.sub !== "string") throw new Error("token");
    return { sub: decoded.sub, role: decoded.role, adm: decoded.adm === true };
  } catch {
    throw new AuthError(401, "Sesi\xF3n vencida. Vuelve a entrar.");
  }
};
var findByPhone = async (exec, phone, lock = false) => {
  const [rows] = await exec.query(
    `SELECT id, full_name, phone, password_hash, role, is_admin, is_blocked, phone_verified, kyc_status
     FROM users WHERE phone = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [phone]
  );
  return rows[0];
};
var startRegistration = async (rawPhone) => {
  const phone = normalizePhone(rawPhone);
  const existing = await findByPhone(getPool(), phone);
  if (existing) throw new AuthError(409, "Este celular ya tiene cuenta. Entra con tu clave.");
  await issueOtp(phone, "VERIFY_PHONE");
};
var completeRegistration = async (input) => {
  const phone = normalizePhone(input.phone);
  const password = validatePassword(input.password);
  const fullName = validateName(input.fullName);
  const role = validateRole(input.role);
  const passwordHash = await import_bcryptjs.default.hash(password, 10);
  return withTransaction(async (conn) => {
    await consumeOtp(conn, phone, "VERIFY_PHONE", input.code);
    if (await findByPhone(conn, phone, true)) throw new AuthError(409, "Este celular ya tiene cuenta.");
    const id = import_crypto.default.randomUUID();
    const roleLabel = role === "driver" ? "MOTORIZADO" : "CLIENTE";
    await conn.execute(
      `INSERT INTO users (id, full_name, phone, password_hash, role, roles_enabled, active_role, phone_verified)
       VALUES (?, ?, ?, ?, ?, JSON_ARRAY(?), ?, 1)`,
      [id, fullName, phone, passwordHash, role, roleLabel, roleLabel]
    );
    if (role === "driver") {
      await conn.execute("INSERT INTO driver_profiles (user_id) VALUES (?)", [id]);
      await conn.execute("INSERT INTO wallets (driver_id) VALUES (?)", [id]);
    }
    await conn.execute(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id) VALUES (?, ?, 'USER_REGISTERED', 'user', ?)`,
      [id, role, id]
    );
    const user = await findByPhone(conn, phone);
    if (!user) throw new AuthError(500, "No se pudo crear la cuenta.");
    return createSession(conn, user, input.deviceInfo);
  });
};
var login = async (input) => {
  const phone = normalizePhone(input.phone);
  if (typeof input.password !== "string") throw new AuthError(400, "Escribe tu clave.");
  const user = await findByPhone(getPool(), phone);
  const ok = user?.password_hash ? await import_bcryptjs.default.compare(input.password, user.password_hash) : false;
  if (!user || !ok) throw new AuthError(401, "Celular o clave incorrectos.");
  if (user.is_blocked === 1) throw new AuthError(403, "Tu cuenta est\xE1 bloqueada. Escribe a soporte.");
  return createSession(null, user, input.deviceInfo);
};
var refreshSession = async (rawToken) => {
  if (typeof rawToken !== "string" || rawToken.length < 20) throw new AuthError(401, "Sesi\xF3n inv\xE1lida.");
  const [reused] = await getPool().query(
    "SELECT user_id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL",
    [sha256(rawToken)]
  );
  if (reused[0]) {
    await getPool().execute(
      "UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL",
      [reused[0].user_id]
    );
    throw new AuthError(401, "Sesi\xF3n cerrada por seguridad. Vuelve a entrar.");
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, user_id, device_info, revoked_at, expires_at > NOW(3) AS alive
       FROM refresh_tokens WHERE token_hash = ? FOR UPDATE`,
      [sha256(rawToken)]
    );
    const rt = rows[0];
    if (!rt) throw new AuthError(401, "Sesi\xF3n inv\xE1lida.");
    if (rt.revoked_at) throw new AuthError(401, "Sesi\xF3n cerrada por seguridad. Vuelve a entrar.");
    if (!Number(rt.alive)) throw new AuthError(401, "Sesi\xF3n vencida. Vuelve a entrar.");
    await conn.execute("UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE id = ?", [rt.id]);
    const [urows] = await conn.query(
      `SELECT id, full_name, phone, password_hash, role, is_admin, is_blocked, phone_verified, kyc_status
       FROM users WHERE id = ?`,
      [rt.user_id]
    );
    const user = urows[0];
    if (!user || user.is_blocked === 1) throw new AuthError(403, "Cuenta no disponible.");
    return createSession(conn, user, rt.device_info ?? void 0);
  });
};
var logout = async (rawToken) => {
  if (typeof rawToken !== "string") return;
  await getPool().execute("UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE token_hash = ? AND revoked_at IS NULL", [sha256(rawToken)]);
};
var startPasswordReset = async (rawPhone) => {
  const phone = normalizePhone(rawPhone);
  const user = await findByPhone(getPool(), phone);
  if (!user || user.is_blocked === 1) return;
  await issueOtp(phone, "RESET_PASSWORD");
};
var completePasswordReset = async (input) => {
  const phone = normalizePhone(input.phone);
  const password = validatePassword(input.newPassword);
  const passwordHash = await import_bcryptjs.default.hash(password, 10);
  return withTransaction(async (conn) => {
    await consumeOtp(conn, phone, "RESET_PASSWORD", input.code);
    const user = await findByPhone(conn, phone, true);
    if (!user) throw new AuthError(400, "C\xF3digo incorrecto.");
    await conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    await conn.execute("UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL", [user.id]);
    await conn.execute(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id) VALUES (?, ?, 'PASSWORD_RESET', 'user', ?)`,
      [user.id, user.role, user.id]
    );
    return createSession(conn, user, input.deviceInfo);
  });
};
var getUserById = async (id) => {
  const [rows] = await getPool().query(
    `SELECT id, full_name, phone, password_hash, role, is_admin, is_blocked, phone_verified, kyc_status
     FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] ? toPublic(rows[0]) : null;
};

// server/middlewares/session.middleware.ts
var requireSession = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Debes iniciar sesi\xF3n." });
  }
  try {
    req.session = verifyAccessToken(header.slice(7));
    next();
  } catch (err) {
    const status = err instanceof AuthError ? err.statusCode : 401;
    return res.status(status).json({ success: false, message: err.message });
  }
};
var requireAppRole = (roles) => (req, res, next) => {
  const s = req.session;
  if (!s) return res.status(401).json({ success: false, message: "Debes iniciar sesi\xF3n." });
  const allowed = s.adm && roles.includes("admin") || roles.includes(s.role);
  if (!allowed) return res.status(403).json({ success: false, message: "No tienes permiso para esto." });
  next();
};

// server/services/ride.service.ts
var import_crypto3 = __toESM(require("crypto"), 1);

// server/services/pricing.service.ts
var import_crypto2 = __toESM(require("crypto"), 1);

// server/services/routes.service.ts
var GoogleRoutesProvider = class {
  constructor(apiKey, timeoutMs = 7e3) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
    this.timeoutMs = timeoutMs;
  }
  async computeRoute(origin, destination) {
    if (!this.apiKey || this.apiKey === "MY_GOOGLE_MAPS_KEY") {
      throw new Error("Google Routes API Key no configurada en el servidor (GOOGLE_MAPS_PLATFORM_KEY).");
    }
    if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng) || origin.lat < -90 || origin.lat > 90 || destination.lat < -90 || destination.lat > 90 || origin.lng < -180 || origin.lng > 180 || destination.lng < -180 || destination.lng > 180) {
      throw new Error("Coordenadas de origen o destino fuera de rango.");
    }
    const endpoint = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const requestBody = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: false
      };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const status = response.status;
        const errMsg = errorBody?.error?.message || `Error HTTP ${status} en Google Routes API`;
        throw new Error(`Google Routes API fall\xF3 (${status}): ${errMsg}`);
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.routes) || data.routes.length === 0) {
        throw new Error("Google Routes API no encontr\xF3 una ruta vial v\xE1lida entre los puntos especificados.");
      }
      const route = data.routes[0];
      const distanceMeters = Number(route.distanceMeters);
      if (isNaN(distanceMeters) || distanceMeters <= 0) {
        throw new Error("Google Routes API retorn\xF3 una distancia vial inv\xE1lida o igual a 0 metros.");
      }
      let durationSeconds = 0;
      if (typeof route.duration === "string") {
        durationSeconds = parseInt(route.duration.replace("s", ""), 10) || 0;
      }
      const distanceKm = Number((distanceMeters / 1e3).toFixed(3));
      const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
      const geodesicKm = getGeodesicDistance(origin.lat, origin.lng, destination.lat, destination.lng);
      if (distanceKm < geodesicKm * 0.9) {
        throw new Error(
          `Inconsistencia f\xEDsica detectada: Distancia vial Google (${distanceKm.toFixed(2)} km) es menor que la geod\xE9sica m\xEDnima (${geodesicKm.toFixed(2)} km).`
        );
      }
      return {
        distanceMeters,
        distanceKm,
        durationSeconds,
        durationMinutes,
        encodedPolyline: route.polyline?.encodedPolyline,
        source: "GOOGLE_ROUTES"
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`Timeout al consultar Google Routes API (${this.timeoutMs}ms excedidos).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
var EstimateRouteProvider = class {
  constructor(roadFactor = 1.35, avgSpeedKmh = 22) {
    this.roadFactor = roadFactor;
    this.avgSpeedKmh = avgSpeedKmh;
  }
  async computeRoute(origin, destination) {
    const bad = (c) => !Number.isFinite(c.lat) || !Number.isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180;
    if (bad(origin) || bad(destination)) throw new Error("Coordenadas de origen o destino fuera de rango.");
    const straightKm = getGeodesicDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const distanceKm = Number(Math.max(0.3, straightKm * this.roadFactor).toFixed(3));
    const durationMinutes = Math.max(2, Math.round(distanceKm / this.avgSpeedKmh * 60));
    return {
      distanceMeters: Math.round(distanceKm * 1e3),
      distanceKm,
      durationSeconds: durationMinutes * 60,
      durationMinutes,
      source: "ESTIMATE"
    };
  }
};
var defaultProvider = () => (process.env.ROUTE_PROVIDER || "").toLowerCase() === "google" ? new GoogleRoutesProvider() : new EstimateRouteProvider();
var activeRouteProvider = defaultProvider();
function getRouteProvider() {
  return activeRouteProvider;
}

// server/config/cities.config.ts
var DEFAULT_CONFIGURED_CITIES = [
  {
    code: "TRU",
    name: "Trujillo",
    department: "La Libertad",
    country: "PE",
    center: { lat: -8.1116, lng: -79.0287 },
    boundingBox: { latMin: -8.35, latMax: -7.95, lngMin: -79.2, lngMax: -78.85 },
    operationalRadiusKm: 22,
    active: true,
    aliases: ["trujillo", "victor larco", "huanchaco", "moche", "la esperanza", "el porvenir"],
    metropolitanArea: "\xC1rea Metropolitana de Trujillo"
  },
  {
    code: "LIM",
    name: "Lima",
    department: "Lima",
    country: "PE",
    center: { lat: -12.0464, lng: -77.0428 },
    boundingBox: { latMin: -12.5, latMax: -11.6, lngMin: -77.3, lngMax: -76.65 },
    operationalRadiusKm: 40,
    active: true,
    aliases: ["lima", "callao", "miraflores", "san isidro", "surco", "san borja", "la molina"],
    metropolitanArea: "Lima Metropolitana y Callao"
  },
  {
    code: "AQP",
    name: "Arequipa",
    department: "Arequipa",
    country: "PE",
    center: { lat: -16.409, lng: -71.5375 },
    boundingBox: { latMin: -16.6, latMax: -16.2, lngMin: -71.7, lngMax: -71.35 },
    operationalRadiusKm: 22,
    active: true,
    aliases: ["arequipa", "cayma", "yanahuara", "cerro colorado", "bustamante y rivero"],
    metropolitanArea: "\xC1rea Metropolitana de Arequipa"
  },
  {
    code: "CIX",
    name: "Chiclayo",
    department: "Lambayeque",
    country: "PE",
    center: { lat: -6.7714, lng: -79.8409 },
    boundingBox: { latMin: -6.95, latMax: -6.65, lngMin: -80, lngMax: -79.7 },
    operationalRadiusKm: 20,
    active: true,
    aliases: ["chiclayo", "la victoria", "jose leonardo ortiz", "pimentel"],
    metropolitanArea: "\xC1rea Metropolitana de Chiclayo"
  },
  {
    code: "PIU",
    name: "Piura",
    department: "Piura",
    country: "PE",
    center: { lat: -5.1945, lng: -80.6328 },
    boundingBox: { latMin: -5.35, latMax: -5.05, lngMin: -80.8, lngMax: -80.5 },
    operationalRadiusKm: 20,
    active: true,
    aliases: ["piura", "castilla", "veintiseis de octubre", "catacaos"],
    metropolitanArea: "\xC1rea Metropolitana de Piura"
  },
  {
    code: "CUZ",
    name: "Cusco",
    department: "Cusco",
    country: "PE",
    center: { lat: -13.532, lng: -71.9675 },
    boundingBox: { latMin: -13.65, latMax: -13.4, lngMin: -72.1, lngMax: -71.85 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ["cusco", "cuzco", "wanchaq", "santiago", "san sebastian", "san jeronimo"],
    metropolitanArea: "Valle Urbano del Cusco"
  },
  {
    code: "HYO",
    name: "Huancayo",
    department: "Jun\xEDn",
    country: "PE",
    center: { lat: -12.0651, lng: -75.2049 },
    boundingBox: { latMin: -12.2, latMax: -11.95, lngMin: -75.35, lngMax: -75.1 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ["huancayo", "el tambo", "chilca"],
    metropolitanArea: "\xC1rea Metropolitana de Huancayo"
  },
  {
    code: "IQT",
    name: "Iquitos",
    department: "Loreto",
    country: "PE",
    center: { lat: -3.7491, lng: -73.2538 },
    boundingBox: { latMin: -3.9, latMax: -3.6, lngMin: -73.4, lngMax: -73.15 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ["iquitos", "punchana", "belen", "san juan bautista"],
    metropolitanArea: "\xC1rea Urbana de Iquitos"
  },
  {
    code: "TAC",
    name: "Tacna",
    department: "Tacna",
    country: "PE",
    center: { lat: -18.0146, lng: -70.2536 },
    boundingBox: { latMin: -18.15, latMax: -17.9, lngMin: -70.35, lngMax: -70.15 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ["tacna", "alto de la alianza", "ciudad nueva", "coronel gregorio albarracin"],
    metropolitanArea: "\xC1rea Metropolitana de Tacna"
  },
  {
    code: "CHM",
    name: "Chimbote",
    department: "\xC1ncash",
    country: "PE",
    center: { lat: -9.0745, lng: -78.5936 },
    boundingBox: { latMin: -9.2, latMax: -8.95, lngMin: -78.7, lngMax: -78.45 },
    operationalRadiusKm: 20,
    active: true,
    aliases: ["chimbote", "nuevo chimbote", "coishco"],
    metropolitanArea: "\xC1rea Conurbada Chimbote - Nuevo Chimbote"
  },
  {
    code: "PCL",
    name: "Pucallpa",
    department: "Ucayali",
    country: "PE",
    center: { lat: -8.3791, lng: -74.5539 },
    boundingBox: { latMin: -8.5, latMax: -8.25, lngMin: -74.7, lngMax: -74.4 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ["pucallpa", "calleria", "yarinacocha", "manantay"],
    metropolitanArea: "\xC1rea Metropolitana de Pucallpa"
  }
];
var CityCatalogRegistry = class {
  constructor() {
    this.citiesMap = /* @__PURE__ */ new Map();
    this.resetToDefaults();
  }
  /**
   * Restablece el catálogo con las ciudades base configuradas.
   */
  resetToDefaults() {
    this.citiesMap.clear();
    for (const city of DEFAULT_CONFIGURED_CITIES) {
      this.citiesMap.set(city.code.toUpperCase(), { ...city });
    }
  }
  /**
   * Registra una nueva ciudad en el catálogo.
   * La operación valida unicidad de código y completitud geográfica.
   */
  registerCity(city) {
    const code = city.code.trim().toUpperCase();
    if (!code || code.length < 2) {
      throw new Error(`C\xF3digo de ciudad inv\xE1lido: "${city.code}". Debe tener al menos 2 caracteres.`);
    }
    if (typeof city.center?.lat !== "number" || typeof city.center?.lng !== "number" || city.center.lat < -90 || city.center.lat > 90 || city.center.lng < -180 || city.center.lng > 180) {
      throw new Error(`Coordenadas del centroide inv\xE1lidas para la ciudad ${city.name}.`);
    }
    this.citiesMap.set(code, {
      ...city,
      code,
      country: city.country || "PE",
      active: city.active !== void 0 ? city.active : true
    });
  }
  /**
   * Elimina o desregistra una ciudad por código.
   */
  unregisterCity(code) {
    return this.citiesMap.delete(code.trim().toUpperCase());
  }
  /**
   * Obtiene la definición de una ciudad por su código.
   */
  getCityByCode(code) {
    return this.citiesMap.get(code.trim().toUpperCase());
  }
  /**
   * Retorna todas las ciudades configuradas (por defecto solo las activas).
   */
  getAllCities(onlyActive = true) {
    const all = Array.from(this.citiesMap.values());
    return onlyActive ? all.filter((c) => c.active) : all;
  }
  /**
   * Busca si las coordenadas caen dentro del Bounding Box de alguna ciudad configurada.
   */
  findByBoundingBox(lat, lng) {
    for (const city of this.citiesMap.values()) {
      if (!city.active) continue;
      const b = city.boundingBox;
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
        return city;
      }
    }
    return void 0;
  }
  /**
   * Busca si el texto de dirección coincide con el nombre o alias de alguna ciudad configurada.
   */
  findByAddress(address) {
    if (!address) return void 0;
    const lowerAddr = address.toLowerCase();
    for (const city of this.citiesMap.values()) {
      if (!city.active) continue;
      if (lowerAddr.includes(city.name.toLowerCase())) {
        return city;
      }
      if (city.aliases && city.aliases.some((alias) => lowerAddr.includes(alias.toLowerCase()))) {
        return city;
      }
    }
    return void 0;
  }
};
var CityCatalog = new CityCatalogRegistry();

// server/services/geo.service.ts
var MAX_DRIVER_STALE_MS = 10 * 60 * 1e3;
function resolveCityFromCoordinates(lat, lng, address) {
  const matchBox = CityCatalog.findByBoundingBox(lat, lng);
  if (matchBox) {
    const dist = getGeodesicDistance(lat, lng, matchBox.center.lat, matchBox.center.lng);
    return {
      city: matchBox.name,
      code: matchBox.code,
      department: matchBox.department,
      isKnownCity: true,
      distanceToCenterKm: Number(dist.toFixed(2)),
      operationalRadiusKm: matchBox.operationalRadiusKm,
      definition: matchBox
    };
  }
  const activeCities = CityCatalog.getAllCities(true);
  for (const c of activeCities) {
    const dist = getGeodesicDistance(lat, lng, c.center.lat, c.center.lng);
    if (dist <= c.operationalRadiusKm) {
      return {
        city: c.name,
        code: c.code,
        department: c.department,
        isKnownCity: true,
        distanceToCenterKm: Number(dist.toFixed(2)),
        operationalRadiusKm: c.operationalRadiusKm,
        definition: c
      };
    }
  }
  if (address) {
    const matchAddr = CityCatalog.findByAddress(address);
    if (matchAddr) {
      const dist = getGeodesicDistance(lat, lng, matchAddr.center.lat, matchAddr.center.lng);
      return {
        city: matchAddr.name,
        code: matchAddr.code,
        department: matchAddr.department,
        isKnownCity: true,
        distanceToCenterKm: Number(dist.toFixed(2)),
        operationalRadiusKm: matchAddr.operationalRadiusKm,
        definition: matchAddr
      };
    }
  }
  if (activeCities.length > 0) {
    let nearest = activeCities[0];
    let minDistance = getGeodesicDistance(lat, lng, nearest.center.lat, nearest.center.lng);
    for (let i = 1; i < activeCities.length; i++) {
      const d = getGeodesicDistance(lat, lng, activeCities[i].center.lat, activeCities[i].center.lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = activeCities[i];
      }
    }
    if (minDistance <= 50) {
      return {
        city: nearest.name,
        code: nearest.code,
        department: nearest.department,
        isKnownCity: true,
        distanceToCenterKm: Number(minDistance.toFixed(2)),
        operationalRadiusKm: nearest.operationalRadiusKm,
        definition: nearest
      };
    }
  }
  const latBin = (Math.round(lat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(lng * 33) / 33).toFixed(3);
  const regionalGridKey = `${latBin}:${lngBin}`;
  const regionalCode = `RGN_${Math.abs(Math.round(lat * 10))}_${Math.abs(Math.round(lng * 10))}`;
  return {
    city: `Regi\xF3n Local [${regionalGridKey}]`,
    code: regionalCode,
    department: "Regional",
    isKnownCity: false,
    distanceToCenterKm: 0,
    operationalRadiusKm: 15
    // Radio operativo regional estricto (15 km)
  };
}
function resolveGeoMarketZone(lat, lng, address) {
  const cityResult = resolveCityFromCoordinates(lat, lng, address);
  const city = cityResult.city;
  const latBin = (Math.round(lat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(lng * 33) / 33).toFixed(3);
  const cityCode = cityResult.code || city.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "RGN";
  const id = `MZ-${cityCode}-${latBin}_${lngBin}`;
  return {
    id,
    name: `Zona Operacional ${city} (${latBin}, ${lngBin})`,
    city,
    gridKey: `${latBin}:${lngBin}`
  };
}

// server/services/pricing.service.ts
function getGeodesicDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}
function calculateNormalFare(distanceKm) {
  const d = Math.max(0, distanceKm);
  if (d <= 2.5) return 5;
  if (d <= 4.5) return 6;
  if (d <= 6) return 8;
  if (d <= 7.5) return 10;
  if (d <= 8.5) return 12;
  if (d <= 9.5) return 14;
  if (d <= 10) return 17;
  if (d <= 12) return 18;
  if (d <= 14) return 20;
  if (d <= 15) return 22;
  if (d <= 17) return 24;
  if (d <= 20) return 27;
  const extraKm = d - 20;
  const extraFare = extraKm * 1.5;
  return Number((27 + extraFare).toFixed(2));
}
function getMultiplierFromPressure(pressure) {
  if (pressure <= 1) return 1;
  if (pressure <= 1.25) return 1.05;
  if (pressure <= 1.5) return 1.1;
  if (pressure <= 2) return 1.15;
  if (pressure <= 2.5) return 1.2;
  if (pressure <= 3) return 1.25;
  return 1.3;
}
function calculateDynamicMultiplier(pendingOrders, availableDrivers) {
  if (availableDrivers === 0 && pendingOrders > 0) {
    return {
      multiplier: 1,
      pressure: Infinity,
      status: "SIN_OFERTA_DISPONIBLE",
      message: "Sin motorizados disponibles en la zona. Tarifa no inflada artificialmente."
    };
  }
  if (pendingOrders === 0) {
    return {
      multiplier: 1,
      pressure: 0,
      status: "DISPONIBLE",
      message: "Presi\xF3n normal del mercado (sin demanda activa)."
    };
  }
  const rawPressure = pendingOrders / availableDrivers;
  const pressure = Number(rawPressure.toFixed(4));
  const multiplier = getMultiplierFromPressure(pressure);
  return {
    multiplier,
    pressure,
    status: "DISPONIBLE",
    message: `Presi\xF3n de mercado: ${pressure.toFixed(2)} (Multiplicador: \xD7${multiplier.toFixed(2)})`
  };
}
function resolveMarketZone(lat, lng, address) {
  return resolveGeoMarketZone(lat, lng, address);
}
function getPricingSecret() {
  const secret = process.env.PRICING_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[PRICING_SECURITY] PRICING_HMAC_SECRET no est\xE1 configurado en producci\xF3n.");
    }
    console.warn("[PRICING_SECURITY] ADVERTENCIA: PRICING_HMAC_SECRET no definido en desarrollo. Configure la variable para producci\xF3n.");
    return "ZENITH_DEV_UNSECURE_FALLBACK_SECRET_CHANGE_IN_PROD";
  }
  return secret;
}
function generateQuoteSignature(payload) {
  const secret = getPricingSecret();
  const originAddr = (payload.originAddress || payload.origin?.address || "").trim();
  const destAddr = (payload.destAddress || payload.destination?.address || "").trim();
  const currency = (payload.currency || "PEN").trim().toUpperCase();
  const oLat = payload.originLat ?? payload.origin?.lat;
  const oLng = payload.originLng ?? payload.origin?.lng;
  const dLat = payload.destLat ?? payload.destination?.lat;
  const dLng = payload.destLng ?? payload.destination?.lng;
  const originCoords = oLat !== void 0 && oLng !== void 0 ? `${oLat.toFixed(5)},${oLng.toFixed(5)}` : "";
  const destCoords = dLat !== void 0 && dLng !== void 0 ? `${dLat.toFixed(5)},${dLng.toFixed(5)}` : "";
  const canonicalData = [
    payload.quoteId,
    payload.pricingVersion,
    payload.totalFare.toFixed(2),
    payload.normalFare.toFixed(2),
    payload.multiplier.toFixed(2),
    payload.distance.toFixed(2),
    originAddr,
    destAddr,
    originCoords,
    destCoords,
    currency,
    payload.expiresAt
  ].join("|");
  return import_crypto2.default.createHmac("sha256", secret).update(canonicalData).digest("hex");
}
function verifyQuoteSignature(quote) {
  const now = /* @__PURE__ */ new Date();
  const expiry = new Date(quote.expiresAt);
  if (isNaN(expiry.getTime()) || now > expiry) {
    return { valid: false, reason: "Cotizaci\xF3n expirada" };
  }
  if (quote.pricingVersion !== "DPE_V2") {
    return { valid: false, reason: "Versi\xF3n de pricing inv\xE1lida" };
  }
  const currency = (quote.currency || "PEN").trim().toUpperCase();
  if (currency !== "PEN") {
    return { valid: false, reason: "Moneda no autorizada (solo PEN)" };
  }
  try {
    const expectedSig = generateQuoteSignature({
      ...quote,
      currency
    });
    const sealBuffer = Buffer.from(quote.pricingSeal || "", "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (sealBuffer.length !== expectedBuffer.length || !import_crypto2.default.timingSafeEqual(sealBuffer, expectedBuffer)) {
      return { valid: false, reason: "Firma criptogr\xE1fica inv\xE1lida o datos manipulados" };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `Error al verificar firma: ${err?.message || "Error desconocido"}` };
  }
}
async function calculateServerQuote(params) {
  const routeProvider = getRouteProvider();
  const route = await routeProvider.computeRoute(
    { lat: params.originLat, lng: params.originLng },
    { lat: params.destLat, lng: params.destLng }
  );
  const distance = route.distanceKm;
  const duration = params.durationMin && params.durationMin > 0 ? Math.round(params.durationMin) : route.durationMinutes;
  const marketZone = resolveMarketZone(params.originLat, params.originLng, params.originAddress);
  const normalFare = calculateNormalFare(distance);
  const pendingOrders = params.pendingOrders !== void 0 ? params.pendingOrders : 1;
  const availableDrivers = params.availableDrivers !== void 0 ? params.availableDrivers : 1;
  const dynamicEval = calculateDynamicMultiplier(pendingOrders, availableDrivers);
  const rawTotal = normalFare * dynamicEval.multiplier;
  const totalFare = Number(rawTotal.toFixed(2));
  const quoteId = `quote_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
  const pricingSeal = generateQuoteSignature({
    quoteId,
    pricingVersion: "DPE_V2",
    totalFare,
    normalFare,
    multiplier: dynamicEval.multiplier,
    distance,
    origin: {
      address: params.originAddress,
      lat: params.originLat,
      lng: params.originLng
    },
    destination: {
      address: params.destAddress,
      lat: params.destLat,
      lng: params.destLng
    },
    currency: "PEN",
    expiresAt
  });
  return {
    quoteId,
    origin: {
      address: params.originAddress,
      lat: params.originLat,
      lng: params.originLng
    },
    destination: {
      address: params.destAddress,
      lat: params.destLat,
      lng: params.destLng
    },
    distance,
    duration,
    normalFare,
    pressure: dynamicEval.pressure,
    multiplier: dynamicEval.multiplier,
    totalFare,
    currency: "PEN",
    pricingVersion: "DPE_V2",
    expiresAt,
    pricingSeal,
    marketZone,
    status: dynamicEval.status
  };
}
var PricingEngineClass = class {
  async calculateProtectedPrice(factors) {
    const normalFare = calculateNormalFare(factors.distanceKm);
    const pendingOrders = factors.pendingOrders ?? 1;
    const availableDrivers = factors.availableDrivers ?? 1;
    const dynamicEval = calculateDynamicMultiplier(pendingOrders, availableDrivers);
    const totalFare = Number((normalFare * dynamicEval.multiplier).toFixed(2));
    const quoteId = `compat_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    const pricingSeal = generateQuoteSignature({
      quoteId,
      pricingVersion: "DPE_V2",
      totalFare,
      normalFare,
      multiplier: dynamicEval.multiplier,
      distance: factors.distanceKm,
      originAddress: "COMPAT",
      destAddress: "COMPAT",
      expiresAt
    });
    return {
      baseFare: normalFare,
      distanceFare: 0,
      durationFare: 0,
      trafficMultiplier: 1,
      weatherMultiplier: 1,
      demandMultiplier: dynamicEval.multiplier,
      riskZoneSurcharge: 0,
      sustainabilityOffset: 0,
      platformHealthFee: 0,
      finalPrice: totalFare,
      pricingSeal
    };
  }
  async verifyPricingSeal(price, seal, _rideId) {
    if (!seal) return false;
    return typeof seal === "string" && seal.length > 0;
  }
};
var PricingEngine = new PricingEngineClass();

// server/services/settings.service.ts
var TTL_MS = 6e4;
var cache = null;
var load = async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const [rows] = await getPool().query("SELECT setting_key, setting_value FROM app_settings");
  const values = /* @__PURE__ */ new Map();
  for (const r of rows) values.set(String(r.setting_key), String(r.setting_value).replace(/^"|"$/g, ""));
  cache = { at: Date.now(), values };
  return values;
};
var getNumberSetting = async (key, fallback) => {
  const v = (await load()).get(key);
  const n = v === void 0 ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// server/realtime/bus.ts
var listeners = /* @__PURE__ */ new Set();
var onRealtime = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
var notify = (notices) => {
  for (const n of notices) {
    for (const fn of listeners) {
      try {
        fn(n.userId, n.event);
      } catch (err) {
        console.error("[REALTIME] Error al avisar:", err.message);
      }
    }
  }
};

// server/services/dispatch.service.ts
var KM_PER_DEG_LAT = 111.32;
var logDispatch = async (conn, rideId, event2, details, extra = {}) => {
  await conn.execute(
    `INSERT INTO dispatch_logs (ride_id, driver_id, assignment_id, event, attempt_number, distance_km, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rideId, extra.driverId ?? null, extra.assignmentId ?? null, event2, extra.attempt ?? null, extra.distanceKm ?? null, details.slice(0, 500)]
  );
};
var DispatchService = class _DispatchService {
  /** Intenta ofrecer el pedido al siguiente motorizado. Seguro de llamar varias veces. */
  static async runDispatchCycle(rideId) {
    const offerSeconds = await getNumberSetting("offer_timeout_seconds", 15);
    const maxKm = await getNumberSetting("dispatch_max_km", 6);
    const freshSeconds = await getNumberSetting("driver_fresh_seconds", 120);
    const notices = [];
    const result = await withTransaction(async (conn) => {
      notices.length = 0;
      const [rides] = await conn.query(
        `SELECT id, status, passenger_id, origin_lat, origin_lng, search_expires_at <= NOW(3) AS search_over
         FROM rides WHERE id = ? FOR UPDATE`,
        [rideId]
      );
      const ride = rides[0];
      if (!ride || ride.status !== "SEARCHING_DRIVER") {
        return { dispatched: false, rideId, status: "NOT_SEARCHING" };
      }
      const [open] = await conn.query(
        `SELECT id, driver_id, attempt_number, expires_at > NOW(3) AS alive
         FROM assignments WHERE ride_id = ? AND status = 'OFFERED' FOR UPDATE`,
        [rideId]
      );
      for (const a of open) {
        if (Number(a.alive)) {
          return { dispatched: true, rideId, status: "OFFERED", assignedDriverId: String(a.driver_id), attemptNumber: Number(a.attempt_number) };
        }
        await conn.execute(`UPDATE assignments SET status = 'EXPIRED', responded_at = NOW(3) WHERE id = ?`, [a.id]);
        notices.push({ userId: String(a.driver_id), event: { type: "offer.closed", assignmentId: String(a.id), reason: "EXPIRED" } });
        await logDispatch(conn, rideId, "ASSIGNMENT_EXPIRED", "El motorizado no respondi\xF3 a tiempo.", { driverId: String(a.driver_id), assignmentId: String(a.id) });
      }
      if (Number(ride.search_over)) {
        await conn.execute(`UPDATE rides SET status = 'EXPIRED', solicitude_status = 'CLOSED' WHERE id = ?`, [rideId]);
        await logDispatch(conn, rideId, "SEARCH_EXPIRED", "Nadie acept\xF3 el pedido dentro del tiempo de b\xFAsqueda.");
        notices.push({ userId: String(ride.passenger_id), event: { type: "ride", rideId, status: "EXPIRED" } });
        return { dispatched: false, rideId, status: "EXPIRED" };
      }
      const [cnt] = await conn.query("SELECT COUNT(*) AS n FROM assignments WHERE ride_id = ?", [rideId]);
      const attempt = Number(cnt[0]?.n || 0) + 1;
      const lat = Number(ride.origin_lat);
      const lng = Number(ride.origin_lng);
      const dLat = maxKm / KM_PER_DEG_LAT;
      const dLng = maxKm / (KM_PER_DEG_LAT * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
      const [cands] = await conn.query(
        `SELECT d.driver_id, u.full_name,
                6371 * 2 * ASIN(SQRT(POW(SIN(RADIANS(d.lat - ?) / 2), 2) +
                  COS(RADIANS(?)) * COS(RADIANS(d.lat)) * POW(SIN(RADIANS(d.lng - ?) / 2), 2))) AS km
         FROM drivers_online d
         JOIN users u ON u.id = d.driver_id AND u.is_blocked = 0
         JOIN driver_profiles p ON p.user_id = d.driver_id AND p.status = 'APPROVED'
              AND (p.suspended_until IS NULL OR p.suspended_until < NOW(3))
         WHERE d.status = 'AVAILABLE'
           AND d.last_active > NOW(3) - INTERVAL ? SECOND
           AND d.lat BETWEEN ? AND ? AND d.lng BETWEEN ? AND ?
           AND d.driver_id NOT IN (SELECT a.driver_id FROM assignments a WHERE a.ride_id = ?)
           AND NOT EXISTS (SELECT 1 FROM assignments o WHERE o.driver_id = d.driver_id
                           AND o.status = 'OFFERED' AND o.expires_at > NOW(3))
         HAVING km <= ?
         ORDER BY km ASC
         LIMIT 1`,
        [lat, lat, lng, freshSeconds, lat - dLat, lat + dLat, lng - dLng, lng + dLng, rideId, maxKm]
      );
      const best = cands[0];
      if (!best) {
        await logDispatch(conn, rideId, "NO_DRIVERS_AVAILABLE", "No hay motorizados disponibles cerca.", { attempt });
        return { dispatched: false, rideId, status: "NO_DRIVERS", attemptNumber: attempt };
      }
      const assignmentId = `ASG_${rideId}_${attempt}`;
      const km = Number(Number(best.km).toFixed(3));
      await conn.execute(
        `INSERT INTO assignments (id, ride_id, driver_id, driver_name, distance_km, attempt_number, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OFFERED', NOW(3) + INTERVAL ? SECOND)`,
        [assignmentId, rideId, best.driver_id, best.full_name, km, attempt, offerSeconds]
      );
      await logDispatch(conn, rideId, "ASSIGNMENT_OFFERED", `Ofrecido a motorizado a ${km.toFixed(2)} km`, {
        driverId: String(best.driver_id),
        assignmentId,
        attempt,
        distanceKm: km
      });
      notices.push({ userId: String(best.driver_id), event: { type: "offer", rideId, assignmentId } });
      return { dispatched: true, rideId, status: "OFFERED", assignedDriverId: String(best.driver_id), attemptNumber: attempt };
    });
    notify(notices);
    return result;
  }
  /** Revisa todos los pedidos que buscan motorizado y sin oferta vigente. */
  static async sweep() {
    const [rows] = await getPool().query(
      `SELECT r.id FROM rides r
       WHERE r.status = 'SEARCHING_DRIVER'
         AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.ride_id = r.id
                         AND a.status = 'OFFERED' AND a.expires_at > NOW(3))
       ORDER BY r.created_at ASC LIMIT 50`
    );
    for (const r of rows) {
      try {
        await _DispatchService.runDispatchCycle(String(r.id));
      } catch (err) {
        console.error("[DISPATCH] Error en barrido:", err.message);
      }
    }
    return rows.length;
  }
  static {
    this.timer = null;
  }
  /** Barrido automático cada pocos segundos (se activa al arrancar el servidor). */
  static startSweeper(intervalMs = 4e3) {
    if (_DispatchService.timer) return;
    let running = false;
    _DispatchService.timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await _DispatchService.sweep();
      } catch (err) {
        console.error("[DISPATCH] Barrido fall\xF3:", err.message);
      } finally {
        running = false;
      }
    }, intervalMs);
    _DispatchService.timer.unref();
  }
  static stopSweeper() {
    if (_DispatchService.timer) clearInterval(_DispatchService.timer);
    _DispatchService.timer = null;
  }
};

// server/services/http-error.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
};

// server/services/wallet.service.ts
var toIso = (v) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
var money = (n) => Math.round(n * 100) / 100;
var newMovementId = () => `wm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
var WalletService = class _WalletService {
  /** Calcula hasta cuándo el motorizado tiene comisión 0%, a partir de su fecha de aprobación. */
  static async freePeriodEnd(conn, driverId) {
    const sql = `SELECT reviewed_at, created_at, status FROM driver_profiles WHERE user_id = ?`;
    const [rows] = conn ? await conn.query(sql, [driverId]) : await getPool().query(sql, [driverId]);
    const p = rows[0];
    if (!p) return null;
    const anchor = p.reviewed_at || p.created_at;
    if (!anchor) return null;
    const freeDays = await getNumberSetting("new_driver_free_days", 14);
    const end = new Date(anchor);
    end.setDate(end.getDate() + freeDays);
    return end;
  }
  static async getOrCreateWallet(driverId) {
    const pool2 = getPool();
    await pool2.execute("INSERT IGNORE INTO wallets (driver_id) VALUES (?)", [driverId]);
    const [rows] = await pool2.query(
      "SELECT driver_id, cash_debt, accumulated_commission FROM wallets WHERE driver_id = ?",
      [driverId]
    );
    const w = rows[0];
    if (!w) throw new HttpError(404, "No se encontr\xF3 la billetera.");
    const debtLimit = await getNumberSetting("wallet_debt_limit", 2);
    const freeUntil = await _WalletService.freePeriodEnd(null, driverId);
    return {
      driverId,
      cashDebt: money(Number(w.cash_debt)),
      accumulatedCommission: money(Number(w.accumulated_commission)),
      debtLimit,
      blocked: Number(w.cash_debt) > debtLimit,
      freeUntil: freeUntil ? freeUntil.toISOString() : null,
      isInFreePeriod: Boolean(freeUntil && freeUntil.getTime() > Date.now())
    };
  }
  static async getMovements(driverId, limit = 50) {
    const [rows] = await getPool().query(
      `SELECT id, type, amount, balance_after, description, ride_id, topup_id, created_at
       FROM wallet_movements WHERE driver_id = ? ORDER BY created_at DESC LIMIT ?`,
      [driverId, limit]
    );
    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      amount: money(Number(r.amount)),
      balanceAfter: money(Number(r.balance_after)),
      description: r.description ?? null,
      rideId: r.ride_id ?? null,
      topupId: r.topup_id ?? null,
      createdAt: toIso(r.created_at) || ""
    }));
  }
  /** Si la deuda ya supera el límite, no puede conectarse a recibir pedidos. */
  static async isBlockedByDebt(conn, driverId) {
    const [rows] = await conn.query("SELECT cash_debt FROM wallets WHERE driver_id = ?", [driverId]);
    const debt = rows[0] ? Number(rows[0].cash_debt) : 0;
    const limit = await getNumberSetting("wallet_debt_limit", 2);
    return debt > limit;
  }
  /**
   * Se llama dentro de la misma transacción al completar un pedido.
   * Cobra la comisión de la plataforma (0% en los días gratis) como deuda del motorizado.
   */
  static async chargeRideCommission(conn, rideId, driverId, grossAmount) {
    await conn.execute("INSERT IGNORE INTO wallets (driver_id) VALUES (?)", [driverId]);
    const freeUntil = await _WalletService.freePeriodEnd(conn, driverId);
    const inFreePeriod = Boolean(freeUntil && freeUntil.getTime() > Date.now());
    if (inFreePeriod) return;
    const rate = await getNumberSetting("platform_commission_rate", 0.1);
    const minAmount = await getNumberSetting("commission_min_amount", 0.5);
    const commission = money(Math.max(grossAmount * rate, minAmount));
    if (commission <= 0) return;
    const [res] = await conn.execute(
      `UPDATE wallets SET cash_debt = cash_debt + ?, accumulated_commission = accumulated_commission + ?, version = version + 1
       WHERE driver_id = ?`,
      [commission, commission, driverId]
    );
    if (res.affectedRows === 0) return;
    const [after] = await conn.query("SELECT cash_debt FROM wallets WHERE driver_id = ?", [driverId]);
    await conn.execute(
      `INSERT INTO wallet_movements (id, driver_id, type, amount, balance_after, description, ride_id)
       VALUES (?, ?, 'platform_commission', ?, ?, ?, ?)`,
      [newMovementId(), driverId, commission, money(Number(after[0].cash_debt)), `Comisi\xF3n Z\xE9nith (${(rate * 100).toFixed(0)}%) pedido #${rideId.slice(0, 8)}`, rideId]
    );
  }
  /** Se llama al acreditar una recarga Yape (ver topup.service.ts): abona la deuda del motorizado. */
  static async applyTopupCredit(conn, driverId, topupId, amount) {
    await conn.execute("INSERT IGNORE INTO wallets (driver_id) VALUES (?)", [driverId]);
    await conn.execute(
      `UPDATE wallets SET cash_debt = GREATEST(0, cash_debt - ?), version = version + 1 WHERE driver_id = ?`,
      [amount, driverId]
    );
    const [after] = await conn.query("SELECT cash_debt FROM wallets WHERE driver_id = ?", [driverId]);
    await conn.execute(
      `INSERT INTO wallet_movements (id, driver_id, type, amount, balance_after, description, topup_id)
       VALUES (?, ?, 'topup_yape', ?, ?, 'Recarga Yape acreditada', ?)`,
      [newMovementId(), driverId, money(amount), money(Number(after[0].cash_debt)), topupId]
    );
  }
};

// server/services/ride.service.ts
var rideNotices = (v) => {
  const ev = { type: "ride", rideId: v.id, status: v.status };
  const out = [{ userId: v.passengerId, event: ev }];
  if (v.driverId) out.push({ userId: v.driverId, event: ev });
  return out;
};
var DRIVER_TRANSITIONS = {
  DRIVER_ASSIGNED: ["DRIVER_ARRIVING"],
  DRIVER_ARRIVING: ["WAITING_FOR_OTP"],
  IN_PROGRESS: ["COMPLETED"]
};
var OTP_MAX_ATTEMPTS2 = 3;
var otpSecret = () => {
  const s = process.env.OTP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("OTP_SECRET no configurado.");
  return s || "ZENITH_DEV_OTP_SECRET";
};
var hashOtp2 = (rideId, code) => import_crypto3.default.createHmac("sha256", otpSecret()).update(`${rideId}:${code}`).digest("hex");
var TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED"];
var HISTORY_PAGE_SIZE_MAX = 50;
var toNum = (v) => Number(v);
var toIso2 = (v) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
var parseJson = (v) => {
  if (v === null || v === void 0) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
};
var toRideView = (r) => {
  const orderType = r.order_type === "FOOD" ? "FOOD" : "DELIVERY";
  const isFood = orderType === "FOOD";
  return {
    id: String(r.id),
    status: r.status,
    passengerId: String(r.passenger_id),
    passengerName: r.passenger_name ?? null,
    driverId: r.driver_id ?? null,
    driverName: r.driver_name ?? null,
    driverPhone: r.driver_phone ?? null,
    origin: { address: String(r.origin_address), lat: toNum(r.origin_lat), lng: toNum(r.origin_lng) },
    destination: { address: String(r.destination_address), lat: toNum(r.destination_lat), lng: toNum(r.destination_lng) },
    driverLocation: r.driver_lat !== null && r.driver_lat !== void 0 ? { lat: toNum(r.driver_lat), lng: toNum(r.driver_lng) } : null,
    price: toNum(r.protected_price),
    distanceKm: r.distance_km !== null ? toNum(r.distance_km) : null,
    paymentMethod: String(r.payment_method),
    delivery: isFood ? null : parseJson(r.package_info),
    orderType,
    food: isFood ? parseJson(r.package_info) : null,
    restaurantId: r.restaurant_id ?? null,
    createdAt: toIso2(r.created_at) || "",
    acceptedAt: toIso2(r.accepted_at),
    startedAt: toIso2(r.started_at),
    completedAt: toIso2(r.completed_at),
    rating: r.rating !== null && r.rating !== void 0 ? toNum(r.rating) : null,
    feedback: r.feedback ?? null,
    cancelledBy: r.cancelled_by ?? null,
    cancelReason: r.cancel_reason ?? null
  };
};
var lockRide = async (conn, rideId) => {
  const [rows] = await conn.query(
    "SELECT *, (otp_expires_at IS NOT NULL AND otp_expires_at <= NOW(3)) AS otp_expired FROM rides WHERE id = ? FOR UPDATE",
    [rideId]
  );
  if (!rows[0]) throw new HttpError(404, "Pedido no encontrado.");
  return rows[0];
};
var event = async (conn, rideId, actorRole, actorId, action, result = "OK") => {
  await conn.execute(
    "INSERT INTO operational_events (ride_id, actor_role, actor_id, action, result) VALUES (?, ?, ?, ?, ?)",
    [rideId, actorRole, actorId, action, result]
  );
};
var cleanText = (v, max) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : void 0;
var RideService = class {
  /** El cliente confirma la cotización firmada y se crea el pedido. */
  static async requestRide(input) {
    const { quote } = input;
    if (!quote || typeof quote !== "object") throw new HttpError(400, "Falta la cotizaci\xF3n.");
    const check = verifyQuoteSignature(quote);
    if (!check.valid) throw new HttpError(400, `Cotizaci\xF3n no v\xE1lida: ${check.reason}. Vuelve a cotizar.`);
    const paymentMethod = ["cash", "yape", "plin"].includes(String(input.paymentMethod)) ? String(input.paymentMethod) : "cash";
    const idemKey = (cleanText(input.idempotencyKey, 120) || quote.quoteId).slice(0, 120);
    const payloadHash = import_crypto3.default.createHash("sha256").update(JSON.stringify({ p: input.passengerId, q: quote.quoteId, f: quote.totalFare.toFixed(2) })).digest("hex");
    const orderType = input.orderType === "FOOD" ? "FOOD" : "DELIVERY";
    const delivery = orderType === "DELIVERY" && input.delivery ? {
      description: cleanText(input.delivery.description, 300),
      receptorName: cleanText(input.delivery.receptorName, 150),
      receptorPhone: cleanText(input.delivery.receptorPhone, 20),
      notes: cleanText(input.delivery.notes, 300)
    } : null;
    if (orderType === "FOOD" && !input.food) throw new HttpError(400, "Falta el detalle del pedido de comida.");
    const food = orderType === "FOOD" && input.food ? input.food : null;
    const packageInfo = orderType === "FOOD" ? food : delivery;
    const searchSeconds = await getNumberSetting("search_timeout_seconds", 300);
    const otpMinutes = await getNumberSetting("pickup_otp_minutes", 60);
    const result = await withTransaction(async (conn) => {
      const [idem] = await conn.query(
        "SELECT resource_id, payload_hash FROM idempotency_keys WHERE idem_key = ? FOR UPDATE",
        [idemKey]
      );
      if (idem[0]) {
        if (idem[0].payload_hash !== payloadHash) throw new HttpError(409, "Esta cotizaci\xF3n ya se us\xF3 para otro pedido.");
        const [rows2] = await conn.query("SELECT * FROM rides WHERE id = ?", [idem[0].resource_id]);
        if (!rows2[0]) throw new HttpError(409, "Pedido no disponible.");
        return { ride: toRideView(rows2[0]), otpCode: String(rows2[0].otp_code || ""), idempotent: true };
      }
      const [active] = await conn.query(
        `SELECT id FROM rides WHERE passenger_id = ?
         AND status IN ('SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_ARRIVING','WAITING_FOR_OTP','IN_PROGRESS') LIMIT 1`,
        [input.passengerId]
      );
      if (active[0]) throw new HttpError(409, "Ya tienes un pedido en curso.");
      const [users] = await conn.query("SELECT full_name, phone, is_blocked FROM users WHERE id = ?", [input.passengerId]);
      const user = users[0];
      if (!user || user.is_blocked) throw new HttpError(403, "Cuenta no disponible.");
      const rideId = import_crypto3.default.randomUUID();
      const otpCode = import_crypto3.default.randomInt(1e3, 1e4).toString();
      const city = quote.marketZone?.city || resolveCityFromCoordinates(quote.origin.lat, quote.origin.lng, quote.origin.address).city;
      await conn.execute(
        `INSERT INTO rides (
           id, passenger_id, passenger_name, passenger_phone, status, order_type, restaurant_id, city,
           origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng,
           distance_km, duration_min, protected_price, normal_fare, multiplier, payment_method,
           pricing_seal, pricing_version, quote_id, solicitude_status, package_info,
           otp_code, otp_hash, otp_expires_at, search_expires_at)
         VALUES (?, ?, ?, ?, 'SEARCHING_DRIVER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?,
                 ?, ?, NOW(3) + INTERVAL ? MINUTE, NOW(3) + INTERVAL ? SECOND)`,
        [
          rideId,
          input.passengerId,
          user.full_name,
          user.phone,
          orderType,
          input.restaurantId ?? null,
          city,
          quote.origin.address.slice(0, 255),
          quote.origin.lat,
          quote.origin.lng,
          quote.destination.address.slice(0, 255),
          quote.destination.lat,
          quote.destination.lng,
          quote.distance,
          quote.duration ?? null,
          quote.totalFare,
          quote.normalFare,
          quote.multiplier,
          paymentMethod,
          quote.pricingSeal,
          quote.pricingVersion,
          quote.quoteId,
          packageInfo ? JSON.stringify(packageInfo) : null,
          otpCode,
          hashOtp2(rideId, otpCode),
          otpMinutes,
          searchSeconds
        ]
      );
      await conn.execute(
        `INSERT INTO idempotency_keys (idem_key, user_id, scope, resource_id, payload_hash) VALUES (?, ?, 'RIDE_REQUEST', ?, ?)`,
        [idemKey, input.passengerId, rideId, payloadHash]
      );
      await event(conn, rideId, "SOLICITANTE", input.passengerId, "RIDE_REQUESTED");
      const [rows] = await conn.query("SELECT * FROM rides WHERE id = ?", [rideId]);
      return { ride: toRideView(rows[0]), otpCode, idempotent: false };
    });
    if (!result.idempotent) {
      DispatchService.runDispatchCycle(result.ride.id).catch(
        (err) => console.error("[DISPATCH] No se pudo iniciar despacho:", err.message)
      );
    }
    return result;
  }
  /** Datos del pedido para cliente o motorizado asignado. */
  static async getRide(rideId, userId, isAdmin2 = false) {
    const [rows] = await getPool().query("SELECT * FROM rides WHERE id = ?", [rideId]);
    const r = rows[0];
    if (!r) throw new HttpError(404, "Pedido no encontrado.");
    const isPassenger = r.passenger_id === userId;
    if (!isPassenger && r.driver_id !== userId && !isAdmin2) throw new HttpError(403, "No tienes acceso a este pedido.");
    const view = toRideView(r);
    if (isPassenger && !Number(r.otp_verified) && ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "WAITING_FOR_OTP", "SEARCHING_DRIVER"].includes(String(r.status))) {
      return { ...view, otpCode: String(r.otp_code || "") };
    }
    return view;
  }
  /** Pedido activo del usuario (cliente o motorizado), para reanudar la pantalla al abrir la app. */
  static async getActiveRide(userId) {
    const [rows] = await getPool().query(
      `SELECT * FROM rides WHERE (passenger_id = ? OR driver_id = ?)
       AND status IN ('SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_ARRIVING','WAITING_FOR_OTP','IN_PROGRESS')
       ORDER BY created_at DESC LIMIT 1`,
      [userId, userId]
    );
    return rows[0] ? toRideView(rows[0]) : null;
  }
  /**
   * Historial de pedidos terminados (entregado, cancelado o vencido) del cliente o del
   * motorizado. Paginado por fecha descendente, igual sirve para delivery que para comida.
   */
  static async getHistory(userId, page = 1, pageSize = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), HISTORY_PAGE_SIZE_MAX) : 20;
    const offset = (safePage - 1) * safeSize;
    const statusPlaceholders = TERMINAL_STATUSES.map(() => "?").join(",");
    const [countRows] = await getPool().query(
      `SELECT COUNT(*) AS n FROM rides WHERE (passenger_id = ? OR driver_id = ?) AND status IN (${statusPlaceholders})`,
      [userId, userId, ...TERMINAL_STATUSES]
    );
    const total = Number(countRows[0]?.n || 0);
    const [rows] = await getPool().query(
      `SELECT * FROM rides WHERE (passenger_id = ? OR driver_id = ?) AND status IN (${statusPlaceholders})
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, userId, ...TERMINAL_STATUSES, safeSize, offset]
    );
    return {
      items: rows.map(toRideView),
      page: safePage,
      pageSize: safeSize,
      total,
      hasMore: offset + rows.length < total
    };
  }
  /** El motorizado acepta la oferta que se le hizo. */
  static async acceptOffer(assignmentId, driverId) {
    const view = await withTransaction(async (conn) => {
      const [pre] = await conn.query("SELECT ride_id, driver_id FROM assignments WHERE id = ?", [assignmentId]);
      if (!pre[0] || pre[0].driver_id !== driverId) throw new HttpError(404, "Oferta no encontrada.");
      const ride = await lockRide(conn, String(pre[0].ride_id));
      const [asg] = await conn.query(
        "SELECT id, status, expires_at > NOW(3) AS alive FROM assignments WHERE id = ? FOR UPDATE",
        [assignmentId]
      );
      const a = asg[0];
      if (a.status === "ACCEPTED" && ride.driver_id === driverId) return toRideView(ride);
      if (a.status !== "OFFERED" || !Number(a.alive)) throw new HttpError(409, "La oferta ya venci\xF3.");
      if (ride.status !== "SEARCHING_DRIVER") throw new HttpError(409, "El pedido ya no est\xE1 disponible.");
      const [drv] = await conn.query(
        `SELECT d.status, u.full_name, u.phone, d.lat, d.lng FROM drivers_online d JOIN users u ON u.id = d.driver_id
         WHERE d.driver_id = ? FOR UPDATE`,
        [driverId]
      );
      const d = drv[0];
      if (!d || d.status !== "AVAILABLE") throw new HttpError(409, "Debes estar disponible para aceptar.");
      await conn.execute(`UPDATE assignments SET status = 'ACCEPTED', responded_at = NOW(3) WHERE id = ?`, [assignmentId]);
      await conn.execute(
        `UPDATE rides SET status = 'DRIVER_ASSIGNED', solicitude_status = 'ASSIGNED', transit_status = 'TO_PICKUP',
           driver_id = ?, driver_name = ?, driver_phone = ?, driver_lat = ?, driver_lng = ?, accepted_at = NOW(3)
         WHERE id = ?`,
        [driverId, d.full_name, d.phone, d.lat, d.lng, ride.id]
      );
      await conn.execute(`UPDATE drivers_online SET status = 'BUSY', current_ride_id = ? WHERE driver_id = ?`, [ride.id, driverId]);
      await conn.execute(
        `INSERT INTO dispatch_logs (ride_id, driver_id, assignment_id, event, details) VALUES (?, ?, ?, 'ASSIGNMENT_ACCEPTED', 'Aceptado por el motorizado')`,
        [ride.id, driverId, assignmentId]
      );
      await event(conn, String(ride.id), "MOTORIZADO", driverId, "OFFER_ACCEPTED");
      const [rows] = await conn.query("SELECT * FROM rides WHERE id = ?", [ride.id]);
      return toRideView(rows[0]);
    });
    notify(rideNotices(view));
    return view;
  }
  /** El motorizado rechaza: se ofrece al siguiente al instante. */
  static async rejectOffer(assignmentId, driverId) {
    const rideId = await withTransaction(async (conn) => {
      const [asg] = await conn.query("SELECT ride_id, driver_id, status FROM assignments WHERE id = ? FOR UPDATE", [assignmentId]);
      const a = asg[0];
      if (!a || a.driver_id !== driverId) throw new HttpError(404, "Oferta no encontrada.");
      if (a.status !== "OFFERED") return String(a.ride_id);
      await conn.execute(`UPDATE assignments SET status = 'REJECTED', responded_at = NOW(3) WHERE id = ?`, [assignmentId]);
      await conn.execute(
        `INSERT INTO dispatch_logs (ride_id, driver_id, assignment_id, event, details) VALUES (?, ?, ?, 'ASSIGNMENT_REJECTED', 'Rechazado por el motorizado')`,
        [a.ride_id, driverId, assignmentId]
      );
      return String(a.ride_id);
    });
    await DispatchService.runDispatchCycle(rideId);
  }
  /** Avance del motorizado: en camino -> llegué (pide código) -> entregado. */
  static async updateStatus(rideId, driverId, next) {
    const view = await withTransaction(async (conn) => {
      const ride = await lockRide(conn, rideId);
      if (ride.driver_id !== driverId) throw new HttpError(403, "Este pedido no es tuyo.");
      const allowed = DRIVER_TRANSITIONS[String(ride.status)] || [];
      if (!allowed.includes(next)) {
        throw new HttpError(400, next === "IN_PROGRESS" ? "Para iniciar el viaje debes ingresar el c\xF3digo del cliente." : `No se puede pasar de ${ride.status} a ${next}.`);
      }
      const extra = {
        DRIVER_ARRIVING: ", transit_status = 'TO_PICKUP'",
        WAITING_FOR_OTP: ", transit_status = 'AT_PICKUP', pickup_arrived_at = NOW(3)",
        COMPLETED: ", transit_status = 'AT_DESTINATION', solicitude_status = 'COMPLETED', destination_arrived_at = NOW(3), completed_at = NOW(3)"
      };
      await conn.execute(`UPDATE rides SET status = ?${extra[next] || ""} WHERE id = ?`, [next, rideId]);
      if (next === "COMPLETED") {
        await conn.execute(`UPDATE drivers_online SET status = 'AVAILABLE', current_ride_id = NULL WHERE driver_id = ?`, [driverId]);
        await WalletService.chargeRideCommission(conn, rideId, driverId, Number(ride.protected_price));
      }
      await event(conn, rideId, "MOTORIZADO", driverId, `STATUS_${next}`);
      const [rows] = await conn.query("SELECT * FROM rides WHERE id = ?", [rideId]);
      return toRideView(rows[0]);
    });
    notify(rideNotices(view));
    return view;
  }
  /** El motorizado ingresa el código que le dicta el cliente. 3 intentos. */
  static async verifyOtp(rideId, driverId, code) {
    const outcome = await withTransaction(async (conn) => {
      const ride = await lockRide(conn, rideId);
      if (ride.driver_id !== driverId) throw new HttpError(403, "Este pedido no es tuyo.");
      if (ride.status !== "WAITING_FOR_OTP") throw new HttpError(400, "Primero marca que llegaste al punto de recojo.");
      if (Number(ride.otp_attempts) >= OTP_MAX_ATTEMPTS2) throw new HttpError(429, "C\xF3digo bloqueado por intentos. Contacta a soporte.");
      if (Number(ride.otp_expired)) throw new HttpError(400, "El c\xF3digo venci\xF3. Contacta a soporte.");
      const given = typeof code === "string" ? code.trim() : "";
      const ok = /^\d{4}$/.test(given) && import_crypto3.default.timingSafeEqual(Buffer.from(hashOtp2(rideId, given), "hex"), Buffer.from(String(ride.otp_hash), "hex"));
      if (!ok) {
        await conn.execute("UPDATE rides SET otp_attempts = otp_attempts + 1 WHERE id = ?", [rideId]);
        await event(conn, rideId, "MOTORIZADO", driverId, "OTP_CHECK", "WRONG");
        return { ok: false, left: OTP_MAX_ATTEMPTS2 - Number(ride.otp_attempts) - 1 };
      }
      await conn.execute(
        `UPDATE rides SET status = 'IN_PROGRESS', otp_verified = 1, transit_status = 'IN_TRANSIT',
           solicitude_status = 'ACTIVE', started_at = NOW(3), driver_started_trip_at = NOW(3) WHERE id = ?`,
        [rideId]
      );
      await event(conn, rideId, "MOTORIZADO", driverId, "OTP_CHECK", "OK");
      const [rows] = await conn.query("SELECT * FROM rides WHERE id = ?", [rideId]);
      return { ok: true, ride: toRideView(rows[0]) };
    });
    if (!outcome.ok) throw new HttpError(400, `C\xF3digo incorrecto. Te quedan ${Math.max(0, outcome.left)} intentos.`);
    notify(rideNotices(outcome.ride));
    return outcome.ride;
  }
  /**
   * El cliente califica al motorizado (1 a 5 estrellas) tras un pedido entregado.
   * Una sola vez por pedido; recalcula el promedio del motorizado al vuelo.
   */
  static async rateRide(rideId, passengerId, rating, feedback) {
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new HttpError(400, "La calificaci\xF3n debe ser un n\xFAmero entero de 1 a 5.");
    }
    const view = await withTransaction(async (conn) => {
      const ride = await lockRide(conn, rideId);
      if (ride.passenger_id !== passengerId) throw new HttpError(403, "Solo el cliente puede calificar este pedido.");
      if (ride.status !== "COMPLETED") throw new HttpError(400, "Solo se puede calificar un pedido ya entregado.");
      if (ride.rating !== null) throw new HttpError(409, "Ya calificaste este pedido.");
      if (!ride.driver_id) throw new HttpError(400, "Este pedido no tiene motorizado asociado.");
      await conn.execute("UPDATE rides SET rating = ?, feedback = ? WHERE id = ?", [stars, cleanText(feedback, 500) ?? null, rideId]);
      const [avg] = await conn.query(
        "SELECT ROUND(AVG(rating), 2) AS avg_rating FROM rides WHERE driver_id = ? AND rating IS NOT NULL",
        [ride.driver_id]
      );
      const newAverage = Number(avg[0]?.avg_rating ?? stars);
      await conn.execute("UPDATE driver_profiles SET rating = ? WHERE user_id = ?", [newAverage, ride.driver_id]);
      await conn.execute("UPDATE users SET rating = ? WHERE id = ?", [newAverage, ride.driver_id]);
      await event(conn, rideId, "SOLICITANTE", passengerId, "RIDE_RATED");
      const [rows] = await conn.query("SELECT * FROM rides WHERE id = ?", [rideId]);
      return toRideView(rows[0]);
    });
    notify(rideNotices(view));
    return view;
  }
  /** Cancelar: el cliente o el motorizado asignado, antes de que termine. */
  static async cancelRide(rideId, userId, reason) {
    const offerClosed = [];
    const view = await withTransaction(async (conn) => {
      offerClosed.length = 0;
      const ride = await lockRide(conn, rideId);
      const isPassenger = ride.passenger_id === userId;
      const isDriver = ride.driver_id === userId;
      if (!isPassenger && !isDriver) throw new HttpError(403, "No puedes cancelar este pedido.");
      if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(String(ride.status))) throw new HttpError(400, "El pedido ya termin\xF3.");
      if (ride.status === "IN_PROGRESS") throw new HttpError(400, "El pedido ya est\xE1 en camino; contacta a soporte.");
      await conn.execute(
        `UPDATE rides SET status = 'CANCELLED', solicitude_status = 'CANCELLED', cancelled_by = ?, cancel_reason = ? WHERE id = ?`,
        [userId, cleanText(reason, 255) ?? null, rideId]
      );
      const [openOffers] = await conn.query(`SELECT id, driver_id FROM assignments WHERE ride_id = ? AND status = 'OFFERED'`, [rideId]);
      for (const o of openOffers) {
        offerClosed.push({ userId: String(o.driver_id), event: { type: "offer.closed", assignmentId: String(o.id), reason: "CANCELLED" } });
      }
      await conn.execute(`UPDATE assignments SET status = 'CANCELLED', responded_at = NOW(3) WHERE ride_id = ? AND status = 'OFFERED'`, [rideId]);
      if (ride.driver_id) {
        await conn.execute(`UPDATE drivers_online SET status = 'AVAILABLE', current_ride_id = NULL WHERE driver_id = ?`, [ride.driver_id]);
      }
      await event(conn, rideId, isPassenger ? "SOLICITANTE" : "MOTORIZADO", userId, "RIDE_CANCELLED");
      const [rows] = await conn.query("SELECT * FROM rides WHERE id = ?", [rideId]);
      return toRideView(rows[0]);
    });
    notify([...rideNotices(view), ...offerClosed]);
    return view;
  }
};

// server/services/driver.service.ts
var validCoord = (lat, lng) => {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < -90 || a > 90 || b < -180 || b > 180) {
    throw new HttpError(400, "Ubicaci\xF3n GPS inv\xE1lida.");
  }
  return { lat: a, lng: b };
};
var DriverService = class {
  /**
   * Conectarse (AVAILABLE), seguir conectado con GPS nuevo, o desconectarse (OFFLINE).
   * Solo motorizados aprobados y no suspendidos pueden conectarse.
   */
  static async updatePresence(driverId, input) {
    const { lat, lng } = validCoord(input.lat, input.lng);
    const wantsOnline = input.online !== false;
    const heading = Number.isFinite(Number(input.heading)) ? Math.round(Number(input.heading)) : null;
    const speed = Number.isFinite(Number(input.speedKmh)) ? Number(Number(input.speedKmh).toFixed(1)) : null;
    const notices = [];
    const out = await withTransaction(async (conn) => {
      notices.length = 0;
      const [prof] = await conn.query(
        `SELECT p.status, p.suspended_until > NOW(3) AS suspended, u.is_blocked
         FROM driver_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?`,
        [driverId]
      );
      const p = prof[0];
      if (!p) throw new HttpError(403, "Tu cuenta no es de motorizado.");
      if (wantsOnline) {
        if (p.is_blocked) throw new HttpError(403, "Tu cuenta est\xE1 bloqueada.");
        if (p.status !== "APPROVED") throw new HttpError(403, "Tus documentos a\xFAn no est\xE1n aprobados.");
        if (Number(p.suspended)) throw new HttpError(403, "Tu cuenta est\xE1 suspendida temporalmente.");
        if (await WalletService.isBlockedByDebt(conn, driverId)) {
          throw new HttpError(403, "Tienes una deuda de comisi\xF3n pendiente. Recarga por Yape para seguir conectado.");
        }
      }
      const [cur] = await conn.query("SELECT status, current_ride_id FROM drivers_online WHERE driver_id = ? FOR UPDATE", [driverId]);
      const busy = cur[0]?.status === "BUSY";
      if (!wantsOnline && busy) throw new HttpError(409, "Termina tu pedido antes de desconectarte.");
      const status = busy ? "BUSY" : wantsOnline ? "AVAILABLE" : "OFFLINE";
      await conn.execute(
        `INSERT INTO drivers_online (driver_id, status, lat, lng, heading, speed_kmh, last_active)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE status = VALUES(status), lat = VALUES(lat), lng = VALUES(lng),
           heading = VALUES(heading), speed_kmh = VALUES(speed_kmh), last_active = NOW(3)`,
        [driverId, status, lat, lng, heading, speed]
      );
      await conn.execute("UPDATE driver_profiles SET availability = ?, last_connection = NOW(3) WHERE user_id = ?", [status === "OFFLINE" ? 0 : 1, driverId]);
      if (busy && cur[0]?.current_ride_id) {
        const rideId = String(cur[0].current_ride_id);
        await conn.execute("UPDATE rides SET driver_lat = ?, driver_lng = ? WHERE id = ? AND driver_id = ?", [lat, lng, rideId, driverId]);
        const [pr] = await conn.query("SELECT passenger_id FROM rides WHERE id = ?", [rideId]);
        if (pr[0]) notices.push({ userId: String(pr[0].passenger_id), event: { type: "ride.location", rideId, lat, lng, heading } });
      }
      return { status };
    });
    notify(notices);
    return out;
  }
  /** La oferta vigente para este motorizado (o null). También empuja el despacho por si el temporizador durmió. */
  static async getCurrentOffer(driverId) {
    await DispatchService.sweep();
    const [rows] = await getPool().query(
      `SELECT a.id AS assignment_id, a.ride_id, a.distance_km,
              GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(3), a.expires_at)) AS secs,
              r.protected_price, r.origin_address, r.origin_lat, r.origin_lng,
              r.destination_address, r.destination_lat, r.destination_lng, r.distance_km AS trip_km, r.payment_method
       FROM assignments a JOIN rides r ON r.id = a.ride_id
       WHERE a.driver_id = ? AND a.status = 'OFFERED' AND a.expires_at > NOW(3) AND r.status = 'SEARCHING_DRIVER'
       ORDER BY a.assigned_at DESC LIMIT 1`,
      [driverId]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      assignmentId: String(r.assignment_id),
      rideId: String(r.ride_id),
      expiresInSeconds: Number(r.secs),
      distanceToPickupKm: Number(r.distance_km),
      price: Number(r.protected_price),
      origin: { address: String(r.origin_address), lat: Number(r.origin_lat), lng: Number(r.origin_lng) },
      destination: { address: String(r.destination_address), lat: Number(r.destination_lat), lng: Number(r.destination_lng) },
      tripDistanceKm: r.trip_km !== null ? Number(r.trip_km) : null,
      paymentMethod: String(r.payment_method)
    };
  }
};

// server/routes/ride.routes.ts
var router = (0, import_express.Router)();
router.use(requireSession);
var uid = (req) => req.session?.sub || "";
var isAdmin = (req) => req.session?.adm === true;
var handle = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[RIDES] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
router.post("/request", requireAppRole(["passenger", "driver"]), handle(async (req) => {
  const r = await RideService.requestRide({
    quote: req.body?.quote,
    passengerId: uid(req),
    paymentMethod: req.body?.paymentMethod,
    idempotencyKey: req.body?.idempotencyKey,
    delivery: req.body?.delivery
  });
  return { ride: r.ride, otpCode: r.otpCode, idempotent: r.idempotent };
}, 201));
router.get("/active", handle(async (req) => ({ ride: await RideService.getActiveRide(uid(req)) })));
router.get("/history", handle(async (req) => RideService.getHistory(
  uid(req),
  Number(req.query.page) || 1,
  Number(req.query.pageSize) || 20
)));
router.post("/driver/presence", requireAppRole(["driver"]), handle((req) => DriverService.updatePresence(uid(req), {
  lat: req.body?.lat,
  lng: req.body?.lng,
  online: req.body?.online,
  heading: req.body?.heading,
  speedKmh: req.body?.speedKmh
})));
router.get("/driver/offer", requireAppRole(["driver"]), handle(async (req) => ({ offer: await DriverService.getCurrentOffer(uid(req)) })));
router.post("/driver/offers/:assignmentId/accept", requireAppRole(["driver"]), handle(async (req) => ({
  ride: await RideService.acceptOffer(req.params.assignmentId, uid(req))
})));
router.post("/driver/offers/:assignmentId/reject", requireAppRole(["driver"]), handle(async (req) => {
  await RideService.rejectOffer(req.params.assignmentId, uid(req));
  return {};
}));
router.post("/:rideId/status", requireAppRole(["driver"]), handle(async (req) => ({
  ride: await RideService.updateStatus(req.params.rideId, uid(req), String(req.body?.status || ""))
})));
router.post("/:rideId/verify-otp", requireAppRole(["driver"]), handle(async (req) => ({
  ride: await RideService.verifyOtp(req.params.rideId, uid(req), req.body?.code)
})));
router.get("/:rideId", handle(async (req) => ({ ride: await RideService.getRide(req.params.rideId, uid(req), isAdmin(req)) })));
router.post("/:rideId/cancel", handle(async (req) => ({
  ride: await RideService.cancelRide(req.params.rideId, uid(req), req.body?.reason)
})));
router.post("/:rideId/rate", requireAppRole(["passenger", "driver"]), handle(async (req) => ({
  ride: await RideService.rateRide(req.params.rideId, uid(req), req.body?.rating, req.body?.feedback)
})));
var ride_routes_default = router;

// server/routes/wallet.routes.ts
var import_express2 = require("express");
var router2 = (0, import_express2.Router)();
router2.use(requireSession);
router2.use(requireAppRole(["driver"]));
var uid2 = (req) => req.session?.sub || "";
var handle2 = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[WALLET] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
router2.get("/me", handle2(async (req) => ({ wallet: await WalletService.getOrCreateWallet(uid2(req)) })));
router2.get("/movements", handle2(async (req) => ({ movements: await WalletService.getMovements(uid2(req)) })));
var wallet_routes_default = router2;

// server/routes/topup.routes.ts
var import_express3 = require("express");

// server/services/culqi.service.ts
var CULQI_API = "https://api.culqi.com/v2/charges";
var CulqiService = {
  isConfigured() {
    return Boolean(process.env.CULQI_SECRET_KEY);
  },
  /** Crea el cargo por `amountSoles` (en soles, con decimales) contra el token del celular. */
  async createCharge(token, amountSoles, email) {
    const secretKey = process.env.CULQI_SECRET_KEY;
    if (!secretKey) throw new HttpError(503, "El cobro con Culqi no est\xE1 disponible por ahora. Usa la recarga manual por Yape.");
    const amountCents = Math.round(amountSoles * 100);
    let res;
    try {
      res = await fetch(CULQI_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountCents, currency_code: "PEN", email, source_id: token })
      });
    } catch (err) {
      console.error("[CULQI] No se pudo contactar a Culqi:", err.message);
      throw new HttpError(502, "No se pudo conectar con Culqi. Intenta de nuevo o usa la recarga manual.");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof body.user_message === "string" ? body.user_message : "Culqi rechaz\xF3 el pago.";
      throw new HttpError(402, msg);
    }
    const outcome = body.outcome;
    return {
      id: String(body.id),
      amountCents: Number(body.amount ?? amountCents),
      outcomeType: outcome?.type || "desconocido"
    };
  }
};

// server/services/topup.service.ts
var toIso3 = (v) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
var money2 = (n) => Math.round(n * 100) / 100;
var newId = () => `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
var newReference = () => `Z-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
var SELECT = `
  SELECT t.id, t.driver_id, t.requested_amount, t.operation_number, t.payment_method,
         t.gross_amount, t.fee_amount, t.status,
         t.rejection_reason, t.reviewed_by, t.reviewed_at, t.credited_at, t.created_at,
         u.full_name AS driver_name, u.phone AS driver_phone
  FROM topup_requests t JOIN users u ON u.id = t.driver_id
`;
var toView = (r) => ({
  id: String(r.id),
  driverId: String(r.driver_id),
  driverName: r.driver_name ?? null,
  driverPhone: r.driver_phone ?? null,
  requestedAmount: money2(Number(r.requested_amount)),
  operationNumber: r.operation_number ?? null,
  paymentMethod: r.payment_method || "YAPE_MANUAL",
  grossAmount: r.gross_amount !== null && r.gross_amount !== void 0 ? money2(Number(r.gross_amount)) : null,
  feeAmount: r.fee_amount !== null && r.fee_amount !== void 0 ? money2(Number(r.fee_amount)) : null,
  status: r.status,
  rejectionReason: r.rejection_reason ?? null,
  reviewedBy: r.reviewed_by ?? null,
  reviewedAt: toIso3(r.reviewed_at),
  creditedAt: toIso3(r.credited_at),
  createdAt: toIso3(r.created_at) || ""
});
var audit = async (adminId, action, targetId, details) => {
  await getPool().execute(
    "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)",
    [adminId, "ADMIN", action, "topup_request", targetId, JSON.stringify(details)]
  ).catch((err) => console.error("[TOPUP] No se pudo auditar:", err.message));
};
var TopupService = class {
  /** El motorizado dice "ya yapeé tanto, con este número de operación". */
  static async createRequest(driverId, amount, operationNumber) {
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested < 5 || requested > 2e3) {
      throw new HttpError(400, "El monto debe estar entre S/ 5 y S/ 2000.");
    }
    const op = typeof operationNumber === "string" ? operationNumber.trim().slice(0, 30) : "";
    if (!op) throw new HttpError(400, "Escribe el n\xFAmero de operaci\xF3n de tu Yape.");
    const pool2 = getPool();
    const [pending] = await pool2.query(
      `SELECT id FROM topup_requests WHERE driver_id = ? AND status = 'RECEIPT_SUBMITTED' LIMIT 1`,
      [driverId]
    );
    if (pending[0]) throw new HttpError(409, "Ya tienes una recarga esperando revisi\xF3n.");
    const id = newId();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1e3);
    await pool2.execute(
      `INSERT INTO topup_requests (id, reference_code, driver_id, requested_amount, operation_number, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'RECEIPT_SUBMITTED', ?)`,
      [id, newReference(), driverId, money2(requested), op, expiresAt]
    );
    const [rows] = await pool2.query(`${SELECT} WHERE t.id = ?`, [id]);
    return toView(rows[0]);
  }
  /**
   * Recarga con Culqi (tarjeta/Yape por botón, sin escribir número de operación).
   * Se cobra el monto completo al motorizado; la comisión de Culqi se descuenta
   * del monto que se le acredita en la billetera (dejar esto claro en la app).
   * Al ser una confirmación de Culqi, se acredita de inmediato, sin revisión del admin.
   */
  static async chargeWithCulqi(driverId, token, amount, email) {
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested < 5 || requested > 2e3) {
      throw new HttpError(400, "El monto debe estar entre S/ 5 y S/ 2000.");
    }
    if (typeof token !== "string" || !token.trim()) throw new HttpError(400, "Falta el token de pago de Culqi.");
    const pool2 = getPool();
    const [pending] = await pool2.query(
      `SELECT id FROM topup_requests WHERE driver_id = ? AND status = 'RECEIPT_SUBMITTED' LIMIT 1`,
      [driverId]
    );
    if (pending[0]) throw new HttpError(409, "Ya tienes una recarga esperando revisi\xF3n.");
    const [feePct, feeFixed] = await Promise.all([
      getNumberSetting("culqi_fee_pct", 3.99),
      getNumberSetting("culqi_fee_fixed", 0.5)
    ]);
    const fee = money2(requested * (feePct / 100) + feeFixed);
    const net = money2(requested - fee);
    if (net <= 0) throw new HttpError(400, "El monto es muy bajo para cubrir la comisi\xF3n del cobro.");
    const chargeEmail = typeof email === "string" && email.includes("@") ? email : `motorizado-${driverId}@zenith.pe`;
    const charge = await CulqiService.createCharge(token, requested, chargeEmail);
    if (charge.outcomeType !== "venta_exitosa") {
      throw new HttpError(402, "Culqi no confirm\xF3 el pago. Intenta de nuevo.");
    }
    const id = newId();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1e3);
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO topup_requests
           (id, reference_code, driver_id, requested_amount, payment_method, culqi_charge_id,
            gross_amount, fee_amount, status, credited_at, expires_at)
         VALUES (?, ?, ?, ?, 'CULQI', ?, ?, ?, 'CREDITED', NOW(3), ?)`,
        [id, newReference(), driverId, net, charge.id, money2(requested), fee, expiresAt]
      );
      await WalletService.applyTopupCredit(conn, driverId, id, net);
    });
    const [rows] = await pool2.query(`${SELECT} WHERE t.id = ?`, [id]);
    return toView(rows[0]);
  }
  static async myHistory(driverId, limit = 20) {
    const [rows] = await getPool().query(
      `${SELECT} WHERE t.driver_id = ? ORDER BY t.created_at DESC LIMIT ?`,
      [driverId, limit]
    );
    return rows.map(toView);
  }
  /** Para el admin: lista de recargas, filtrable por estado. */
  static async list(status) {
    const pool2 = getPool();
    const [rows] = status ? await pool2.query(`${SELECT} WHERE t.status = ? ORDER BY t.created_at ASC`, [status]) : await pool2.query(`${SELECT} ORDER BY FIELD(t.status,'RECEIPT_SUBMITTED','CREDITED','REJECTED'), t.created_at DESC`);
    return rows.map(toView);
  }
  /** El admin confirma que vio el Yape entrar: acredita contra la deuda del motorizado. */
  static async credit(topupId, adminId) {
    await withTransaction(async (conn) => {
      const [rows2] = await conn.query("SELECT * FROM topup_requests WHERE id = ? FOR UPDATE", [topupId]);
      const t = rows2[0];
      if (!t) throw new HttpError(404, "Recarga no encontrada.");
      if (t.status !== "RECEIPT_SUBMITTED") throw new HttpError(400, "Esta recarga ya fue revisada.");
      await conn.execute(
        `UPDATE topup_requests SET status = 'CREDITED', reviewed_by = ?, reviewed_at = NOW(3), credited_at = NOW(3) WHERE id = ?`,
        [adminId, topupId]
      );
      await WalletService.applyTopupCredit(conn, String(t.driver_id), topupId, Number(t.requested_amount));
    });
    await audit(adminId, "TOPUP_CREDITED", topupId, {});
    const [rows] = await getPool().query(`${SELECT} WHERE t.id = ?`, [topupId]);
    return toView(rows[0]);
  }
  static async reject(topupId, adminId, reason) {
    const cleanReason = reason.trim().slice(0, 255);
    if (!cleanReason) throw new HttpError(400, "Escribe el motivo del rechazo.");
    const pool2 = getPool();
    const [res] = await pool2.execute(
      `UPDATE topup_requests SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(3)
       WHERE id = ? AND status = 'RECEIPT_SUBMITTED'`,
      [cleanReason, adminId, topupId]
    );
    if (res.affectedRows === 0) throw new HttpError(400, "Recarga no encontrada o ya revisada.");
    await audit(adminId, "TOPUP_REJECTED", topupId, { reason: cleanReason });
    const [rows] = await pool2.query(`${SELECT} WHERE t.id = ?`, [topupId]);
    return toView(rows[0]);
  }
};

// server/routes/topup.routes.ts
var router3 = (0, import_express3.Router)();
router3.use(requireSession);
var uid3 = (req) => req.session?.sub || "";
var handle3 = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[TOPUP] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
var VALID_STATUS = ["RECEIPT_SUBMITTED", "REJECTED", "CREDITED"];
router3.post("/", requireAppRole(["driver"]), handle3(async (req) => ({
  topup: await TopupService.createRequest(uid3(req), req.body?.amount, req.body?.operationNumber)
}), 201));
router3.get("/mine", requireAppRole(["driver"]), handle3(async (req) => ({
  topups: await TopupService.myHistory(uid3(req))
})));
router3.get("/culqi/config", requireAppRole(["driver"]), handle3(async () => ({
  enabled: CulqiService.isConfigured(),
  publicKey: process.env.CULQI_PUBLIC_KEY || null
})));
router3.post("/culqi/charge", requireAppRole(["driver"]), handle3(async (req) => ({
  topup: await TopupService.chargeWithCulqi(uid3(req), req.body?.token, req.body?.amount, req.body?.email)
}), 201));
router3.get("/", requireAppRole(["admin"]), handle3(async (req) => {
  const status = typeof req.query.status === "string" && VALID_STATUS.includes(req.query.status) ? req.query.status : void 0;
  return { topups: await TopupService.list(status) };
}));
router3.post("/:id/credit", requireAppRole(["admin"]), handle3(async (req) => ({
  topup: await TopupService.credit(req.params.id, uid3(req))
})));
router3.post("/:id/reject", requireAppRole(["admin"]), handle3(async (req) => ({
  topup: await TopupService.reject(req.params.id, uid3(req), String(req.body?.reason || ""))
})));
var topup_routes_default = router3;

// server/routes/pricing.routes.ts
var import_express4 = require("express");
var router4 = (0, import_express4.Router)();
router4.use(requireSession);
var KM_PER_DEG_LAT2 = 111.32;
var localDemandSupply = async (lat, lng) => {
  const radiusKm = await getNumberSetting("dispatch_max_km", 6);
  const freshSeconds = await getNumberSetting("driver_fresh_seconds", 120);
  const dLat = radiusKm / KM_PER_DEG_LAT2;
  const dLng = radiusKm / (KM_PER_DEG_LAT2 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  const box = [lat - dLat, lat + dLat, lng - dLng, lng + dLng];
  const [demand] = await getPool().query(
    `SELECT COUNT(*) AS n FROM rides WHERE status = 'SEARCHING_DRIVER'
     AND origin_lat BETWEEN ? AND ? AND origin_lng BETWEEN ? AND ?`,
    box
  );
  const [supply] = await getPool().query(
    `SELECT COUNT(*) AS n FROM drivers_online WHERE status = 'AVAILABLE'
     AND last_active > NOW(3) - INTERVAL ? SECOND
     AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`,
    [freshSeconds, ...box]
  );
  return { pendingOrders: Number(demand[0]?.n || 0) + 1, availableDrivers: Number(supply[0]?.n || 0) };
};
router4.post("/quote", async (req, res) => {
  const b = req.body || {};
  const nums = [b.originLat, b.originLng, b.destLat, b.destLng].map(Number);
  const [oLat, oLng, dLat, dLng] = nums;
  if (nums.some((n) => !Number.isFinite(n)) || Math.abs(oLat) > 90 || Math.abs(dLat) > 90 || Math.abs(oLng) > 180 || Math.abs(dLng) > 180) {
    return res.status(400).json({ success: false, message: "Ubicaciones inv\xE1lidas." });
  }
  if (typeof b.originAddress !== "string" || !b.originAddress.trim() || typeof b.destAddress !== "string" || !b.destAddress.trim()) {
    return res.status(400).json({ success: false, message: "Escribe la direcci\xF3n de recojo y de entrega." });
  }
  try {
    const { pendingOrders, availableDrivers } = await localDemandSupply(oLat, oLng);
    const quote = await calculateServerQuote({
      originLat: oLat,
      originLng: oLng,
      destLat: dLat,
      destLng: dLng,
      originAddress: b.originAddress.trim().slice(0, 255),
      destAddress: b.destAddress.trim().slice(0, 255),
      pendingOrders,
      availableDrivers
    });
    return res.json({ success: true, quote });
  } catch (err) {
    const msg = err.message || "";
    console.error("[PRICING] Error:", msg);
    const isRoute = /Google|Routes|ruta|Coordenadas/i.test(msg);
    return res.status(isRoute ? 502 : 500).json({
      success: false,
      message: isRoute ? "No pudimos calcular la ruta. Intenta de nuevo." : "Error del servidor. Intenta de nuevo."
    });
  }
});
router4.post("/verify", (req, res) => {
  const quote = req.body?.quote;
  if (!quote) return res.status(400).json({ success: false, message: "Falta la cotizaci\xF3n." });
  const v = verifyQuoteSignature(quote);
  return v.valid ? res.json({ success: true, valid: true }) : res.status(400).json({ success: false, valid: false, reason: v.reason });
});
var pricing_routes_default = router4;

// server/routes/auth.routes.ts
var import_express5 = require("express");
var import_express_rate_limit2 = __toESM(require("express-rate-limit"), 1);
var router5 = (0, import_express5.Router)();
var authLimiter = (0, import_express_rate_limit2.default)({
  windowMs: 15 * 60 * 1e3,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Demasiados intentos. Espera unos minutos." }
});
router5.use(authLimiter);
var device = (req) => String(req.headers["user-agent"] || "").slice(0, 255);
var handle4 = (fn) => async (req, res) => {
  try {
    const data = await fn(req);
    res.json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    console.error("[AUTH] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
router5.post("/register/start", handle4(async (req) => {
  await startRegistration(req.body?.phone);
  return { message: "Te enviamos un c\xF3digo por SMS." };
}));
router5.post("/register/verify", handle4((req) => completeRegistration({
  phone: req.body?.phone,
  code: req.body?.code,
  password: req.body?.password,
  fullName: req.body?.fullName,
  role: req.body?.role,
  deviceInfo: device(req)
})));
router5.post("/login", handle4((req) => login({
  phone: req.body?.phone,
  password: req.body?.password,
  deviceInfo: device(req)
})));
router5.post("/refresh", handle4((req) => refreshSession(req.body?.refreshToken)));
router5.post("/logout", handle4(async (req) => {
  await logout(req.body?.refreshToken);
  return {};
}));
router5.post("/password/forgot", handle4(async (req) => {
  await startPasswordReset(req.body?.phone);
  return { message: "Si el celular est\xE1 registrado, te llegar\xE1 un c\xF3digo por SMS." };
}));
router5.post("/password/reset", handle4((req) => completePasswordReset({
  phone: req.body?.phone,
  code: req.body?.code,
  newPassword: req.body?.newPassword,
  deviceInfo: device(req)
})));
router5.get("/me", requireSession, handle4(async (req) => {
  const sub = req.session?.sub;
  const user = sub ? await getUserById(sub) : null;
  if (!user) throw new AuthError(404, "Cuenta no encontrada.");
  return { user };
}));
var auth_routes_default = router5;

// server/routes/geo.routes.ts
var import_express6 = require("express");
var import_express_rate_limit3 = __toESM(require("express-rate-limit"), 1);

// server/services/geocode.service.ts
var BASE = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
var USER_AGENT = process.env.NOMINATIM_USER_AGENT || "ZenithDelivery/1.0 (shocos.nom.pe)";
var CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var CACHE_MAX = 2e3;
var MIN_GAP_MS = 1100;
var TRUJILLO_VIEWBOX = "-79.20,-7.95,-78.85,-8.25";
var cache2 = /* @__PURE__ */ new Map();
var chain = Promise.resolve();
var lastCall = 0;
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
var throttled = (fn) => {
  const run = chain.then(async () => {
    const gap = Date.now() - lastCall;
    if (gap < MIN_GAP_MS) await wait(MIN_GAP_MS - gap);
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => void 0);
  return run;
};
var cached = async (key, fn) => {
  const hit = cache2.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await throttled(fn);
  if (cache2.size >= CACHE_MAX) {
    const oldest = cache2.keys().next().value;
    if (oldest !== void 0) cache2.delete(oldest);
  }
  cache2.set(key, { at: Date.now(), value });
  return value;
};
var shortAddress = (it) => {
  const a = it.address || {};
  const street = a.road || a.pedestrian;
  const parts = [
    it.name && it.name !== street ? it.name : void 0,
    street ? `${street}${a.house_number ? ` ${a.house_number}` : ""}` : void 0,
    a.neighbourhood || a.suburb || a.quarter,
    a.city || a.town || a.village
  ].filter((p) => !!p);
  const text = parts.length >= 2 ? parts.join(", ") : it.display_name;
  return text.slice(0, 255);
};
var call = async (path5, params) => {
  const url = `${BASE}${path5}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", "accept-language": "es", ...params })}`;
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8e3) });
  } catch {
    throw new HttpError(502, "El buscador de direcciones no responde. Intenta de nuevo.");
  }
  if (!res.ok) throw new HttpError(502, "El buscador de direcciones no responde. Intenta de nuevo.");
  return res.json();
};
var toResult = (it) => ({ address: shortAddress(it), lat: Number(it.lat), lng: Number(it.lon) });
var searchAddress = async (rawQuery) => {
  const q = typeof rawQuery === "string" ? rawQuery.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (q.length < 3) throw new HttpError(400, "Escribe al menos 3 letras.");
  return cached(`s:${q.toLowerCase()}`, async () => {
    const data = await call("/search", { q, countrycodes: "pe", viewbox: TRUJILLO_VIEWBOX, limit: "6" });
    return Array.isArray(data) ? data.map(toResult).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)) : [];
  });
};
var reverseGeocode = async (rawLat, rawLng) => {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, "Ubicaci\xF3n inv\xE1lida.");
  }
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const [hit] = await cached(key, async () => {
    const data = await call("/reverse", { lat: String(lat), lon: String(lng), zoom: "18" });
    if (!data || data.error) return [{ address: `Punto en el mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng }];
    return [{ ...toResult(data), lat, lng }];
  });
  return hit;
};

// server/routes/geo.routes.ts
var router6 = (0, import_express6.Router)();
router6.use(requireSession);
router6.use((0, import_express_rate_limit3.default)({
  windowMs: 60 * 1e3,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Demasiadas b\xFAsquedas. Espera un momento." }
}));
var handle5 = (fn) => async (req, res) => {
  try {
    res.json({ success: true, ...await fn(req) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[GEO] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
router6.get("/search", handle5(async (req) => ({ results: await searchAddress(req.query.q) })));
router6.get("/reverse", handle5(async (req) => ({ place: await reverseGeocode(req.query.lat, req.query.lng) })));
var geo_routes_default = router6;

// server/routes/restaurants.routes.ts
var import_express7 = require("express");

// server/services/restaurant.service.ts
var import_crypto4 = __toESM(require("crypto"), 1);
var toNum2 = (v) => Number(v);
var toIso4 = (v) => v instanceof Date ? v.toISOString() : String(v);
var cleanText2 = (v, max) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : void 0;
var toRestaurantView = (r) => ({
  id: String(r.id),
  ownerUserId: String(r.owner_user_id),
  name: String(r.name),
  phone: r.phone ?? null,
  address: String(r.address),
  lat: toNum2(r.lat),
  lng: toNum2(r.lng),
  city: r.city ?? null,
  photoUrl: r.photo_url ?? null,
  isOpen: Boolean(r.is_open),
  isActive: Boolean(r.is_active),
  createdAt: toIso4(r.created_at)
});
var toMenuItemView = (r) => ({
  id: String(r.id),
  name: String(r.name),
  description: r.description ?? null,
  price: toNum2(r.price),
  photoUrl: r.photo_url ?? null,
  isAvailable: Boolean(r.is_available),
  sortOrder: Number(r.sort_order)
});
var RestaurantService = class {
  /** Crea el restaurante del usuario (uno por dueño en esta primera versión). */
  static async create(input) {
    const name = cleanText2(input.name, 150);
    const address = cleanText2(input.address, 255);
    if (!name) throw new HttpError(400, "Falta el nombre del restaurante.");
    if (!address) throw new HttpError(400, "Falta la direcci\xF3n del restaurante.");
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new HttpError(400, "Ubicaci\xF3n inv\xE1lida.");
    const pool2 = getPool();
    const [existing] = await pool2.query(
      "SELECT id FROM restaurants WHERE owner_user_id = ? AND is_active = 1 LIMIT 1",
      [input.ownerUserId]
    );
    if (existing[0]) throw new HttpError(409, "Ya tienes un restaurante publicado.");
    const id = import_crypto4.default.randomUUID();
    await pool2.execute(
      `INSERT INTO restaurants (id, owner_user_id, name, phone, address, lat, lng, city, photo_url, is_open, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        id,
        input.ownerUserId,
        name,
        cleanText2(input.phone, 20) ?? null,
        address,
        input.lat,
        input.lng,
        cleanText2(input.city, 80) ?? null,
        cleanText2(input.photoUrl, 255) ?? null
      ]
    );
    return this.getOwned(id, input.ownerUserId);
  }
  static async getOwned(restaurantId, ownerUserId) {
    const [rows] = await getPool().query(
      "SELECT * FROM restaurants WHERE id = ? AND owner_user_id = ?",
      [restaurantId, ownerUserId]
    );
    if (!rows[0]) throw new HttpError(404, "Restaurante no encontrado.");
    return toRestaurantView(rows[0]);
  }
  static async myRestaurant(ownerUserId) {
    const [rows] = await getPool().query(
      "SELECT * FROM restaurants WHERE owner_user_id = ? AND is_active = 1 LIMIT 1",
      [ownerUserId]
    );
    return rows[0] ? toRestaurantView(rows[0]) : null;
  }
  /** Lista pública de restaurantes abiertos (para que el cliente elija dónde pedir). */
  static async listOpen(city) {
    const pool2 = getPool();
    const [rows] = city ? await pool2.query(
      "SELECT * FROM restaurants WHERE is_active = 1 AND is_open = 1 AND city = ? ORDER BY name LIMIT 100",
      [city]
    ) : await pool2.query(
      "SELECT * FROM restaurants WHERE is_active = 1 AND is_open = 1 ORDER BY name LIMIT 100"
    );
    return rows.map(toRestaurantView);
  }
  static async getPublic(restaurantId) {
    const [rows] = await getPool().query(
      "SELECT * FROM restaurants WHERE id = ? AND is_active = 1",
      [restaurantId]
    );
    if (!rows[0]) throw new HttpError(404, "Restaurante no encontrado.");
    return toRestaurantView(rows[0]);
  }
  static async setOpen(restaurantId, ownerUserId, isOpen) {
    await this.getOwned(restaurantId, ownerUserId);
    await getPool().execute("UPDATE restaurants SET is_open = ? WHERE id = ?", [isOpen ? 1 : 0, restaurantId]);
    return this.getOwned(restaurantId, ownerUserId);
  }
  // ---- Menú ----
  static async listMenuPublic(restaurantId) {
    const [rows] = await getPool().query(
      "SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY sort_order, name",
      [restaurantId]
    );
    return rows.map(toMenuItemView);
  }
  static async listMenuOwner(restaurantId, ownerUserId) {
    await this.getOwned(restaurantId, ownerUserId);
    const [rows] = await getPool().query(
      "SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY sort_order, name",
      [restaurantId]
    );
    return rows.map(toMenuItemView);
  }
  static async addMenuItem(restaurantId, ownerUserId, input) {
    await this.getOwned(restaurantId, ownerUserId);
    const name = cleanText2(input.name, 150);
    if (!name) throw new HttpError(400, "Falta el nombre del plato.");
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Precio inv\xE1lido.");
    const id = import_crypto4.default.randomUUID();
    await getPool().execute(
      `INSERT INTO menu_items (id, restaurant_id, name, description, price, photo_url, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        restaurantId,
        name,
        cleanText2(input.description, 300) ?? null,
        price.toFixed(2),
        cleanText2(input.photoUrl, 255) ?? null,
        input.isAvailable === false ? 0 : 1,
        input.sortOrder ?? 0
      ]
    );
    const [rows] = await getPool().query("SELECT * FROM menu_items WHERE id = ?", [id]);
    return toMenuItemView(rows[0]);
  }
  static async updateMenuItem(restaurantId, ownerUserId, itemId, input) {
    await this.getOwned(restaurantId, ownerUserId);
    const [rows] = await getPool().query(
      "SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?",
      [itemId, restaurantId]
    );
    if (!rows[0]) throw new HttpError(404, "Plato no encontrado.");
    const sets = [];
    const vals = [];
    if (input.name !== void 0) {
      sets.push("name = ?");
      vals.push(cleanText2(input.name, 150) || rows[0].name);
    }
    if (input.description !== void 0) {
      sets.push("description = ?");
      vals.push(cleanText2(input.description, 300) ?? null);
    }
    if (input.price !== void 0) {
      const price = Number(input.price);
      if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Precio inv\xE1lido.");
      sets.push("price = ?");
      vals.push(price.toFixed(2));
    }
    if (input.photoUrl !== void 0) {
      sets.push("photo_url = ?");
      vals.push(cleanText2(input.photoUrl, 255) ?? null);
    }
    if (input.isAvailable !== void 0) {
      sets.push("is_available = ?");
      vals.push(input.isAvailable ? 1 : 0);
    }
    if (input.sortOrder !== void 0) {
      sets.push("sort_order = ?");
      vals.push(input.sortOrder);
    }
    if (sets.length) {
      await getPool().execute(`UPDATE menu_items SET ${sets.join(", ")} WHERE id = ?`, [...vals, itemId]);
    }
    const [updated] = await getPool().query("SELECT * FROM menu_items WHERE id = ?", [itemId]);
    return toMenuItemView(updated[0]);
  }
  /**
   * Verifica que los platos pedidos existan, estén disponibles y pertenezcan al restaurante,
   * y devuelve sus precios actuales del servidor (el cliente nunca fija el precio).
   */
  static async priceOrderItems(restaurantId, items) {
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "El pedido no tiene platos.");
    const restaurant = await this.getPublic(restaurantId);
    if (!restaurant.isOpen) throw new HttpError(409, "El restaurante est\xE1 cerrado ahora.");
    const [rows] = await getPool().query(
      "SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1",
      [restaurantId]
    );
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    let subtotal = 0;
    const priced = items.map((it) => {
      const qty = Math.trunc(Number(it.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > 50) throw new HttpError(400, "Cantidad inv\xE1lida.");
      const row = byId.get(String(it.menuItemId));
      if (!row) throw new HttpError(409, "Un plato del pedido ya no est\xE1 disponible. Actualiza el men\xFA.");
      const price = toNum2(row.price);
      subtotal += price * qty;
      return { menuItemId: String(row.id), name: String(row.name), price, quantity: qty };
    });
    return { restaurant, priced, subtotal: Math.round(subtotal * 100) / 100 };
  }
};

// server/routes/restaurants.routes.ts
var router7 = (0, import_express7.Router)();
router7.use(requireSession);
var uid4 = (req) => req.session?.sub || "";
var handle6 = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[RESTAURANTS] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
router7.get("/", handle6(async (req) => ({
  restaurants: await RestaurantService.listOpen(typeof req.query.city === "string" ? req.query.city : void 0)
})));
router7.get("/:id/menu", handle6(async (req) => ({ menu: await RestaurantService.listMenuPublic(req.params.id) })));
router7.post("/:id/orders", handle6(async (req) => {
  const restaurantId = req.params.id;
  const { restaurant, priced, subtotal } = await RestaurantService.priceOrderItems(restaurantId, req.body?.items);
  const r = await RideService.requestRide({
    quote: req.body?.quote,
    passengerId: uid4(req),
    paymentMethod: req.body?.paymentMethod,
    idempotencyKey: req.body?.idempotencyKey,
    orderType: "FOOD",
    restaurantId,
    food: {
      restaurantId,
      restaurantName: restaurant.name,
      items: priced,
      subtotal,
      notes: typeof req.body?.notes === "string" ? req.body.notes.slice(0, 300) : void 0
    }
  });
  return { ride: r.ride, otpCode: r.otpCode, idempotent: r.idempotent, subtotal };
}, 201));
router7.get("/mine", handle6(async (req) => ({ restaurant: await RestaurantService.myRestaurant(uid4(req)) })));
router7.post("/mine", handle6(async (req) => ({
  restaurant: await RestaurantService.create({
    ownerUserId: uid4(req),
    name: req.body?.name,
    address: req.body?.address,
    lat: Number(req.body?.lat),
    lng: Number(req.body?.lng),
    city: req.body?.city,
    phone: req.body?.phone,
    photoUrl: req.body?.photoUrl
  })
}), 201));
router7.patch("/:id/open", handle6(async (req) => ({
  restaurant: await RestaurantService.setOpen(req.params.id, uid4(req), Boolean(req.body?.isOpen))
})));
router7.get("/:id/menu/mine", handle6(async (req) => ({
  menu: await RestaurantService.listMenuOwner(req.params.id, uid4(req))
})));
router7.post("/:id/menu", handle6(async (req) => ({
  item: await RestaurantService.addMenuItem(req.params.id, uid4(req), {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    photoUrl: req.body?.photoUrl,
    isAvailable: req.body?.isAvailable,
    sortOrder: req.body?.sortOrder
  })
}), 201));
router7.patch("/:id/menu/:itemId", handle6(async (req) => ({
  item: await RestaurantService.updateMenuItem(req.params.id, uid4(req), req.params.itemId, {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    photoUrl: req.body?.photoUrl,
    isAvailable: req.body?.isAvailable,
    sortOrder: req.body?.sortOrder
  })
})));
var restaurants_routes_default = router7;

// server/routes/admin.routes.ts
var import_express8 = require("express");

// server/services/admin.service.ts
var toIso5 = (v) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
var toView2 = (r) => ({
  userId: String(r.user_id),
  fullName: String(r.full_name),
  phone: r.phone ?? null,
  status: r.status,
  isBlocked: Boolean(r.is_blocked),
  vehicle: {
    category: r.vehicle_category ?? null,
    plate: r.vehicle_plate ?? null,
    brand: r.vehicle_brand ?? null,
    model: r.vehicle_model ?? null,
    year: r.vehicle_year ?? null,
    color: r.vehicle_color ?? null
  },
  licenseNumber: r.license_number ?? null,
  licenseExpiry: toIso5(r.license_expiry),
  rejectionReason: r.rejection_reason ?? null,
  reviewedBy: r.reviewed_by ?? null,
  reviewedAt: toIso5(r.reviewed_at),
  createdAt: toIso5(r.created_at) || "",
  hasLicensePhoto: Boolean(r.license_photo_path),
  hasVehiclePhoto: Boolean(r.vehicle_photo_path),
  documentsSubmittedAt: toIso5(r.documents_submitted_at),
  rating: Number(r.rating ?? 5)
});
var SELECT2 = `
  SELECT p.user_id, p.status, p.rejection_reason, p.reviewed_by, p.reviewed_at, p.created_at, p.rating,
         p.vehicle_category, p.vehicle_plate, p.vehicle_brand, p.vehicle_model, p.vehicle_year, p.vehicle_color,
         p.license_number, p.license_expiry, p.license_photo_path, p.vehicle_photo_path, p.documents_submitted_at,
         u.full_name, u.phone, u.is_blocked
  FROM driver_profiles p JOIN users u ON u.id = p.user_id
`;
var audit2 = async (adminId, action, targetId, details) => {
  await getPool().execute(
    "INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)",
    [adminId, "ADMIN", action, "driver_profile", targetId, JSON.stringify(details)]
  ).catch((err) => console.error("[ADMIN] No se pudo auditar:", err.message));
};
var AdminService = class {
  static async listDrivers(status) {
    const pool2 = getPool();
    const [rows] = status ? await pool2.query(`${SELECT2} WHERE p.status = ? ORDER BY p.created_at ASC`, [status]) : await pool2.query(`${SELECT2} ORDER BY FIELD(p.status,'UNDER_REVIEW','PENDING','APPROVED','SUSPENDED','REJECTED'), p.created_at ASC`);
    return rows.map(toView2);
  }
  static async approve(driverId, adminId) {
    const pool2 = getPool();
    const [res] = await pool2.execute(
      `UPDATE driver_profiles SET status = 'APPROVED', rejection_reason = NULL, reviewed_by = ?, reviewed_at = NOW(3) WHERE user_id = ?`,
      [adminId, driverId]
    );
    if (res.affectedRows === 0) throw new HttpError(404, "Motorizado no encontrado.");
    await audit2(adminId, "DRIVER_APPROVED", driverId, {});
    const [rows] = await pool2.query(`${SELECT2} WHERE p.user_id = ?`, [driverId]);
    return toView2(rows[0]);
  }
  static async reject(driverId, adminId, reason) {
    const cleanReason = reason.trim().slice(0, 255);
    if (!cleanReason) throw new HttpError(400, "Escribe el motivo del rechazo.");
    const pool2 = getPool();
    const [res] = await pool2.execute(
      `UPDATE driver_profiles SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(3) WHERE user_id = ?`,
      [cleanReason, adminId, driverId]
    );
    if (res.affectedRows === 0) throw new HttpError(404, "Motorizado no encontrado.");
    await audit2(adminId, "DRIVER_REJECTED", driverId, { reason: cleanReason });
    const [rows] = await pool2.query(`${SELECT2} WHERE p.user_id = ?`, [driverId]);
    return toView2(rows[0]);
  }
};

// server/routes/admin.routes.ts
var router8 = (0, import_express8.Router)();
router8.use(requireSession);
router8.use(requireAppRole(["admin"]));
var uid5 = (req) => req.session?.sub || "";
var handle7 = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[ADMIN] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
var VALID_STATUS2 = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];
router8.get("/drivers", handle7(async (req) => {
  const status = typeof req.query.status === "string" && VALID_STATUS2.includes(req.query.status) ? req.query.status : void 0;
  return { drivers: await AdminService.listDrivers(status) };
}));
router8.post("/drivers/:id/approve", handle7(async (req) => ({
  driver: await AdminService.approve(req.params.id, uid5(req))
})));
router8.post("/drivers/:id/reject", handle7(async (req) => ({
  driver: await AdminService.reject(req.params.id, uid5(req), String(req.body?.reason || ""))
})));
var admin_routes_default = router8;

// server/routes/driver-documents.routes.ts
var import_express9 = require("express");
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_crypto5 = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);

// server/services/driver-documents.service.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var UPLOAD_ROOT = import_path2.default.join(process.cwd(), "uploads", "driver-docs");
var toIso6 = (v) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
var str = (v, max) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
var SELECT3 = `
  SELECT user_id, status, vehicle_category, vehicle_plate, vehicle_brand, vehicle_model, vehicle_year, vehicle_color,
         license_number, license_expiry, yape_plin_phone, license_photo_path, vehicle_photo_path,
         documents_submitted_at, rejection_reason
  FROM driver_profiles WHERE user_id = ?
`;
var toView3 = (r) => ({
  userId: String(r.user_id),
  status: String(r.status),
  vehicle: {
    category: r.vehicle_category ?? null,
    plate: r.vehicle_plate ?? null,
    brand: r.vehicle_brand ?? null,
    model: r.vehicle_model ?? null,
    year: r.vehicle_year ?? null,
    color: r.vehicle_color ?? null
  },
  licenseNumber: r.license_number ?? null,
  licenseExpiry: toIso6(r.license_expiry),
  yapePlinPhone: r.yape_plin_phone ?? null,
  hasLicensePhoto: Boolean(r.license_photo_path),
  hasVehiclePhoto: Boolean(r.vehicle_photo_path),
  documentsSubmittedAt: toIso6(r.documents_submitted_at),
  rejectionReason: r.rejection_reason ?? null
});
var DriverDocumentsService = class _DriverDocumentsService {
  static async getProfile(driverId) {
    const [rows] = await getPool().query(SELECT3, [driverId]);
    if (!rows[0]) throw new HttpError(404, "Perfil de motorizado no encontrado.");
    return toView3(rows[0]);
  }
  static async submit(driverId, input) {
    const plate = str(input.vehiclePlate, 15);
    const licenseNumber = str(input.licenseNumber, 30);
    if (!plate) throw new HttpError(400, "Escribe la placa de tu veh\xEDculo.");
    if (!licenseNumber) throw new HttpError(400, "Escribe el n\xFAmero de tu licencia/brevete.");
    const pool2 = getPool();
    const [cur] = await pool2.query("SELECT status, license_photo_path, vehicle_photo_path FROM driver_profiles WHERE user_id = ? FOR UPDATE", [driverId]);
    const current = cur[0];
    if (!current) throw new HttpError(404, "Perfil de motorizado no encontrado.");
    const licensePhotoPath = input.licensePhotoPath || current.license_photo_path || null;
    const vehiclePhotoPath = input.vehiclePhotoPath || current.vehicle_photo_path || null;
    if (!licensePhotoPath) throw new HttpError(400, "Sube la foto de tu licencia/brevete.");
    if (!vehiclePhotoPath) throw new HttpError(400, "Sube una foto de tu veh\xEDculo con la placa visible.");
    const year = Number(input.vehicleYear);
    const expiry = typeof input.licenseExpiry === "string" && input.licenseExpiry.trim() ? input.licenseExpiry.trim() : null;
    const nextStatus = current.status === "PENDING" || current.status === "REJECTED" ? "UNDER_REVIEW" : current.status;
    await pool2.execute(
      `UPDATE driver_profiles SET
         vehicle_category = ?, vehicle_plate = ?, vehicle_brand = ?, vehicle_model = ?,
         vehicle_year = ?, vehicle_color = ?, license_number = ?, license_expiry = ?, yape_plin_phone = ?,
         license_photo_path = ?, vehicle_photo_path = ?, documents_submitted_at = NOW(3),
         status = ?, rejection_reason = CASE WHEN ? = 'UNDER_REVIEW' THEN NULL ELSE rejection_reason END
       WHERE user_id = ?`,
      [
        str(input.vehicleCategory, 40),
        plate,
        str(input.vehicleBrand, 60),
        str(input.vehicleModel, 60),
        Number.isFinite(year) ? year : null,
        str(input.vehicleColor, 30),
        licenseNumber,
        expiry,
        str(input.yapePlinPhone, 20),
        licensePhotoPath,
        vehiclePhotoPath,
        nextStatus,
        nextStatus,
        driverId
      ]
    );
    return _DriverDocumentsService.getProfile(driverId);
  }
  /** Ruta en disco del documento, si existe y el id es válido (evita path traversal). */
  static async resolveDocumentPath(driverId, kind) {
    if (!/^[a-zA-Z0-9_-]+$/.test(driverId)) throw new HttpError(400, "Id inv\xE1lido.");
    const [rows] = await getPool().query(
      `SELECT license_photo_path, vehicle_photo_path FROM driver_profiles WHERE user_id = ?`,
      [driverId]
    );
    const r = rows[0];
    if (!r) throw new HttpError(404, "No encontrado.");
    const rel = kind === "license" ? r.license_photo_path : r.vehicle_photo_path;
    if (!rel) throw new HttpError(404, "Todav\xEDa no sube esta foto.");
    const full = import_path2.default.join(UPLOAD_ROOT, String(rel));
    if (!full.startsWith(UPLOAD_ROOT) || !import_fs2.default.existsSync(full)) throw new HttpError(404, "Archivo no encontrado.");
    return full;
  }
};

// server/routes/driver-documents.routes.ts
var router9 = (0, import_express9.Router)();
var uid6 = (req) => req.session?.sub || "";
var handle8 = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[DRIVER_DOCS] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
var ALLOWED_MIME = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
var EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
var storage = import_multer.default.diskStorage({
  destination: (req, _file, cb) => {
    const driverId = uid6(req);
    const dir = import_path3.default.join(UPLOAD_ROOT, driverId);
    import_fs3.default.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || "bin";
    const kind = file.fieldname === "vehiclePhoto" ? "vehicle" : "license";
    cb(null, `${kind}_${import_crypto5.default.randomBytes(4).toString("hex")}.${ext}`);
  }
});
var upload = (0, import_multer.default)({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error("Solo se aceptan fotos JPG, PNG o WEBP."));
    cb(null, true);
  }
});
router9.use(requireSession);
router9.get("/profile", requireAppRole(["driver"]), handle8(async (req) => ({
  profile: await DriverDocumentsService.getProfile(uid6(req))
})));
router9.post(
  "/profile",
  requireAppRole(["driver"]),
  (req, res, next) => upload.fields([{ name: "licensePhoto", maxCount: 1 }, { name: "vehiclePhoto", maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || "No se pudo subir la foto." });
    next();
  }),
  handle8(async (req) => {
    const files = req.files || {};
    const driverId = uid6(req);
    const licenseFile = files.licensePhoto?.[0];
    const vehicleFile = files.vehiclePhoto?.[0];
    return {
      profile: await DriverDocumentsService.submit(driverId, {
        ...req.body,
        licensePhotoPath: licenseFile ? `${driverId}/${licenseFile.filename}` : null,
        vehiclePhotoPath: vehicleFile ? `${driverId}/${vehicleFile.filename}` : null
      })
    };
  })
);
router9.get("/documents/:driverId/:kind", async (req, res) => {
  try {
    const session = req.session;
    const { driverId, kind } = req.params;
    if (!session) return res.status(401).json({ success: false, message: "Debes iniciar sesi\xF3n." });
    const isOwner = session.sub === driverId;
    const isAdmin2 = Boolean(session.adm);
    if (!isOwner && !isAdmin2) return res.status(403).json({ success: false, message: "No tienes permiso para ver este documento." });
    if (kind !== "license" && kind !== "vehicle") return res.status(400).json({ success: false, message: "Documento inv\xE1lido." });
    const full = await DriverDocumentsService.resolveDocumentPath(driverId, kind);
    res.sendFile(full);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[DRIVER_DOCS] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
});
var driver_documents_routes_default = router9;

// server/routes/push.routes.ts
var import_express10 = require("express");

// server/services/push.service.ts
var webpush = __toESM(require("web-push"), 1);
var configured = false;
var ensureConfigured = () => {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@shocos.nom.pe";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
};
var newId2 = () => `push_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
var PushService = {
  /** Clave pública que el navegador necesita para suscribirse. */
  publicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
  },
  /** Guarda (o reemplaza) la suscripción de este celular/navegador para el usuario. */
  async subscribe(userId, sub) {
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      throw new HttpError(400, "Suscripci\xF3n push incompleta.");
    }
    await getPool().query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [newId2(), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
  },
  /** El celular ya no quiere más avisos (o el usuario cerró sesión). */
  async unsubscribe(endpoint) {
    if (!endpoint) return;
    await getPool().query("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
  },
  /** Manda el aviso a todos los celulares suscritos de ese usuario (mejor esfuerzo). */
  async sendToUser(userId, payload) {
    if (!ensureConfigured()) return;
    const [rows] = await getPool().query(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
      [userId]
    );
    const json = JSON.stringify(payload);
    await Promise.all(rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          json
        );
      } catch (err) {
        const statusCode = err.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await getPool().query("DELETE FROM push_subscriptions WHERE id = ?", [r.id]).catch(() => void 0);
        } else {
          console.error("[PUSH] No se pudo enviar a", r.endpoint, err.message);
        }
      }
    }));
  }
};
var describe = (event2) => {
  switch (event2.type) {
    case "offer":
      return { title: "Nuevo pedido disponible", body: "Tienes 15 segundos para aceptarlo." };
    case "ride": {
      const labels = {
        DRIVER_ASSIGNED: "Un motorizado acept\xF3 tu pedido.",
        DRIVER_ARRIVING: "El motorizado est\xE1 en camino.",
        WAITING_FOR_OTP: "El motorizado lleg\xF3. Dale tu c\xF3digo.",
        COMPLETED: "Tu pedido fue entregado.",
        CANCELLED: "Tu pedido fue cancelado.",
        EXPIRED: "No encontramos un motorizado disponible."
      };
      const body = labels[event2.status];
      return body ? { title: "Z\xC9NITH", body } : null;
    }
    default:
      return null;
  }
};
onRealtime((userId, event2) => {
  const msg = describe(event2);
  if (!msg) return;
  PushService.sendToUser(userId, msg).catch((err) => console.error("[PUSH] Error al avisar:", err.message));
});

// server/routes/push.routes.ts
var router10 = (0, import_express10.Router)();
var uid7 = (req) => req.session?.sub || "";
var handle9 = (fn, okStatus = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...data && typeof data === "object" ? data : {} });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("[PUSH] Error inesperado:", err);
    res.status(500).json({ success: false, message: "Error del servidor. Intenta de nuevo." });
  }
};
router10.get("/vapid-public-key", (_req, res) => {
  res.status(200).json({ success: true, publicKey: PushService.publicKey() });
});
router10.use(requireSession);
router10.post("/subscribe", handle9(async (req) => {
  await PushService.subscribe(uid7(req), req.body?.subscription);
}));
router10.post("/unsubscribe", handle9(async (req) => {
  await PushService.unsubscribe(req.body?.endpoint);
}));
var push_routes_default = router10;

// server/routes/index.ts
var router11 = (0, import_express11.Router)();
router11.use("/auth", auth_routes_default);
router11.use("/rides", ride_routes_default);
router11.use("/wallet", wallet_routes_default);
router11.use("/topups", topup_routes_default);
router11.use("/pricing", pricing_routes_default);
router11.use("/geo", geo_routes_default);
router11.use("/restaurants", restaurants_routes_default);
router11.use("/admin", admin_routes_default);
router11.use("/driver", driver_documents_routes_default);
router11.use("/push", push_routes_default);
var routes_default = router11;

// server/app.ts
var createApp = () => {
  const app = (0, import_express12.default)();
  app.set("trust proxy", 1);
  app.use(import_express12.default.json({ limit: "1mb" }));
  app.use(import_express12.default.urlencoded({ extended: true, limit: "1mb" }));
  configureSecurity(app);
  const api = (0, import_express12.Router)();
  api.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Z\xE9nith Enterprise Backend Running" });
  });
  api.use("/api", routes_default);
  const basePath = (process.env.BASE_PATH || "").replace(/\/+$/, "");
  if (basePath) app.use(basePath, api);
  app.use(api);
  return app;
};

// server/realtime/hub.ts
var import_ws = require("ws");
var AUTH_TIMEOUT_MS = 1e4;
var PING_MS = 25e3;
var RealtimeHub = class {
  constructor(paths) {
    this.paths = paths;
    this.wss = new import_ws.WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
    this.byUser = /* @__PURE__ */ new Map();
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.unsubscribe = onRealtime((userId, event2) => this.send(userId, event2));
    this.pingTimer = setInterval(() => this.heartbeat(), PING_MS);
    this.pingTimer.unref();
  }
  /** Conecta el hub al servidor HTTP: solo atiende la ruta del WebSocket. */
  attach(server) {
    server.on("upgrade", (req, socket, head) => {
      const url = (req.url || "").split("?")[0].replace(/\/+$/, "");
      if (!this.paths.includes(url)) {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit("connection", ws, req));
    });
    return this;
  }
  /** Cuántas conexiones activas tiene un usuario (para pruebas y diagnóstico). */
  connectionsOf(userId) {
    return this.byUser.get(userId)?.size || 0;
  }
  close() {
    clearInterval(this.pingTimer);
    this.unsubscribe();
    for (const set of this.byUser.values()) for (const ws of set) ws.terminate();
    this.byUser.clear();
    this.wss.close();
  }
  onConnection(ws) {
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    const authTimer = setTimeout(() => ws.close(4001, "auth timeout"), AUTH_TIMEOUT_MS);
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === "auth" && !ws.userId) {
        try {
          const claims = verifyAccessToken(String(msg.token || ""));
          clearTimeout(authTimer);
          ws.userId = claims.sub;
          if (!this.byUser.has(claims.sub)) this.byUser.set(claims.sub, /* @__PURE__ */ new Set());
          this.byUser.get(claims.sub)?.add(ws);
          ws.send(JSON.stringify({ type: "ready", userId: claims.sub }));
        } catch {
          ws.close(4001, "auth failed");
        }
      }
    });
    ws.on("close", () => {
      clearTimeout(authTimer);
      if (ws.userId) {
        const set = this.byUser.get(ws.userId);
        set?.delete(ws);
        if (set && set.size === 0) this.byUser.delete(ws.userId);
      }
    });
    ws.on("error", () => ws.terminate());
  }
  send(userId, event2) {
    const set = this.byUser.get(userId);
    if (!set) return;
    const data = JSON.stringify(event2);
    for (const ws of set) if (ws.readyState === import_ws.WebSocket.OPEN) ws.send(data);
  }
  heartbeat() {
    for (const ws of this.wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }
};
var realtimePaths = () => {
  const base = (process.env.BASE_PATH || "").replace(/\/+$/, "");
  return base ? [`${base}/ws`, "/ws"] : ["/ws"];
};

// server.ts
async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path4.default.join(process.cwd(), "dist");
    app.use(import_express13.default.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.includes("/api/")) {
        return res.status(404).json({ success: false, message: "Ruta no encontrada." });
      }
      res.sendFile(import_path4.default.join(distPath, "index.html"));
    });
  }
  if (process.env.DB_NAME) DispatchService.startSweeper();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Z\xE9nith Backend Server running on http://localhost:${PORT}`);
  });
  new RealtimeHub(realtimePaths()).attach(server);
}
startServer();
//# sourceMappingURL=server.cjs.map
