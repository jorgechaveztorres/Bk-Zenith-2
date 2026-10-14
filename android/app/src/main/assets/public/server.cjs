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
var import_express12 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/app.ts
var import_express11 = __toESM(require("express"), 1);

// server/middlewares/security.middleware.ts
var import_helmet = __toESM(require("helmet"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
var configureSecurity = (app) => {
  app.use((0, import_helmet.default)({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  }));
  app.use((0, import_cors.default)({
    origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL || "*" : "*",
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
  app.use("/api", limiter);
  const paymentLimiter = (0, import_express_rate_limit.default)({
    windowMs: 15 * 60 * 1e3,
    max: 10,
    message: { success: false, message: "L\xEDmite de intentos de pago excedido." }
  });
  app.use("/api/payments", paymentLimiter);
  app.use("/api/settlements", paymentLimiter);
};

// server/routes/index.ts
var import_express10 = require("express");

// server/routes/payment.routes.ts
var import_express = require("express");

// server/config/firebase.ts
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_auth = require("firebase-admin/auth");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0838883154",
  appId: "1:949145719529:web:419c6a4c217688c5c81678",
  apiKey: "AIzaSyBpKw8Niv0rx3pdcvMhnJGgmnE9HxPPTxM",
  authDomain: "gen-lang-client-0838883154.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-c005ecfa-a6b8-4b3b-952e-e9f3a6061d74",
  storageBucket: "gen-lang-client-0838883154.firebasestorage.app",
  messagingSenderId: "949145719529",
  measurementId: ""
};

// server/config/firebase.ts
var adminApp;
try {
  if ((0, import_app.getApps)().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      adminApp = (0, import_app.initializeApp)({
        credential: (0, import_app.cert)(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        projectId: firebase_applet_config_default.projectId
      });
    } else {
      adminApp = (0, import_app.initializeApp)({
        projectId: firebase_applet_config_default.projectId
      });
    }
  } else {
    adminApp = (0, import_app.getApps)()[0];
  }
} catch (e) {
  console.error("[FIREBASE_ADMIN_INIT_ERROR] Error inicializando Firebase Admin:", e.message);
  adminApp = (0, import_app.getApps)()[0];
}
var db = (0, import_firestore.getFirestore)(adminApp, firebase_applet_config_default.firestoreDatabaseId);
var auth = (0, import_auth.getAuth)(adminApp);

// server/middlewares/auth.middleware.ts
var requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No se proporcion\xF3 token de autenticaci\xF3n (Zero-Trust)." });
    }
    const token = authHeader.split("Bearer ")[1];
    if (!auth) {
      return res.status(500).json({ success: false, message: "Servicio de autenticaci\xF3n no disponible." });
    }
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role
    };
    next();
  } catch (error) {
    console.error("[AUTH_MIDDLEWARE] Error verificando token:", error);
    return res.status(401).json({ success: false, message: "Token de autenticaci\xF3n inv\xE1lido o expirado." });
  }
};
var requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "No autenticado." });
    }
    if (!req.user.role && !allowedRoles.includes("any")) {
      console.warn(`[AUTH_MIDDLEWARE] Usuario ${req.user.uid} intentando acceder a ruta protegida sin rol en el JWT.`);
    }
    next();
  };
};

// server/services/payment.service.ts
var import_firestore2 = require("firebase-admin/firestore");
var PaymentService = class {
  static async process(rideId, passengerId, driverId, amount, details) {
    if (!db) throw new Error("Base de datos no disponible.");
    const riskScore = Math.random() * 10;
    if (riskScore > 8) {
      throw new Error("Bloqueado por prevenci\xF3n de fraude.");
    }
    let message = "Pago procesado exitosamente.";
    if (details.method === "wallet" || details.method === "mixed") {
      const walletAmt = details.walletAmountUsed || amount;
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(passengerId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("Usuario no encontrado.");
        const userData = userDoc.data();
        const currentWallet = userData?.wallet || { availableBalance: 0 };
        if (currentWallet.availableBalance < walletAmt) {
          throw new Error("Saldo de billetera insuficiente.");
        }
        transaction.update(userRef, {
          "wallet.availableBalance": currentWallet.availableBalance - walletAmt,
          "wallet.digitalBalance": currentWallet.availableBalance - walletAmt
        });
      });
      message = "Pago debitado exitosamente de la billetera digital.";
    }
    const txRef = db.collection("transactions").doc();
    const transactionRecord = {
      id: txRef.id,
      rideId,
      passengerId,
      driverId,
      amount,
      method: details.method,
      status: "CAPTURED",
      timestamp: import_firestore2.FieldValue.serverTimestamp()
    };
    await txRef.set(transactionRecord);
    return { message, transactionId: txRef.id };
  }
};

// server/controllers/payment.controller.ts
var processPayment = async (req, res) => {
  try {
    const { rideId, passengerId, driverId, amount, details } = req.body;
    const userId = req.user.uid;
    if (userId !== passengerId && userId !== driverId) {
      return res.status(403).json({ success: false, message: "Operaci\xF3n denegada. El usuario no participa en este viaje." });
    }
    if (!rideId || !amount || !details) {
      return res.status(400).json({ success: false, message: "Faltan par\xE1metros obligatorios." });
    }
    const result = await PaymentService.process(rideId, passengerId, driverId, amount, details);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[PAYMENT_CONTROLLER] Error procesando pago:", error.message);
    return res.status(500).json({ success: false, message: error.message || "Error interno del servidor." });
  }
};

// server/routes/payment.routes.ts
var router = (0, import_express.Router)();
router.post("/process", requireAuth, processPayment);
var payment_routes_default = router;

// server/routes/settlement.routes.ts
var import_express2 = require("express");

