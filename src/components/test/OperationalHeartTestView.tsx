import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { 
  Navigation, 
  MapPin, 
  Car, 
  Compass, 
  Crosshair, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Play, 
  ArrowRight, 
  Check, 
  Zap, 
  Smartphone, 
  Route as RouteIcon,
  Clock,
  Shield,
  Send,
  Sliders,
  ChevronRight,
  Radio,
  Copy,
  Pause,
  RotateCcw,
  Gauge,
  FastForward,
  Package
} from 'lucide-react';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { signInAnonymously } from 'firebase/auth';
import { API_KEY, DARK_MAP_STYLE, hasValidKey } from '../MapContainer';
import {
  OperationStatus,
  OperationRecord,
  createDraftOrder,
  publishOrder,
  acceptOrderAsMotorizado,
  activateOrder,
  finalizeOrder,
  updateOperationTelemetry,
  subscribeToOperations,
  getStoredOrders,
  saveOrdersToStorage
} from '../../services/operationalOrdersService';
import { calculatePricing, PricingResult } from '../../utils/pricingEngine';
import { OperationStatusStepper } from './OperationStatusStepper';
import { VirtualSandboxTestRunner } from './VirtualSandboxTestRunner';
import { DocumentStatus, UserRole } from '../../types';
import ZenithOrderCreationModal from '../delivery/ZenithOrderCreationModal';
import ZenithImperialEagleMarker from '../maps/ZenithImperialEagleMarker';
import CallPhoneButton from '../common/CallPhoneButton';
import {
  DetectedGeoContext,
  PERU_NEUTRAL_CENTER,
  requestCurrentBrowserPosition,
  reverseGeocodeLocation,
  getLastKnownLocation
} from '../../services/geoContextService';

// ============================================================================
// PROTAGONISTAS DE PRUEBA AISLADOS
// ============================================================================
export const TEST_ACTORS = {
  SOLICITANTE: {
    uid: 'test-solicitante-01',
    name: 'Carlos Mendoza (Solicitante TEST)',
    phone: '+51 948 112 233',
    role: 'passenger'
  },
  MOTORIZADO: {
    uid: 'test-motorizado-01',
    name: 'Juan Pérez (Motorizado TEST)',
    phone: '+51 944 556 677',
    plate: 'TR-8899-MOTO',
    vehicleModel: 'Honda GL150 Negra',
    role: 'driver' as const,
    activeRole: 'MOTORIZADO' as const,
    rolesEnabled: ['driver', 'MOTORIZADO'] as (UserRole | 'CLIENTE' | 'MOTORIZADO')[],
    isBlocked: false,
    driverProfile: {
      status: DocumentStatus.APPROVED,
      availability: true,
      rating: 5.0,
      appVersion: '2.4.0-TEST',
      vehicle: {
        category: 'Zenith Standard',
        plate: 'TR-8899-MOTO',
        brand: 'Honda',
        model: 'GL150 Negra',
        year: 2024,
        color: 'Negra'
      },
      documentation: {
        licenseNumber: 'TEST-MTC-01',
        licenseExpiry: '2030-12-31'
      }
    },
    wallet: {
      availableBalance: 100.00,
      digitalBalance: 100.00,
      retainedBalance: 0.00,
      cashDebt: 0.00,
      pendingSettlement: 0.00,
      accumulatedCommission: 0.00,
      dailyEarnings: 0.00,
      weeklyEarnings: 0.00,
      movements: [],
      todaySettlements: 0,
      nextSettlementDate: '2026-10-01T00:00:00.000Z'
    }
  },
  RECEPTOR: {
    uid: 'test-receptor-01',
    name: 'Ana Flores (Receptora TEST)',
    phone: '+51 977 334 455',
    role: 'passenger'
  }
};

// ============================================================================
// DIRECCIONES PREESTABLECIDAS REGIONALES (DEMO / PRUEBAS MULTICIUDAD PERÚ)
// ============================================================================
const DEMO_REGIONAL_PRESETS: Record<string, { label: string; origin: string; destination: string }[]> = {
  'Arequipa': [
    {
      label: 'Plaza de Armas → Cayma',
      origin: 'Plaza de Armas de Arequipa, Perú',
      destination: 'Plaza de Cayma, Arequipa, Perú'
    },
    {
      label: 'Av. Ejército → Mall Porongoche',
      origin: 'Av. Ejército 710, Yanahuara, Arequipa, Perú',
      destination: 'Mall Aventura Porongoche, Arequipa, Perú'
    }
  ],
  'Lima': [
    {
      label: 'Miraflores → San Isidro',
      origin: 'Parque Kennedy, Miraflores, Lima, Perú',
      destination: 'Centro Financiero, San Isidro, Lima, Perú'
    },
    {
      label: 'Plaza Mayor → Jockey Plaza',
      origin: 'Plaza Mayor de Lima, Perú',
      destination: 'Jockey Plaza, Santiago de Surco, Lima, Perú'
    }
  ],
  'Trujillo': [
    {
      label: 'Plaza Mayor → Mall Plaza',
      origin: 'Plaza de Armas de Trujillo, Perú',
      destination: 'Mallplaza Trujillo, Av. Mansiche, Trujillo, Perú'
    },
    {
      label: 'Av. España 123 → Av. Larco 500',
      origin: 'Av. España 123, Trujillo, Perú',
      destination: 'Av. Víctor Larco Herrera 500, Trujillo, Perú'
    }
  ],
  'Interciudad': [
    {
      label: 'Arequipa → Lima (Interprovincial)',
      origin: 'Terminal Terrestre de Arequipa, Perú',
      destination: 'Plaza Mayor de Lima, Perú'
    },
    {
      label: 'Trujillo → Chiclayo (Norte)',
      origin: 'Plaza de Armas de Trujillo, Perú',
      destination: 'Plaza de Armas de Chiclayo, Perú'
    }
  ]
};

export interface TestOperationData {
  id: string;
  isTestOperation: boolean;
  status: 'SEARCHING_DRIVER' | 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED';
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destLat: number;
  destLng: number;
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  polylinePointsCount: number;
  polylinePoints?: { lat: number; lng: number }[];
  driverLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    updatedAt?: string;
  };
  createdAt?: any;
  updatedAt?: any;
}

// ============================================================================
// COMPONENTE AUXILIAR PARA TRAZAR LA POLILÍNEA REAL EN EL MAPA
// ============================================================================
function RealRoutePolylineRenderer({
  pathPoints,
  fitBounds = true
}: {
  pathPoints: google.maps.LatLngLiteral[];
  fitBounds?: boolean;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !window.google || pathPoints.length === 0) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const polyline = new window.google.maps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: '#39FF14',
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: map
    });

    polylineRef.current = polyline;

    if (fitBounds) {
      const bounds = new window.google.maps.LatLngBounds();
      pathPoints.forEach(pt => bounds.extend(pt));
      map.fitBounds(bounds, { top: 70, bottom: 70, left: 50, right: 50 });
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, pathPoints, fitBounds]);

  return null;
}

// ============================================================================
// COMPONENTE AUXILIAR PARA RECENTRAR MAPA DINÁMICAMENTE
// ============================================================================
function MapPanner({ target }: { target: google.maps.LatLngLiteral | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    const currentZoom = map.getZoom();
    if (typeof currentZoom === 'number' && currentZoom < 10) {
      map.setZoom(14);
    }
  }, [map, target]);
  return null;
}

