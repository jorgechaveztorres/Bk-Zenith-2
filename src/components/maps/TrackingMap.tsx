// ============================================================================
// ZÉNITH
// Module : Tracking / TrackingMap Component
// Layer  : Presentation / UI Component
// File   : TrackingMap.tsx
// ============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { API_KEY, DARK_MAP_STYLE, hasValidKey } from '../MapContainer';
import { MapPin, Navigation, Compass, Shield, Maximize2 } from 'lucide-react';

interface TrackingMapProps {
  passengerLoc: { lat: number; lng: number; address?: string };
  driverLoc?: { lat: number; lng: number; address?: string };
  originLoc: { lat: number; lng: number; address?: string };
  destinationLoc: { lat: number; lng: number; address?: string };
  height?: string;
  autoCenter?: boolean;
}

// Internal component to manage route calculations, splitting, and rendering
function LiveRouteRenderer({
  origin,
  destination,
  driverCurrent,
  onHeadingCalculated
}: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  driverCurrent?: google.maps.LatLngLiteral;
  onHeadingCalculated?: (heading: number) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  
  // Keep refs to clear map polylines cleanly
  const staticRoutePolyRef = useRef<google.maps.Polyline | null>(null);
  const completedPolyRef = useRef<google.maps.Polyline | null>(null);
  const remainingPolyRef = useRef<google.maps.Polyline | null>(null);
  
  const [routePoints, setRoutePoints] = useState<google.maps.LatLngLiteral[]>([]);
  const prevDriverLocRef = useRef<google.maps.LatLngLiteral | null>(null);

  // 1. Calculate static route path once
  useEffect(() => {
    if (!routesLib || !map || !window.google) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          const points: google.maps.LatLngLiteral[] = [];
          const legs = result.routes[0]?.legs || [];
          for (const leg of legs) {
            for (const step of leg.steps) {
              const path = step.path;
              for (const latLng of path) {
                points.push({ lat: latLng.lat(), lng: latLng.lng() });
              }
            }
          }

          setRoutePoints(points);

          // Render static baseline path (gorgeous semi-transparent charcoal)
          if (staticRoutePolyRef.current) staticRoutePolyRef.current.setMap(null);
          staticRoutePolyRef.current = new window.google.maps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: '#444444',
            strokeOpacity: 0.6,
            strokeWeight: 4,
            map
          });

          // Zoom to fit full journey on load
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(destination);
          map.fitBounds(bounds, { top: 80, right: 40, bottom: 80, left: 40 });
        }
      }
    );

    return () => {
      if (staticRoutePolyRef.current) staticRoutePolyRef.current.setMap(null);
      if (completedPolyRef.current) completedPolyRef.current.setMap(null);
      if (remainingPolyRef.current) remainingPolyRef.current.setMap(null);
    };
  }, [routesLib, map, origin.lat, origin.lng, destination.lat, destination.lng]);

  // 2. Perform splitting into completed and pending segments & calculate rotation heading
  useEffect(() => {
    if (!map || !window.google) return;

    const currentDriver = driverCurrent || origin;

    // A. Calculate heading (bearing) of the car
    if (onHeadingCalculated && driverCurrent) {
      const prev = prevDriverLocRef.current;
      if (prev && (prev.lat !== driverCurrent.lat || prev.lng !== driverCurrent.lng)) {
        const bearing = getBearing(prev.lat, prev.lng, driverCurrent.lat, driverCurrent.lng);
        onHeadingCalculated(bearing);
      }
      prevDriverLocRef.current = driverCurrent;
    }

    if (routePoints.length === 0) return;

    // B. Slice the route array into completed and pending paths based on driver's physical proximity
    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < routePoints.length; i++) {
      const dist = computeDistance(currentDriver.lat, currentDriver.lng, routePoints[i].lat, routePoints[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    const completedSegment = routePoints.slice(0, closestIdx + 1);
    const remainingSegment = routePoints.slice(closestIdx);

    // C. Draw completed path (Bright Neon Green - #39FF14)
    if (completedPolyRef.current) completedPolyRef.current.setMap(null);
    completedPolyRef.current = new window.google.maps.Polyline({
      path: completedSegment,
      geodesic: true,
      strokeColor: '#39FF14',
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map
    });

    // D. Draw remaining pending path (Tactical Dashed/Dot pattern - blue/cyan)
    if (remainingPolyRef.current) remainingPolyRef.current.setMap(null);
    remainingPolyRef.current = new window.google.maps.Polyline({
      path: remainingSegment,
      geodesic: true,
      strokeColor: '#00F0FF',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map
    });
  }, [routePoints, driverCurrent?.lat, driverCurrent?.lng, map]);

  return null;
}

// Math helper to get bearing between two coordinate vectors
function getBearing(startLat: number, startLng: number, endLat: number, endLng: number): number {
  const startLatRad = startLat * Math.PI / 180;
  const startLngRad = startLng * Math.PI / 180;
  const endLatRad = endLat * Math.PI / 180;
  const endLngRad = endLng * Math.PI / 180;

  const dLng = endLngRad - startLngRad;
  const y = Math.sin(dLng) * Math.cos(endLatRad);
  const x = Math.cos(startLatRad) * Math.sin(endLatRad) -
            Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// Math helper for Haversine distance
function computeDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map center synchronizer
function MapRecenterEngine({ center, active }: { center: google.maps.LatLngLiteral; active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !active) return;
    map.panTo(center);
  }, [map, center.lat, center.lng, active]);
  return null;
}

