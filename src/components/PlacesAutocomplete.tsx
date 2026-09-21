import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Location } from '../types';
import { MapPin } from 'lucide-react';

interface PlacesAutocompleteProps {
  placeholder: string;
  value: string;
  onLocationSelect: (location: Location) => void;
  icon: React.ReactNode;
  locationBias?: google.maps.LatLngLiteral;
}

export default function PlacesAutocomplete({
  placeholder,
  value,
  onLocationSelect,
  icon,
  locationBias
}: PlacesAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keep input value in sync when the parent updates it (e.g., Geolocation)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!placesLib) return;
    autocompleteService.current = new placesLib.AutocompleteService();
    const dummyDiv = document.createElement('div');
    placesService.current = new placesLib.PlacesService(dummyDiv);
    sessionToken.current = new placesLib.AutocompleteSessionToken();
  }, [placesLib]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    
    if (!text.trim()) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    if (!autocompleteService.current) return;

    setLoading(true);

    const request: google.maps.places.AutocompletionRequest = {
      input: text,
      sessionToken: sessionToken.current || undefined,
      componentRestrictions: { country: 'pe' },
    };

    if (locationBias && window.google?.maps?.Circle) {
      // Sesgo suave de 50km alrededor del usuario para priorizar su localidad sin impedir búsquedas en otras ciudades
      request.locationBias = new window.google.maps.Circle({
        center: locationBias,
        radius: 50000,
      });
    }

    autocompleteService.current.getPlacePredictions(
      request,
      (preds, status) => {
        setLoading(false);
        if (status === 'OK' && preds) {
          setPredictions(preds);
          setIsOpen(true);
        } else {
          setPredictions([]);
        }
      }
    );
  };

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;
    
    setInputValue(prediction.description);
    setIsOpen(false);
    setLoading(true);

    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'formatted_address']
      },
      (place, status) => {
        setLoading(false);
        if (status === 'OK' && place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          
          onLocationSelect({
            address: prediction.description,
            lat,
            lng,
            placeId: prediction.place_id,
            formattedAddress: place.formatted_address || prediction.description
          });
          
          // Generate a new session token for the next transaction
          if (placesLib) {
            sessionToken.current = new placesLib.AutocompleteSessionToken();
          }
        } else {
          console.error("Places details query failed: ", status);
        }
      }
    );
  };

  return (
    <div className="relative group w-full" ref={dropdownRef}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#39FF14] transition-colors z-10">
        {icon}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (predictions.length > 0) setIsOpen(true);
        }}
        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 transition-all text-sm font-mono uppercase tracking-widest placeholder:text-gray-700 text-white"
        placeholder={placeholder}
      />
      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          <div className="w-4 h-4 border border-[#39FF14] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {isOpen && predictions.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-[#0a0a0a]/95 backdrop-blur-md border border-white/10 rounded-xl max-h-60 overflow-y-auto z-50 shadow-glow">
          {predictions.map((pred) => (
            <div
              key={pred.place_id}
              onClick={() => handleSelectPrediction(pred)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#39FF14]/10 hover:text-[#39FF14] cursor-pointer border-b border-white/5 last:border-b-0 transition-colors text-xs font-mono uppercase tracking-wider text-left text-gray-300"
            >
              <MapPin size={14} className="text-gray-500 shrink-0" />
              <div className="truncate">
                <p className="font-bold truncate text-white group-hover:text-[#39FF14]">{pred.structured_formatting.main_text}</p>
                <p className="text-[10px] text-gray-500 truncate">{pred.structured_formatting.secondary_text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
