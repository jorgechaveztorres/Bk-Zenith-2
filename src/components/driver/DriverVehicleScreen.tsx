import React, { useState, useEffect } from 'react';
import { DriverService } from '../../services/DriverService';
import { motion } from 'motion/react';
import { Car, CreditCard, Tag, Calendar, Palette, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { User } from '../../types';

interface DriverVehicleScreenProps {
  user: User;
  onSuccess: () => void;
}

export default function DriverVehicleScreen({ user, onSuccess }: DriverVehicleScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState(user.driverProfile?.vehicle?.category || 'Zenith Standard');
  const [plate, setPlate] = useState(user.driverProfile?.vehicle?.plate || '');
  const [brand, setBrand] = useState(user.driverProfile?.vehicle?.brand || '');
  const [model, setModel] = useState(user.driverProfile?.vehicle?.model || '');
  const [year, setYear] = useState<number>(user.driverProfile?.vehicle?.year || new Date().getFullYear());
  const [color, setColor] = useState(user.driverProfile?.vehicle?.color || '');

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const errors: Record<string, string> = {};
    if (plate.trim() && !/^[A-Z0-9-]{6,8}$/i.test(plate.trim())) {
      errors.plate = 'Ingrese un formato de placa válido (ej: ABC-123 o 1234-AB)';
    }
    if (year && (year < 2010 || year > new Date().getFullYear() + 1)) {
      errors.year = 'El vehículo debe ser del año 2010 o posterior';
    }
    setValidationErrors(errors);
  }, [plate, year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    setError(null);

    try {
      await DriverService.updateVehicleDetails(
        user.uid,
        category,
        plate.trim().toUpperCase(),
        brand.trim(),
        model.trim(),
        Number(year),
        color.trim()
      );
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Car className="text-[#39FF14]" size={24} />
        </div>
        <h2 className="text-2xl font-black tracking-tight uppercase italic text-[#39FF14]">
          Datos del Vehículo
        </h2>
        <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
          Registre las especificaciones oficiales de su unidad de transporte
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Categoría de Servicio Zénith</label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all appearance-none text-white"
            >
              <option value="Zenith Standard">Zenith Standard (Sedán / Hatchback)</option>
              <option value="Zenith SUV">Zenith SUV (Familiar / Amplio)</option>
              <option value="Zenith Premium">Zenith Premium (Ejecutivo / Lujo)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Placa / Matrícula</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className={`w-full bg-white/5 border ${validationErrors.plate ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all placeholder-gray-600 uppercase`}
                placeholder="ABC-123"
                required
              />
            </div>
            {validationErrors.plate && <span className="text-[9px] text-red-400 font-mono mt-1 block">{validationErrors.plate}</span>}
          </div>

          <div>
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Color de Carrocería</label>
            <div className="relative">
              <Palette className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-[#39FF14]/50 outline-none transition-all placeholder-gray-600"
                placeholder="Negro Perlado"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Año</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="number"
                value={year || ''}
                onChange={(e) => setYear(Number(e.target.value))}
                className={`w-full bg-white/5 border ${validationErrors.year ? 'border-red-500/50' : 'border-white/10'} rounded-xl py-3 pl-8 pr-2 text-sm focus:border-[#39FF14]/50 outline-none transition-all placeholder-gray-600`}
                placeholder="2022"
                required
              />
            </div>
            {validationErrors.year && <span className="text-[8px] text-red-400 font-mono mt-1 block leading-tight">{validationErrors.year}</span>}
          </div>

          <div className="col-span-1">
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Marca</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-sm focus:border-[#39FF14]/50 outline-none transition-all placeholder-gray-600"
              placeholder="Toyota"
              required
            />
          </div>

          <div className="col-span-1">
            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Modelo</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-sm focus:border-[#39FF14]/50 outline-none transition-all placeholder-gray-600"
              placeholder="Corolla"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || Object.keys(validationErrors).length > 0}
          className="w-full mt-4 py-3 bg-[#39FF14] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          Guardar y Continuar
        </button>
      </form>
    </div>
  );
}
