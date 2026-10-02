// ============================================================================
// ZÉNITH
// Module : Maps / Visual Assets
// File   : ZenithImperialEagleMarker.tsx
// Description: Marcador oficial de unidad ZÉNITH sobre Google Maps.
//              ÁGUILA IMPERIAL DORADA + ZÉNITH con fondo transparente
//              y halo oscuro sutil para máxima legibilidad táctica.
// ============================================================================

import React from 'react';

interface ZenithImperialEagleMarkerProps {
  size?: number;
  heading?: number | null;
  showPulse?: boolean;
  className?: string;
  title?: string;
}

export default function ZenithImperialEagleMarker({
  size = 48,
  heading = null,
  showPulse = true,
  className = '',
  title = 'Unidad Zénith'
}: ZenithImperialEagleMarkerProps) {
  const rotationStyle = heading !== null && heading !== undefined
    ? { transform: `rotate(${heading}deg)` }
    : undefined;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      title={title}
      style={{ width: size, height: size }}
    >
      {/* Halo de pulso / radar sutil para unidades activas en mapa */}
      {showPulse && (
        <div
          className="absolute -inset-2 rounded-full bg-[#D4AF37]/25 blur-sm animate-ping pointer-events-none"
          style={{ animationDuration: '3s' }}
        />
      )}

      {/* Contenedor con rotación dinámica según rumbo GPS */}
      <div
        className="relative flex items-center justify-center transition-transform duration-300 ease-out"
        style={{ ...rotationStyle, width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] filter"
          style={{
            filter: 'drop-shadow(0px 0px 2px #050505) drop-shadow(0px 2px 5px rgba(0,0,0,0.95))'
          }}
        >
          <defs>
            {/* Gradiente Dorado Imperial de Alto Impacto */}
            <linearGradient id="zenithGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF4B8" />
              <stop offset="25%" stopColor="#F7D358" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="75%" stopColor="#B38728" />
              <stop offset="100%" stopColor="#7E5616" />
            </linearGradient>

            {/* Gradiente Dorado para Iluminaciones Superiores */}
            <linearGradient id="zenithGoldHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#F5D77F" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </linearGradient>

            {/* Sombra sutil para plumas interiores */}
            <linearGradient id="zenithFeatherShade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8A631E" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#5C3F0F" />
            </linearGradient>
          </defs>

          {/* Sutil contorno/halo oscuro detrás del arte para contraste garantizado sobre mapas claros u oscuros */}
          <g stroke="#0A0A0A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9">
            {/* Silueta Ala Izquierda */}
            <path d="M 50 42 C 45 35 34 20 18 16 C 14 15 11 16 10 18 C 11 23 15 31 22 38 C 16 38 12 41 12 44 C 13 47 18 51 25 53 C 20 54 16 57 17 60 C 18 63 24 64 32 63 C 28 65 26 68 28 71 C 30 73 37 72 44 67 C 46 68 48 69 50 70" />
            {/* Silueta Ala Derecha */}
            <path d="M 50 42 C 55 35 66 20 82 16 C 86 15 89 16 90 18 C 89 23 85 31 78 38 C 84 38 88 41 88 44 C 87 47 82 51 75 53 C 80 54 84 57 83 60 C 82 63 76 64 68 63 C 72 65 74 68 72 71 C 70 73 63 72 56 67 C 54 68 52 69 50 70" />
            {/* Cabeza Imperial */}
            <path d="M 50 36 L 50 24 C 50 21 53 19 56 20 C 59 21 62 24 64 25 C 62 27 58 28 56 29 L 55 36 Z" />
            {/* Cola Imperial */}
            <path d="M 44 70 L 40 82 L 50 85 L 60 82 L 56 70 Z" />
          </g>

          {/* CUERPO DEL ÁGUILA IMPERIAL - ORO METÁLICO */}
          <g fill="url(#zenithGoldGrad)" stroke="#3D290A" strokeWidth="0.6" strokeLinejoin="round">
            {/* Cola Imperial de Abanico */}
            <path d="M 45 68 L 38 80 C 42 82 46 83 50 83 C 54 83 58 82 62 80 L 55 68 C 52 69 48 69 45 68 Z" />
            <path d="M 43 72 L 40 80 M 47 72 L 46 82 M 50 72 L 50 83 M 53 72 L 54 82 M 57 72 L 60 80" stroke="#7E5616" strokeWidth="0.6" />

            {/* Ala Izquierda Desplegada (Plumas Primarias y Secundarias) */}
            <path d="M 49 42 C 43 34 32 20 18 16 C 14 15 11 17 11 19 C 13 24 17 31 23 37 C 17 38 13 41 13 44 C 14 47 19 50 26 52 C 21 54 17 57 18 60 C 19 63 25 63 32 62 C 28 65 27 68 29 70 C 31 72 38 71 44 66 C 47 58 48 50 49 42 Z" />

            {/* Ranuras/Plumas Ala Izquierda */}
            <path d="M 23 23 C 28 27 34 34 40 40" stroke="#FFF4B8" strokeWidth="0.8" opacity="0.8" />
            <path d="M 20 31 C 26 35 32 41 38 46" stroke="#7E5616" strokeWidth="0.6" />
            <path d="M 23 42 C 29 45 35 49 41 52" stroke="#7E5616" strokeWidth="0.6" />
            <path d="M 27 52 C 32 54 37 57 42 60" stroke="#7E5616" strokeWidth="0.6" />

            {/* Ala Derecha Desplegada (Simetría Imperial) */}
            <path d="M 51 42 C 57 34 68 20 82 16 C 86 15 89 17 89 19 C 87 24 83 31 77 37 C 83 38 87 41 87 44 C 86 47 81 50 74 52 C 79 54 83 57 82 60 C 81 63 75 63 68 62 C 72 65 73 68 71 70 C 69 72 62 71 56 66 C 53 58 52 50 51 42 Z" />

            {/* Ranuras/Plumas Ala Derecha */}
            <path d="M 77 23 C 72 27 66 34 60 40" stroke="#FFF4B8" strokeWidth="0.8" opacity="0.8" />
            <path d="M 80 31 C 74 35 68 41 62 46" stroke="#7E5616" strokeWidth="0.6" />
            <path d="M 77 42 C 71 45 65 49 59 52" stroke="#7E5616" strokeWidth="0.6" />
            <path d="M 73 52 C 68 54 63 57 58 60" stroke="#7E5616" strokeWidth="0.6" />

            {/* Pecho y Torso Imperial */}
            <path d="M 46 36 C 44 42 43 54 44 66 C 47 69 53 69 56 66 C 57 54 56 42 54 36 Z" fill="url(#zenithGoldGrad)" />

            {/* Escamas/Plumas del Pecho */}
            <path d="M 47 43 Q 50 46 53 43" stroke="#7E5616" strokeWidth="0.7" fill="none" />
            <path d="M 46 49 Q 50 52 54 49" stroke="#7E5616" strokeWidth="0.7" fill="none" />
            <path d="M 46 55 Q 50 58 54 55" stroke="#7E5616" strokeWidth="0.7" fill="none" />
            <path d="M 47 61 Q 50 63 53 61" stroke="#7E5616" strokeWidth="0.7" fill="none" />

            {/* Cabeza Imperial en Perfil Vigilante */}
            <path d="M 48 36 L 47 24 C 47 20 51 17 55 18 C 59 19 63 21 66 23 C 63 25 58 26 56 28 L 54 36 Z" />
            {/* Pico Afilado */}
            <path d="M 59 20 L 67 23 C 65 24 62 25 58 25 Z" fill="#FFEAA7" stroke="#5C3F0F" strokeWidth="0.5" />
            {/* Ojo Imperial */}
            <circle cx="54" cy="21.5" r="1.1" fill="#0A0A0A" />
            <circle cx="54.3" cy="21.2" r="0.4" fill="#FFFFFF" />

            {/* Garras / Talones */}
            <path d="M 44 66 L 42 70 M 46 67 L 45 71 M 54 67 L 55 71 M 56 66 L 58 70" stroke="#FFEAA7" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* PALABRA TIPOGRÁFICA: ZÉNITH EN ORO IMPERIAL */}
          <g>
            {/* Trazo oscuro exterior para legibilidad */}
            <text
              x="50"
              y="95"
              textAnchor="middle"
              fontFamily="ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif"
              fontWeight="900"
              fontSize="10.5"
              letterSpacing="2.2"
              fill="none"
              stroke="#000000"
              strokeWidth="2.8"
              strokeLinejoin="round"
            >
              ZÉNITH
            </text>
            {/* Relleno Dorado */}
            <text
              x="50"
              y="95"
              textAnchor="middle"
              fontFamily="ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif"
              fontWeight="900"
              fontSize="10.5"
              letterSpacing="2.2"
              fill="url(#zenithGoldGrad)"
              stroke="#5C3F0F"
              strokeWidth="0.4"
            >
              ZÉNITH
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
