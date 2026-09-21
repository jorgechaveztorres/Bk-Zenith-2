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
  Copy
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
  updateOperationTelemetry,
  subscribeToOperations
} from '../../services/operationalOrdersService';
import { OperationStatusStepper } from './OperationStatusStepper';
import { VirtualSandboxTestRunner } from './VirtualSandboxTestRunner';
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
    role: 'driver'
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
// COMPONENTE PRINCIPAL: MODO PRUEBA DEL CORAZÓN OPERATIVO (FASE 1)
// ============================================================================
export default function OperationalHeartTestView({
  onClose
}: {
  onClose?: () => void;
}) {
  // Rol activo para la prueba
  const [activeRole, setActiveRole] = useState<'SOLICITANTE' | 'MOTORIZADO' | 'RECEPTOR' | 'SANDBOX_VIRTUAL'>('SOLICITANTE');

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

  // Operación activa y sincronización reactiva en tiempo real (BroadcastChannel + LocalStorage + Firestore)
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState(false);

  // Suscripción reactiva multicanal en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeToOperations((ops) => {
      setOperations(ops);
      setActiveOrderId(prev => {
        if (prev && ops.some(o => o.id === prev)) return prev;
        return ops.length > 0 ? ops[0].id : null;
      });
    });
    return () => unsubscribe();
  }, []);

  // Orden activa seleccionada para seguimiento
  const activeOrder: OperationRecord | null =
    operations.find(o => o.id === activeOrderId) ||
    (operations.length > 0 ? operations[0] : null);

  // Pedidos disponibles para aceptar (Estado estricto: PUBLICADO)
  const availableOrders = operations.filter(o => o.status === 'PUBLICADO');

  // Operación del motorizado en curso
  const motorizadoCurrentOrder = operations.find(
    o => o.driverId === TEST_ACTORS.MOTORIZADO.uid ||
    (o.status === 'ACEPTADO' || o.status === 'ACTIVO' || o.status === 'ASIGNADO')
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

  // Asegurar autenticación anónima si no hay usuario para Firestore
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(err => {
        console.warn('[ZENITH-TEST] Anonymous sign-in warning:', err);
      });
    }
  }, []);

  // Sincronizar posición del motorizado en el solicitante si la orden tiene telemetría
  useEffect(() => {
    if (activeOrder?.driverLocation && activeRole === 'SOLICITANTE') {
      setRealMotorizadoLocation({
        lat: activeOrder.driverLocation.lat,
        lng: activeOrder.driverLocation.lng,
        accuracy: activeOrder.driverLocation.accuracy || 5,
        speed: activeOrder.driverLocation.speed || 0,
        heading: activeOrder.driverLocation.heading || 0,
        timestamp: activeOrder.driverLocation.updatedAt || new Date().toLocaleTimeString()
      });
    }
  }, [activeOrder?.driverLocation, activeRole]);

  // Limpiar GPS al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
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

      // PASO 1 OPERATIVO: Crear automáticamente el borrador en estado CREADO
      const draft = createDraftOrder({
        originAddress: originCoords?.address || originInput || 'Origen de la Operación',
        originLat: origin.lat,
        originLng: origin.lng,
        destinationAddress: destCoords?.address || destInput || 'Destino de la Operación',
        destLat: destination.lat,
        destLng: destination.lng,
        distanceText: calculatedData.distanceText,
        durationText: calculatedData.durationText,
        distanceMeters: calculatedData.distanceMeters,
        durationSeconds: calculatedData.durationSeconds,
        polylinePoints: calculatedData.polylinePoints
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
    try {
      const accepted = await acceptOrderAsMotorizado(orderId, {
        driverId: TEST_ACTORS.MOTORIZADO.uid,
        driverName: TEST_ACTORS.MOTORIZADO.name,
        driverPhone: TEST_ACTORS.MOTORIZADO.phone,
        driverPlate: TEST_ACTORS.MOTORIZADO.plate,
        driverVehicle: `${TEST_ACTORS.MOTORIZADO.vehicleModel}`
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
  // PASO 6: OBTENCIÓN DE GPS REAL DEL DISPOSITIVO FÍSICO
  // ============================================================================
  const startRealDeviceGPS = () => {
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
                        <div><span className="text-gray-500">Teléfono:</span> {activeOrder.driverPhone}</div>
                        <div><span className="text-gray-500">Vehículo:</span> {activeOrder.driverVehicle}</div>
                        <div><span className="text-gray-500">Estado de Operación:</span> <strong className="text-[#39FF14]">{activeOrder.status}</strong></div>
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
                    <div className="p-3 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl text-center space-y-1">
                      <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#39FF14] font-bold">
                        <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-ping"></span>
                        <span>OPERACIÓN EN CURSO (ACTIVO)</span>
                      </div>
                      <p className="text-[10px] font-mono text-gray-400">
                        Transmitiendo posición continua al mapa del solicitante y la central.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Panel de Telemetría GPS Real del Teléfono */}
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
                      className="bg-[#39FF14] text-black font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#32e012] transition-all shadow-glow"
                    >
                      <Play size={14} />
                      <span>Activar GPS Real</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopRealDeviceGPS}
                      className="bg-red-500/20 text-red-400 border border-red-500/30 font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all"
                    >
                      <span>Detener GPS</span>
                    </button>
                  )}

                  <button
                    onClick={forceSingleGpsReading}
                    className="bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw size={14} />
                    <span>Ping Manual</span>
                  </button>
                </div>
              </div>
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

                  {/* Marcador en Vivo del Motorizado con GPS Físico */}
                  {realMotorizadoLocation && (
                    <AdvancedMarker
                      position={{ lat: realMotorizadoLocation.lat, lng: realMotorizadoLocation.lng }}
                      title={`Motorizado en Vivo: ±${realMotorizadoLocation.accuracy.toFixed(1)}m`}
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="absolute -inset-3 bg-[#39FF14] rounded-full blur-md opacity-70 animate-pulse"></div>
                        <div className="w-10 h-10 rounded-full bg-black border-2 border-[#39FF14] text-[#39FF14] flex items-center justify-center shadow-2xl z-10">
                          <Car size={18} className="stroke-[2.5]" />
                        </div>
                      </div>
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
                  {routeData ? `${routeData.polylinePoints.length} Puntos de Ruta Real` : 'Esperando trazo de ruta'}
                </p>
              </div>
            </div>

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
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs font-mono text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 shrink-0"
              >
                Cerrar Modo Prueba
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
