/**
 * Mapa gratis (OpenStreetMap + Leaflet). Sin claves ni cobro de Google.
 * Usa círculos en vez de íconos para no depender de imágenes del paquete.
 */
import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import type { GeoPoint } from '../../api/types';

export const TRUJILLO: GeoPoint = { lat: -8.1116, lng: -79.0287 };

interface Props {
  origin?: GeoPoint | null;
  destination?: GeoPoint | null;
  driver?: GeoPoint | null;
  onPick?: (p: GeoPoint) => void;
  height?: number;
}

const tuple = (p: GeoPoint): LatLngTuple => [p.lat, p.lng];

function ClickCatcher({ onPick }: { onPick?: (p: GeoPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Encuadra los puntos visibles cada vez que cambian. */
function FitPoints({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  const latest = useRef(points);
  latest.current = points;
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  useEffect(() => {
    const pts = latest.current;
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(tuple(pts[0]), Math.max(map.getZoom(), 15));
    else map.fitBounds(pts.map(tuple), { padding: [40, 40], maxZoom: 16 });
  }, [key, map]);
  return null;
}

export default function ZenithMap({ origin, destination, driver, onPick, height = 260 }: Props) {
  const points = [origin, destination, driver].filter((p): p is GeoPoint => !!p);
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height }}>
      <MapContainer center={tuple(origin || TRUJILLO)} zoom={14} style={{ height: '100%', width: '100%' }} attributionControl>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <ClickCatcher onPick={onPick} />
        <FitPoints points={points} />
        {origin && destination && (
          <Polyline positions={[tuple(origin), tuple(destination)]} pathOptions={{ color: '#39FF14', weight: 3, dashArray: '6 8' }} />
        )}
        {origin && (
          <CircleMarker center={tuple(origin)} radius={9} pathOptions={{ color: '#000', weight: 2, fillColor: '#39FF14', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]}>Recojo</Tooltip>
          </CircleMarker>
        )}
        {destination && (
          <CircleMarker center={tuple(destination)} radius={9} pathOptions={{ color: '#000', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]}>Entrega</Tooltip>
          </CircleMarker>
        )}
        {driver && (
          <CircleMarker center={tuple(driver)} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]}>Motorizado</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