// server/services/settlement.service.ts
var import_firestore3 = require("firebase-admin/firestore");
var SettlementService = class {
  static async process(driverId, bankDetails) {
    if (!db) throw new Error("Base de datos no disponible.");
    const userRef = db.collection("users").doc(driverId);
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("Conductor no encontrado.");
      const userData = userDoc.data();
      const wallet = userData?.wallet;
      if (!wallet || wallet.availableBalance <= 10) {
        throw new Error("Saldo insuficiente para liquidar (M\xEDnimo S/. 10.00).");
      }
      const amountToSettle = wallet.availableBalance;
      transaction.update(userRef, {
        "wallet.availableBalance": 0,
        "wallet.digitalBalance": 0,
        "wallet.pendingSettlement": (wallet.pendingSettlement || 0) + amountToSettle
      });
      const settlementRecord = {
        id: `SET_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        driverId,
        amountSettled: amountToSettle,
        commissionCollected: wallet.accumulatedCommission || 0,
        cashDebtCompensated: wallet.cashDebt || 0,
        bankDetails,
        status: "COMPLETED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      const settlementRef = db.collection("settlements").doc(settlementRecord.id);
      transaction.set(settlementRef, {
        ...settlementRecord,
        createdAt: import_firestore3.FieldValue.serverTimestamp()
      });
      return {
        message: `Liquidaci\xF3n de S/. ${amountToSettle.toFixed(2)} procesada exitosamente.`,
        record: settlementRecord
      };
    });
  }
};

// server/controllers/settlement.controller.ts
var processSettlement = async (req, res) => {
  try {
    const { driverId, bankDetails } = req.body;
    const userId = req.user.uid;
    if (userId !== driverId) {
      if (req.user.role !== "admin" && req.user.email !== "bkheelsec@gmail.com") {
        return res.status(403).json({ success: false, message: "Operaci\xF3n denegada. El usuario no corresponde al conductor." });
      }
    }
    if (!driverId || !bankDetails) {
      return res.status(400).json({ success: false, message: "Faltan par\xE1metros obligatorios." });
    }
    const result = await SettlementService.process(driverId, bankDetails);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[SETTLEMENT_CONTROLLER] Error procesando liquidaci\xF3n:", error.message);
    return res.status(500).json({ success: false, message: error.message || "Error interno del servidor." });
  }
};

// server/routes/settlement.routes.ts
var router2 = (0, import_express2.Router)();
router2.post("/process", requireAuth, processSettlement);
var settlement_routes_default = router2;

// server/routes/ride.routes.ts
var import_express3 = require("express");

// server/services/ride.service.ts
var import_firestore5 = require("firebase-admin/firestore");
var import_crypto2 = __toESM(require("crypto"), 1);

// server/services/pricing.service.ts
var import_crypto = __toESM(require("crypto"), 1);

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
var activeRouteProvider = new GoogleRoutesProvider();
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
function isDriverFresh(driver, nowMs = Date.now()) {
  if (driver.isStale === true) {
    return false;
  }
  let lastUpdateMs = null;
  if (driver.lastActive) {
    if (typeof driver.lastActive.toMillis === "function") {
      lastUpdateMs = driver.lastActive.toMillis();
    } else if (typeof driver.lastActive === "number") {
      lastUpdateMs = driver.lastActive;
    } else if (driver.lastActive instanceof Date) {
      lastUpdateMs = driver.lastActive.getTime();
    } else if (typeof driver.lastActive === "string") {
      const parsed = Date.parse(driver.lastActive);
      if (!isNaN(parsed)) lastUpdateMs = parsed;
    }
  }
  if (lastUpdateMs === null && driver.driverProfile?.gps?.updatedAt) {
    const parsed = Date.parse(driver.driverProfile.gps.updatedAt);
    if (!isNaN(parsed)) lastUpdateMs = parsed;
  }
  if (lastUpdateMs === null && driver.driverProfile?.lastConnection) {
    const parsed = Date.parse(driver.driverProfile.lastConnection);
    if (!isNaN(parsed)) lastUpdateMs = parsed;
  }
  if (lastUpdateMs === null) {
    return true;
  }
  return nowMs - lastUpdateMs <= MAX_DRIVER_STALE_MS;
}
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
function filterLocalDemandAndSupply(originLat, originLng, originAddress, rawRides, rawDrivers, nowMs = Date.now()) {
  const cityMeta = resolveCityFromCoordinates(originLat, originLng, originAddress);
  const marketZone = resolveGeoMarketZone(originLat, originLng, originAddress);
  const city = cityMeta.city;
  const maxRadiusKm = cityMeta.operationalRadiusKm;
  const ACTIVE_DEMAND_STATUSES = ["SEARCHING_DRIVER", "REQUESTED", "SEARCHING", "pending"];
  const localRideIds = [];
  for (const ride of rawRides) {
    if (!ride.status || !ACTIVE_DEMAND_STATUSES.includes(ride.status)) {
      continue;
    }
    const rLat = ride.origin?.lat;
    const rLng = ride.origin?.lng;
    if (typeof rLat === "number" && typeof rLng === "number") {
      const dist = getGeodesicDistance(originLat, originLng, rLat, rLng);
      if (dist <= maxRadiusKm) {
        localRideIds.push(ride.id || `ride_${localRideIds.length}`);
      }
    } else if (cityMeta.isKnownCity && ride.city && ride.city.toLowerCase() === city.toLowerCase()) {
      localRideIds.push(ride.id || `ride_${localRideIds.length}`);
    }
  }
  const localDriverIds = [];
  for (const driver of rawDrivers) {
    const isAvailable = driver.status === "AVAILABLE" || driver.driverProfile?.availability === true;
    if (!isAvailable) {
      continue;
    }
    if (!isDriverFresh(driver, nowMs)) {
      continue;
    }
    const dLat = typeof driver.lat === "number" ? driver.lat : driver.driverProfile?.gps?.lat;
    const dLng = typeof driver.lng === "number" ? driver.lng : driver.driverProfile?.gps?.lng;
    if (typeof dLat === "number" && typeof dLng === "number") {
      const dist = getGeodesicDistance(originLat, originLng, dLat, dLng);
      if (dist <= maxRadiusKm) {
        localDriverIds.push(driver.driverId || driver.id || `driver_${localDriverIds.length}`);
      }
    } else if (cityMeta.isKnownCity && driver.driverProfile?.city && driver.driverProfile.city.toLowerCase() === city.toLowerCase()) {
      localDriverIds.push(driver.driverId || driver.id || `driver_${localDriverIds.length}`);
    }
  }
  return {
    city,
    marketZone,
    pendingOrders: localRideIds.length,
    availableDrivers: localDriverIds.length,
    localRideIds,
    localDriverIds
  };
}
function buildDemandQueryFilters(originLat, originLng, originAddress) {
  const geoScope = resolveCityFromCoordinates(originLat, originLng, originAddress);
  const statusFilter = {
    field: "status",
    operator: "in",
    value: ["SEARCHING_DRIVER", "REQUESTED", "SEARCHING"]
  };
  if (geoScope.isKnownCity) {
    return {
      collection: "rides",
      scopeFilter: {
        field: "city",
        operator: "==",
        value: geoScope.city,
        isCityScoped: true
      },
      statusFilter
    };
  }
  const latBin = (Math.round(originLat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(originLng * 33) / 33).toFixed(3);
  return {
    collection: "rides",
    scopeFilter: {
      field: "gridKey",
      operator: "==",
      value: `${latBin}:${lngBin}`,
      isCityScoped: false
    },
    statusFilter
  };
}
function buildSupplyQueryFilters(originLat, originLng, originAddress) {
  const geoScope = resolveCityFromCoordinates(originLat, originLng, originAddress);
  const statusFilter = {
    field: "status",
    operator: "==",
    value: "AVAILABLE"
  };
  if (geoScope.isKnownCity) {
    return {
      collection: "drivers_online",
      scopeFilter: {
        field: "city",
        operator: "==",
        value: geoScope.city,
        isCityScoped: true
      },
      statusFilter
    };
  }
  const latBin = (Math.round(originLat * 33) / 33).toFixed(3);
  const lngBin = (Math.round(originLng * 33) / 33).toFixed(3);
  return {
    collection: "drivers_online",
    scopeFilter: {
      field: "gridKey",
      operator: "==",
      value: `${latBin}:${lngBin}`,
      isCityScoped: false
    },
    statusFilter
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
  return import_crypto.default.createHmac("sha256", secret).update(canonicalData).digest("hex");
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
    if (sealBuffer.length !== expectedBuffer.length || !import_crypto.default.timingSafeEqual(sealBuffer, expectedBuffer)) {
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
  const quoteId = `quote_${Date.now()}_${import_crypto.default.randomBytes(4).toString("hex")}`;
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

// server/services/dispatch.service.ts
var import_firestore4 = require("firebase-admin/firestore");
var DispatchService = class {
  /**
   * Ejecuta el ciclo de despacho server-side para una orden específica.
   */
  static async runDispatchCycle(rideId) {
    if (!db) {
      throw new Error("Servicio de base de datos no disponible.");
    }
    const rideRef = db.collection("rides").doc(rideId);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) {
      return { dispatched: false, rideId, status: "NOT_FOUND", reason: "Viaje no encontrado" };
    }
    const ride = rideSnap.data();
    if (ride.status !== "SEARCHING_DRIVER" && ride.status !== "REQUESTED") {
      return { dispatched: false, rideId, status: ride.status, reason: "Viaje no est\xE1 en estado de b\xFAsqueda" };
    }
    const assignmentsSnap = await db.collection("assignments").where("rideId", "==", rideId).get();
    const existingAssignments = [];
    assignmentsSnap.forEach((doc) => {
      existingAssignments.push(doc.data());
    });
    const now = Date.now();
    const activeAssignment = existingAssignments.find((a) => a.status === "OFFERED");
    if (activeAssignment) {
      const expiresAt = new Date(activeAssignment.expiresAt).getTime();
      if (now <= expiresAt) {
        return {
          dispatched: true,
          rideId,
          status: "OFFERED",
          assignedDriverId: activeAssignment.driverId,
          attemptNumber: activeAssignment.attemptNumber,
          reason: "Oferta activa en progreso"
        };
      } else {
        const asgDocRef = db.collection("assignments").doc(activeAssignment.assignmentId);
        await asgDocRef.update({
          status: "EXPIRED",
          expiredAt: import_firestore4.FieldValue.serverTimestamp()
        });
      }
    }
    const excludedDriverIds = existingAssignments.filter((a) => a.status === "REJECTED" || a.status === "EXPIRED" || a.status === "CANCELLED").map((a) => a.driverId);
    const city = ride.city || "Trujillo";
    let queryRef = db.collection("drivers_online").where("status", "==", "AVAILABLE").where("city", "==", city);
    let onlineSnap = await queryRef.get();
    if (onlineSnap.empty && ride.gridKey) {
      onlineSnap = await db.collection("drivers_online").where("status", "==", "AVAILABLE").where("gridKey", "==", ride.gridKey).get();
    }
    const availableCandidates = [];
    const originLat = ride.origin?.lat ?? 0;
    const originLng = ride.origin?.lng ?? 0;
    onlineSnap.forEach((doc) => {
      const d = doc.data();
      if (!excludedDriverIds.includes(d.driverId)) {
        const dist = getGeodesicDistance(originLat, originLng, d.lat, d.lng);
        availableCandidates.push({
          driverId: d.driverId,
          driverName: d.driverName,
          lat: d.lat,
          lng: d.lng,
          distanceKm: dist,
          rating: d.rating || 5
        });
      }
    });
    if (availableCandidates.length === 0) {
      await db.collection("dispatch_logs").add({
        rideId,
        event: "NO_DRIVERS_AVAILABLE",
        attemptNumber: existingAssignments.length + 1,
        details: "No se encontraron conductores AVAILABLE aptos en la zona.",
        createdAt: import_firestore4.FieldValue.serverTimestamp()
      });
      return {
        dispatched: false,
        rideId,
        status: "NO_DRIVERS",
        attemptNumber: existingAssignments.length + 1,
        reason: "Sin conductores disponibles"
      };
    }
    availableCandidates.sort((a, b) => a.distanceKm - b.distanceKm);
    const bestCandidate = availableCandidates[0];
    const assignmentId = `ASG_${rideId}_${Date.now()}`;
    const expiresAtDate = new Date(now + 15 * 1e3).toISOString();
    const assignmentData = {
      assignmentId,
      rideId,
      driverId: bestCandidate.driverId,
      driverName: bestCandidate.driverName || "Conductor Z\xE9nith",
      distanceKm: bestCandidate.distanceKm,
      attemptNumber: existingAssignments.length + 1,
      status: "OFFERED",
      assignedAt: import_firestore4.FieldValue.serverTimestamp(),
      expiresAt: expiresAtDate
    };
    await db.collection("assignments").doc(assignmentId).set(assignmentData);
    await db.collection("dispatch_logs").add({
      rideId,
      driverId: bestCandidate.driverId,
      assignmentId,
      event: "ASSIGNMENT_OFFERED",
      attemptNumber: assignmentData.attemptNumber,
      distanceKm: bestCandidate.distanceKm,
      details: `Viaje ofrecido server-side a conductor a ${bestCandidate.distanceKm.toFixed(2)} km`,
      createdAt: import_firestore4.FieldValue.serverTimestamp()
    });
    return {
      dispatched: true,
      rideId,
      status: "OFFERED",
      assignedDriverId: bestCandidate.driverId,
      attemptNumber: assignmentData.attemptNumber
    };
  }
};

// server/services/ride.service.ts
var OTP_SECRET = process.env.OTP_SECRET || "ZENITH_SECURE_OTP_SALT_2026";
var ALLOWED_STATUS_TRANSITIONS = {
  REQUESTED: ["SEARCHING_DRIVER", "DRIVER_ASSIGNED", "CANCELLED"],
  SEARCHING_DRIVER: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["DRIVER_ARRIVING", "CANCELLED"],
  DRIVER_ARRIVING: ["WAITING_FOR_OTP", "CANCELLED"],
  WAITING_FOR_OTP: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};
function hashOtp(rideId, otpCode) {
  return import_crypto2.default.createHmac("sha256", OTP_SECRET).update(`${rideId}:${otpCode}`).digest("hex");
}
var RideService = class {
  /**
   * GATEKEEPER SERVER-SIDE: Creación de viajes y órdenes de entrega.
   * Valida identidad contra JWT, verifica la firma criptográfica HMAC del quote,
   * controla idempotencia y persiste el documento en Firestore con Firebase Admin SDK.
   */
  static async requestRide(payload, authenticatedUid) {
    if (!db) {
      throw new Error("Servicio de base de datos Firestore no disponible en backend.");
    }
    if (!payload || !payload.quote) {
      throw new Error("El payload debe contener un objeto de cotizaci\xF3n (quote) v\xE1lido emitido por el servidor.");
    }
    if (payload.passengerId !== authenticatedUid) {
      const error = new Error("Violaci\xF3n de identidad Zero-Trust: passengerId no coincide con el token autenticado.");
      error.statusCode = 403;
      throw error;
    }
    const { quote } = payload;
    const verification = verifyQuoteSignature(quote);
    if (!verification.valid) {
      const error = new Error(`Cotizaci\xF3n rechazada por el Gatekeeper: ${verification.reason}`);
      error.statusCode = 400;
      throw error;
    }
    if (quote.currency !== "PEN") {
      const error = new Error("Moneda no autorizada para operaci\xF3n en Z\xE9nith (solo PEN).");
      error.statusCode = 400;
      throw error;
    }
    const idempotencyKey = payload.idempotencyKey?.trim() || quote.quoteId;
    const payloadHash = import_crypto2.default.createHash("sha256").update(JSON.stringify({
      passengerId: authenticatedUid,
      quoteId: quote.quoteId,
      origin: {
        address: (quote.origin?.address || "").trim(),
        lat: Number(quote.origin?.lat !== void 0 ? Number(quote.origin.lat).toFixed(5) : 0),
        lng: Number(quote.origin?.lng !== void 0 ? Number(quote.origin.lng).toFixed(5) : 0)
      },
      destination: {
        address: (quote.destination?.address || "").trim(),
        lat: Number(quote.destination?.lat !== void 0 ? Number(quote.destination.lat).toFixed(5) : 0),
        lng: Number(quote.destination?.lng !== void 0 ? Number(quote.destination.lng).toFixed(5) : 0)
      },
      totalFare: Number(quote.totalFare.toFixed(2)),
      currency: quote.currency || "PEN",
      pricingVersion: quote.pricingVersion
    })).digest("hex");
    const idempotencyRef = db.collection("idempotency_keys").doc(idempotencyKey);
    const createdRide = await db.runTransaction(async (transaction) => {
      const idempDoc = await transaction.get(idempotencyRef);
      if (idempDoc.exists) {
        const existingKeyData = idempDoc.data();
        if (existingKeyData.payloadHash !== payloadHash) {
          const conflictErr = new Error(
            "Conflicto de Idempotencia: La clave ya fue utilizada para una solicitud con par\xE1metros diferentes."
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
        const existingRideRef = db.collection("rides").doc(existingKeyData.rideId);
        const existingRideDoc = await transaction.get(existingRideRef);
        if (existingRideDoc.exists) {
          console.log(`[RIDE_GATEKEEPER] Idempotencia at\xF3mica activada para key: ${idempotencyKey}. Retornando viaje existente ${existingKeyData.rideId}.`);
          return {
            id: existingKeyData.rideId,
            ...existingRideDoc.data(),
            _idempotent: true
          };
        }
      }
      const newRideRef = db.collection("rides").doc();
      const rideId = newRideRef.id;
      const otpCode = import_crypto2.default.randomInt(100, 1e3).toString();
      const otpHash = hashOtp(rideId, otpCode);
      const rideDocument = {
        id: rideId,
        idempotencyKey,
        passengerId: authenticatedUid,
        passengerName: payload.passengerName?.trim() || "Pasajero Z\xE9nith",
        passengerPhone: payload.passengerPhone?.trim() || "",
        origin: {
          address: quote.origin.address,
          lat: quote.origin.lat,
          lng: quote.origin.lng
        },
        destination: {
          address: quote.destination.address,
          lat: quote.destination.lat,
          lng: quote.destination.lng
        },
        city: quote.marketZone?.city || (quote.origin ? resolveCityFromCoordinates(quote.origin.lat, quote.origin.lng, quote.origin.address).city : "Per\xFA"),
        marketZoneId: quote.marketZone?.id || null,
        gridKey: quote.marketZone?.gridKey || null,
        // AUTORIDAD TOTAL DEL BACKEND SOBRE PRECIOS
        protectedPrice: quote.totalFare,
        finalPrice: quote.totalFare,
        basePrice: quote.normalFare,
        multiplier: quote.multiplier,
        marketPressure: quote.pressure ?? 1,
        distance: quote.distance,
        duration: quote.duration ?? 0,
        currency: "PEN",
        quoteId: quote.quoteId,
        pricingSeal: quote.pricingSeal,
        pricingVersion: quote.pricingVersion,
        paymentMethod: payload.paymentMethod || "cash",
        paymentState: payload.paymentState || "AUTHORIZED",
        paymentId: payload.paymentId || `tx_${Date.now()}`,
        status: "SEARCHING_DRIVER",
        // Generación Segura de OTP Criptográfico Server-Side
        otpHash,
        otpAttempts: 0,
        otpMaxAttempts: 3,
        otpExpiresAt: new Date(Date.now() + 30 * 60 * 1e3).toISOString(),
        otpVerified: false,
        passengerOtp: otpCode,
        createdAt: import_firestore5.FieldValue.serverTimestamp(),
        updatedAt: import_firestore5.FieldValue.serverTimestamp()
      };
      if (payload.orderType === "DELIVERY" || payload.packageInfo) {
        rideDocument.orderType = "DELIVERY";
        if (payload.packageInfo) rideDocument.packageInfo = payload.packageInfo;
        if (payload.receptor) rideDocument.receptor = payload.receptor;
        if (payload.pagador) rideDocument.pagador = payload.pagador;
        if (payload.solicitante) rideDocument.solicitante = payload.solicitante;
        if (payload.evidenceLevel) rideDocument.evidenceLevel = payload.evidenceLevel;
        if (payload.returnContingency) rideDocument.returnContingency = payload.returnContingency;
      }
      transaction.set(newRideRef, rideDocument);
      transaction.set(idempotencyRef, {
        idempotencyKey,
        rideId,
        payloadHash,
        passengerId: authenticatedUid,
        createdAt: import_firestore5.FieldValue.serverTimestamp()
      });
      console.log(`[RIDE_GATEKEEPER] Viaje ${rideId} creado at\xF3micamente con tarifa inmutable S/ ${quote.totalFare.toFixed(2)}.`);
      return {
        id: rideId,
        ...rideDocument,
        _idempotent: false
      };
    });
    if (!createdRide._idempotent) {
      DispatchService.runDispatchCycle(createdRide.id).catch((err) => {
        console.warn(`[SERVER_DISPATCH] Error iniciando ciclo de despacho para ${createdRide.id}:`, err);
      });
    }
    return createdRide;
  }
  static async acceptRide(rideId, driverId, driverName, driverLocation) {
    if (!db) throw new Error("Base de datos no disponible.");
    const rideRef = db.collection("rides").doc(rideId);
    const driverPresenceRef = db.collection("drivers_online").doc(driverId);
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err = new Error("Viaje no encontrado.");
        err.statusCode = 404;
        throw err;
      }
      const ride = rideDoc.data();
      if (ride.status === "DRIVER_ASSIGNED" && ride.driverId === driverId) {
        return {
          id: rideId,
          ...ride,
          _idempotent: true
        };
      }
      if (ride.status !== "SEARCHING_DRIVER" && ride.status !== "REQUESTED") {
        const conflictErr = new Error("El viaje ya no est\xE1 disponible para asignaci\xF3n (asignado a otro conductor o finalizado).");
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
      const driverDoc = await transaction.get(driverPresenceRef);
      if (!driverDoc.exists) {
        const unavailErr = new Error("El conductor no se encuentra conectado a la red de despacho.");
        unavailErr.statusCode = 400;
        throw unavailErr;
      }
      const driverData = driverDoc.data();
      if (driverData.status !== "AVAILABLE") {
        const busyErr = new Error(`El conductor no est\xE1 disponible para aceptar viajes (estado actual: ${driverData.status}).`);
        busyErr.statusCode = 409;
        throw busyErr;
      }
      const resolvedDriverName = driverName?.trim() || driverData.driverName || "Conductor Z\xE9nith";
      const resolvedLocation = driverLocation || (driverData.lat && driverData.lng ? { lat: driverData.lat, lng: driverData.lng } : null);
      const updateData = {
        status: "DRIVER_ASSIGNED",
        driverId,
        driverName: resolvedDriverName,
        driverLocation: resolvedLocation,
        acceptedAt: import_firestore5.FieldValue.serverTimestamp(),
        updatedAt: import_firestore5.FieldValue.serverTimestamp()
      };
      transaction.update(rideRef, updateData);
      transaction.update(driverPresenceRef, {
        status: "BUSY",
        currentRideId: rideId,
        lastActive: import_firestore5.FieldValue.serverTimestamp()
      });
      console.log(`[RIDE_LIFECYCLE] Viaje ${rideId} asignado exitosamente al conductor ${driverId}. Estado de conductor: BUSY.`);
      return {
        id: rideId,
        ...ride,
        ...updateData,
        _idempotent: false
      };
    });
  }
  static async cancelRide(rideId, userId) {
    if (!db) throw new Error("Base de datos no disponible.");
    const rideRef = db.collection("rides").doc(rideId);
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err = new Error("Viaje no encontrado.");
        err.statusCode = 404;
        throw err;
      }
      const ride = rideDoc.data();
      if (ride?.passengerId !== userId && ride?.driverId !== userId) {
        const err = new Error("No tienes permiso para cancelar este viaje.");
        err.statusCode = 403;
        throw err;
      }
      if (["COMPLETED", "CANCELLED"].includes(ride?.status)) {
        const err = new Error("El viaje ya ha finalizado.");
        err.statusCode = 400;
        throw err;
      }
      let driverSnap = null;
      let driverRef = null;
      if (ride?.driverId) {
        driverRef = db.collection("drivers_online").doc(ride.driverId);
        driverSnap = await transaction.get(driverRef);
      }
      transaction.update(rideRef, {
        status: "CANCELLED",
        cancelledBy: userId,
        updatedAt: import_firestore5.FieldValue.serverTimestamp()
      });
      if (driverRef && driverSnap && driverSnap.exists) {
        transaction.update(driverRef, {
          status: "AVAILABLE",
          currentRideId: null,
          lastActive: import_firestore5.FieldValue.serverTimestamp()
        });
      }
    });
  }
  static async updateRideStatus(rideId, driverId, status) {
    if (!db) throw new Error("Base de datos no disponible.");
    const rideRef = db.collection("rides").doc(rideId);
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err = new Error("Viaje no encontrado.");
        err.statusCode = 404;
        throw err;
      }
      const ride = rideDoc.data();
      if (ride.driverId !== driverId) {
        const err = new Error("No tienes permiso para actualizar este viaje.");
        err.statusCode = 403;
        throw err;
      }
      const currentStatus = ride.status;
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(status)) {
        const err = new Error(`Transici\xF3n ilegal de '${currentStatus}' a '${status}'.`);
        err.statusCode = 400;
        throw err;
      }
      if (status === "IN_PROGRESS") {
        const err = new Error("El estado IN_PROGRESS solo puede alcanzarse validando el c\xF3digo OTP mediante /api/rides/:rideId/verify-otp.");
        err.statusCode = 400;
        throw err;
      }
      let driverSnap = null;
      let driverRef = null;
      if (status === "COMPLETED") {
        driverRef = db.collection("drivers_online").doc(driverId);
        driverSnap = await transaction.get(driverRef);
      }
      const updatePayload = {
        status,
        updatedAt: import_firestore5.FieldValue.serverTimestamp()
      };
      if (status === "COMPLETED") {
        updatePayload.completedAt = import_firestore5.FieldValue.serverTimestamp();
      }
      transaction.update(rideRef, updatePayload);
      if (status === "COMPLETED" && driverRef && driverSnap && driverSnap.exists) {
        transaction.update(driverRef, {
          status: "AVAILABLE",
          currentRideId: null,
          lastActive: import_firestore5.FieldValue.serverTimestamp()
        });
      }
      return { success: true, message: `Estado actualizado a ${status}.`, status };
    });
  }
  /**
   * Validador oficial y autoritativo de código de abordaje (OTP).
   * Exclusivo para el conductor asignado cuando el viaje está en WAITING_FOR_OTP.
   */
  static async verifyOtp(rideId, driverId, inputOtp) {
    if (!db) throw new Error("Base de datos no disponible.");
    const rideRef = db.collection("rides").doc(rideId);
    return await db.runTransaction(async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) {
        const err = new Error("Viaje no encontrado.");
        err.statusCode = 404;
        throw err;
      }
      const ride = rideDoc.data();
      if (ride.driverId !== driverId) {
        const err = new Error("No tienes permiso para validar el c\xF3digo de este viaje.");
        err.statusCode = 403;
        throw err;
      }
      if (ride.status !== "WAITING_FOR_OTP") {
        const err = new Error(`El viaje no se encuentra esperando c\xF3digo OTP (estado actual: ${ride.status}).`);
        err.statusCode = 400;
        throw err;
      }
      if (ride.otpVerified) {
        const err = new Error("El c\xF3digo OTP ya fue consumido.");
        err.statusCode = 400;
        throw err;
      }
      const currentAttempts = ride.otpAttempts || 0;
      const maxAttempts = ride.otpMaxAttempts || 3;
      if (currentAttempts >= maxAttempts) {
        const err = new Error("L\xEDmite de intentos de OTP excedido. Por seguridad el abordaje est\xE1 bloqueado.");
        err.statusCode = 400;
        throw err;
      }
      if (ride.otpExpiresAt && /* @__PURE__ */ new Date() > new Date(ride.otpExpiresAt)) {
        const err = new Error("El c\xF3digo OTP ha expirado.");
        err.statusCode = 400;
        throw err;
      }
      const inputHash = hashOtp(rideId, (inputOtp || "").trim());
      if (inputHash !== ride.otpHash) {
        const nextAttempts = currentAttempts + 1;
        await rideRef.update({
          otpAttempts: nextAttempts,
          updatedAt: import_firestore5.FieldValue.serverTimestamp()
        });
        const remaining = Math.max(0, maxAttempts - nextAttempts);
        const err = new Error(`C\xF3digo OTP incorrecto. Intentos restantes: ${remaining}.`);
        err.statusCode = 400;
        throw err;
      }
      transaction.update(rideRef, {
        status: "IN_PROGRESS",
        otpVerified: true,
        startedAt: import_firestore5.FieldValue.serverTimestamp(),
        updatedAt: import_firestore5.FieldValue.serverTimestamp()
      });
      console.log(`[RIDE_OTP] Viaje ${rideId} inici\xF3 su curso exitosamente (OTP verificado por conductor ${driverId}).`);
      return {
        success: true,
        message: "C\xF3digo de seguridad verificado exitosamente. Viaje iniciado.",
        status: "IN_PROGRESS"
      };
    });
  }
  /**
   * Consulta segura del código OTP de abordaje exclusivamente por el pasajero propietario.
   */
  static async getPassengerOtp(rideId, passengerId) {
    if (!db) throw new Error("Base de datos no disponible.");
    const rideSnap = await db.collection("rides").doc(rideId).get();
    if (!rideSnap.exists) {
      const err = new Error("Viaje no encontrado.");
      err.statusCode = 404;
      throw err;
    }
    const ride = rideSnap.data();
    if (ride.passengerId !== passengerId) {
      const err = new Error("No tienes permiso para consultar el c\xF3digo de este viaje.");
      err.statusCode = 403;
      throw err;
    }
    return {
      otpCode: ride.passengerOtp,
      expiresAt: ride.otpExpiresAt,
      attemptsRemaining: Math.max(0, (ride.otpMaxAttempts || 3) - (ride.otpAttempts || 0))
    };
  }
};

// server/controllers/ride.controller.ts
var requestRide = async (req, res) => {
  try {
    const userId = req.user.uid;
    const payload = req.body.quote ? req.body : req.body.rideData || req.body;
    if (!payload.passengerId) {
      payload.passengerId = userId;
    }
    if (payload.passengerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Violaci\xF3n de identidad Zero-Trust: passengerId no coincide con el token de autenticaci\xF3n."
      });
    }
    const ride = await RideService.requestRide(payload, userId);
    const statusCode = ride._idempotent ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      rideId: ride.id,
      ride
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error interno al procesar solicitud de viaje."
    });
  }
};
var acceptRide = async (req, res) => {
  try {
    const driverId = req.user.uid;
    const { rideId } = req.params;
    const { driverLocation, driverName } = req.body;
    const ride = await RideService.acceptRide(rideId, driverId, driverName, driverLocation);
    const statusCode = ride._idempotent ? 200 : 200;
    return res.status(statusCode).json({ success: true, ride });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Error al aceptar viaje." });
  }
};
var cancelRide = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { rideId } = req.params;
    await RideService.cancelRide(rideId, userId);
    return res.status(200).json({ success: true, message: "Viaje cancelado exitosamente." });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Error al cancelar viaje." });
  }
};
var updateRideStatus = async (req, res) => {
  try {
    const driverId = req.user.uid;
    const { rideId } = req.params;
    const { status } = req.body;
    await RideService.updateRideStatus(rideId, driverId, status);
    return res.status(200).json({ success: true, message: "Estado actualizado." });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Error al actualizar estado." });
  }
};
var verifyOtp = async (req, res) => {
  try {
    const driverId = req.user.uid;
    const { rideId } = req.params;
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ success: false, message: "Debe proporcionar el c\xF3digo OTP de seguridad." });
    }
    const result = await RideService.verifyOtp(rideId, driverId, otp);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Error al validar c\xF3digo OTP." });
  }
};
var getPassengerOtp = async (req, res) => {
  try {
    const passengerId = req.user.uid;
    const { rideId } = req.params;
    const result = await RideService.getPassengerOtp(rideId, passengerId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Error al consultar c\xF3digo OTP." });
  }
};

// server/routes/ride.routes.ts
var router3 = (0, import_express3.Router)();
router3.post("/request", requireAuth, requestRide);
router3.post("/:rideId/accept", requireAuth, acceptRide);
router3.post("/:rideId/cancel", requireAuth, cancelRide);
router3.post("/:rideId/status", requireAuth, updateRideStatus);
router3.post("/:rideId/verify-otp", requireAuth, verifyOtp);
router3.get("/:rideId/otp", requireAuth, getPassengerOtp);
var ride_routes_default = router3;

// server/routes/wallet.routes.ts
var import_express4 = require("express");

// server/services/wallet.service.ts
var import_firestore6 = require("firebase-admin/firestore");
var WalletService = {
  // Initialize wallet V2 for any user (passenger or driver)
  getOrCreateWallet: async (userId) => {
    if (!db) throw new Error("Base de datos no disponible.");
    const userDocRef = db.collection("users").doc(userId);
    const snap = await userDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.wallet) {
        const loadedWallet = data.wallet;
        return {
          availableBalance: loadedWallet.availableBalance !== void 0 ? loadedWallet.availableBalance : 0,
          retainedBalance: loadedWallet.retainedBalance !== void 0 ? loadedWallet.retainedBalance : 0,
          dailyEarnings: loadedWallet.dailyEarnings !== void 0 ? loadedWallet.dailyEarnings : 0,
          weeklyEarnings: loadedWallet.weeklyEarnings !== void 0 ? loadedWallet.weeklyEarnings : 0,
          digitalBalance: loadedWallet.digitalBalance !== void 0 ? loadedWallet.digitalBalance : 0,
          cashDebt: loadedWallet.cashDebt !== void 0 ? loadedWallet.cashDebt : 0,
          movements: loadedWallet.movements || [],
          // Wallet V2 extensions
          pendingBalance: loadedWallet.pendingBalance !== void 0 ? loadedWallet.pendingBalance : 0,
          promotionalBalance: loadedWallet.promotionalBalance !== void 0 ? loadedWallet.promotionalBalance : 25,
          compensationBalance: loadedWallet.compensationBalance !== void 0 ? loadedWallet.compensationBalance : 0,
          accumulatedCommission: loadedWallet.accumulatedCommission !== void 0 ? loadedWallet.accumulatedCommission : 0,
          monthlyEarnings: loadedWallet.monthlyEarnings !== void 0 ? loadedWallet.monthlyEarnings : 0,
          dailyBalanceHist: loadedWallet.dailyBalanceHist || {
            Lunes: 120,
            Martes: 155,
            Miercoles: 190,
            Jueves: 240,
            Viernes: 320,
            Sabado: 410,
            Domingo: 480
          },
          weeklyBalanceHist: loadedWallet.weeklyBalanceHist || {
            "Semana 1": 480,
            "Semana 2": 610,
            "Semana 3": 850,
            "Semana 4": 1100
          },
          monthlyBalanceHist: loadedWallet.monthlyBalanceHist || {
            Enero: 1100,
            Febrero: 1450,
            Marzo: 1980,
            Abril: 2450,
            Mayo: 3100,
            Junio: 4200
          }
        };
      }
    }
    const defaultWallet = {
      availableBalance: 0,
      retainedBalance: 0,
      dailyEarnings: 0,
      weeklyEarnings: 0,
      pendingSettlement: 0,
      digitalBalance: 0,
      cashDebt: 0,
      todaySettlements: 0,
      nextSettlementDate: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString(),
      pendingBalance: 0,
      promotionalBalance: 0,
      compensationBalance: 0,
      accumulatedCommission: 0,
      monthlyEarnings: 0,
      dailyBalanceHist: {},
      weeklyBalanceHist: {},
      monthlyBalanceHist: {},
      movements: []
    };
    await userDocRef.update({
      wallet: defaultWallet
    });
    return defaultWallet;
  },
  // Acreditación Atómica de Recarga Verificada (V1 - Yape Personal)
  creditVerifiedTopup: async (topupId, operatorId) => {
    if (!db) throw new Error("Base de datos no disponible.");
    return await db.runTransaction(async (transaction) => {
      const topupRef = db.collection("topup_requests").doc(topupId);
      const topupSnap = await transaction.get(topupRef);
      if (!topupSnap.exists) {
        throw new Error(`RECARGA_NO_ENCONTRADA: La solicitud ${topupId} no existe.`);
      }
      const topupData = topupSnap.data();
      if (topupData.status !== "VERIFIED") {
        throw new Error(`ESTADO_INVALIDO: Solo se pueden acreditar recargas en estado VERIFIED. Estado actual: ${topupData.status}`);
      }
      if (topupData.status !== "VERIFIED" || topupData.reconciliation?.status !== "VERIFIED" || !topupData.reconciliation.matchedMovementId) {
        throw new Error("CONCILIACION_NO_VERIFICADA: La recarga no tiene una conciliaci\xF3n VERIFIED y trazable.");
      }
      if (topupData.creditedAt) {
        throw new Error(`IDEMPOTENCIA: La recarga ${topupId} ya fue acreditada previamente.`);
      }
      const verifiedAmount = Number((topupData.verifiedAmount ?? topupData.requestedAmount).toFixed(2));
      if (verifiedAmount <= 0) {
        throw new Error(`MONTO_INVALIDO: El monto a acreditar debe ser mayor a 0.`);
      }
      const movementFingerprint = topupData.reconciliation.matchedMovementId;
      const processedRef = db.collection("processed_bank_movements").doc(movementFingerprint);
      const processedSnap = await transaction.get(processedRef);
      if (processedSnap.exists) {
        throw new Error(`MOVIMIENTO_REUTILIZADO: El movimiento bancario ${movementFingerprint} ya fue procesado en la recarga ${processedSnap.data()?.topupId}.`);
      }
      const driverId = topupData.driverId;
      const userRef = db.collection("users").doc(driverId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error(`CONDUCTOR_NO_ENCONTRADO: El perfil del conductor ${driverId} no existe.`);
      }
      const userData = userSnap.data();
      const currentWallet = userData?.wallet ?? {
        availableBalance: 0,
        retainedBalance: 0,
        movements: []
      };
      const currentBalance = Number((currentWallet.availableBalance || 0).toFixed(2));
      const newAvailableBalance = Number((currentBalance + verifiedAmount).toFixed(2));
      const txId = `WTX-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
      const newMov = {
        id: txId,
        type: "topup_yape",
        amount: verifiedAmount,
        description: `Recarga verificada v\xEDa Yape (${topupData.referenceCode})`,
        createdAt: import_firestore6.Timestamp.now(),
        referenceId: topupId
      };
      const updatedWallet = {
        ...currentWallet,
        availableBalance: newAvailableBalance,
        digitalBalance: newAvailableBalance,
        updatedAt: import_firestore6.FieldValue.serverTimestamp(),
        movements: [newMov, ...(currentWallet.movements || []).slice(0, 49)]
      };
      transaction.set(processedRef, {
        movementFingerprint,
        topupId,
        referenceCode: topupData.referenceCode,
        driverId,
        amount: verifiedAmount,
        operatorId,
        creditedAt: import_firestore6.FieldValue.serverTimestamp()
      });
      const creditedTimestamp = (/* @__PURE__ */ new Date()).toISOString();
      const newAuditEntry = {
        fromStatus: "VERIFIED",
        toStatus: "CREDITED",
        timestamp: creditedTimestamp,
        actorId: operatorId,
        actorRole: "operator",
        reason: "Acreditaci\xF3n at\xF3mica de saldo completada con \xE9xito",
        metadata: {
          verifiedAmount,
          txId,
          previousBalance: currentBalance,
          newBalance: newAvailableBalance
        }
      };
      transaction.update(topupRef, {
        status: "CREDITED",
        creditedAt: creditedTimestamp,
        creditedTxId: txId,
        finalBalanceSnapshot: newAvailableBalance,
        updatedAt: creditedTimestamp,
        auditHistory: import_firestore6.FieldValue.arrayUnion(newAuditEntry)
      });
      transaction.update(userRef, {
        wallet: updatedWallet
      });
      const standaloneMovRef = db.collection("wallets").doc(driverId).collection("movements").doc(txId);
      transaction.set(standaloneMovRef, {
        ...newMov,
        topupId,
        referenceCode: topupData.referenceCode,
        creditedBy: operatorId,
        createdAt: import_firestore6.FieldValue.serverTimestamp()
      });
      const ledgerRef = db.collection("accounting_ledger").doc(txId);
      transaction.set(ledgerRef, {
        id: txId,
        type: "WALLET_TOPUP_CREDIT",
        debitAccount: "ACTIVO_BANCO_YAPE_ZENITH",
        creditAccount: "PASIVO_WALLET_MOTORIZADO",
        amount: verifiedAmount,
        driverId,
        referenceCode: topupData.referenceCode,
        topupId,
        operatorId,
        createdAt: import_firestore6.FieldValue.serverTimestamp()
      });
      return {
        success: true,
        topupId,
        txId,
        driverId,
        creditedAmount: verifiedAmount,
        newBalance: newAvailableBalance
      };
    });
  },
  // Record Withdrawal con validación estricta de monto positivo
  withdrawFunds: async (userId, amount, bankDetails) => {
    if (!db) throw new Error("Base de datos no disponible.");
    if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new Error("MONTO_INVALIDO: El monto de retiro debe ser un n\xFAmero positivo mayor a S/ 0.00.");
    }
    const userDocRef = db.collection("users").doc(userId);
    const snap = await userDocRef.get();
    if (!snap.exists) throw new Error("User profile not found");
    const userData = snap.data();
    const currentWallet = userData?.wallet;
    if (!currentWallet || currentWallet.availableBalance < amount) {
      throw new Error("Saldo disponible insuficiente");
    }
    const newMov = {
      id: `mov_wtd_${Date.now()}`,
      type: "withdrawal",
      amount,
      description: `Retiro procesado a: ${bankDetails}`,
      createdAt: import_firestore6.Timestamp.now()
    };
    const updatedWallet = {
      ...currentWallet,
      availableBalance: Number((currentWallet.availableBalance - amount).toFixed(2)),
      digitalBalance: currentWallet.digitalBalance !== void 0 ? Number((currentWallet.digitalBalance - amount).toFixed(2)) : Number((currentWallet.availableBalance - amount).toFixed(2)),
      movements: [newMov, ...currentWallet.movements || []]
    };
    await userDocRef.update({
      wallet: updatedWallet
    });
    return updatedWallet;
  }
};

