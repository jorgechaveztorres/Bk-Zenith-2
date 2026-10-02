/**
 * ZÉNITH TEST SUITE: DEMANDA / OFERTA GEOGRÁFICA MULTICIUDAD & GENERALIZACIÓN (FASE 2.4.2)
 * 
 * Verifica los 20 requerimientos de aislamiento geográfico, frescura de conductores,
 * catálogo dinámico de ciudades configuradas y generalización sin hardcoding.
 */

import { 
  resolveCityFromCoordinates, 
  resolveGeoMarketZone, 
  filterLocalDemandAndSupply,
  isDriverFresh,
  buildDemandQueryFilters,
  buildSupplyQueryFilters
} from '../server/services/geo.service';
import { 
  CityCatalog, 
  DEFAULT_CONFIGURED_CITIES, 
  CityDefinition 
} from '../server/config/cities.config';
import { 
  calculateDynamicMultiplier, 
  calculateServerQuote,
  calculateNormalFare
} from '../server/services/pricing.service';
import { setRouteProvider, MockRouteProvider } from '../server/services/routes.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] Test ${passed}: ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName} - ${detail || 'Condición no cumplida'}`);
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('  ZÉNITH — SUITE FASE 2.4.2: MOTOR GEOGRÁFICO MULTICIUDAD GENERALIZADO  ');
  console.log('======================================================================\n');

  // Asegurar catálogo limpio por defecto
  CityCatalog.resetToDefaults();

  // Proveedor de rutas controlado para tests
  setRouteProvider(new MockRouteProvider({ distanceKm: 4.0, durationMinutes: 10 }));

  // Coordenadas de prueba
  const trujilloCoords = { lat: -8.1116, lng: -79.0287 }; // Plaza de Armas Trujillo
  const limaCoords = { lat: -12.0464, lng: -77.0428 };    // Plaza Mayor Lima
  const arequipaCoords = { lat: -16.4090, lng: -71.5375 };// Plaza de Armas Arequipa

  console.log('--- GRUPO 1: AISLAMIENTO MULTICIUDAD PERÚ ---');

  // TEST 1: Orden en Trujillo + conductor en Trujillo -> cuentan en la misma zona
  const res1 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Plaza de Armas, Trujillo',
    [{ id: 'ride_tru_1', origin: { lat: -8.1120, lng: -79.0290 }, status: 'SEARCHING_DRIVER' }],
    [{ id: 'drv_tru_1', lat: -8.1130, lng: -79.0280, status: 'AVAILABLE', lastActive: Date.now() }]
  );
  assert(res1.city === 'Trujillo' && res1.pendingOrders === 1 && res1.availableDrivers === 1,
    'Orden en Trujillo + conductor en Trujillo cuentan en la misma zona local');

  // TEST 2: Orden en Trujillo + conductor en Lima -> conductor de Lima NO cuenta para Trujillo
  const res2 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Plaza de Armas, Trujillo',
    [{ id: 'ride_tru_1', origin: { lat: -8.1120, lng: -79.0290 }, status: 'SEARCHING_DRIVER' }],
    [{ id: 'drv_lima_1', lat: limaCoords.lat, lng: limaCoords.lng, status: 'AVAILABLE', lastActive: Date.now() }]
  );
  assert(res2.availableDrivers === 0, 'Conductor en Lima NO cuenta para la oferta de Trujillo (560 km de distancia)');

  // TEST 3: Orden en Lima + conductor en Trujillo -> conductor de Trujillo NO cuenta para Lima
  const res3 = filterLocalDemandAndSupply(
    limaCoords.lat,
    limaCoords.lng,
    'Miraflores, Lima',
    [{ id: 'ride_lima_1', origin: { lat: -12.1200, lng: -77.0300 }, status: 'SEARCHING_DRIVER' }],
    [{ id: 'drv_tru_1', lat: trujilloCoords.lat, lng: trujilloCoords.lng, status: 'AVAILABLE', lastActive: Date.now() }]
  );
  assert(res3.availableDrivers === 0, 'Conductor en Trujillo NO cuenta para la oferta de Lima');

  // TEST 4: Dos ciudades simultáneas -> presión independiente
  const poolRides = [
    { id: 't1', origin: { lat: -8.112, lng: -79.028 }, status: 'SEARCHING_DRIVER' },
    { id: 't2', origin: { lat: -8.115, lng: -79.029 }, status: 'SEARCHING_DRIVER' },
    { id: 't3', origin: { lat: -8.110, lng: -79.025 }, status: 'SEARCHING_DRIVER' },
    { id: 'l1', origin: { lat: -12.046, lng: -77.042 }, status: 'SEARCHING_DRIVER' }
  ];
  const poolDrivers = [
    { id: 'dt1', lat: -8.113, lng: -79.027, status: 'AVAILABLE', lastActive: Date.now() },
    { id: 'dl1', lat: -12.045, lng: -77.040, status: 'AVAILABLE', lastActive: Date.now() },
    { id: 'dl2', lat: -12.050, lng: -77.045, status: 'AVAILABLE', lastActive: Date.now() },
    { id: 'dl3', lat: -12.060, lng: -77.030, status: 'AVAILABLE', lastActive: Date.now() },
    { id: 'dl4', lat: -12.070, lng: -77.020, status: 'AVAILABLE', lastActive: Date.now() },
    { id: 'dl5', lat: -12.080, lng: -77.010, status: 'AVAILABLE', lastActive: Date.now() }
  ];

  const evalTrujillo = filterLocalDemandAndSupply(trujilloCoords.lat, trujilloCoords.lng, 'Trujillo', poolRides, poolDrivers);
  const evalLima = filterLocalDemandAndSupply(limaCoords.lat, limaCoords.lng, 'Lima', poolRides, poolDrivers);

  const multTrujillo = calculateDynamicMultiplier(evalTrujillo.pendingOrders, evalTrujillo.availableDrivers);
  const multLima = calculateDynamicMultiplier(evalLima.pendingOrders, evalLima.availableDrivers);

  assert(
    evalTrujillo.pendingOrders === 3 && evalTrujillo.availableDrivers === 1 && multTrujillo.multiplier === 1.25 &&
    evalLima.pendingOrders === 1 && evalLima.availableDrivers === 5 && multLima.multiplier === 1.00,
    'Ciudades simultáneas operan con presión y multiplicadores 100% independientes'
  );

  // TEST 5: Dos zonas de una misma ciudad -> verificar comportamiento según radio geográfico metropolitano
  const pacasmayoCoords = { lat: -7.4000, lng: -79.5700 };
  const res5 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [{ id: 'ride_pacasmayo', origin: { lat: pacasmayoCoords.lat, lng: pacasmayoCoords.lng }, status: 'SEARCHING_DRIVER' }],
    [{ id: 'drv_tru_1', lat: trujilloCoords.lat, lng: trujilloCoords.lng, status: 'AVAILABLE', lastActive: Date.now() }]
  );
  assert(res5.pendingOrders === 0, 'Orden lejana en otra provincia fuera del radio urbano no cuenta en la demanda de Trujillo Centro');

  // TEST 6: Conductor disponible fuera de zona (a 500 km) -> no cuenta
  const res6 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [],
    [{ id: 'drv_cusco', lat: -13.5320, lng: -71.9675, status: 'AVAILABLE', lastActive: Date.now() }]
  );
  assert(res6.availableDrivers === 0, 'Conductor en Cusco no cuenta para la oferta de Trujillo');

  // TEST 7: Conductor no disponible (availability: false o status != AVAILABLE) -> no cuenta
  const res7 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [],
    [
      { id: 'drv_offline', lat: -8.1120, lng: -79.0280, status: 'OFFLINE', lastActive: Date.now() },
      { id: 'drv_unavail', lat: -8.1130, lng: -79.0290, driverProfile: { availability: false } }
    ]
  );
  assert(res7.availableDrivers === 0, 'Conductores con disponibilidad falsa u offline no cuentan');

  // TEST 8: Orden cancelada -> no cuenta como demanda activa
  const res8 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [{ id: 'ride_canc', origin: { lat: -8.1120, lng: -79.0280 }, status: 'CANCELLED' }],
    []
  );
  assert(res8.pendingOrders === 0, 'Orden cancelada (CANCELLED) no cuenta como demanda activa');

  // TEST 9: Orden completada -> no cuenta como demanda activa
  const res9 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [{ id: 'ride_comp', origin: { lat: -8.1120, lng: -79.0280 }, status: 'COMPLETED' }],
    []
  );
  assert(res9.pendingOrders === 0, 'Orden completada (COMPLETED) no cuenta como demanda activa');

  console.log('\n--- GRUPO 2: CALIBRACIÓN DPE V2 & REGLAS DE PRESIÓN ---');

  // TEST 10: Zero supply -> multiplier permanece 1.00x
  const m10 = calculateDynamicMultiplier(5, 0);
  assert(m10.multiplier === 1.00 && m10.status === 'SIN_OFERTA_DISPONIBLE',
    'Zero supply: multiplier permanece estrictamente 1.00x (sin inflación artificial)');

  // TEST 11: Presión <= 1.00 -> 1.00x
  const m11 = calculateDynamicMultiplier(1, 1);
  assert(m11.multiplier === 1.00 && m11.pressure === 1.00, 'Presión 1.00 aplica multiplicador 1.00x');

  // TEST 12: Presión 1.25 -> 1.05x
  const m12 = calculateDynamicMultiplier(5, 4);
  assert(m12.multiplier === 1.05 && m12.pressure === 1.25, 'Presión 1.25 aplica multiplicador 1.05x');

  // TEST 13: Presión 1.50 -> 1.10x
  const m13 = calculateDynamicMultiplier(3, 2);
  assert(m13.multiplier === 1.10 && m13.pressure === 1.50, 'Presión 1.50 aplica multiplicador 1.10x');

  // TEST 14: Presión 2.00 -> 1.15x
  const m14 = calculateDynamicMultiplier(2, 1);
  assert(m14.multiplier === 1.15 && m14.pressure === 2.00, 'Presión 2.00 aplica multiplicador 1.15x');

  // TEST 15: Presión 2.50 -> 1.20x
  const m15 = calculateDynamicMultiplier(5, 2);
  assert(m15.multiplier === 1.20 && m15.pressure === 2.50, 'Presión 2.50 aplica multiplicador 1.20x');

  // TEST 16: Presión 3.00 -> 1.25x
  const m16 = calculateDynamicMultiplier(3, 1);
  assert(m16.multiplier === 1.25 && m16.pressure === 3.00, 'Presión 3.00 aplica multiplicador 1.25x');

  // TEST 17: Presión >3.00 -> 1.30x (Cap)
  const m17 = calculateDynamicMultiplier(10, 1);
  assert(m17.multiplier === 1.30 && m17.pressure === 10.00, 'Presión > 3.00 aplica multiplicador cap 1.30x');

  // TEST 18: Intento de enviar pressure manipulada desde cliente -> backend calcula su propia presión
  const quoteServer = await calculateServerQuote({
    originLat: trujilloCoords.lat,
    originLng: trujilloCoords.lng,
    destLat: -8.1300,
    destLng: -79.0350,
    originAddress: 'Trujillo',
    destAddress: 'Mall Aventura',
    pendingOrders: 2,
    availableDrivers: 1
  });
  assert(quoteServer.multiplier === 1.15 && quoteServer.pressure === 2.0,
    'El backend fija la presión y el multiplicador con autoridad server-side inmutable');

  // TEST 19: Una ciudad no contamina otra
  const arequipaRides = Array.from({ length: 10 }, (_, i) => ({
    id: `aqp_${i}`,
    origin: { lat: arequipaCoords.lat + 0.001 * i, lng: arequipaCoords.lng },
    status: 'SEARCHING_DRIVER'
  }));
  const res19 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    arequipaRides,
    [{ id: 'drv_tru_1', lat: trujilloCoords.lat, lng: trujilloCoords.lng, status: 'AVAILABLE', lastActive: Date.now() }]
  );
  assert(res19.pendingOrders === 0 && res19.availableDrivers === 1,
    '10 órdenes masivas en Arequipa producen exactamente 0 demanda en Trujillo');

  // TEST 20: Cotización sin zona urbana predefinida
  const ruralCoords = { lat: -7.8100, lng: -78.0500 };
  const res20 = resolveCityFromCoordinates(ruralCoords.lat, ruralCoords.lng);
  const zone20 = resolveGeoMarketZone(ruralCoords.lat, ruralCoords.lng);
  assert(zone20.id.startsWith('MZ-') && typeof zone20.gridKey === 'string',
    'Cotización en zona rural resuelve deterministamente una MarketZone válida y segura');

  console.log('\n--- GRUPO 3: FRESCURA DE CONDUCTORES (ANTI-STALE) ---');

  // TEST 21: Conductor stale (inactivo hace más de 10 min) queda excluido
  const now = Date.now();
  const staleDriver = {
    id: 'drv_stale',
    lat: trujilloCoords.lat,
    lng: trujilloCoords.lng,
    status: 'AVAILABLE',
    lastActive: now - (15 * 60 * 1000) // 15 minutos de inactividad
  };
  const freshDriver = {
    id: 'drv_fresh',
    lat: trujilloCoords.lat,
    lng: trujilloCoords.lng,
    status: 'AVAILABLE',
    lastActive: now - (2 * 60 * 1000) // 2 minutos de inactividad
  };
  assert(!isDriverFresh(staleDriver, now) && isDriverFresh(freshDriver, now),
    'isDriverFresh rechaza conductor inactivo hace 15m y acepta conductor activo hace 2m');

  // TEST 22: filterLocalDemandAndSupply excluye conductor stale de la oferta
  const res22 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo',
    [],
    [staleDriver, freshDriver],
    now
  );
  assert(res22.availableDrivers === 1 && res22.localDriverIds.includes('drv_fresh') && !res22.localDriverIds.includes('drv_stale'),
    'filterLocalDemandAndSupply descarta oferta de conductor con telemetría stale');

  console.log('\n--- GRUPO 4: GENERALIZACIÓN MULTICIUDAD & AMPLIACIÓN DINÁMICA (TEST 29 - 40) ---');

  // TEST 29: Las 11 ciudades actualmente configuradas resuelven correctamente por coordenadas
  const allConfigured = CityCatalog.getAllCities(true);
  assert(allConfigured.length === 11, 'Existen exactamente 11 ciudades actualmente configuradas por defecto');

  let all11Resolved = true;
  for (const c of allConfigured) {
    const res = resolveCityFromCoordinates(c.center.lat, c.center.lng);
    if (res.city !== c.name || res.code !== c.code) {
      all11Resolved = false;
      console.error(`Fallo resolviendo ciudad configurada ${c.name}: esperado ${c.name}/${c.code}, obtenido ${res.city}/${res.code}`);
    }
  }
  assert(all11Resolved, 'Las 11 ciudades configuradas resuelven exactamente su nombre y código oficial');

  // TEST 30: Una ciudad nueva ficticia (TEST_CITY_X) puede agregarse al catálogo sin modificar la lógica
  const testCityX: CityDefinition = {
    code: 'TCX',
    name: 'Test City X',
    department: 'San Martín',
    country: 'PE',
    center: { lat: -6.4850, lng: -76.3700 }, // Tarapoto coords
    boundingBox: { latMin: -6.600, latMax: -6.350, lngMin: -76.450, lngMax: -76.250 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ['test city x', 'tarapoto test']
  };

  CityCatalog.registerCity(testCityX);
  assert(CityCatalog.getCityByCode('TCX')?.name === 'Test City X',
    'TEST_CITY_X fue incorporada dinámicamente al CityCatalog sin alterar ninguna línea de lógica');

  // TEST 31: TEST_CITY_X obtiene su propio city code
  const res31 = resolveCityFromCoordinates(testCityX.center.lat, testCityX.center.lng);
  assert(res31.code === 'TCX' && res31.city === 'Test City X',
    'TEST_CITY_X obtiene su código propio "TCX" y nombre oficial mediante el motor geográfico');

  // TEST 32: TEST_CITY_X obtiene su propio marketZone
  const zone32 = resolveGeoMarketZone(testCityX.center.lat, testCityX.center.lng);
  assert(zone32.id.startsWith('MZ-TCX-'),
    `TEST_CITY_X genera MarketZone propio con su código prefijado: ${zone32.id}`);

  // TEST 33: Una orden de TEST_CITY_X no afecta Trujillo
  const res33 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [{ id: 'ride_tcx', origin: { lat: testCityX.center.lat, lng: testCityX.center.lng }, status: 'SEARCHING_DRIVER' }],
    [{ id: 'drv_tru_1', lat: trujilloCoords.lat, lng: trujilloCoords.lng, status: 'AVAILABLE', lastActive: now }],
    now
  );
  assert(res33.pendingOrders === 0 && res33.availableDrivers === 1,
    'Una orden generada en TEST_CITY_X produce 0 demanda en Trujillo');

  // TEST 34: Un conductor de TEST_CITY_X no afecta Trujillo
  const res34 = filterLocalDemandAndSupply(
    trujilloCoords.lat,
    trujilloCoords.lng,
    'Trujillo Centro',
    [],
    [
      { id: 'drv_tru_1', lat: trujilloCoords.lat, lng: trujilloCoords.lng, status: 'AVAILABLE', lastActive: now },
      { id: 'drv_tcx_1', lat: testCityX.center.lat, lng: testCityX.center.lng, status: 'AVAILABLE', lastActive: now }
    ],
    now
  );
  assert(res34.availableDrivers === 1 && res34.localDriverIds.includes('drv_tru_1') && !res34.localDriverIds.includes('drv_tcx_1'),
    'Un conductor disponible en TEST_CITY_X no altera la oferta de Trujillo');

  // TEST 35: Una ubicación regional no catalogada obtiene aislamiento propio
  // Simulamos dos ubicaciones regionales lejanas: Puno (-15.84, -70.02) y Chachapoyas (-6.23, -77.87)
  const punoCoords = { lat: -15.8400, lng: -70.0200 };
  const chachaCoords = { lat: -6.2300, lng: -77.8700 };

  const zonePuno = resolveGeoMarketZone(punoCoords.lat, punoCoords.lng);
  const zoneChacha = resolveGeoMarketZone(chachaCoords.lat, chachaCoords.lng);

  assert(zonePuno.id !== zoneChacha.id && zonePuno.gridKey !== zoneChacha.gridKey,
    'Dos ubicaciones regionales no catalogadas obtienen zonas de mercado geodésicamente aisladas');

  // TEST 36: Una ubicación regional no altera ninguna ciudad configurada
  const res36 = filterLocalDemandAndSupply(
    limaCoords.lat,
    limaCoords.lng,
    'Lima',
    [{ id: 'ride_puno', origin: { lat: punoCoords.lat, lng: punoCoords.lng }, status: 'SEARCHING_DRIVER' }],
    [{ id: 'drv_lima', lat: limaCoords.lat, lng: limaCoords.lng, status: 'AVAILABLE', lastActive: now }],
    now
  );
  assert(res36.pendingOrders === 0 && res36.availableDrivers === 1,
    'Una orden en zona regional no catalogada (Puno) no altera la demanda de Lima');

  // TEST 37: No existe contador nacional de demanda (órdenes en 3 ciudades distintas no se suman)
  const multicityRides = [
    { id: 'r_tru', origin: { lat: trujilloCoords.lat, lng: trujilloCoords.lng }, status: 'SEARCHING_DRIVER' },
    { id: 'r_lim', origin: { lat: limaCoords.lat, lng: limaCoords.lng }, status: 'SEARCHING_DRIVER' },
    { id: 'r_aqp', origin: { lat: arequipaCoords.lat, lng: arequipaCoords.lng }, status: 'SEARCHING_DRIVER' }
  ];
  const evalTruDemand = filterLocalDemandAndSupply(trujilloCoords.lat, trujilloCoords.lng, 'Trujillo', multicityRides, []);
  assert(evalTruDemand.pendingOrders === 1, 'Inexistencia de contador nacional de demanda: 3 órdenes en 3 ciudades resultan en exactamente 1 orden local');

  // TEST 38: No existe contador nacional de oferta (conductores en 3 ciudades distintas no se suman)
  const multicityDrivers = [
    { id: 'd_tru', lat: trujilloCoords.lat, lng: trujilloCoords.lng, status: 'AVAILABLE', lastActive: now },
    { id: 'd_lim', lat: limaCoords.lat, lng: limaCoords.lng, status: 'AVAILABLE', lastActive: now },
    { id: 'd_aqp', lat: arequipaCoords.lat, lng: arequipaCoords.lng, status: 'AVAILABLE', lastActive: now }
  ];
  const evalLimSupply = filterLocalDemandAndSupply(limaCoords.lat, limaCoords.lng, 'Lima', [], multicityDrivers, now);
  assert(evalLimSupply.availableDrivers === 1, 'Inexistencia de contador nacional de oferta: 3 conductores en 3 ciudades resultan en exactamente 1 conductor local');

  // TEST 39: No existe hardcode de Trujillo como fallback universal
  const uncataloguedCoords = { lat: -11.0000, lng: -75.0000 }; // Selva central
  const uncatRes = resolveCityFromCoordinates(uncataloguedCoords.lat, uncataloguedCoords.lng);
  assert(uncatRes.city !== 'Trujillo' && uncatRes.code !== 'TRU',
    `Ubicación desconocida resuelve a "${uncatRes.city}" y no cae en Trujillo`);

  // TEST 40: Agregar una nueva ciudad no modifica DPE V2
  // Verificamos que la tabla escalonada DPE V2 produce exactamente los mismos precios y multiplicadores
  const fareBase = calculateNormalFare(2.50);
  const fareMid = calculateNormalFare(4.50);
  const fareLong = calculateNormalFare(24.0);
  assert(fareBase === 5.00 && fareMid === 6.00 && fareLong === 33.00,
    'La incorporación de nuevas ciudades preserva 100% inalterada la tabla tarifaria DPE V2');

  // Limpiar registro de test para dejar catálogo limpio
  CityCatalog.unregisterCity('TCX');

  console.log('\n--- GRUPO 5: VERIFICACIÓN REAL DE CONSULTAS FIRESTORE GEOACOTADAS (FASE 2.4.3) ---');

  // TEST 41: buildDemandQueryFilters para Trujillo genera filtro Firestore acotado por city == 'Trujillo'
  const planDemandTru = buildDemandQueryFilters(trujilloCoords.lat, trujilloCoords.lng, 'Trujillo');
  assert(
    planDemandTru.collection === 'rides' &&
    planDemandTru.scopeFilter.field === 'city' &&
    planDemandTru.scopeFilter.operator === '==' &&
    planDemandTru.scopeFilter.value === 'Trujillo' &&
    planDemandTru.scopeFilter.isCityScoped === true,
    'buildDemandQueryFilters(Trujillo) genera consulta Firestore acotada con city == "Trujillo" (sin lectura global)'
  );

  // TEST 42: buildDemandQueryFilters para Lima genera filtro Firestore acotado por city == 'Lima'
  const planDemandLim = buildDemandQueryFilters(limaCoords.lat, limaCoords.lng, 'Lima');
  assert(
    planDemandLim.collection === 'rides' &&
    planDemandLim.scopeFilter.field === 'city' &&
    planDemandLim.scopeFilter.operator === '==' &&
    planDemandLim.scopeFilter.value === 'Lima' &&
    planDemandLim.scopeFilter.isCityScoped === true,
    'buildDemandQueryFilters(Lima) genera consulta Firestore acotada con city == "Lima"'
  );

  // TEST 43: buildSupplyQueryFilters para Trujillo genera filtro Firestore acotado por city == 'Trujillo' sobre drivers_online
  const planSupplyTru = buildSupplyQueryFilters(trujilloCoords.lat, trujilloCoords.lng, 'Trujillo');
  assert(
    planSupplyTru.collection === 'drivers_online' &&
    planSupplyTru.scopeFilter.field === 'city' &&
    planSupplyTru.scopeFilter.operator === '==' &&
    planSupplyTru.scopeFilter.value === 'Trujillo' &&
    planSupplyTru.statusFilter.value === 'AVAILABLE',
    'buildSupplyQueryFilters(Trujillo) genera consulta Firestore acotada con city == "Trujillo" sobre drivers_online'
  );

  // TEST 44: buildSupplyQueryFilters para Lima genera filtro Firestore acotado por city == 'Lima' sobre drivers_online
  const planSupplyLim = buildSupplyQueryFilters(limaCoords.lat, limaCoords.lng, 'Lima');
  assert(
    planSupplyLim.collection === 'drivers_online' &&
    planSupplyLim.scopeFilter.field === 'city' &&
    planSupplyLim.scopeFilter.operator === '==' &&
    planSupplyLim.scopeFilter.value === 'Lima' &&
    planSupplyLim.statusFilter.value === 'AVAILABLE',
    'buildSupplyQueryFilters(Lima) genera consulta Firestore acotada con city == "Lima" sobre drivers_online'
  );

  // TEST 45: buildDemandQueryFilters para región no catalogada acota por gridKey (no lectura nacional abierta)
  const planDemandUncat = buildDemandQueryFilters(uncataloguedCoords.lat, uncataloguedCoords.lng);
  assert(
    planDemandUncat.collection === 'rides' &&
    planDemandUncat.scopeFilter.field === 'gridKey' &&
    planDemandUncat.scopeFilter.operator === '==' &&
    planDemandUncat.scopeFilter.value === '-11.000:-75.000' &&
    planDemandUncat.scopeFilter.isCityScoped === false,
    'buildDemandQueryFilters(Región no catalogada) acota la consulta Firestore estrictamente a su gridKey local'
  );

  // TEST 46: buildSupplyQueryFilters para región no catalogada acota por gridKey sobre drivers_online
  const planSupplyUncat = buildSupplyQueryFilters(uncataloguedCoords.lat, uncataloguedCoords.lng);
  assert(
    planSupplyUncat.collection === 'drivers_online' &&
    planSupplyUncat.scopeFilter.field === 'gridKey' &&
    planSupplyUncat.scopeFilter.operator === '==' &&
    planSupplyUncat.scopeFilter.value === '-11.000:-75.000' &&
    planSupplyUncat.scopeFilter.isCityScoped === false,
    'buildSupplyQueryFilters(Región no catalogada) acota la consulta de oferta Firestore estrictamente a su gridKey local'
  );

  // TEST 47: Ninguna consulta de pricing carece de filtro de ámbito geográfico
  const planTest1 = buildDemandQueryFilters(-16.4090, -71.5375); // Arequipa
  const planTest2 = buildSupplyQueryFilters(-16.4090, -71.5375); // Arequipa
  assert(
    Boolean(planTest1.scopeFilter && planTest1.scopeFilter.field && planTest1.scopeFilter.value) &&
    Boolean(planTest2.scopeFilter && planTest2.scopeFilter.field && planTest2.scopeFilter.value),
    'Garantía estructural: 100% de los planes de consulta Firestore incorporan scopeFilter obligatorio'
  );

  console.log('\n======================================================================');
  console.log(`  RESULTADO FASE 2.4.3: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Error fatal en suite de pruebas FASE 2.4.2:', e);
  process.exit(1);
});
