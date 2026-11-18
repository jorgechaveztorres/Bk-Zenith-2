/**
 * Elegir una dirección: escribirla (buscador OSM), usar el GPS, o tocar el mapa.
 */
import React, { useState } from 'react';
import { Search, LocateFixed, Loader2 } from 'lucide-react';
import { GeoApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import { currentFix } from '../../api/gps';
import type { Place } from '../../api/types';

interface Props {
  label: string;
  value: Place | null;
  onChange: (p: Place) => void;
  allowGps?: boolean;
}

export default function AddressPicker({ label, value, onChange, allowGps }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const search = () => run(async () => {
    // Trujillo por defecto si no escribió la ciudad: mejora mucho los resultados de OSM.
    const q = /trujillo|la libertad|huanchaco|moche|esperanza|porvenir|victor larco/i.test(text) ? text : `${text}, Trujillo`;
    const r = await GeoApi.search(q);
    setResults(r);
    if (r.length === 0) setError('No encontramos esa dirección. Prueba con otra o toca el mapa.');
  });

  const useGps = () => run(async () => {
    const fix = await currentFix();
    onChange(await GeoApi.reverse(fix.lat, fix.lng));
    setResults([]);
  });

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase text-gray-500 tracking-widest">{label}</p>
      {value && <p className="text-sm bg-white/5 border border-[#39FF14]/30 rounded-xl px-3 py-2">{value.address}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 3 && !busy) void search();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Calle y número, o un lugar"
          className="flex-1 bg-white/5 border border-white/10 focus:border-[#39FF14]/60 rounded-xl px-3 py-2.5 text-sm outline-none"
        />
        <button type="submit" disabled={busy || text.trim().length < 3} className="px-3 rounded-xl bg-white/10 disabled:opacity-40" aria-label="Buscar">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
        {allowGps && (
          <button type="button" onClick={useGps} disabled={busy} className="px-3 rounded-xl bg-white/10 disabled:opacity-40" aria-label="Usar mi ubicación">
            <LocateFixed size={16} />
          </button>
        )}
      </form>
      {results.length > 0 && (
        <ul className="bg-black/60 border border-white/10 rounded-xl divide-y divide-white/5">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                onClick={() => {
                  onChange(r);
                  setResults([]);
                  setText('');
                }}
              >
                {r.address}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
    </div>
  );
}