export default function TrackingMap({
  passengerLoc,
  driverLoc,
  originLoc,
  destinationLoc,
  height = '420px',
  autoCenter = true
}: TrackingMapProps) {
  const [heading, setHeading] = useState<number>(0);

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center bg-neutral-950 border border-white/5 rounded-2xl p-8 text-center" style={{ height }}>
        <Shield size={36} className="text-[#39FF14] mb-4 animate-pulse" />
        <h2 className="text-sm font-bold font-mono text-white uppercase tracking-widest mb-2">Protocolo de Google Maps Requerido</h2>
        <p className="text-[10px] text-gray-500 max-w-sm font-mono uppercase tracking-widest leading-relaxed">
          Sincronización en tiempo real deshabilitada. Configure su GOOGLE_MAPS_PLATFORM_KEY para desbloquear el monitor táctico de geolocalización.
        </p>
      </div>
    );
  }

  const centerPoint = driverLoc || originLoc;

  return (
    <div className="w-full relative rounded-2xl overflow-hidden border border-white/5 bg-neutral-900 shadow-tactical" style={{ height }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={centerPoint}
          defaultZoom={15}
          mapId="DEMO_MAP_ID"
          styles={DARK_MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          disableDefaultUI={true}
          zoomControl={true}
        >
          {/* Synchronize Auto Recentering on vehicle */}
          <MapRecenterEngine center={centerPoint} active={autoCenter} />

          {/* Core Routes, Splitting logic, and Heading computation */}
          <LiveRouteRenderer
            origin={originLoc}
            destination={destinationLoc}
            driverCurrent={driverLoc}
            onHeadingCalculated={setHeading}
          />

          {/* Passenger Marker */}
          <AdvancedMarker position={passengerLoc} title="Pasajero">
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-2 rounded-full blur bg-[#00F0FF]/30 animate-ping" style={{ animationDuration: '3s' }}></div>
              <div className="w-6 h-6 rounded-full border border-white/20 bg-[#00F0FF] text-black flex items-center justify-center shadow-lg relative z-10">
                <MapPin size={12} className="stroke-[3]" />
              </div>
            </div>
          </AdvancedMarker>

          {/* Destination Marker */}
          <AdvancedMarker position={destinationLoc} title="Destino">
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-1 rounded-full blur bg-rose-500/30"></div>
              <div className="w-6 h-6 rounded-full border border-white/20 bg-rose-500 text-white flex items-center justify-center shadow-lg relative z-10">
                <Compass size={12} className="stroke-[3]" />
              </div>
            </div>
          </AdvancedMarker>

          {/* Active Driver Vehicle Marker */}
          {driverLoc && (
            <AdvancedMarker position={driverLoc} title="Conductor en Tránsito">
              <div 
                className="relative flex items-center justify-center transition-all duration-500 ease-out"
                style={{ transform: `rotate(${heading}deg)` }}
              >
                {/* Real-time radar shadow waves */}
                <div className="absolute -inset-3 rounded-full blur bg-[#39FF14]/20 animate-ping" style={{ animationDuration: '2s' }}></div>
                <div className="w-8 h-8 rounded-full border border-white/20 bg-black text-[#39FF14] flex items-center justify-center shadow-2xl relative z-10">
                  <Navigation size={16} className="stroke-[2.5]" />
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      {/* Tactile Map HUD Elements */}
      <div className="absolute top-4 left-4 pointer-events-none space-y-1.5">
        <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 border border-[#39FF14]/30 rounded-xl flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse"></div>
          <span className="text-[9px] font-mono text-white font-bold uppercase tracking-wider">Telemetría Zénith GPS v2.4</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md px-2.5 py-1.5 border border-white/5 rounded-lg flex items-center gap-2 text-[8px] font-mono text-gray-400 uppercase">
          <Maximize2 size={10} className="text-[#39FF14]" /> Centrado Autónomo: Activo
        </div>
      </div>
    </div>
  );
}