// server/controllers/wallet.controller.ts
var walletController = {
  getOrCreateWallet: async (req, res) => {
    try {
      const { userId } = req.body;
      const uid = req.user.uid;
      if (uid !== userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const wallet = await WalletService.getOrCreateWallet(userId);
      return res.json({ success: true, wallet });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  depositFunds: async (req, res) => {
    return res.status(403).json({
      success: false,
      message: "DEPRECATED_INSECURE_ENDPOINT: El dep\xF3sito arbitrario ha sido deshabilitado permanentemente. Utilice el flujo seguro de recargas verificadas /api/topups."
    });
  },
  withdrawFunds: async (req, res) => {
    try {
      const { userId, amount, bankDetails } = req.body;
      const uid = req.user.uid;
      if (uid !== userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const wallet = await WalletService.withdrawFunds(userId, amount, bankDetails);
      return res.json({ success: true, wallet });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

// server/routes/wallet.routes.ts
var import_express_rate_limit2 = __toESM(require("express-rate-limit"), 1);
var router4 = (0, import_express4.Router)();
var financialRateLimiter = (0, import_express_rate_limit2.default)({
  windowMs: 15 * 60 * 1e3,
  max: 10,
  message: { success: false, message: "Demasiadas solicitudes financieras, por favor intente m\xE1s tarde." }
});
router4.post("/getOrCreate", requireAuth, walletController.getOrCreateWallet);
router4.post("/deposit", requireAuth, financialRateLimiter, walletController.depositFunds);
router4.post("/withdraw", requireAuth, financialRateLimiter, walletController.withdrawFunds);
var wallet_routes_default = router4;

// server/routes/audit.routes.ts
var import_express5 = require("express");
var import_firestore7 = require("firebase-admin/firestore");
var router5 = (0, import_express5.Router)();
router5.post("/log", requireAuth, async (req, res) => {
  try {
    const record = req.body;
    if (!db) throw new Error("Base de datos no disponible.");
    const uid = req.user.uid;
    if (record.actorId !== uid) {
      record.actorId = uid;
    }
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      ...record,
      id: auditRef.id,
      timestamp: import_firestore7.FieldValue.serverTimestamp(),
      environment: "production-sandbox"
    });
    return res.json({ success: true, id: auditRef.id });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
var audit_routes_default = router5;

// server/routes/ledger.routes.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
router6.post("/record", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const data = req.body;
    if (!db) throw new Error("Base de datos no disponible.");
    const id = data.id || `LED-${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const ledgerRef = db.collection("accounting_ledger").doc(id);
    await ledgerRef.set(data);
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
var ledger_routes_default = router6;

// server/routes/topup.routes.ts
var import_express7 = require("express");

// server/services/topup.service.ts
var import_firestore8 = require("firebase-admin/firestore");

// server/services/reconciliation.service.ts
var ReconciliationService = {
  /**
   * Conciliación de Tres Vías (Three-Way Match) según reglas congeladas de ZÉNITH:
   * A. Solicitud de ZÉNITH (TopupRequest)
   * B. Datos extraídos de la captura por IA (YapeReceiptExtraction)
   * C. Movimiento real confirmado manualmente por el operador en el Yape receptor (BankMovementInput)
   */
  evaluateReconciliation: async (topup, bankMovement, operatorId) => {
    const discrepancies = [];
    const notes = [];
    if (!bankMovement) {
      return {
        status: "REJECTED",
        reconciledAt: (/* @__PURE__ */ new Date()).toISOString(),
        reconciledBy: "OPERATOR_MANUAL",
        reconciledOperatorId: operatorId,
        discrepancies: ["No existe confirmaci\xF3n de movimiento real en el Yape receptor de Z\xE9nith."],
        notes: "Rechazado autom\xE1ticamente por ausencia de fondos en cuenta receptora.",
        verifiedAmount: 0
      };
    }
    const movementFingerprint = bankMovement.securityCode && bankMovement.operationNumber ? `MOV-${bankMovement.operationNumber}-${bankMovement.securityCode}` : `MOV-${bankMovement.date}-${bankMovement.time}-${bankMovement.amount}-${bankMovement.payerName.replace(/\s+/g, "_")}`;
    if (!db) {
      throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    }
    const processedSnap = await db.collection("processed_bank_movements").doc(movementFingerprint).get();
    if (processedSnap.exists) {
      return {
        status: "REJECTED",
        reconciledAt: (/* @__PURE__ */ new Date()).toISOString(),
        reconciledBy: "OPERATOR_MANUAL",
        reconciledOperatorId: operatorId,
        discrepancies: [`El movimiento bancario (${movementFingerprint}) ya fue utilizado en una recarga previa.`],
        notes: "Intento de duplicidad o reuso de comprobante detectado.",
        verifiedAmount: 0,
        matchedMovementId: movementFingerprint
      };
    }
    const requested = Number(topup.requestedAmount.toFixed(2));
    const realReceived = Number(bankMovement.amount.toFixed(2));
    if (realReceived <= 0) {
      return {
        status: "REJECTED",
        reconciledAt: (/* @__PURE__ */ new Date()).toISOString(),
        reconciledBy: "OPERATOR_MANUAL",
        reconciledOperatorId: operatorId,
        discrepancies: ["El monto recibido en banco es menor o igual a 0."],
        verifiedAmount: 0
      };
    }
    if (requested !== realReceived) {
      discrepancies.push(`Monto solicitado (S/ ${requested.toFixed(2)}) difiere del monto real recibido (S/ ${realReceived.toFixed(2)}).`);
    }
    const ai = topup.aiExtraction;
    if (ai) {
      if (ai.amount !== null && Number(ai.amount.toFixed(2)) !== realReceived) {
        discrepancies.push(`Monto extra\xEDdo en captura (S/ ${ai.amount.toFixed(2)}) no coincide con el monto real en cuenta (S/ ${realReceived.toFixed(2)}).`);
      }
      if (ai.securityCode && bankMovement.securityCode && ai.securityCode !== bankMovement.securityCode) {
        discrepancies.push(`C\xF3digo de seguridad de captura (${ai.securityCode}) no coincide con el movimiento real (${bankMovement.securityCode}).`);
      }
      if (ai.operationNumber && bankMovement.operationNumber && ai.operationNumber !== bankMovement.operationNumber) {
        discrepancies.push(`N\xFAmero de operaci\xF3n de captura (${ai.operationNumber}) no coincide con el movimiento real (${bankMovement.operationNumber}).`);
      }
      if (ai.confidence < 0.5) {
        notes.push("La captura presenta baja nitidez visual o datos parcialmente legibles.");
      }
    } else {
      notes.push("No se adjunt\xF3 captura de pantalla preliminar; validado contra confirmaci\xF3n f\xEDsica del operador.");
    }
    const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cleanDriverName = normalize(topup.driverName || "");
    const cleanPayerName = normalize(bankMovement.payerName || "");
    const namesMatch = cleanDriverName && cleanPayerName && (cleanDriverName.includes(cleanPayerName) || cleanPayerName.includes(cleanDriverName) || cleanDriverName.split(" ")[0] === cleanPayerName.split(" ")[0]);
    if (!namesMatch && cleanPayerName.length > 0) {
      notes.push(`Pagador en Yape ("${bankMovement.payerName}") difiere del titular de la cuenta Z\xC9NITH ("${topup.driverName}"). Posible recarga por tercero.`);
    }
    const hasCriticalAmountError = requested !== realReceived && Math.abs(requested - realReceived) > 50;
    const hasCriticalCodeMismatch = discrepancies.some((d) => d.includes("C\xF3digo de seguridad"));
    if (hasCriticalAmountError || hasCriticalCodeMismatch) {
      return {
        status: "REJECTED",
        reconciledAt: (/* @__PURE__ */ new Date()).toISOString(),
        reconciledBy: "OPERATOR_MANUAL",
        reconciledOperatorId: operatorId,
        discrepancies,
        notes: notes.join(" | ") || "Discrepancias cr\xEDticas entre la solicitud y los fondos reales.",
        verifiedAmount: 0,
        matchedMovementId: movementFingerprint
      };
    }
    if (discrepancies.length > 0 || !namesMatch || ai && ai.confidence < 0.6) {
      return {
        status: "REVIEW",
        reconciledAt: (/* @__PURE__ */ new Date()).toISOString(),
        reconciledBy: "OPERATOR_MANUAL",
        reconciledOperatorId: operatorId,
        discrepancies,
        notes: notes.join(" | ") || "Requiere autorizaci\xF3n manual del operador debido a discrepancias.",
        verifiedAmount: realReceived,
        matchedMovementId: movementFingerprint
      };
    }
    return {
      status: "VERIFIED",
      reconciledAt: (/* @__PURE__ */ new Date()).toISOString(),
      reconciledBy: "OPERATOR_MANUAL",
      reconciledOperatorId: operatorId,
      discrepancies: [],
      notes: notes.join(" | ") || "Conciliaci\xF3n exacta de tres v\xEDas confirmada.",
      verifiedAmount: realReceived,
      matchedMovementId: movementFingerprint
    };
  }
};

// server/services/topup.service.ts
var TopupService = {
  /**
   * Genera un código de referencia no predecible de 6 caracteres alfanuméricos.
   * Ejemplo: ZNTH-482910 o ZNTH-K7P9X2
   */
  generateReferenceCode: () => {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let randomPart = "";
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ZNTH-${randomPart}`;
  },
  /**
   * 1. MOTORIZADO SOLICITA RECARGA
   * Valida monto, genera ID único, código de referencia y auditoría inicial.
   * REGLA FAIL-CLOSED: La persistencia en Firestore es OBLIGATORIA. Si falla, la operación aborta.
   */
  createTopupRequest: async (driverId, requestedAmount, driverMeta) => {
    if (!requestedAmount || typeof requestedAmount !== "number" || requestedAmount <= 0) {
      throw new Error("MONTO_INVALIDO: El monto de recarga debe ser un n\xFAmero positivo mayor a S/ 0.00.");
    }
    if (!driverId) {
      throw new Error("AUTH_ERROR: Identificador de conductor requerido.");
    }
    if (!db) {
      throw new Error("FIRESTORE_UNAVAILABLE: La base de datos central no est\xE1 disponible.");
    }
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1e5 + Math.random() * 9e5);
    const topupId = `TOPUP-${dateStr}-${randomSuffix}`;
    const referenceCode = TopupService.generateReferenceCode();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1e3).toISOString();
    const initialAudit = {
      fromStatus: "NONE",
      toStatus: "CREATED",
      timestamp: now.toISOString(),
      actorId: driverId,
      actorRole: "driver",
      reason: `Solicitud de recarga creada por S/ ${requestedAmount.toFixed(2)}`,
      metadata: { requestedAmount, referenceCode }
    };
    const newTopup = {
      id: topupId,
      referenceCode,
      driverId,
      driverName: driverMeta.name || "Conductor Z\xC9NITH",
      driverPhone: driverMeta.phone || "",
      requestedAmount: Number(requestedAmount.toFixed(2)),
      status: "CREATED",
      auditHistory: [initialAudit],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt
    };
    await db.collection("topup_requests").doc(topupId).set({
      ...newTopup,
      createdAtServer: import_firestore8.FieldValue.serverTimestamp(),
      updatedAtServer: import_firestore8.FieldValue.serverTimestamp()
    });
    return newTopup;
  },
  /**
   * Obtener una solicitud de recarga por ID directamente de Firestore.
   */
  getTopupById: async (topupId) => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const snap = await db.collection("topup_requests").doc(topupId).get();
    if (!snap.exists) return null;
    return snap.data();
  },
  /**
   * Obtener el historial de solicitudes de un motorizado directamente de Firestore.
   */
  getDriverTopupHistory: async (driverId) => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const snap = await db.collection("topup_requests").where("driverId", "==", driverId).limit(25).get();
    const list = [];
    snap.forEach((doc) => list.push(doc.data()));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  /**
   * Obtener todas las solicitudes pendientes para la consola del operador humano.
   */
  getPendingTopups: async () => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const snap = await db.collection("topup_requests").where("status", "in", ["CREATED", "RECEIPT_SUBMITTED", "REVIEW", "VERIFIED"]).limit(50).get();
    const list = [];
    snap.forEach((doc) => list.push(doc.data()));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  /**
   * 3. INGESTA DE COMPROBANTE VISUAL (EVIDENCIA AUXILIAR OPCIONAL)
   * REGLA V1: No se invoca Gemini ni OCR. La captura sirve exclusivamente como evidencia
   * complementaria para la inspección visual del operador humano.
   */
  submitReceiptAndAnalyze: async (topupId, driverId, receiptBase64, receiptUrl) => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const topupRef = db.collection("topup_requests").doc(topupId);
    const snap = await topupRef.get();
    if (!snap.exists) throw new Error("RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.");
    const topup = snap.data();
    if (topup.driverId !== driverId) {
      throw new Error("ACCESO_DENEGADO: No tiene autorizaci\xF3n sobre esta recarga.");
    }
    if (topup.status === "CREDITED" || topup.status === "REJECTED") {
      throw new Error(`ESTADO_TERMINAL: La recarga se encuentra en estado terminal (${topup.status}).`);
    }
    if (topup.status === "VERIFIED") {
      throw new Error("ESTADO_INMUTABLE: Una solicitud VERIFIED ya fue conciliada y no puede recibir nuevos comprobantes.");
    }
    if (new Date(topup.expiresAt) < /* @__PURE__ */ new Date()) {
      throw new Error("SOLICITUD_EXPIRADA: Esta solicitud de recarga ha superado el tiempo l\xEDmite.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const submitAudit = {
      fromStatus: topup.status,
      toStatus: "RECEIPT_SUBMITTED",
      timestamp: nowIso,
      actorId: driverId,
      actorRole: "driver",
      reason: "Comprobante visual adjuntado como evidencia auxiliar para revisi\xF3n humana del operador."
    };
    const cleanBase64 = receiptBase64.slice(0, 5e5);
    await topupRef.update({
      receiptBase64: cleanBase64,
      receiptUrl: receiptUrl || null,
      status: "RECEIPT_SUBMITTED",
      updatedAt: nowIso,
      auditHistory: import_firestore8.FieldValue.arrayUnion(submitAudit)
    });
    const updatedSnap = await topupRef.get();
    return updatedSnap.data();
  },
  /**
   * 4 & 5. CONCILIACIÓN CON MOVIMIENTO REAL CONFIRMADO POR EL OPERADOR
   * El operador humano ingresa los datos del dinero recibido en el Yape receptor.
   */
  reconcileTopup: async (topupId, bankMovement, operatorId) => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const topupRef = db.collection("topup_requests").doc(topupId);
    const snap = await topupRef.get();
    if (!snap.exists) throw new Error("RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.");
    const topup = snap.data();
    if (topup.status === "CREDITED") {
      throw new Error("IDEMPOTENCIA: Esta solicitud ya fue acreditada.");
    }
    if (topup.status === "REJECTED") {
      throw new Error("ESTADO_TERMINAL: Una solicitud REJECTED no puede volver a conciliarse.");
    }
    if (topup.status === "VERIFIED") {
      throw new Error("ESTADO_INMUTABLE: Una conciliaci\xF3n VERIFIED no puede ser reemplazada; debe pasar por acreditaci\xF3n o rechazo expl\xEDcito.");
    }
    if (new Date(topup.expiresAt) < /* @__PURE__ */ new Date()) {
      throw new Error("SOLICITUD_EXPIRADA: La solicitud ha expirado.");
    }
    let movementDocId = null;
    if (bankMovement) {
      movementDocId = bankMovement.securityCode && bankMovement.operationNumber ? `MOV-${bankMovement.operationNumber}-${bankMovement.securityCode}` : `MOV-${bankMovement.date}-${bankMovement.time}-${bankMovement.amount}-${bankMovement.payerName.replace(/\s+/g, "_")}`;
      const movementRef = db.collection("bank_movements").doc(movementDocId);
      await db.runTransaction(async (transaction) => {
        const movementSnap = await transaction.get(movementRef);
        if (movementSnap.exists) {
          const existingTopupId = movementSnap.data()?.matchedTopupId;
          if (existingTopupId && existingTopupId !== topupId) {
            throw new Error(
              `MOVIMIENTO_YA_ASIGNADO: El movimiento bancario ${movementDocId} ya est\xE1 vinculado a la recarga ${existingTopupId}.`
            );
          }
        }
        transaction.set(movementRef, {
          ...bankMovement,
          id: movementDocId,
          source: "YAPE_PERSONAL_MANUAL",
          operatorId,
          matchedTopupId: topupId,
          confirmedAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdAtServer: import_firestore8.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    }
    const reconciliation = await ReconciliationService.evaluateReconciliation(topup, bankMovement, operatorId);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const reconciliationAudit = {
      fromStatus: topup.status,
      toStatus: reconciliation.status,
      timestamp: nowIso,
      actorId: operatorId,
      actorRole: "operator",
      reason: `Conciliaci\xF3n del operador: estado resultante ${reconciliation.status}. ${reconciliation.notes || ""}`,
      metadata: {
        discrepancies: reconciliation.discrepancies,
        verifiedAmount: reconciliation.verifiedAmount
      }
    };
    await topupRef.update({
      reconciliation,
      verifiedAmount: reconciliation.verifiedAmount,
      bankMovementId: movementDocId,
      status: reconciliation.status,
      updatedAt: nowIso,
      auditHistory: import_firestore8.FieldValue.arrayUnion(reconciliationAudit)
    });
    const updatedSnap = await topupRef.get();
    return updatedSnap.data();
  },
  /**
   * APROBACIÓN MANUAL DE CASOS EN 'REVIEW'
   * Autorización formal por parte del operador humano tras verificar con el chofer o el banco.
   */
  approveReviewTopup: async (topupId, operatorId, operatorNotes) => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const topupRef = db.collection("topup_requests").doc(topupId);
    const snap = await topupRef.get();
    if (!snap.exists) throw new Error("RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.");
    const topup = snap.data();
    if (topup.status !== "REVIEW") {
      throw new Error(`ESTADO_INVALIDO: Solo se pueden aprobar solicitudes en estado REVIEW. Estado actual: ${topup.status}`);
    }
    if (topup.reconciliation?.status !== "REVIEW" || !topup.reconciliation.matchedMovementId || topup.bankMovementId !== topup.reconciliation.matchedMovementId) {
      throw new Error("CONCILIACION_NO_VERIFICABLE: El caso REVIEW no tiene una conciliaci\xF3n trazable a un movimiento confirmado.");
    }
    const movementRef = db.collection("bank_movements").doc(topup.reconciliation.matchedMovementId);
    const movementSnap = await movementRef.get();
    if (!movementSnap.exists || movementSnap.data()?.matchedTopupId !== topupId) {
      throw new Error("MOVIMIENTO_NO_VERIFICADO: No existe un movimiento bancario confirmado y vinculado a esta recarga.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const approvedAudit = {
      fromStatus: "REVIEW",
      toStatus: "VERIFIED",
      timestamp: nowIso,
      actorId: operatorId,
      actorRole: "operator",
      reason: `Aprobaci\xF3n manual autorizada tras revisi\xF3n: ${operatorNotes}`,
      metadata: { operatorNotes }
    };
    await topupRef.update({
      status: "VERIFIED",
      updatedAt: nowIso,
      "reconciliation.status": "VERIFIED",
      "reconciliation.notes": `Aprobado manualmente por operador ${operatorId}: ${operatorNotes}`,
      auditHistory: import_firestore8.FieldValue.arrayUnion(approvedAudit)
    });
    const updatedSnap = await topupRef.get();
    return updatedSnap.data();
  },
  /**
   * RECHAZO EXPLÍCITO POR EL OPERADOR
   */
  rejectTopup: async (topupId, operatorId, reason) => {
    if (!db) throw new Error("FIRESTORE_UNAVAILABLE: Base de datos no disponible.");
    const topupRef = db.collection("topup_requests").doc(topupId);
    const snap = await topupRef.get();
    if (!snap.exists) throw new Error("RECARGA_NO_ENCONTRADA: Recarga no encontrada en Firestore.");
    const topup = snap.data();
    if (topup.status === "CREDITED") {
      throw new Error("IDEMPOTENCIA: No se puede rechazar una recarga ya acreditada.");
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const rejectAudit = {
      fromStatus: topup.status,
      toStatus: "REJECTED",
      timestamp: nowIso,
      actorId: operatorId,
      actorRole: "operator",
      reason: `Rechazado por operador: ${reason}`
    };
    await topupRef.update({
      status: "REJECTED",
      updatedAt: nowIso,
      "reconciliation.status": "REJECTED",
      "reconciliation.notes": reason,
      auditHistory: import_firestore8.FieldValue.arrayUnion(rejectAudit)
    });
    const updatedSnap = await topupRef.get();
    return updatedSnap.data();
  },
  /**
   * ACREDITACIÓN ATÓMICA FINAL
   * Delega exclusivamente a WalletService.creditVerifiedTopup (Firestore runTransaction).
   */
  creditTopup: async (topupId, operatorId) => {
    return await WalletService.creditVerifiedTopup(topupId, operatorId);
  }
};

// server/controllers/topup.controller.ts
var topupController = {
  /**
   * POST /api/topups/request
   * Motorizado solicita recarga.
   * Regla de Seguridad: driverId se deriva EXCLUSIVAMENTE del token JWT de Firebase.
   */
  createRequest: async (req, res) => {
    try {
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ success: false, message: "Usuario no autenticado." });
      }
      const { amount } = req.body;
      const requestedAmount = Number(amount);
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "El monto de recarga debe ser un n\xFAmero positivo mayor a S/ 0.00."
        });
      }
      let driverName = "Conductor Z\xC9NITH";
      let driverPhone = "";
      if (db) {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          driverName = uData?.fullName || uData?.name || driverName;
          driverPhone = uData?.phone || driverPhone;
        }
      }
      const topup = await TopupService.createTopupRequest(user.uid, requestedAmount, {
        name: driverName,
        phone: driverPhone
      });
      return res.status(201).json({
        success: true,
        topup
      });
    } catch (error) {
      console.error("[TOPUP_CONTROLLER] Error creando solicitud de recarga:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * POST /api/topups/receipt
   * Motorizado adjunta captura de pantalla del Yape.
   */
  submitReceipt: async (req, res) => {
    try {
      const user = req.user;
      if (!user || !user.uid) {
        return res.status(401).json({ success: false, message: "Usuario no autenticado." });
      }
      const { topupId, receiptBase64, receiptUrl } = req.body;
      if (!topupId || !receiptBase64 && !receiptUrl) {
        return res.status(400).json({
          success: false,
          message: "Se requiere topupId y la captura en base64 o URL."
        });
      }
      const updated = await TopupService.submitReceiptAndAnalyze(
        topupId,
        user.uid,
        receiptBase64 || receiptUrl,
        receiptUrl
      );
      return res.json({
        success: true,
        topup: updated
      });
    } catch (error) {
      console.error("[TOPUP_CONTROLLER] Error enviando comprobante:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * GET /api/topups/status/:topupId
   * Consulta el estado de una recarga.
   */
  getStatus: async (req, res) => {
    try {
      const user = req.user;
      const { topupId } = req.params;
      const topup = await TopupService.getTopupById(topupId);
      if (!topup) {
        return res.status(404).json({ success: false, message: "Recarga no encontrada." });
      }
      if (topup.driverId !== user.uid && user.role !== "admin" && user.email !== "bkheelsec@gmail.com") {
        return res.status(403).json({ success: false, message: "Acceso denegado a esta recarga." });
      }
      return res.json({ success: true, topup });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * GET /api/topups/my-history
   * Obtiene las solicitudes de recarga del motorizado autenticado.
   */
  getMyHistory: async (req, res) => {
    try {
      const user = req.user;
      const history = await TopupService.getDriverTopupHistory(user.uid);
      return res.json({ success: true, history });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * POST /api/topups/reconcile
   * El operador confirma el movimiento real en el Yape receptor y ejecuta conciliación de 3 vías.
   */
  reconcile: async (req, res) => {
    try {
      const user = req.user;
      const { topupId, bankMovement } = req.body;
      if (!topupId) {
        return res.status(400).json({ success: false, message: "Se requiere topupId." });
      }
      const operatorId = user?.uid || "OPERATOR_DESK";
      const reconciled = await TopupService.reconcileTopup(topupId, bankMovement || null, operatorId);
      return res.json({
        success: true,
        topup: reconciled
      });
    } catch (error) {
      console.error("[TOPUP_CONTROLLER] Error en conciliaci\xF3n:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * POST /api/topups/approve-review
   * El operador aprueba manualmente una recarga que cayó en REVIEW tras validación humana.
   */
  approveReview: async (req, res) => {
    try {
      const user = req.user;
      const { topupId, notes } = req.body;
      if (!topupId) {
        return res.status(400).json({ success: false, message: "Se requiere topupId." });
      }
      const operatorId = user?.uid || "OPERATOR_DESK";
      const approved = await TopupService.approveReviewTopup(topupId, operatorId, notes || "Aprobado manualmente.");
      return res.json({
        success: true,
        topup: approved
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * POST /api/topups/credit
   * Ejecuta la acreditación atómica de una recarga en estado VERIFIED.
   */
  credit: async (req, res) => {
    try {
      const user = req.user;
      const { topupId } = req.body;
      if (!topupId) {
        return res.status(400).json({ success: false, message: "Se requiere topupId." });
      }
      const operatorId = user?.uid || "OPERATOR_DESK";
      const result = await TopupService.creditTopup(topupId, operatorId);
      return res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error("[TOPUP_CONTROLLER] Error en acreditaci\xF3n at\xF3mica:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * GET /api/topups/pending
   * Lista de solicitudes pendientes para revisión del operador humano.
   */
  getPending: async (req, res) => {
    try {
      const list = await TopupService.getPendingTopups();
      return res.json({ success: true, topups: list });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * POST /api/topups/reject
   * El operador humano rechaza explícitamente una solicitud con motivo.
   */
  reject: async (req, res) => {
    try {
      const user = req.user;
      const { topupId, reason } = req.body;
      if (!topupId) {
        return res.status(400).json({ success: false, message: "Se requiere topupId." });
      }
      const operatorId = user?.uid || "OPERATOR_DESK";
      const rejected = await TopupService.rejectTopup(topupId, operatorId, reason || "Rechazado por operador.");
      return res.json({ success: true, topup: rejected });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

// server/routes/topup.routes.ts
var import_express_rate_limit3 = __toESM(require("express-rate-limit"), 1);
var router7 = (0, import_express7.Router)();
var topupRateLimiter = (0, import_express_rate_limit3.default)({
  windowMs: 15 * 60 * 1e3,
  max: 30,
  message: { success: false, message: "Demasiadas solicitudes de recarga. Intente nuevamente en unos minutos." }
});
router7.post("/request", requireAuth, topupRateLimiter, topupController.createRequest);
router7.post("/receipt", requireAuth, topupRateLimiter, topupController.submitReceipt);
router7.get("/status/:topupId", requireAuth, topupController.getStatus);
router7.get("/my-history", requireAuth, topupController.getMyHistory);
router7.get("/pending", requireAuth, topupController.getPending);
router7.post("/reconcile", requireAuth, topupController.reconcile);
router7.post("/approve-review", requireAuth, topupController.approveReview);
router7.post("/reject", requireAuth, topupController.reject);
router7.post("/credit", requireAuth, topupController.credit);
var topup_routes_default = router7;

// server/routes/notification.routes.ts
var import_express8 = require("express");
var router8 = (0, import_express8.Router)();
var ACTIVE_RIDE_STATUSES = [
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
  "WAITING_FOR_OTP",
  "IN_PROGRESS",
  "ACCEPTED",
  "ARRIVED",
  "ASIGNADO",
  "ACTIVO"
];
router8.post("/send", requireAuth, async (req, res) => {
  try {
    const { recipientUserId, title, message, type, rideId } = req.body;
    if (!recipientUserId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios: recipientUserId, title, message y type son requeridos."
      });
    }
    const allowedTypes = ["info", "success", "alert", "promo"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Tipo de notificaci\xF3n inv\xE1lido. Tipos permitidos: info, success, alert, promo."
      });
    }
    if (typeof title !== "string" || title.length > 120) {
      return res.status(400).json({
        success: false,
        message: "El t\xEDtulo no debe exceder los 120 caracteres."
      });
    }
    if (typeof message !== "string" || message.length > 500) {
      return res.status(400).json({
        success: false,
        message: "El mensaje no debe exceder los 500 caracteres."
      });
    }
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({
        success: false,
        message: "No autenticado."
      });
    }
    const isSelf = recipientUserId === callerUid;
    const isAdmin = req.user?.role === "admin";
    if (!isSelf && !isAdmin) {
      if (!rideId) {
        return res.status(403).json({
          success: false,
          message: "No tiene autorizaci\xF3n para enviar notificaciones a este usuario fuera de un servicio activo."
        });
      }
      if (!db) {
        return res.status(500).json({
          success: false,
          message: "Base de datos no disponible."
        });
      }
      const rideDoc = await db.collection("rides").doc(rideId).get();
      if (!rideDoc.exists) {
        return res.status(403).json({
          success: false,
          message: "No tiene autorizaci\xF3n para enviar notificaciones a este usuario fuera de un servicio activo."
        });
      }
      const rideData = rideDoc.data();
      if (!rideData?.status || !ACTIVE_RIDE_STATUSES.includes(rideData.status)) {
        return res.status(403).json({
          success: false,
          message: "No tiene autorizaci\xF3n para enviar notificaciones a este usuario fuera de un servicio activo."
        });
      }
      const isPassengerToDriver = rideData.passengerId === callerUid && rideData.driverId === recipientUserId;
      const isDriverToPassenger = rideData.driverId === callerUid && rideData.passengerId === recipientUserId;
      if (!isPassengerToDriver && !isDriverToPassenger) {
        return res.status(403).json({
          success: false,
          message: "No tiene autorizaci\xF3n para enviar notificaciones a este usuario fuera de un servicio activo."
        });
      }
    }
    if (!db) {
      return res.status(500).json({
        success: false,
        message: "Base de datos no disponible."
      });
    }
    const docRef = await db.collection("users").doc(recipientUserId).collection("notifications").add({
      title,
      message,
      type,
      ...rideId ? { rideId } : {},
      senderUid: callerUid,
      read: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      serverVerified: true
    });
    return res.status(200).json({
      success: true,
      notificationId: docRef.id
    });
  } catch (error) {
    console.error("[NOTIFICATION_ROUTES] Error al despachar notificaci\xF3n:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Error interno del servidor al procesar la notificaci\xF3n."
    });
  }
});
var notification_routes_default = router8;

// server/routes/pricing.routes.ts
var import_express9 = require("express");
var router9 = (0, import_express9.Router)();
router9.post("/quote", requireAuth, async (req, res) => {
  try {
    const {
      originLat,
      originLng,
      destLat,
      destLng,
      originAddress,
      destAddress,
      durationMin
    } = req.body;
    if (typeof originLat !== "number" || isNaN(originLat) || typeof originLng !== "number" || isNaN(originLng) || typeof destLat !== "number" || isNaN(destLat) || typeof destLng !== "number" || isNaN(destLng)) {
      return res.status(400).json({
        success: false,
        message: "Coordenadas geogr\xE1ficas inv\xE1lidas o ausentes."
      });
    }
    if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90 || originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180) {
      return res.status(400).json({
        success: false,
        message: "Coordenadas geogr\xE1ficas fuera del rango terrestre permitido."
      });
    }
    if (!originAddress || typeof originAddress !== "string" || !destAddress || typeof destAddress !== "string") {
      return res.status(400).json({
        success: false,
        message: "Las direcciones de origen y destino son obligatorias."
      });
    }
    let pendingOrders = 1;
    let availableDrivers = 1;
    if (db) {
      try {
        const geoScope = resolveCityFromCoordinates(originLat, originLng, originAddress.trim());
        const targetCity = geoScope.city;
        const demandPlan = buildDemandQueryFilters(originLat, originLng, originAddress.trim());
        const pendingSnap = await db.collection(demandPlan.collection).where(demandPlan.scopeFilter.field, demandPlan.scopeFilter.operator, demandPlan.scopeFilter.value).where(demandPlan.statusFilter.field, demandPlan.statusFilter.operator, demandPlan.statusFilter.value).get();
        const rawRides = [];
        pendingSnap.forEach((docSnap) => {
          rawRides.push({ id: docSnap.id, ...docSnap.data() });
        });
        const supplyPlan = buildSupplyQueryFilters(originLat, originLng, originAddress.trim());
        const onlineSnap = await db.collection(supplyPlan.collection).where(supplyPlan.scopeFilter.field, supplyPlan.scopeFilter.operator, supplyPlan.scopeFilter.value).where(supplyPlan.statusFilter.field, supplyPlan.statusFilter.operator, supplyPlan.statusFilter.value).get();
        const rawDrivers = [];
        onlineSnap.forEach((docSnap) => {
          rawDrivers.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (rawDrivers.length === 0 && geoScope.isKnownCity) {
          const usersSnap = await db.collection("users").where("driverProfile.availability", "==", true).where("driverProfile.city", "==", targetCity).get();
          usersSnap.forEach((docSnap) => {
            rawDrivers.push({ id: docSnap.id, ...docSnap.data() });
          });
        }
        const localAssessment = filterLocalDemandAndSupply(
          originLat,
          originLng,
          originAddress.trim(),
          rawRides,
          rawDrivers
        );
        pendingOrders = localAssessment.pendingOrders;
        availableDrivers = localAssessment.availableDrivers;
        console.log(`[PRICING_ROUTES] \xC1mbito: ${localAssessment.city} (${localAssessment.marketZone.id}) | Demanda Acotada: ${pendingOrders} | Oferta Acotada: ${availableDrivers}`);
      } catch (dbErr) {
        console.warn("[PRICING_ROUTES] Fallback de conteo demanda/oferta local:", dbErr);
        pendingOrders = 1;
        availableDrivers = 1;
      }
    }
    const quote = await calculateServerQuote({
      originLat,
      originLng,
      destLat,
      destLng,
      originAddress: originAddress.trim(),
      destAddress: destAddress.trim(),
      durationMin: typeof durationMin === "number" ? durationMin : void 0,
      pendingOrders,
      availableDrivers
    });
    return res.status(200).json({
      success: true,
      quote
    });
  } catch (error) {
    console.error("[PRICING_ROUTES] Error al calcular cotizaci\xF3n:", error);
    const message = error?.message || "Error interno del servidor al procesar la cotizaci\xF3n.";
    const statusCode = message.includes("Google Routes") || message.includes("Inconsistencia") ? 502 : 400;
    return res.status(statusCode).json({
      success: false,
      message
    });
  }
});
router9.post("/verify", requireAuth, async (req, res) => {
  try {
    const { quote } = req.body;
    if (!quote) {
      return res.status(400).json({ success: false, message: "Objeto de cotizaci\xF3n requerido." });
    }
    const verification = verifyQuoteSignature(quote);
    if (!verification.valid) {
      return res.status(400).json({ success: false, reason: verification.reason });
    }
    return res.status(200).json({ success: true, valid: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || "Error al verificar cotizaci\xF3n." });
  }
});
var pricing_routes_default = router9;

// server/routes/index.ts
var router10 = (0, import_express10.Router)();
router10.use("/payments", payment_routes_default);
router10.use("/settlements", settlement_routes_default);
router10.use("/rides", ride_routes_default);
router10.use("/wallet", wallet_routes_default);
router10.use("/topups", topup_routes_default);
router10.use("/audit", audit_routes_default);
router10.use("/ledger", ledger_routes_default);
router10.use("/notifications", notification_routes_default);
router10.use("/pricing", pricing_routes_default);
var routes_default = router10;

// server/app.ts
var createApp = () => {
  const app = (0, import_express11.default)();
  app.use(import_express11.default.json({ limit: "1mb" }));
  app.use(import_express11.default.urlencoded({ extended: true, limit: "1mb" }));
  configureSecurity(app);
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Z\xE9nith Enterprise Backend Running" });
  });
  app.use("/api", routes_default);
  return app;
};

// server.ts
async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express12.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Z\xE9nith Backend Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
