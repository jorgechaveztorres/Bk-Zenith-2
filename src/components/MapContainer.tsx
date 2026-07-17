import React, { useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';

export const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  'AIzaSyBBkr2N2bzcruQwDj4Cy6lCb-4DqUFuuEs';
export const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

interface MapContainerProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  markers?: { id: string; position: google.maps.LatLngLiteral; title?: string; color?: string }[];
  onMapClick?: (e: google.maps.MapMouseEvent) => void;
  height?: string;
}

function RouteDisplay({ origin, destination, onRouteLoaded }: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  onRouteLoaded?: (count: number) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const rendererRef = useRef<any>(null);

  useEffect(() => {
    if (!routesLib || !map || !window.google) return;

    // Create the renderer if it doesn't exist yet
    if (!rendererRef.current) {
      rendererRef.current = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: false, // Let Google Maps natively and robustly adjust the viewport to the route
        polylineOptions: {
          strokeColor: '#39FF14',
          strokeOpacity: 0.85,
          strokeWeight: 5,
        },
      });
    }

    const directionsService = new window.google.maps.DirectionsService();

    console.log(`[ZENITH-TRACE] [${new Date().toLocaleTimeString()}] Component: RouteDisplay | Action: Just before calling directionsService.route() | Origin Lat: ${origin.lat}, Lng: ${origin.lng} | Destination Lat: ${destination.lat}, Lng: ${destination.lng}`);
    directionsService.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        console.log(`[ZENITH-TRACE] [${new Date().toLocaleTimeString()}] Component: RouteDisplay | Action: Just after receiving Directions API response | Status: ${status} | Has routes: ${!!result?.routes?.length}`);
        if (status === window.google.maps.DirectionsStatus.OK && result && rendererRef.current) {
          const route = result.routes[0];
          const leg = route?.legs?.[0];
          console.log(`[ZENITH-TRACE] [${new Date().toLocaleTimeString()}] Component: RouteDisplay | Action: Google Directions Successful Response Received
- route.summary: "${route?.summary}"
- legs[0].start_location: ${leg?.start_location?.toString() || JSON.stringify(leg?.start_location?.toJSON())}
- legs[0].end_location: ${leg?.end_location?.toString() || JSON.stringify(leg?.end_location?.toJSON())}
- bounds (Northeast): ${route?.bounds?.getNorthEast()?.toString() || JSON.stringify(route?.bounds?.getNorthEast()?.toJSON())}
- bounds (Southwest): ${route?.bounds?.getSouthWest()?.toString() || JSON.stringify(route?.bounds?.getSouthWest()?.toJSON())}
- overview_path.length (polyline points count): ${route?.overview_path?.length}`);

          if (onRouteLoaded) {
            onRouteLoaded(route?.overview_path?.length || 0);
          }

          console.log(`[ZENITH-TRACE] [${new Date().toLocaleTimeString()}] Component: RouteDisplay | Action: Just before executing DirectionsRenderer.setDirections() (triggers fitBounds) | Status: ${status}`);
          rendererRef.current.setDirections(result);
        } else {
          console.error('Directions request failed due to: ' + status);
        }
      }
    );

    return () => {
      if (rendererRef.current) {
        rendererRef.current.setMap(null);
        rendererRef.current = null;
      }
    };
  }, [routesLib, map, origin.lat, origin.lng, destination.lat, destination.lng]);

  return null;
}