// ============================================================================
// HELPERS MATEMÁTICOS DE RUTA (BEARING & DISTANCIA GEODÉSICA)
// ============================================================================
function getBearing(startLat: number, startLng: number, endLat: number, endLng: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const endLatRad = (endLat * Math.PI) / 180;
  const endLngRad = (endLng * Math.PI) / 180;

  const dLng = endLngRad - startLngRad;
  const y = Math.sin(dLng) * Math.cos(endLatRad);
  const x = Math.cos(startLatRad) * Math.sin(endLatRad) -
            Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

function computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function computeRemainingPolylineDistance(points: google.maps.LatLngLiteral[], currentIndex: number): number {
  if (!points || points.length <= 1 || currentIndex >= points.length - 1) return 0;
  let totalMeters = 0;
  for (let i = currentIndex; i < points.length - 1; i++) {
    totalMeters += computeDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return totalMeters;
}

// ============================================================================
// COMPONENTE PRINCIPAL: MODO PRUEBA DEL CORAZÓN OPERATIVO (FASE 1)
// ============================================================================
export default function OperationalHeartTestView({
  onClose,
  onReturnHome
}: {
  onClose?: () => void;
  onReturnHome?: () => void;
}) {
  // Rol activo para la prueba
  const [activeRole, setActiveRole] = useState<'SOLICITANTE' | 'MOTORIZADO' | 'RECEPTOR' | 'SANDBOX_VIRTUAL'>('SOLICITANTE');

  // Control de finalización idempotente y transición a Home
  const isFinalizingRef = useRef(false);
  const [finalizingOrder, setFinalizingOrder] = useState(false);

  // Estado de inputs para Solicitante (limpios e independientes para permitir libre ingreso en cualquier ciudad del Perú)
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');

  // Contexto Geográfico Dinámico y Ubicación Física del Solicitante (GPS + Reverse Geocoding)
  const [detectedGeoContext, setDetectedGeoContext] = useState<DetectedGeoContext | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetectionStatus, setLocationDetectionStatus] = useState<string>('Detectando ubicación...');
  const [selectedPresetRegion, setSelectedPresetRegion] = useState<string>('Arequipa');

  // Coordenadas obtenidas por Geocoding (inicializadas estrictamente en null hasta que Google devuelva respuesta real)
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // Estados de cálculo de Geocoding y Rutas
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Datos de ruta real calculada
  const [routeData, setRouteData] = useState<{
    distanceText: string;
    durationText: string;
    distanceMeters: number;
    durationSeconds: number;
    polylinePoints: google.maps.LatLngLiteral[];
  } | null>(null);

  // Datos tarifarios DPE V2 calculados
  const [pricingData, setPricingData] = useState<PricingResult | null>(null);

  // Operación activa y sincronización reactiva en tiempo real (BroadcastChannel + LocalStorage + Firestore)
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [currentTestUid, setCurrentTestUid] = useState<string | null>(auth.currentUser?.uid || null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);

  // Limpieza exclusiva de órdenes TEST huérfanas del actor antes de iniciar una nueva prueba
  const cleanOrphanTestOrders = (driverUid: string) => {
    const all = getStoredOrders();
    const cleaned = all.filter(o => {
      const isActorOrder = o.driverId === driverUid || o.driverId === TEST_ACTORS.MOTORIZADO.uid || o.passengerId === TEST_ACTORS.SOLICITANTE.uid;
      return !(isActorOrder && o.status !== 'FINALIZADO');
    });
    if (cleaned.length !== all.length) {
      saveOrdersToStorage(cleaned);
    }
  };

  // Suscripción reactiva multicanal en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeToOperations((ops) => {
      setOperations(ops);
      setActiveOrderId(prev => {
        if (prev && ops.some(o => o.id === prev && o.status !== 'FINALIZADO')) return prev;
        const pendingActive = ops.find(o => o.status !== 'FINALIZADO');
        return pendingActive ? pendingActive.id : null;
      });
    });
    return () => unsubscribe();
  }, []);

  // Orden activa seleccionada para seguimiento (prioriza orden activa seleccionada o pendiente en curso)
  const activeOrder: OperationRecord | null =
    (activeOrderId ? operations.find(o => o.id === activeOrderId) : null) ||
    operations.find(o => o.status !== 'FINALIZADO') ||
    null;

  // Tarifa activa unificada (proveniente del cálculo actual o del pedido persistido)
  const currentPricing = pricingData || (activeOrder?.protectedPrice !== undefined ? {
    totalFare: activeOrder.protectedPrice,
    normalFare: activeOrder.basePrice ?? activeOrder.protectedPrice,
    multiplier: activeOrder.multiplier ?? 1.0,
    marketPressure: activeOrder.marketPressure ?? 1.0,
    distanceSource: 'GOOGLE_DIRECTIONS' as const,
    seal: activeOrder.pricingSeal || ''
  } : null);

  // Pedidos disponibles para aceptar (Estado estricto: PUBLICADO)
  const availableOrders = operations.filter(o => o.status === 'PUBLICADO');

  // Operación del motorizado en curso (estrictamente no finalizada)
  const motorizadoCurrentOrder = operations.find(
    o => (o.status === 'ACEPTADO' || o.status === 'ACTIVO' || o.status === 'ASIGNADO') &&
    (o.driverId === (currentTestUid || TEST_ACTORS.MOTORIZADO.uid) || o.driverId === TEST_ACTORS.MOTORIZADO.uid || o.id === activeOrderId)
  );

  // Estado GPS real del Motorizado
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'REQUESTING' | 'ACTIVE' | 'DENIED' | 'ERROR'>('IDLE');
  const [realMotorizadoLocation, setRealMotorizadoLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    timestamp: string;
  } | null>(null);
  const [gpsUpdatesCount, setGpsUpdatesCount] = useState(0);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  // Estados del Modo Telemetría y Simulador de Ruta (Cockpit DEV)
  const [telemetryMode, setTelemetryMode] = useState<'SIMULATOR' | 'PHYSICAL_GPS'>('SIMULATOR');
  const [simStatus, setSimStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED'>('IDLE');
  const [simCurrentIndex, setSimCurrentIndex] = useState<number>(0);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<1 | 2 | 4>(1);
  const simCurrentIndexRef = useRef<number>(0);
  const simIntervalRef = useRef<any>(null);
  const simHeadingRef = useRef<number>(0);

  // Centro del mapa: dinámico según última ubicación conocida o centro neutral de Perú (sin forzar Trujillo)
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(() => {
    return getLastKnownLocation() || PERU_NEUTRAL_CENTER;
  });
  const [recenterTarget, setRecenterTarget] = useState<google.maps.LatLngLiteral | null>(null);

  // Referencias internas
  const watchIdRef = useRef<number | null>(null);

  // DETECCIÓN DINÁMICA DE UBICACIÓN INICIAL Y REVERSE GEOCODING
  useEffect(() => {
    let isMounted = true;
    setIsDetectingLocation(true);
    setLocationDetectionStatus('Consultando GPS del dispositivo...');

    requestCurrentBrowserPosition()
      .then(async (coords) => {
        if (!isMounted) return;
        // 1. Centrar inicialmente el mapa en la ubicación del usuario
        setMapCenter(coords);
        setRecenterTarget(coords);

        // 2. Ejecutar Reverse Geocoding usando el Google Geocoder existente
        try {
          const geo = await reverseGeocodeLocation(coords.lat, coords.lng);
          if (isMounted) {
            setDetectedGeoContext(geo);
            setLocationDetectionStatus(`Ubicación detectada: ${geo.displayName}`);
            if (geo.city && DEMO_REGIONAL_PRESETS[geo.city]) {
              setSelectedPresetRegion(geo.city);
            } else if (geo.region && DEMO_REGIONAL_PRESETS[geo.region]) {
              setSelectedPresetRegion(geo.region);
            }
          }
        } catch (geoErr: any) {
          if (isMounted) {
            const fallbackGeo: DetectedGeoContext = {
              lat: coords.lat,
              lng: coords.lng,
              formattedAddress: `Lat: ${coords.lat.toFixed(5)}, Lng: ${coords.lng.toFixed(5)}`,
              city: 'Perú',
              region: '',
              country: 'Perú',
              displayName: `Perú (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
              timestamp: Date.now()
            };
            setDetectedGeoContext(fallbackGeo);
            setLocationDetectionStatus('Ubicación fijada por GPS');
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[ZENITH-GEO] Detección GPS omitida o denegada:', err?.message || err);
        const lastKnown = getLastKnownLocation();
        if (lastKnown) {
          setMapCenter(lastKnown);
          setLocationDetectionStatus('Última ubicación conocida cargada');
        } else {
          setMapCenter(PERU_NEUTRAL_CENTER);
          setLocationDetectionStatus('Vista general de Perú (Sin GPS)');
        }
      })
      .finally(() => {
        if (isMounted) setIsDetectingLocation(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Acción Opcional: "Usar mi ubicación actual" como Origen (Punto A)
  const handleUseCurrentLocationAsOrigin = () => {
    if (!detectedGeoContext) {
      setIsDetectingLocation(true);
      requestCurrentBrowserPosition()
        .then(async (coords) => {
          setMapCenter(coords);
          setRecenterTarget(coords);
          const geo = await reverseGeocodeLocation(coords.lat, coords.lng).catch(() => ({
            lat: coords.lat,
            lng: coords.lng,
            formattedAddress: `Ubicación GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
            city: 'Perú',
            region: '',
            country: 'Perú',
            displayName: `Ubicación GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
            timestamp: Date.now()
          }));
          setDetectedGeoContext(geo);
          setOriginInput(geo.formattedAddress);
          setOriginCoords({
            lat: geo.lat,
            lng: geo.lng,
            address: geo.formattedAddress
          });
        })
        .catch(err => {
          alert('No se pudo acceder al GPS de tu navegador: ' + (err?.message || err));
        })
        .finally(() => setIsDetectingLocation(false));
      return;
    }

    setOriginInput(detectedGeoContext.formattedAddress);
    setOriginCoords({
      lat: detectedGeoContext.lat,
      lng: detectedGeoContext.lng,
      address: detectedGeoContext.formattedAddress
    });
    setMapCenter({ lat: detectedGeoContext.lat, lng: detectedGeoContext.lng });
    setRecenterTarget({ lat: detectedGeoContext.lat, lng: detectedGeoContext.lng });
  };

  // Asegurar autenticación real y perfil de prueba homologado en Firestore
  useEffect(() => {
    const initTestAuth = async () => {
      let user = auth.currentUser;
      if (!user) {
        try {
          const cred = await signInAnonymously(auth);
          user = cred.user;
        } catch (err) {
          console.warn('[ZENITH-TEST] Anonymous sign-in warning:', err);
        }
      }

      if (user) {
        setCurrentTestUid(user.uid);

        // Sembrar el perfil homologado documental (KYC APPROVED) y Wallet con saldo para el UID real autenticado
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            role: 'driver',
            activeRole: 'MOTORIZADO',
            fullName: TEST_ACTORS.MOTORIZADO.name,
            phone: TEST_ACTORS.MOTORIZADO.phone,
            isBlocked: false,
            driverProfile: {
              status: DocumentStatus.APPROVED,
              availability: true,
              rating: 5.0,
              appVersion: '2.4.0-TEST',
              vehicle: {
                category: 'Zenith Standard',
                plate: TEST_ACTORS.MOTORIZADO.plate,
                brand: 'Honda',
                model: TEST_ACTORS.MOTORIZADO.vehicleModel,
                year: 2024,
                color: 'Negra'
              },
              documentation: {
                licenseNumber: 'TEST-MTC-01',
                licenseExpiry: '2030-12-31'
              }
            },
            wallet: {
              availableBalance: 100.00,
              digitalBalance: 100.00,
              retainedBalance: 0.00,
              cashDebt: 0.00,
              pendingSettlement: 0.00,
              accumulatedCommission: 0.00,
              dailyEarnings: 0.00,
              weeklyEarnings: 0.00,
              movements: [],
              todaySettlements: 0,
              nextSettlementDate: '2026-10-01T00:00:00.000Z'
            },
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.warn('[ZENITH-TEST] Warning seeding driver profile in Firestore:', err);
        }

        // Limpiar únicamente órdenes TEST huérfanas del actor antes de iniciar una nueva prueba
        cleanOrphanTestOrders(user.uid);
      }
    };

    initTestAuth();
  }, []);

  // Sincronizar posición del motorizado desde la telemetría de la orden activa
  useEffect(() => {
    if (activeOrder?.driverLocation) {
      setRealMotorizadoLocation({
        lat: activeOrder.driverLocation.lat,
        lng: activeOrder.driverLocation.lng,
        accuracy: activeOrder.driverLocation.accuracy || 5,
        speed: activeOrder.driverLocation.speed || 0,
        heading: activeOrder.driverLocation.heading || 0,
        timestamp: activeOrder.driverLocation.updatedAt || new Date().toLocaleTimeString()
      });
      if (simStatus === 'RUNNING') {
        setRecenterTarget({ lat: activeOrder.driverLocation.lat, lng: activeOrder.driverLocation.lng });
      }
    }
  }, [activeOrder?.driverLocation, simStatus]);

  // Limpiar GPS y Simulador al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // PASO 1 & 2: GEOCODIFICACIÓN REAL CON GOOGLE GEOCODER
  // ============================================================================
  const executeRealGeocoding = async () => {
    setIsGeocoding(true);
    setGeocodingError(null);
    setRouteError(null);
    // Limpiar explícitamente cualquier coordenada o ruta previa
    setOriginCoords(null);
    setDestCoords(null);
    setRouteData(null);

    try {
      if (!hasValidKey) {
        throw new Error('API Key de Google Maps no configurada. Configure GOOGLE_MAPS_PLATFORM_KEY con una credencial válida del proyecto gen-lang-client-0838883154.');
      }

      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps JavaScript API aún no está disponible o no se ha inicializado.');
      }

      const geocoder = new window.google.maps.Geocoder();

      // Geocodificar Origen (usa coordenadas de GPS directo si el usuario seleccionó su ubicación)
      let originResult: { lat: number; lng: number; address: string };
      if (originCoords && originCoords.address === originInput) {
        originResult = originCoords;
      } else {
        originResult = await new Promise<{ lat: number; lng: number; address: string }>((resolve, reject) => {
          geocoder.geocode({ address: originInput, componentRestrictions: { country: 'PE' } }, (results, status) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
              resolve({
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng(),
                address: results[0].formatted_address
              });
            } else {
              reject(new Error(`Google Maps Geocoder no pudo localizar el Origen en Perú: ${status}`));
            }
          });
        });
      }

      // Geocodificar Destino
      let destResult: { lat: number; lng: number; address: string };
      if (destCoords && destCoords.address === destInput) {
        destResult = destCoords;
      } else {
        destResult = await new Promise<{ lat: number; lng: number; address: string }>((resolve, reject) => {
          geocoder.geocode({ address: destInput, componentRestrictions: { country: 'PE' } }, (results, status) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
              resolve({
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng(),
                address: results[0].formatted_address
              });
            } else {
              reject(new Error(`Google Maps Geocoder no pudo localizar el Destino en Perú: ${status}`));
            }
          });
        });
      }

      // Solo si ambas consultas resolvieron satisfactoriamente se asignan las coordenadas reales
      setOriginCoords(originResult);
      setDestCoords(destResult);
      setMapCenter({ lat: originResult.lat, lng: originResult.lng });

      // Inmediatamente calcular la ruta oficial entre A y B
      await calculateRealRoute(originResult, destResult);

    } catch (err: any) {
      console.error('[ZENITH-GEOCODING] Error:', err);
      // Garantizar que no quede evidencia residual ante cualquier error
      setOriginCoords(null);
      setDestCoords(null);
      setRouteData(null);
      setGeocodingError(err.message || 'Error durante la geocodificación.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // ============================================================================
  // PASO 3: CÁLCULO DE RUTA Y POLILÍNEA REAL CON GOOGLE DIRECTIONS SERVICE
  // ============================================================================
  const calculateRealRoute = async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) => {
    setIsCalculatingRoute(true);
    setRouteError(null);
    setRouteData(null);

    try {
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps API no está disponible.');
      }

      const directionsService = new window.google.maps.DirectionsService();

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(
          {
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            travelMode: window.google.maps.TravelMode.DRIVING
          },
          (res, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && res) {
              resolve(res);
            } else {
              reject(new Error(`Google Maps Directions rechazó la ruta: ${status}`));
            }
          }
        );
      });

      const primaryRoute = result.routes[0];
      const leg = primaryRoute.legs[0];

      // Extraer todos los puntos de la polilínea real siguiendo las calles
      const pathPoints: google.maps.LatLngLiteral[] = [];
      if (primaryRoute.overview_path && primaryRoute.overview_path.length > 0) {
        primaryRoute.overview_path.forEach(pt => {
          pathPoints.push({ lat: pt.lat(), lng: pt.lng() });
        });
      } else {
        leg.steps.forEach(step => {
          step.path.forEach(pt => {
            pathPoints.push({ lat: pt.lat(), lng: pt.lng() });
          });
        });
      }

      const calculatedData = {
        distanceText: leg.distance?.text || '0 km',
        durationText: leg.duration?.text || '0 min',
        distanceMeters: leg.distance?.value || 0,
        durationSeconds: leg.duration?.value || 0,
        polylinePoints: pathPoints
      };

      setRouteData(calculatedData);

      // CÁLCULO TARIFARIO DPE V2 SOBRE DISTANCIA VIAL GOOGLE
      const distanceKm = calculatedData.distanceMeters / 1000;
      const durationMin = calculatedData.durationSeconds / 60;
      const originAddr = originCoords?.address || originInput || 'Origen de la Operación';
      const destAddr = destCoords?.address || destInput || 'Destino de la Operación';

      const pricing = calculatePricing(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        originAddr,
        destAddr,
        {
          distanceKm,
          durationMin,
          distanceSource: 'GOOGLE_DIRECTIONS'
        }
      );
      setPricingData(pricing);

      // PASO 1 OPERATIVO: Crear automáticamente el borrador en estado CREADO con tarifa inmutable protegida
      const draft = createDraftOrder({
        originAddress: originAddr,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationAddress: destAddr,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceText: calculatedData.distanceText,
        durationText: calculatedData.durationText,
        distanceMeters: calculatedData.distanceMeters,
        durationSeconds: calculatedData.durationSeconds,
        polylinePoints: calculatedData.polylinePoints,
        // DPE V2
        protectedPrice: pricing.totalFare,
        finalPrice: pricing.totalFare,
        pricingSeal: pricing.seal,
        pricingVersion: pricing.pricingVersion,
        basePrice: pricing.normalFare,
        multiplier: pricing.multiplier,
        marketPressure: pricing.marketPressure,
        currency: 'PEN'
      });
      setActiveOrderId(draft.id);
    } catch (err: any) {
      console.error('[ZENITH-ROUTES] Error calculando ruta:', err);
      setRouteError(err.message || 'Error en el cálculo de la ruta.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // ============================================================================
  // PASO 4: PUBLICACIÓN DEL PEDIDO (CREADO -> PUBLICADO)
  // ============================================================================
  const handlePublishOrder = async () => {
    if (!activeOrder) {
      alert('Debes geocodificar y calcular la ruta antes de publicar.');
      return;
    }

    setCreatingOrder(true);
    setOrderCreatedSuccess(false);

    try {
      // Limpiar únicamente órdenes TEST huérfanas del actor antes de publicar una nueva prueba
      const driverUid = auth.currentUser?.uid || currentTestUid || TEST_ACTORS.MOTORIZADO.uid;
      cleanOrphanTestOrders(driverUid);

      const published = await publishOrder(activeOrder.id);
      setActiveOrderId(published.id);
      setOrderCreatedSuccess(true);
    } catch (err: any) {
      console.error('[ZENITH-TEST] Error publicando pedido:', err);
      alert(err.message || 'Error al publicar el pedido.');
    } finally {
      setCreatingOrder(false);
    }
  };

  // ============================================================================
  // PASO 5: MOTORIZADO ACEPTA EL PEDIDO (PUBLICADO -> ASIGNADO -> ACEPTADO)
  // ============================================================================
  const handleAcceptOrder = async (orderId: string) => {
    const driverUid = auth.currentUser?.uid || currentTestUid || TEST_ACTORS.MOTORIZADO.uid;
    try {
      const accepted = await acceptOrderAsMotorizado(orderId, {
        driverId: driverUid,
        driverName: TEST_ACTORS.MOTORIZADO.name,
        driverPhone: TEST_ACTORS.MOTORIZADO.phone,
        driverPlate: TEST_ACTORS.MOTORIZADO.plate,
        driverVehicle: `${TEST_ACTORS.MOTORIZADO.vehicleModel}`,
        userProfile: {
          uid: driverUid,
          activeRole: 'MOTORIZADO',
          role: UserRole.DRIVER,
          driverProfile: {
            status: DocumentStatus.APPROVED,
            availability: true,
            rating: 5.0,
            appVersion: '2.4.0-TEST',
            vehicle: {
              category: 'Zenith Standard',
              plate: TEST_ACTORS.MOTORIZADO.plate,
              brand: 'Honda',
              model: TEST_ACTORS.MOTORIZADO.vehicleModel,
              year: 2024,
              color: 'Negra'
            },
            documentation: {
              licenseNumber: 'TEST-MTC-01',
              licenseExpiry: '2030-12-31'
            }
          } as any,
          wallet: {
            availableBalance: 100.00,
            digitalBalance: 100.00,
            retainedBalance: 0.00,
            cashDebt: 0.00,
            pendingSettlement: 0.00,
            accumulatedCommission: 0.00,
            dailyEarnings: 0.00,
            weeklyEarnings: 0.00,
            movements: [],
            todaySettlements: 0,
            nextSettlementDate: '2026-10-01T00:00:00.000Z'
          }
        }
      });
      setActiveOrderId(accepted.id);
    } catch (err: any) {
      console.error('[ZENITH-TEST] Error aceptando orden:', err);
      alert(err.message || 'Error al aceptar la orden.');
    }
  };

  // ============================================================================
  // PASO 6: MOTORIZADO PONE EN MARCHA (ACEPTADO -> ACTIVO)
  // ============================================================================
  const handleActivateOrder = async (orderId: string) => {
    try {
      const activated = await activateOrder(orderId);
      setActiveOrderId(activated.id);
      // Iniciar el rastreo GPS físico inmediatamente
      startRealDeviceGPS();
    } catch (err: any) {
      console.error('[ZENITH-TEST] Error activando orden:', err);
      alert(err.message || 'Error al activar la orden.');
    }
  };

  // ============================================================================
  // PASO 7: CIERRE OPERACIONAL (ACTIVO -> FINALIZADO -> HOME)
  // ============================================================================
  const handleFinalizeOrder = async (orderId: string) => {
    if (isFinalizingRef.current) return;
    try {
      isFinalizingRef.current = true;
      setFinalizingOrder(true);

      // Detener simulación si está corriendo
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      // Detener telemetría de GPS físico
      stopRealDeviceGPS();
      setSimStatus('COMPLETED');

      // Actualizar telemetría final en 0 si hay puntos disponibles
      if (routeData?.polylinePoints && routeData.polylinePoints.length > 0) {
        const lastPt = routeData.polylinePoints[routeData.polylinePoints.length - 1];
        updateOperationTelemetry(orderId, {
          lat: lastPt.lat,
          lng: lastPt.lng,
          accuracy: 2.0,
          speed: 0,
          heading: simHeadingRef.current || 0
        });
      }

      await finalizeOrder(orderId);
      setActiveOrderId(null);

      // Regresar al Home tras confirmación visual de persistencia
      setTimeout(() => {
        isFinalizingRef.current = false;
        setFinalizingOrder(false);
        if (onReturnHome) {
          onReturnHome();
        } else if (onClose) {
          onClose();
        }
      }, 1200);
    } catch (err: any) {
      console.error('[ZENITH-TEST] Error al finalizar orden:', err);
      isFinalizingRef.current = false;
      setFinalizingOrder(false);
      alert(err.message || 'Error al finalizar la orden.');
    }
  };

  // ============================================================================
  // PASO 6: OBTENCIÓN DE GPS REAL DEL DISPOSITIVO FÍSICO
  // ============================================================================
  const startRealDeviceGPS = () => {
    // REGLA 3: Exclusión mutua con el simulador de ruta
    stopRouteSimulation();

    if (!navigator.geolocation) {
      setGpsStatus('ERROR');
      setGpsErrorMessage('La geolocalización no está soportada en este navegador.');
      return;
    }

    setGpsStatus('REQUESTING');
    setGpsErrorMessage(null);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const speed = position.coords.speed;
        const heading = position.coords.heading;
        const timeStr = new Date().toLocaleTimeString();

        setGpsStatus('ACTIVE');
        setGpsUpdatesCount(prev => prev + 1);

        const newLoc = {
          lat,
          lng,
          accuracy,
          speed,
          heading,
          timestamp: timeStr
        };

        setRealMotorizadoLocation(newLoc);
        setRecenterTarget({ lat, lng });

        // Enviar telemetría en vivo mediante el servicio operativo
        if (activeOrder?.id) {
          updateOperationTelemetry(activeOrder.id, {
            lat,
            lng,
            accuracy,
            speed: speed || 0,
            heading: heading || 0
          });
        }
      },
      (error) => {
        console.error('[ZENITH-GPS] Error en watchPosition:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('DENIED');
          setGpsErrorMessage('Permiso de ubicación denegado. Habilita el GPS en tu navegador o teléfono.');
        } else {
          setGpsStatus('ERROR');
          setGpsErrorMessage(`Error GPS: ${error.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Detener GPS
  const stopRealDeviceGPS = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setGpsStatus('IDLE');
    }
  };

  // Forzar una sola lectura de GPS inmediatamente
  const forceSingleGpsReading = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const timeStr = new Date().toLocaleTimeString();

        setGpsStatus('ACTIVE');
        setGpsUpdatesCount(prev => prev + 1);
        const newLoc = {
          lat,
          lng,
          accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: timeStr
        };
        setRealMotorizadoLocation(newLoc);
        setRecenterTarget({ lat, lng });

        if (activeOrder?.id) {
          updateOperationTelemetry(activeOrder.id, {
            lat,
            lng,
            accuracy,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0
          });
        }
      },
      (err) => {
        alert(`Error al forzar GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // ============================================================================
  // PASO 7: MOTOR DE SIMULACIÓN DE RUTA (COCKPIT DEV)
  // Recorre activeOrder.polylinePoints e inyecta telemetría real en updateOperationTelemetry
  // ============================================================================
  const stopRouteSimulation = (resetToIdle = false) => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (resetToIdle) {
      simCurrentIndexRef.current = 0;
      setSimCurrentIndex(0);
      setSimStatus('IDLE');
    } else if (simStatus === 'RUNNING') {
      setSimStatus('PAUSED');
    }
  };

  const startRouteSimulation = (fromIndex?: number, speed?: 1 | 2 | 4) => {
    // REGLA 3: Mutuamente excluyente con el GPS físico
    stopRealDeviceGPS();

    const points = (activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0)
      ? activeOrder.polylinePoints
      : (routeData?.polylinePoints || []);

    if (points.length === 0) {
      alert('Debes calcular y publicar una ruta antes de iniciar el simulador.');
      return;
    }

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    const currentMultiplier = speed ?? simSpeedMultiplier;
    const startIndex = fromIndex !== undefined ? fromIndex : simCurrentIndexRef.current;

    simCurrentIndexRef.current = startIndex;
    setSimCurrentIndex(startIndex);
    setSimStatus('RUNNING');

    // Emisión inmediata de telemetría para el punto inicial
    const initialPt = points[startIndex];
    const nextPt = startIndex < points.length - 1 ? points[startIndex + 1] : initialPt;
    const initialHeading = getBearing(initialPt.lat, initialPt.lng, nextPt.lat, nextPt.lng);
    simHeadingRef.current = initialHeading;

    if (activeOrder?.id) {
      updateOperationTelemetry(activeOrder.id, {
        lat: initialPt.lat,
        lng: initialPt.lng,
        accuracy: 3.0,
        speed: Math.round(25 * currentMultiplier),
        heading: initialHeading
      });
    }

    const stepIntervalMs = Math.round(1000 / currentMultiplier);

    simIntervalRef.current = setInterval(() => {
      const curIdx = simCurrentIndexRef.current;
      const nextIdx = curIdx + 1;

      if (nextIdx >= points.length) {
        // Llegada a destino (Punto N-1)
        if (simIntervalRef.current) {
          clearInterval(simIntervalRef.current);
          simIntervalRef.current = null;
        }

        // 1. Conservar coordenada final y heading con velocidad = 0
        const lastPt = points[points.length - 1];
        const targetOrderId = activeOrder?.id;
        if (targetOrderId) {
          updateOperationTelemetry(targetOrderId, {
            lat: lastPt.lat,
            lng: lastPt.lng,
            accuracy: 2.0,
            speed: 0,
            heading: simHeadingRef.current || 0
          });
        }

        // 2. Detener telemetría de GPS físico si estuviese corriendo
        stopRealDeviceGPS();

        // 3. Actualizar estado de simulación a COMPLETED
        setSimStatus('COMPLETED');

        // 4. Ejecutar cierre operacional oficial (finalizeOrder)
        if (targetOrderId && !isFinalizingRef.current) {
          isFinalizingRef.current = true;
          setFinalizingOrder(true);
          finalizeOrder(targetOrderId)
            .then(() => {
              // 5. Limpieza de contexto activo
              setActiveOrderId(null);

              // 6. Retorno al Home del Motorizado tras confirmación
              setTimeout(() => {
                isFinalizingRef.current = false;
                setFinalizingOrder(false);
                if (onReturnHome) {
                  onReturnHome();
                } else if (onClose) {
                  onClose();
                }
              }, 1200);
            })
            .catch((err) => {
              console.error('[ZENITH-OPERATIONAL] Error al finalizar orden al arribo:', err);
              isFinalizingRef.current = false;
              setFinalizingOrder(false);
            });
        }

        return;
      }

      // Avanzar al siguiente punto de la polilínea
      simCurrentIndexRef.current = nextIdx;
      setSimCurrentIndex(nextIdx);

      const curPt = points[nextIdx];
      const subsequentPt = nextIdx < points.length - 1 ? points[nextIdx + 1] : curPt;
      const heading = getBearing(curPt.lat, curPt.lng, subsequentPt.lat, subsequentPt.lng);
      simHeadingRef.current = heading;

      const segDistance = computeDistance(curPt.lat, curPt.lng, subsequentPt.lat, subsequentPt.lng);
      const computedSpeedKmh = Math.min(65, Math.max(18, Math.round((segDistance / (stepIntervalMs / 1000)) * 3.6)));

      // REGLA 5: Toda posición simulada debe pasar por updateOperationTelemetry
      if (activeOrder?.id) {
        updateOperationTelemetry(activeOrder.id, {
          lat: curPt.lat,
          lng: curPt.lng,
          accuracy: 3.0,
          speed: computedSpeedKmh,
          heading
        });
      }
    }, stepIntervalMs);
  };

  const handlePauseSimulation = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setSimStatus('PAUSED');
  };

  const handleResumeSimulation = () => {
    startRouteSimulation(simCurrentIndexRef.current, simSpeedMultiplier);
  };

  const handleRestartSimulation = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    simCurrentIndexRef.current = 0;
    setSimCurrentIndex(0);
    setSimStatus('IDLE');

    const points = (activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0)
      ? activeOrder.polylinePoints
      : (routeData?.polylinePoints || []);

    if (points.length > 0 && activeOrder?.id) {
      const p0 = points[0];
      const p1 = points[1] || p0;
      const heading = getBearing(p0.lat, p0.lng, p1.lat, p1.lng);
      updateOperationTelemetry(activeOrder.id, {
        lat: p0.lat,
        lng: p0.lng,
        accuracy: 3.0,
        speed: 0,
        heading
      });
    }
  };

  const handleChangeSpeed = (speed: 1 | 2 | 4) => {
    setSimSpeedMultiplier(speed);
    if (simStatus === 'RUNNING') {
      startRouteSimulation(simCurrentIndexRef.current, speed);
    }
  };

  // Marcadores combinados para el mapa
  const mapMarkers = [
    ...(originCoords ? [{ id: 'A', position: { lat: originCoords.lat, lng: originCoords.lng }, title: 'Punto A: Origen', type: 'ORIGIN' }] : []),
    ...(destCoords ? [{ id: 'B', position: { lat: destCoords.lat, lng: destCoords.lng }, title: 'Punto B: Destino', type: 'DESTINATION' }] : []),
    ...(realMotorizadoLocation ? [{ id: 'MOTORIZADO', position: { lat: realMotorizadoLocation.lat, lng: realMotorizadoLocation.lng }, title: 'Motorizado Real', type: 'MOTORIZADO' }] : [])
  ];

  return (
    <div className="w-full bg-[#0a0a0a] text-white rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
      {/* ==================================================================== */}
      {/* HEADER SUPERIOR: MODO PRUEBAS CORAZÓN OPERATIVO */}
      {/* ==================================================================== */}
      <div className="bg-black/80 border-b border-white/10 p-4 sm:p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/40 flex items-center justify-center text-[#39FF14]">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-[#39FF14] text-black px-2 py-0.5 rounded">
                  FASE 1
                </span>
                <span className="text-[10px] font-mono text-[#39FF14] uppercase tracking-widest">
                  Prueba del Corazón Operativo
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                Zénith Core Engine // Demo Real
              </h2>
            </div>
          </div>

          {/* Selector de Rol de Prueba */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl gap-1">
            <button
              onClick={() => setActiveRole('SOLICITANTE')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all ${
                activeRole === 'SOLICITANTE'
                  ? 'bg-[#39FF14] text-black shadow-glow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone size={14} />
              <span>Solicitante</span>
            </button>
            <button
              onClick={() => setActiveRole('MOTORIZADO')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all ${
                activeRole === 'MOTORIZADO'
                  ? 'bg-[#39FF14] text-black shadow-glow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Car size={14} />
              <span>Motorizado</span>
            </button>
            <button
              onClick={() => setActiveRole('RECEPTOR')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all ${
                activeRole === 'RECEPTOR'
                  ? 'bg-[#39FF14] text-black shadow-glow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shield size={14} />
              <span>Receptor</span>
            </button>
            <button
              onClick={() => setActiveRole('SANDBOX_VIRTUAL')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all ${
                activeRole === 'SANDBOX_VIRTUAL'
                  ? 'bg-purple-500 text-white shadow-glow'
                  : 'text-purple-300/70 hover:text-purple-200'
              }`}
            >
              <Zap size={14} />
              <span>Sandbox Virtual</span>
            </button>
          </div>
        </div>

        {/* Barra de Estado del Hardware y APIs */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-gray-400">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${hasValidKey ? 'bg-[#39FF14]' : 'bg-red-500'}`}></span>
              <span>Google Maps API: {hasValidKey ? 'CONECTADO' : 'SIN LLAVE'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gpsStatus === 'ACTIVE' ? 'bg-[#39FF14] animate-ping' : gpsStatus === 'ERROR' || gpsStatus === 'DENIED' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
              <span>GPS Físico: {gpsStatus}</span>
            </div>
            {activeOrder && (
              <div className="flex items-center gap-1.5 text-[#39FF14]">
                <Radio size={12} className="animate-pulse" />
                <span>Operación: {activeOrder.id} ({activeOrder.status})</span>
              </div>
            )}
          </div>

          <div className="text-gray-500 text-[10px]">
            {activeRole === 'SOLICITANTE' && 'Modo Solicitante: Crea pedido con nombres de calles y observa la ruta.'}
            {activeRole === 'MOTORIZADO' && 'Modo Motorizado: Acepta pedido y transmite posición GPS real con tu teléfono.'}
            {activeRole === 'RECEPTOR' && 'Modo Receptor: Visualiza la custodia y aproximación en tiempo real.'}
          </div>
        </div>
      </div>

      {/* STEPPER DE ESTADOS OPERATIVOS REALES */}
      <div className="px-4 sm:px-6 pt-4">
        <OperationStatusStepper currentStatus={activeOrder ? activeOrder.status : 'CREADO'} />
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ==================================================================== */}
        {/* COLUMNA IZQUIERDA: CONTROLES OPERATIVOS SEGÚN EL ROL */}
        {/* ==================================================================== */}
        <div className="lg:col-span-5 space-y-6">

          {/* ------------------------------------------------------------------ */}
          {/* VISTA DEL SOLICITANTE */}
          {/* ------------------------------------------------------------------ */}
          {activeRole === 'SOLICITANTE' && (
            <div className="space-y-6">
              {/* Contexto Geográfico Detectado (GPS + Reverse Geocoding) */}
              <div className="bg-black/60 border border-white/10 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crosshair size={16} className={isDetectingLocation ? 'text-[#39FF14] animate-spin' : 'text-[#39FF14]'} />
                    <span className="text-[11px] font-mono text-[#39FF14] uppercase tracking-wider font-bold">
                      Contexto Geográfico del Dispositivo
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                    {detectedGeoContext?.city || 'Perú'}
                  </span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                    Ubicación Actual Detectada
                  </div>
                  <div className="text-xs font-mono text-white truncate font-bold">
                    {detectedGeoContext ? detectedGeoContext.formattedAddress : locationDetectionStatus}
                  </div>
                  {detectedGeoContext && (
                    <div className="text-[10px] font-mono text-gray-500">
                      Coordenadas: {detectedGeoContext.lat.toFixed(5)}, {detectedGeoContext.lng.toFixed(5)} • {detectedGeoContext.displayName}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocationAsOrigin}
                    disabled={isDetectingLocation}
                    className="flex-1 bg-white/10 hover:bg-[#39FF14]/20 border border-white/10 hover:border-[#39FF14]/40 py-2 px-3 rounded-xl font-mono text-[11px] font-bold text-white hover:text-[#39FF14] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Navigation size={13} className="text-[#39FF14]" />
                    <span>Usar mi ubicación actual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (detectedGeoContext) {
                        setMapCenter({ lat: detectedGeoContext.lat, lng: detectedGeoContext.lng });
                        setRecenterTarget({ lat: detectedGeoContext.lat, lng: detectedGeoContext.lng });
                      }
                    }}
                    title="Centrar mapa en mi posición"
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Crosshair size={15} />
                  </button>
                </div>

                <p className="text-[10px] font-mono text-gray-500 leading-tight">
                  Nota: Tu ubicación física actúa como contexto. Puedes ingresar libremente cualquier origen y destino en cualquier ciudad o departamento del Perú.
                </p>
              </div>

              {/* Notificación Reactiva Inmediata: Pedido Creado y Publicado */}
              {activeOrder && activeOrder.status === 'PUBLICADO' && (
                <div className="p-4 bg-yellow-500/15 border border-yellow-500/50 rounded-2xl space-y-3 shadow-glow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono text-yellow-400 font-bold">
                      <Radio size={16} className="animate-pulse" />
                      <span>¡OPERACIÓN ZÉNITH PUBLICADA EN RED!</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-black">
                      PUBLICADO
                    </span>
                  </div>
                  <div className="bg-black/60 p-3 rounded-xl border border-white/5 space-y-1.5 text-xs font-mono text-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">ID Operación:</span>
                      <strong className="text-white bg-white/10 px-2 py-0.5 rounded">{activeOrder.id}</strong>
                    </div>
                    <div><span className="text-gray-500">Recojo:</span> {activeOrder.originAddress}</div>
                    <div><span className="text-gray-500">Entrega:</span> {activeOrder.destinationAddress}</div>
                    <div className="flex justify-between items-center pt-1 border-t border-white/5">
                      <span className="text-gray-500">Tarifa Protegida:</span>
                      <strong className="text-[#39FF14] text-sm">S/ {(activeOrder.protectedPrice || 0).toFixed(2)}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] font-mono text-gray-300">
                    El pedido está disponible para los motorizados en <strong>PEDIDOS DISPONIBLES EN RED</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveRole('MOTORIZADO')}
                    className="w-full bg-[#39FF14] hover:bg-[#32e012] text-black py-3 rounded-xl text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all cursor-pointer"
                  >
                    <span>Pasar a vista de Motorizado para Aceptar Pedido</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Formulario Completo de Entrega Modal */}
              <button
                type="button"
                onClick={() => setShowCreationModal(true)}
                className="w-full bg-[#39FF14]/15 hover:bg-[#39FF14]/25 border border-[#39FF14]/40 text-[#39FF14] py-3.5 px-4 rounded-2xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all cursor-pointer"
              >
                <Package size={16} />
                <span>Formulario Completo de Operación Zénith</span>
                <ChevronRight size={14} />
              </button>

              {/* Presets Rápidos Regionales (Demostración Multiciudad Perú) */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-white uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <Zap size={14} className="text-[#39FF14]" />
                    Atajos Rápidos de Prueba (Perú)
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">Demo 1-Clic</span>
                </div>

                {/* Filtro Regional para Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {Object.keys(DEMO_REGIONAL_PRESETS).map((regionKey) => (
                    <button
                      key={regionKey}
                      type="button"
                      onClick={() => setSelectedPresetRegion(regionKey)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                        selectedPresetRegion === regionKey
                          ? 'bg-[#39FF14] text-black font-bold shadow-glow'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {regionKey}
                    </button>
                  ))}
                </div>

                {/* Lista de Atajos de la Región Seleccionada */}
                <div className="flex flex-col gap-2">
                  {(DEMO_REGIONAL_PRESETS[selectedPresetRegion] || []).map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setOriginInput(p.origin);
                        setDestInput(p.destination);
                        setOriginCoords(null);
                        setDestCoords(null);
                        setRouteData(null);
                        setGeocodingError(null);
                        setRouteError(null);
                      }}
                      className="text-left text-xs font-mono p-2.5 rounded-xl bg-black/40 hover:bg-[#39FF14]/10 border border-white/5 hover:border-[#39FF14]/30 transition-all text-gray-300 hover:text-white truncate flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{p.label}</span>
                      <ChevronRight size={14} className="text-gray-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Formulario de Direcciones de Calles */}
              <div className="bg-black/60 border border-white/10 p-5 rounded-2xl space-y-4">
                <div className="border-b border-white/5 pb-3">
                  <h3 className="text-sm font-mono uppercase font-bold text-white flex items-center gap-2">
                    <MapPin size={16} className="text-[#39FF14]" />
                    Puntos de la Operación (Nombres de Calles)
                  </h3>
                  <p className="text-[11px] font-mono text-gray-400 mt-1">
                    Introduce las direcciones sin necesidad de conocer coordenadas.
                  </p>
                </div>

                {/* Input Origen */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#39FF14] text-black font-black text-[10px] flex items-center justify-center">A</span>
                      Dirección de Origen
                    </label>
                    {detectedGeoContext && (
                      <button
                        type="button"
                        onClick={handleUseCurrentLocationAsOrigin}
                        className="text-[10px] font-mono text-[#39FF14] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation size={10} />
                        Usar mi ubicación
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={originInput}
                    onChange={(e) => setOriginInput(e.target.value)}
                    placeholder="Ej. Calle Mercaderes 140, Arequipa o Av. Javier Prado 1000, Lima"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* Input Destino */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-white text-black font-black text-[10px] flex items-center justify-center">B</span>
                    Dirección de Destino
                  </label>
                  <input
                    type="text"
                    value={destInput}
                    onChange={(e) => setDestInput(e.target.value)}
                    placeholder="Ej. Plaza Mayor de Lima o Av. Larco 500, Trujillo"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* Botón de Geocodificación y Ruta */}
                <button
                  onClick={executeRealGeocoding}
                  disabled={isGeocoding || isCalculatingRoute}
                  className="w-full bg-[#39FF14] text-black hover:bg-[#32e012] disabled:opacity-50 py-3.5 px-4 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all"
                >
                  {isGeocoding || isCalculatingRoute ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Consultando Google Maps...</span>
                    </>
                  ) : (
                    <>
                      <RouteIcon size={16} />
                      <span>Geocodificar y Trazar Ruta Real</span>
                    </>
                  )}
                </button>

                {geocodingError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{geocodingError}</span>
                  </div>
                )}
              </div>

              {/* Panel de Coordenadas Obtenidas - Solo visible si AMBOS puntos fueron realmente obtenidos por Google */}
              {originCoords && destCoords && (
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-mono uppercase font-bold text-gray-300">
                      Coordenadas Reales Obtenidas
                    </h4>
                    <span className="text-[10px] font-mono text-[#39FF14] bg-[#39FF14]/10 px-2 py-0.5 rounded">
                      Google Geocoder: Respuesta Exitosa
                    </span>
                  </div>

                  {originCoords && (
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono">
                      <div className="flex items-center gap-2 text-[#39FF14] font-bold mb-1">
                        <MapPin size={14} />
                        <span>Punto A (Origen)</span>
                      </div>
                      <p className="text-[11px] text-gray-300 truncate mb-2">{originCoords.address}</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 bg-white/5 p-2 rounded-lg">
                        <div><span className="text-gray-500">Lat:</span> {originCoords.lat.toFixed(6)}</div>
                        <div><span className="text-gray-500">Lng:</span> {originCoords.lng.toFixed(6)}</div>
                      </div>
                    </div>
                  )}

                  {destCoords && (
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono">
                      <div className="flex items-center gap-2 text-white font-bold mb-1">
                        <Navigation size={14} />
                        <span>Punto B (Destino)</span>
                      </div>
                      <p className="text-[11px] text-gray-300 truncate mb-2">{destCoords.address}</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 bg-white/5 p-2 rounded-lg">
                        <div><span className="text-gray-500">Lat:</span> {destCoords.lat.toFixed(6)}</div>
                        <div><span className="text-gray-500">Lng:</span> {destCoords.lng.toFixed(6)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Métricas de la Ruta y Creación de Pedido */}
              {routeData && (
                <div className="bg-black/80 border border-[#39FF14]/30 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#39FF14] font-bold uppercase tracking-wider">
                      Ruta Validada por Google
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                      {routeData.polylinePoints.length} Puntos de Polilínea
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] font-mono text-gray-500 uppercase">Distancia Real</div>
                      <div className="text-xl font-black font-mono text-white mt-0.5">{routeData.distanceText}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] font-mono text-gray-500 uppercase">Tiempo Estimado</div>
                      <div className="text-xl font-black font-mono text-[#39FF14] mt-0.5">{routeData.durationText}</div>
                    </div>
                  </div>

                  {/* Tarjeta de Tarifa ZÉNITH (DPE V2) */}
                  {currentPricing && (
                    <div className="bg-black/90 border border-[#39FF14]/40 p-4 rounded-xl space-y-3 shadow-glow">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-[#39FF14] animate-pulse" />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                            TARIFA ZÉNITH
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/30 px-2 py-0.5 rounded font-bold uppercase">
                          DPE V2 · {currentPricing.distanceSource === 'GOOGLE_DIRECTIONS' ? 'Ruta Vial' : 'Geodésica'}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">
                            Precio Final
                          </span>
                          <div className="text-3xl font-black font-mono text-[#39FF14] tracking-tight">
                            S/ {currentPricing.totalFare.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right space-y-0.5 font-mono text-[11px]">
                          <div className="text-gray-400">
                            Tarifa normal: <strong className="text-white">S/ {currentPricing.normalFare.toFixed(2)}</strong>
                          </div>
                          <div className="text-gray-400">
                            Multiplicador: <strong className="text-[#39FF14]">×{currentPricing.multiplier.toFixed(2)}</strong>
                          </div>
                          <div className="text-gray-500 text-[10px]">
                            Presión mercado: {currentPricing.marketPressure.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {currentPricing.seal && (
                        <div className="p-2 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between text-[9px] font-mono text-gray-400">
                          <span className="truncate max-w-[200px]">SELLO: {currentPricing.seal}</span>
                          <span className="text-[#39FF14] font-bold">PROTEGIDO</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handlePublishOrder}
                    disabled={creatingOrder || activeOrder?.status !== 'CREADO'}
                    className={`w-full py-4 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all ${
                      activeOrder?.status === 'CREADO'
                        ? 'bg-[#39FF14] text-black hover:bg-[#32e012]'
                        : 'bg-white/10 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {creatingOrder ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    <span>
                      {activeOrder?.status === 'CREADO'
                        ? 'Publicar Pedido a la Red (PUBLICADO)'
                        : `Pedido en estado: ${activeOrder?.status || 'SIN ESTADO'}`}
                    </span>
                  </button>

                  {/* Notificaciones reactivas para el Solicitante según el estado de la orden */}
                  {activeOrder?.status === 'PUBLICADO' && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/40 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-yellow-400 font-bold">
                        <Radio size={16} className="animate-pulse" />
                        <span>¡Pedido publicado y visible para motorizados!</span>
                      </div>
                      <p className="text-[11px] font-mono text-gray-300">
                        ID: <strong className="text-white">{activeOrder.id}</strong> — Esperando que un motorizado lo acepte.
                      </p>
                      <button
                        onClick={() => setActiveRole('MOTORIZADO')}
                        className="w-full bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                      >
                        <span>Pasar a vista de Motorizado para aceptar</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  {(activeOrder?.status === 'ASIGNADO' || activeOrder?.status === 'ACEPTADO' || activeOrder?.status === 'ACTIVO') && (
                    <div className="p-4 bg-[#39FF14]/10 border border-[#39FF14]/40 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-[#39FF14] font-bold">
                        <CheckCircle2 size={16} />
                        <span>¡Pedido aceptado por el motorizado!</span>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg text-[11px] font-mono space-y-1 text-gray-300 border border-white/5">
                        <div><span className="text-gray-500">Conductor:</span> <strong className="text-white">{activeOrder.driverName}</strong></div>
                        <div><span className="text-gray-500">Placa:</span> <strong className="text-[#39FF14]">{activeOrder.driverPlate}</strong></div>
                        <div><span className="text-gray-500">Teléfono:</span> {activeOrder.driverPhone || 'No registrado'}</div>
                        <div><span className="text-gray-500">Vehículo:</span> {activeOrder.driverVehicle}</div>
                        <div><span className="text-gray-500">Estado de Operación:</span> <strong className="text-[#39FF14]">{activeOrder.status}</strong></div>
                        <div className="pt-2 flex items-center justify-between border-t border-white/5">
                          <span className="text-[10px] text-gray-400">Contacto Directo:</span>
                          <CallPhoneButton phone={activeOrder.driverPhone} recipientLabel="Motorizado" size="sm" />
                        </div>
                      </div>
                      <p className="text-[11px] font-mono text-gray-400">
                        {activeOrder.status === 'ACTIVO'
                          ? 'El motorizado está en ruta activa transmitiendo posición satelital.'
                          : 'El motorizado aceptó y está preparando el despacho.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* VISTA DEL MOTORIZADO */}
          {/* ------------------------------------------------------------------ */}
          {activeRole === 'MOTORIZADO' && (
            <div className="space-y-6">
              {/* Información del Motorizado */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-[#39FF14] uppercase tracking-wider">Operador Autorizado</div>
                  <div className="text-sm font-bold text-white mt-0.5">{TEST_ACTORS.MOTORIZADO.name}</div>
                  <div className="text-[11px] font-mono text-gray-400">Placa: {TEST_ACTORS.MOTORIZADO.plate} | {TEST_ACTORS.MOTORIZADO.vehicleModel}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center text-[#39FF14]">
                  <Car size={20} />
                </div>
              </div>

              {/* 1. SECCIÓN: PEDIDOS DISPONIBLES EN LA RED (PUBLICADOS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#39FF14] uppercase font-bold tracking-wider flex items-center gap-2">
                    <Radio size={14} className="animate-pulse" />
                    Pedidos Disponibles en Red
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300">
                    {availableOrders.length} DISPONIBLES
                  </span>
                </div>

                {availableOrders.length > 0 ? (
                  availableOrders.map((order) => (
                    <div key={order.id} className="bg-black/60 border border-[#39FF14]/30 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div>
                          <span className="text-[9px] font-mono text-gray-500 uppercase">Orden #</span>
                          <h4 className="text-xs font-mono font-bold text-white">{order.id}</h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          {order.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="p-2 bg-white/5 rounded-lg">
                          <span className="text-gray-500 text-[9px] uppercase block">Recojo (A):</span>
                          <span className="text-gray-200">{order.originAddress}</span>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg">
                          <span className="text-gray-500 text-[9px] uppercase block">Entrega (B):</span>
                          <span className="text-gray-200">{order.destinationAddress}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                          <span>Distancia: <strong className="text-white">{order.distanceText}</strong></span>
                          <span>Tiempo: <strong className="text-[#39FF14]">{order.durationText}</strong></span>
                          {order.protectedPrice !== undefined && (
                            <span>Tarifa: <strong className="text-[#39FF14] font-black">S/ {order.protectedPrice.toFixed(2)}</strong></span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="w-full bg-[#39FF14] text-black hover:bg-[#32e012] py-3 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all"
                      >
                        <Check size={16} />
                        <span>Aceptar Pedido (ASIGNADO ➔ ACEPTADO)</span>
                      </button>
                    </div>
                  ))
                ) : (
                  !motorizadoCurrentOrder && (
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center space-y-3">
                      <AlertCircle size={28} className="text-yellow-500 mx-auto" />
                      <p className="text-xs font-mono text-gray-400">
                        No hay pedidos en estado PUBLICADO en espera de asignación.
                      </p>
                      <button
                        onClick={() => setActiveRole('SOLICITANTE')}
                        className="bg-[#39FF14] text-black px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#32e012] transition-all"
                      >
                        Crear y Publicar como Solicitante
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* 2. SECCIÓN: PEDIDO EN CURSO ASIGNADO / ACEPTADO / ACTIVO */}
              {(activeOrder && (activeOrder.status === 'ACEPTADO' || activeOrder.status === 'ACTIVO' || activeOrder.status === 'ASIGNADO')) && (
                <div className="bg-black/70 border border-[#39FF14]/40 p-5 rounded-2xl space-y-4 shadow-glow">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase">Mi Asignación Actual</span>
                      <h4 className="text-xs font-mono font-bold text-white">{activeOrder.id}</h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30">
                      {activeOrder.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-gray-500 text-[10px] uppercase block">Recojo (A):</span>
                      <span className="text-gray-200">{activeOrder.originAddress}</span>
                    </div>
                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-gray-500 text-[10px] uppercase block">Entrega (B):</span>
                      <span className="text-gray-200">{activeOrder.destinationAddress}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                      <span>Solicitante: <strong className="text-white">{activeOrder.passengerName}</strong></span>
                      <span>Trayecto: <strong className="text-[#39FF14]">{activeOrder.distanceText}</strong></span>
                      {activeOrder.protectedPrice !== undefined && (
                        <span>Tarifa: <strong className="text-[#39FF14] font-black">S/ {activeOrder.protectedPrice.toFixed(2)}</strong></span>
                      )}
                    </div>
                    {/* Botón de Llamada Telefónica Directa al Cliente/Solicitante */}
                    <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5 mt-1">
                      <div className="text-[11px] font-mono">
                        <span className="text-gray-500 uppercase block text-[9px]">Teléfono Solicitante:</span>
                        <span className="text-white font-bold">{activeOrder.passengerPhone || 'No registrado'}</span>
                      </div>
                      <CallPhoneButton phone={activeOrder.passengerPhone} recipientLabel="Cliente" size="sm" />
                    </div>
                  </div>

                  {activeOrder.status === 'ACEPTADO' && (
                    <button
                      onClick={() => handleActivateOrder(activeOrder.id)}
                      className="w-full bg-[#39FF14] text-black hover:bg-[#32e012] py-3.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all"
                    >
                      <Play size={16} />
                      <span>Poner en Marcha (Pasar a ACTIVO)</span>
                    </button>
                  )}

                  {activeOrder.status === 'ACTIVO' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl text-center space-y-1">
                        <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#39FF14] font-bold">
                          <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-ping"></span>
                          <span>OPERACIÓN EN CURSO (ACTIVO)</span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400">
                          Transmitiendo posición continua al mapa del solicitante y la central.
                        </p>
                      </div>

                      <button
                        onClick={() => handleFinalizeOrder(activeOrder.id)}
                        disabled={finalizingOrder}
                        className="w-full bg-[#39FF14] text-black hover:bg-[#32e012] py-3.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check size={16} />
                        <span>{finalizingOrder ? 'Finalizando y Retornando...' : 'Completar Entrega (Pasar a FINALIZADO)'}</span>
                      </button>
                    </div>
                  )}

                  {finalizingOrder && (
                    <div className="p-4 bg-black/90 border border-[#39FF14] rounded-xl text-center space-y-1 shadow-glow animate-pulse">
                      <div className="text-xs font-mono font-bold text-[#39FF14]">
                        ✓ OPERACIÓN FINALIZADA
                      </div>
                      <p className="text-[10px] font-mono text-gray-400">
                        Persistencia confirmada. Retornando al Home del Motorizado...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Selector de Fuente de Telemetría: Simulador Cockpit DEV vs GPS Físico */}
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setTelemetryMode('SIMULATOR')}
                  className={`flex-1 py-2 px-3 rounded-lg font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    telemetryMode === 'SIMULATOR'
                      ? 'bg-[#39FF14] text-black shadow-glow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap size={13} />
                  <span>Simulador de Ruta (Cockpit DEV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTelemetryMode('PHYSICAL_GPS')}
                  className={`flex-1 py-2 px-3 rounded-lg font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    telemetryMode === 'PHYSICAL_GPS'
                      ? 'bg-[#39FF14] text-black shadow-glow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Crosshair size={13} />
                  <span>GPS Físico Real</span>
                </button>
              </div>

              {/* MODO 1: SIMULADOR DE RUTA (COCKPIT DEV) */}
              {telemetryMode === 'SIMULATOR' && (() => {
                const simPoints = (activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0)
                  ? activeOrder.polylinePoints
                  : (routeData?.polylinePoints || []);
                const simProgressPercent = simPoints.length > 1
                  ? Math.min(100, Math.round((simCurrentIndex / (simPoints.length - 1)) * 1000) / 10)
                  : 0;
                const simRemainingMeters = computeRemainingPolylineDistance(simPoints, simCurrentIndex);
                const simCurrentPt = simPoints[simCurrentIndex] || simPoints[0];

                return (
                  <div className="bg-black/80 border border-[#39FF14]/30 p-5 rounded-2xl space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#39FF14] animate-pulse"></div>
                        <div>
                          <span className="text-[9px] font-mono text-[#39FF14] font-black uppercase tracking-widest block">
                            COCKPIT DEV // TEST LOCAL 1 DISPOSITIVO
                          </span>
                          <h4 className="text-xs font-mono uppercase font-black text-white">
                            Simulador de Movimiento de Ruta
                          </h4>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2.5 py-1 rounded font-bold uppercase tracking-wider ${
                        simStatus === 'RUNNING'
                          ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40 animate-pulse'
                          : simStatus === 'PAUSED'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : simStatus === 'COMPLETED'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-white/10 text-gray-400 border border-white/10'
                      }`}>
                        {simStatus === 'RUNNING' ? 'EN RUTA' : simStatus === 'PAUSED' ? 'PAUSADO' : simStatus === 'COMPLETED' ? 'FINALIZADO' : 'DETENIDO'}
                      </span>
                    </div>

                    {simPoints.length === 0 ? (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-2 text-center">
                        <AlertCircle size={22} className="text-yellow-400 mx-auto" />
                        <p className="text-xs font-mono text-yellow-200 font-bold">
                          Polilínea no cargada
                        </p>
                        <p className="text-[11px] font-mono text-gray-300">
                          Calcula una ruta en la pestaña Solicitante para cargar la polilínea de Google Directions.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Barra de Progreso de Recorrido */}
                        <div className="space-y-1.5 bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-gray-400 uppercase tracking-wider">Avance de Ruta</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[#39FF14] font-black text-xs">{simProgressPercent.toFixed(1)}%</span>
                              <span className="text-gray-500 text-[10px]">({simCurrentIndex + 1}/{simPoints.length} pts)</span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#39FF14]/70 to-[#39FF14] transition-all duration-300"
                              style={{ width: `${simProgressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Telemetría Actual en Vivo */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                              <div className="text-[10px] font-mono text-gray-500 uppercase">Latitud Virtual</div>
                              <div className="text-sm font-black font-mono text-white mt-0.5 truncate">
                                {simCurrentPt ? simCurrentPt.lat.toFixed(6) : '0.000000'}
                              </div>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                              <div className="text-[10px] font-mono text-gray-500 uppercase">Longitud Virtual</div>
                              <div className="text-sm font-black font-mono text-white mt-0.5 truncate">
                                {simCurrentPt ? simCurrentPt.lng.toFixed(6) : '0.000000'}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-[9px] text-gray-500 block uppercase">Dist. Restante</span>
                              <span className="font-bold text-[#39FF14]">
                                {simRemainingMeters >= 1000 ? `${(simRemainingMeters / 1000).toFixed(2)} km` : `${Math.round(simRemainingMeters)} m`}
                              </span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-[9px] text-gray-500 block uppercase">Rumbo</span>
                              <span className="font-bold text-white">{simHeadingRef.current}°</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-[9px] text-gray-500 block uppercase">Vel. Aprox.</span>
                              <span className="font-bold text-white">
                                {simStatus === 'RUNNING' ? `${Math.round(25 * simSpeedMultiplier)} km/h` : '0 km/h'}
                              </span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-[9px] text-gray-500 block uppercase">Precisión</span>
                              <span className="font-bold text-[#39FF14]">±3.0m</span>
                            </div>
                          </div>
                        </div>

                        {/* Selector de Velocidad Multiplicadora (1x, 2x, 4x) */}
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <FastForward size={12} className="text-[#39FF14]" />
                            Velocidad de Avance:
                          </span>
                          <div className="flex items-center gap-1.5">
                            {([1, 2, 4] as const).map(speed => (
                              <button
                                key={speed}
                                type="button"
                                onClick={() => handleChangeSpeed(speed)}
                                className={`px-3 py-1 rounded-lg font-mono text-xs font-black transition-all cursor-pointer ${
                                  simSpeedMultiplier === speed
                                    ? 'bg-[#39FF14] text-black shadow-glow'
                                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {speed}×
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Botones de Control del Simulador */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {simStatus === 'RUNNING' ? (
                            <button
                              type="button"
                              onClick={handlePauseSimulation}
                              className="bg-yellow-500 text-black hover:bg-yellow-400 font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-glow cursor-pointer"
                            >
                              <Pause size={15} />
                              <span>Pausar</span>
                            </button>
                          ) : simStatus === 'PAUSED' ? (
                            <button
                              type="button"
                              onClick={handleResumeSimulation}
                              className="bg-[#39FF14] text-black hover:bg-[#32e012] font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-glow cursor-pointer"
                            >
                              <Play size={15} />
                              <span>Reanudar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startRouteSimulation(0)}
                              className="bg-[#39FF14] text-black hover:bg-[#32e012] font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-glow cursor-pointer"
                            >
                              <Play size={15} />
                              <span>{simStatus === 'COMPLETED' ? 'Reiniciar Ruta' : 'Iniciar Simulación'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleRestartSimulation}
                            disabled={simCurrentIndex === 0 && simStatus === 'IDLE'}
                            className={`font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                              simCurrentIndex === 0 && simStatus === 'IDLE'
                                ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                                : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer'
                            }`}
                          >
                            <RotateCcw size={14} />
                            <span>Punto 0 (A)</span>
                          </button>
                        </div>

                        <p className="text-[10px] font-mono text-gray-500 leading-tight">
                          Recorre la polilínea real de Google Directions alimentando <code className="text-[#39FF14]">updateOperationTelemetry()</code>. Mutuamente excluyente con el GPS físico.
                        </p>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* MODO 2: GPS FÍSICO REAL DEL TELÉFONO */}
              {telemetryMode === 'PHYSICAL_GPS' && (
                <div className="bg-black/80 border border-white/10 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Crosshair size={16} className={gpsStatus === 'ACTIVE' ? 'text-[#39FF14] animate-spin' : 'text-gray-500'} />
                      <h4 className="text-xs font-mono uppercase font-bold text-white">
                        GPS Físico del Dispositivo
                      </h4>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      gpsStatus === 'ACTIVE' ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-white/10 text-gray-400'
                    }`}>
                      {gpsStatus}
                    </span>
                  </div>

                  {gpsErrorMessage && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">
                      {gpsErrorMessage}
                    </div>
                  )}

                  {realMotorizadoLocation ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className="text-[10px] font-mono text-gray-500 uppercase">Latitud Actual</div>
                          <div className="text-base font-black font-mono text-white mt-0.5">
                            {realMotorizadoLocation.lat.toFixed(6)}
                          </div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className="text-[10px] font-mono text-gray-500 uppercase">Longitud Actual</div>
                          <div className="text-base font-black font-mono text-white mt-0.5">
                            {realMotorizadoLocation.lng.toFixed(6)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                        <div className="bg-white/5 p-2 rounded-lg">
                          <span className="text-[9px] text-gray-500 block uppercase">Precisión</span>
                          <span className="font-bold text-[#39FF14]">±{realMotorizadoLocation.accuracy.toFixed(1)}m</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg">
                          <span className="text-[9px] text-gray-500 block uppercase">Pings GPS</span>
                          <span className="font-bold text-white">{gpsUpdatesCount}</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg">
                          <span className="text-[9px] text-gray-500 block uppercase">Último Ping</span>
                          <span className="font-bold text-gray-300">{realMotorizadoLocation.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs font-mono text-gray-500">
                      {gpsStatus === 'REQUESTING' ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw size={20} className="animate-spin text-[#39FF14]" />
                          <span>Esperando confirmación de permisos de ubicación...</span>
                        </div>
                      ) : (
                        <span>GPS en espera. Presiona el botón para comenzar a transmitir tu posición real.</span>
                      )}
                    </div>
                  )}

                  {/* Botones de Control de GPS */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {gpsStatus !== 'ACTIVE' ? (
                      <button
                        onClick={startRealDeviceGPS}
                        className="bg-[#39FF14] text-black font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#32e012] transition-all shadow-glow cursor-pointer"
                      >
                        <Play size={14} />
                        <span>Activar GPS Real</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopRealDeviceGPS}
                        className="bg-red-500/20 text-red-400 border border-red-500/30 font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all cursor-pointer"
                      >
                        <span>Detener GPS</span>
                      </button>
                    )}

                    <button
                      onClick={forceSingleGpsReading}
                      className="bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw size={14} />
                      <span>Ping Manual</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* VISTA DEL RECEPTOR */}
          {/* ------------------------------------------------------------------ */}
          {activeRole === 'RECEPTOR' && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <div className="text-[10px] font-mono text-[#39FF14] uppercase tracking-wider">Receptora Designada</div>
                <div className="text-sm font-bold text-white mt-0.5">{TEST_ACTORS.RECEPTOR.name}</div>
                <div className="text-[11px] font-mono text-gray-400">Tel: {TEST_ACTORS.RECEPTOR.phone}</div>
              </div>

              {activeOrder ? (
                <div className="bg-black/60 border border-white/10 p-5 rounded-2xl space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">Seguimiento de Entrega</span>
                    <h4 className="text-xs font-mono font-bold text-white">{activeOrder.id}</h4>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <span className="text-[10px] text-gray-500 uppercase block">Dirección de Destino:</span>
                      <span className="text-white font-bold">{activeOrder.destinationAddress}</span>
                    </div>

                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-gray-400 text-[11px]">
                        <span>Distancia total:</span>
                        <strong className="text-white">{activeOrder.distanceText}</strong>
                      </div>
                      <div className="flex items-center justify-between text-gray-400 text-[11px]">
                        <span>Tiempo estimado:</span>
                        <strong className="text-[#39FF14]">{activeOrder.durationText}</strong>
                      </div>
                      {activeOrder.protectedPrice !== undefined && (
                        <div className="flex items-center justify-between text-gray-400 text-[11px]">
                          <span>Tarifa acordada:</span>
                          <strong className="text-[#39FF14] font-black">S/ {activeOrder.protectedPrice.toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {realMotorizadoLocation ? (
                    <div className="p-3 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl space-y-1 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-[#39FF14] font-bold">
                        <Car size={14} />
                        <span>Motorizado en Tránsito</span>
                      </div>
                      <p className="text-[11px] text-gray-300">
                        Última posición recibida hace unos instantes a ±{realMotorizadoLocation.accuracy.toFixed(0)}m de precisión.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-gray-500 text-center py-2">
                      Esperando que el motorizado active la transmisión de su GPS.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center text-xs font-mono text-gray-500">
                  No hay encomienda de prueba activa en este momento.
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* VISTA DEL SANDBOX VIRTUAL */}
          {/* ------------------------------------------------------------------ */}
          {activeRole === 'SANDBOX_VIRTUAL' && (
            <VirtualSandboxTestRunner />
          )}

        </div>

        {/* ==================================================================== */}
        {/* COLUMNA DERECHA: MAPA INTERACTIVO CON POLILÍNEA Y SEGUIMIENTO REAL */}
        {/* ==================================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative w-full h-[520px] sm:h-[600px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {!hasValidKey ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 p-8 text-center border border-white/5">
                <AlertCircle size={42} className="text-[#39FF14] mb-4" />
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider mb-2">
                  Configuración de Google Maps Requerida
                </h3>
                <p className="text-xs font-mono text-gray-400 max-w-md leading-relaxed mb-4">
                  Se requiere una API Key configurada en la variable <code>GOOGLE_MAPS_PLATFORM_KEY</code> perteneciente al proyecto de Google Cloud <code>gen-lang-client-0838883154</code>.
                </p>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[11px] font-mono text-gray-300 max-w-md text-left space-y-1">
                  <div>• Project ID: <span className="text-[#39FF14]">gen-lang-client-0838883154</span></div>
                  <div>• Project Number: <span className="text-gray-400">949145719529</span></div>
                  <div>• Facturación: Requiere cuenta de Cloud Billing vinculada</div>
                  <div>• APIs requeridas: Maps JavaScript API, Geocoding API, Directions API</div>
                </div>
              </div>
            ) : (
              <APIProvider apiKey={API_KEY}>
                <Map
                  defaultCenter={mapCenter}
                  defaultZoom={getLastKnownLocation() ? 14 : 6}
                  mapId="DEMO_MAP_ID"
                  styles={DARK_MAP_STYLE}
                  style={{ width: '100%', height: '100%' }}
                  disableDefaultUI={false}
                  zoomControl={true}
                  gestureHandling="greedy"
                >
                  {/* Control de recentrado reactivo */}
                  <MapPanner target={recenterTarget} />

                  {/* Polilínea Real calculada por Google Directions */}
                  {((activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0) || (routeData && routeData.polylinePoints.length > 0)) && (
                    <RealRoutePolylineRenderer
                      pathPoints={(activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0) ? activeOrder.polylinePoints : (routeData?.polylinePoints || [])}
                      fitBounds={!realMotorizadoLocation}
                    />
                  )}

                  {/* Marcador A: Origen */}
                  {(originCoords || activeOrder) && (
                    <AdvancedMarker
                      position={{
                        lat: originCoords?.lat ?? activeOrder!.originLat,
                        lng: originCoords?.lng ?? activeOrder!.originLng
                      }}
                      title="Punto A: Origen"
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="absolute -inset-2 bg-[#39FF14] rounded-full blur opacity-50 animate-ping"></div>
                        <div className="w-9 h-9 rounded-full bg-[#39FF14] text-black font-black flex items-center justify-center shadow-lg border-2 border-black font-mono text-xs z-10">
                          A
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Marcador B: Destino */}
                  {(destCoords || activeOrder) && (
                    <AdvancedMarker
                      position={{
                        lat: destCoords?.lat ?? activeOrder!.destLat,
                        lng: destCoords?.lng ?? activeOrder!.destLng
                      }}
                      title="Punto B: Destino"
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-white text-black font-black flex items-center justify-center shadow-lg border-2 border-black font-mono text-xs z-10">
                          B
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Marcador Oficial de Unidad ZÉNITH: ÁGUILA IMPERIAL + ZÉNITH */}
                  {realMotorizadoLocation && (
                    <AdvancedMarker
                      position={{ lat: realMotorizadoLocation.lat, lng: realMotorizadoLocation.lng }}
                      title={`Unidad Zénith en Vivo: ±${realMotorizadoLocation.accuracy.toFixed(1)}m`}
                    >
                      <ZenithImperialEagleMarker
                        size={52}
                        heading={realMotorizadoLocation.heading}
                        title={`Unidad Zénith: ±${realMotorizadoLocation.accuracy.toFixed(1)}m`}
                      />
                    </AdvancedMarker>
                  )}
                </Map>
              </APIProvider>
            )}

            {/* Overlay HUD Superior Izquierda */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
              <div className="bg-black/70 backdrop-blur-md px-3.5 py-2 border border-[#39FF14]/30 rounded-xl shadow-lg space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-ping"></span>
                  <p className="text-[10px] font-mono text-[#39FF14] uppercase tracking-widest font-black">
                    Cartografía Interactiva Zénith
                  </p>
                </div>
                <p className="text-[9px] font-mono text-gray-400">
                  {(activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0)
                    ? `${activeOrder.polylinePoints.length} Puntos de Ruta Real`
                    : routeData
                    ? `${routeData.polylinePoints.length} Puntos de Ruta Real`
                    : 'Esperando trazo de ruta'}
                </p>
              </div>
            </div>

            {/* Overlay HUD Superior Derecha: Mini Cockpit de Simulación */}
            {(simStatus === 'RUNNING' || simStatus === 'PAUSED' || simStatus === 'COMPLETED') && (() => {
              const hudPoints = (activeOrder?.polylinePoints && activeOrder.polylinePoints.length > 0)
                ? activeOrder.polylinePoints
                : (routeData?.polylinePoints || []);
              const hudProgress = hudPoints.length > 1
                ? Math.min(100, Math.round((simCurrentIndex / (hudPoints.length - 1)) * 1000) / 10)
                : 0;

              return (
                <div className="absolute top-4 right-4 z-10">
                  <div className="bg-black/90 backdrop-blur-md px-3.5 py-2 border border-[#39FF14]/40 rounded-xl shadow-2xl flex items-center gap-2.5 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${simStatus === 'RUNNING' ? 'bg-[#39FF14] animate-ping' : simStatus === 'PAUSED' ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
                      <span className="text-white font-bold text-[10px]">SIMULADOR:</span>
                      <span className="text-[#39FF14] font-black text-xs">
                        {hudProgress.toFixed(1)}%
                      </span>
                      <span className="text-gray-400 text-[10px]">({simSpeedMultiplier}×)</span>
                    </div>
                    <div className="flex items-center gap-1 pl-1 border-l border-white/10">
                      {simStatus === 'RUNNING' ? (
                        <button
                          type="button"
                          onClick={handlePauseSimulation}
                          className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title="Pausar simulador"
                        >
                          <Pause size={10} />
                          <span>Pausar</span>
                        </button>
                      ) : simStatus === 'PAUSED' ? (
                        <button
                          type="button"
                          onClick={handleResumeSimulation}
                          className="px-2 py-1 rounded bg-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/30 transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title="Reanudar simulador"
                        >
                          <Play size={10} />
                          <span>Reanudar</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleRestartSimulation}
                        className="px-2 py-1 rounded bg-white/10 text-gray-300 hover:bg-white/20 transition-all text-[10px] flex items-center gap-1 cursor-pointer"
                        title="Reiniciar simulador al inicio"
                      >
                        <RotateCcw size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Overlay HUD Inferior Derecha: Telemetría Rápida */}
            {realMotorizadoLocation && (
              <div className="absolute bottom-4 right-4 z-10">
                <div className="bg-black/85 backdrop-blur-md p-3 border border-[#39FF14]/40 rounded-xl shadow-xl font-mono text-xs space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[10px] text-[#39FF14] font-bold">
                    <span>MOTORIZADO GPS EN VIVO</span>
                    <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-ping"></span>
                  </div>
                  <div className="text-white text-[11px]">
                    {realMotorizadoLocation.lat.toFixed(5)}, {realMotorizadoLocation.lng.toFixed(5)}
                  </div>
                  <div className="text-gray-400 text-[10px]">
                    Precisión: ±{realMotorizadoLocation.accuracy.toFixed(1)}m | Pings: {gpsUpdatesCount}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Barra de Instrucciones y Tips para la Prueba Física */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-gray-400">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-[#39FF14] shrink-0" />
              <span>
                <strong>Prueba Física:</strong> Abre esta pantalla en tu teléfono, activa el GPS del Motorizado y camina para ver el marcador moverse en vivo.
              </span>
            </div>
            {(onReturnHome || onClose) && (
              <button
                onClick={onReturnHome || onClose}
                className="text-xs font-mono text-[#39FF14] hover:text-white px-3 py-1.5 rounded-lg border border-[#39FF14]/30 hover:bg-[#39FF14]/10 shrink-0 transition-all cursor-pointer font-bold"
              >
                Volver al Home
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Completo de Creación de Operación Zénith */}
      {showCreationModal && (
        <ZenithOrderCreationModal
          user={{
            ...TEST_ACTORS.SOLICITANTE,
            uid: auth.currentUser?.uid || currentTestUid || TEST_ACTORS.SOLICITANTE.uid,
            email: auth.currentUser?.email || 'solicitante@zenith.pe'
          } as any}
          initialOrigin={originCoords ? { address: originCoords.address, lat: originCoords.lat, lng: originCoords.lng } : (originInput ? { address: originInput, lat: -8.11189, lng: -79.02875 } : undefined)}
          initialDestination={destCoords ? { address: destCoords.address, lat: destCoords.lat, lng: destCoords.lng } : (destInput ? { address: destInput, lat: -8.0988, lng: -79.0435 } : undefined)}
          onClose={() => setShowCreationModal(false)}
          onOrderCreated={(orderId, order) => {
            setShowCreationModal(false);
            setActiveOrderId(orderId);
            setOrderCreatedSuccess(true);
            if (order) {
              setOriginInput(order.originAddress);
              setDestInput(order.destinationAddress);
              setOriginCoords({ address: order.originAddress, lat: order.originLat, lng: order.originLng });
              setDestCoords({ address: order.destinationAddress, lat: order.destLat, lng: order.destLng });
              setMapCenter({ lat: order.originLat, lng: order.originLng });
            }
          }}
        />
      )}
    </div>
  );
}
