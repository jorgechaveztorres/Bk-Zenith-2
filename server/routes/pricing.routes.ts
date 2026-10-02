import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { db } from '../config/firebase';
import { calculateServerQuote, verifyQuoteSignature } from '../services/pricing.service';
import { 
  filterLocalDemandAndSupply, 
  resolveCityFromCoordinates,
  buildDemandQueryFilters,
  buildSupplyQueryFilters
} from '../services/geo.service';

const router = Router();

/**
 * POST /api/pricing/quote
 * Emite una cotización oficial protegida mediante el motor DPE V2 gobernado por el servidor.
 * La distancia, tarifa base, multiplicador y firma HMAC son calculados exclusivamente en el backend.
 */
router.post('/quote', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

    // 1. Validación de existencia y tipos de coordenadas
    if (
      typeof originLat !== 'number' || isNaN(originLat) ||
      typeof originLng !== 'number' || isNaN(originLng) ||
      typeof destLat !== 'number' || isNaN(destLat) ||
      typeof destLng !== 'number' || isNaN(destLng)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas geográficas inválidas o ausentes.'
      });
    }

    // 2. Validación de rangos geográficos
    if (
      originLat < -90 || originLat > 90 ||
      destLat < -90 || destLat > 90 ||
      originLng < -180 || originLng > 180 ||
      destLng < -180 || destLng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas geográficas fuera del rango terrestre permitido.'
      });
    }

    // 3. Validación de direcciones
    if (!originAddress || typeof originAddress !== 'string' || !destAddress || typeof destAddress !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Las direcciones de origen y destino son obligatorias.'
      });
    }

    // 4. Determinar Demanda y Oferta REALES Y GEOACOTADAS en Firestore
    let pendingOrders = 1;
    let availableDrivers = 1;

    if (db) {
      try {
        const geoScope = resolveCityFromCoordinates(originLat, originLng, originAddress.trim());
        const targetCity = geoScope.city;

        // 4.1 Consulta Firestore acotada de Demanda (rides)
        const demandPlan = buildDemandQueryFilters(originLat, originLng, originAddress.trim());
        const pendingSnap = await db.collection(demandPlan.collection)
          .where(demandPlan.scopeFilter.field, demandPlan.scopeFilter.operator, demandPlan.scopeFilter.value)
          .where(demandPlan.statusFilter.field, demandPlan.statusFilter.operator, demandPlan.statusFilter.value)
          .get();

        const rawRides: any[] = [];
        pendingSnap.forEach((docSnap: any) => {
          rawRides.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 4.2 Consulta Firestore acotada de Oferta (drivers_online)
        const supplyPlan = buildSupplyQueryFilters(originLat, originLng, originAddress.trim());
        const onlineSnap = await db.collection(supplyPlan.collection)
          .where(supplyPlan.scopeFilter.field, supplyPlan.scopeFilter.operator, supplyPlan.scopeFilter.value)
          .where(supplyPlan.statusFilter.field, supplyPlan.statusFilter.operator, supplyPlan.statusFilter.value)
          .get();

        const rawDrivers: any[] = [];
        onlineSnap.forEach((docSnap: any) => {
          rawDrivers.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 4.3 Complemento en users (solo si drivers_online está vacío y para la ciudad objetivo)
        if (rawDrivers.length === 0 && geoScope.isKnownCity) {
          const usersSnap = await db.collection('users')
            .where('driverProfile.availability', '==', true)
            .where('driverProfile.city', '==', targetCity)
            .get();
          usersSnap.forEach((docSnap: any) => {
            rawDrivers.push({ id: docSnap.id, ...docSnap.data() });
          });
        }

        // 4.4 Filtrado geográfico fino por radio metropolitano y validación de frescura telemétrica
        const localAssessment = filterLocalDemandAndSupply(
          originLat,
          originLng,
          originAddress.trim(),
          rawRides,
          rawDrivers
        );

        pendingOrders = localAssessment.pendingOrders;
        availableDrivers = localAssessment.availableDrivers;

        console.log(`[PRICING_ROUTES] Ámbito: ${localAssessment.city} (${localAssessment.marketZone.id}) | Demanda Acotada: ${pendingOrders} | Oferta Acotada: ${availableDrivers}`);
      } catch (dbErr) {
        console.warn('[PRICING_ROUTES] Fallback de conteo demanda/oferta local:', dbErr);
        // Fallback seguro: reposo local (1 demanda potencial, 1 oferta base = presión 1.00x)
        pendingOrders = 1;
        availableDrivers = 1;
      }
    }

    // 5. Generar Cotización Oficial Server-Side DPE V2 mediante Google Routes API
    const quote = await calculateServerQuote({
      originLat,
      originLng,
      destLat,
      destLng,
      originAddress: originAddress.trim(),
      destAddress: destAddress.trim(),
      durationMin: typeof durationMin === 'number' ? durationMin : undefined,
      pendingOrders,
      availableDrivers
    });

    return res.status(200).json({
      success: true,
      quote
    });
  } catch (error: any) {
    console.error('[PRICING_ROUTES] Error al calcular cotización:', error);
    const message = error?.message || 'Error interno del servidor al procesar la cotización.';
    const statusCode = message.includes('Google Routes') || message.includes('Inconsistencia') ? 502 : 400;
    return res.status(statusCode).json({
      success: false,
      message
    });
  }
});

/**
 * POST /api/pricing/verify
 * Verifica la validez y firma de una cotización.
 */
router.post('/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { quote } = req.body;
    if (!quote) {
      return res.status(400).json({ success: false, message: 'Objeto de cotización requerido.' });
    }

    const verification = verifyQuoteSignature(quote);
    if (!verification.valid) {
      return res.status(400).json({ success: false, reason: verification.reason });
    }

    return res.status(200).json({ success: true, valid: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Error al verificar cotización.' });
  }
});

export default router;