function ViewportEngineV2({
  center,
  markers
}: {
  center: google.maps.LatLngLiteral;
  markers: { id: string; position: google.maps.LatLngLiteral }[];
}) {
  const map = useMap();
  const lastProcessedRef = useRef<string>('');

  useEffect(() => {
    if (!map || !window.google) return;

    // Build a unique key to cache viewport updates and prevent continuous fighting with manual panning/zooming
    const markersKey = markers.map(m => `${m.position.lat.toFixed(5)},${m.position.lng.toFixed(5)}`).join('|');
    const currentKey = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}[${markersKey}]`;

    if (currentKey === lastProcessedRef.current) return;

    // Only mark as processed if map is ready and has bounds
    const isMapReady = map.getBounds() !== null && map.getBounds() !== undefined;
    if (isMapReady) {
      lastProcessedRef.current = currentKey;
    }

    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.position));

      console.log(`[ZENITH-TRACE] [VIEWPORT-V2] Map Engine V2 adjusting viewport for ${markers.length} markers. Map ready: ${isMapReady}`);
      
      if (markers.length === 1) {
        map.setCenter(markers[0].position);
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, {
          top: 100,
          right: 60,
          bottom: 100,
          left: 60
        });
      }
    } else {
      console.log(`[ZENITH-TRACE] [VIEWPORT-V2] Map Engine V2 centering on: ${center.lat}, ${center.lng}. Map ready: ${isMapReady}`);
      map.setCenter(center);
      map.setZoom(13);
    }
  }, [map, center.lat, center.lng, markers]);

  return null;
}

function MapRenderTracer({ markers, polylinePointsCount }: {
  markers: { id: string; position: google.maps.LatLngLiteral; title?: string }[];
  polylinePointsCount: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !window.google) return;
    const listener = map.addListener('idle', () => {
      const currentCenter = map.getCenter();
      console.log(`[ZENITH-TRACE] [${new Date().toLocaleTimeString()}] Component: MapRenderTracer | Action: Map IDLE event (Render/Move Completed)
- Final Center Lat: ${currentCenter?.lat()}
- Final Center Lng: ${currentCenter?.lng()}
- Final Zoom: ${map.getZoom()}
- Markers: ${JSON.stringify(markers)}
- Polyline Points Count: ${polylinePointsCount}`);
    });
    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [map, markers, polylinePointsCount]);
  return null;
}

export default function MapContainer({ 
  center = { lat: -8.11189, lng: -79.02875 }, 
  zoom = 13,
  markers = [],
  onMapClick,
  height = '400px'
}: MapContainerProps) {
  const [polylinePointsCount, setPolylinePointsCount] = React.useState<number>(0);

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center hud-card p-8 text-center" style={{ height }}>
        <h2 className="text-xl font-bold mb-4 uppercase italic">Protocolo de Google Maps Requerido</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm font-mono uppercase tracking-widest leading-relaxed">
          Información operativa restringida. Proporciona <code>GOOGLE_MAPS_PLATFORM_KEY</code> en el panel de Secretos.
        </p>
      </div>
    );
  }

  const originMarker = markers.find(m => m.id === 'origin');
  const destMarker = markers.find(m => m.id === 'dest');
  const hasRoute = originMarker && destMarker;

  return (
    <div className="w-full relative rounded-2xl overflow-hidden border border-white/5 shadow-tactical" style={{ height }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="DEMO_MAP_ID"
          onClick={onMapClick}
          styles={DARK_MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          disableDefaultUI={true}
          zoomControl={true}
        >
          {!hasRoute && <ViewportEngineV2 center={center} markers={markers} />}
          <MapRenderTracer markers={markers} polylinePointsCount={polylinePointsCount} />
          {markers.map(marker => (
            <AdvancedMarker key={marker.id} position={marker.position} title={marker.title}>
              <div className="relative flex items-center justify-center">
                {/* Tactical radar pulse underlay */}
                <div className={`absolute -inset-1 rounded-full blur-md opacity-60 ${
                  marker.id === 'origin' ? 'bg-[#39FF14]' : 'bg-white'
                }`}></div>
                {/* Main pin body */}
                <div className={`w-8 h-8 rounded-full border border-white/20 flex items-center justify-center shadow-lg relative z-10 transition-transform hover:scale-110 ${
                  marker.id === 'origin' ? 'bg-[#39FF14] text-black' : 'bg-black text-[#39FF14]'
                }`}>
                  {marker.id === 'origin' ? (
                    <MapPin size={16} className="stroke-[2.5]" />
                  ) : (
                    <Navigation size={14} className="stroke-[2.5] rotate-45" />
                  )}
                </div>
              </div>
            </AdvancedMarker>
          ))}

          {hasRoute && (
            <RouteDisplay origin={originMarker.position} destination={destMarker.position} onRouteLoaded={setPolylinePointsCount} />
          )}
        </Map>
      </APIProvider>
      
      {/* HUD Overlays */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 border border-[#39FF14]/30 rounded-lg">
          <p className="text-[9px] font-mono text-[#39FF14] uppercase tracking-widest font-bold">Escaneo de Sector en Vivo</p>
        </div>
      </div>
      
      <div className="absolute bottom-4 right-4 pointer-events-none opacity-40">
         <div className="w-16 h-16 border-r border-b border-[#39FF14]"></div>
      </div>
      <div className="absolute top-4 right-4 pointer-events-none opacity-40">
         <div className="w-16 h-16 border-r border-t border-[#39FF14]"></div>
      </div>
    </div>
  );
}
