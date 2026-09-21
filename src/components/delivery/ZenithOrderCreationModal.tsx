import React, { useState } from 'react';
import { User, Solicitante, Pagador, Receptor, ProductType, PackageInfo, EvidenceLevel, Location, RideStatus, SolicitudeStatus, TransitStatus, DeliveryStatus, CustodyStatus } from '../../types';
import { OperationalEngine } from '../../services/OperationalEngine';
import { calculatePricing } from '../../utils/pricingEngine';
import PlacesAutocomplete from '../PlacesAutocomplete';
import { 
  Package, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  DollarSign, 
  UserCheck, 
  Check, 
  X, 
  FileText,
  Camera,
  Layers,
  ArrowRight
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface ZenithOrderCreationModalProps {
  user: User;
  onClose: () => void;
  onOrderCreated: (orderId: string) => void;
  initialOrigin?: Location;
}

export default function ZenithOrderCreationModal({
  user,
  onClose,
  onOrderCreated,
  initialOrigin
}: ZenithOrderCreationModalProps) {
  // Origin & Destination
  const [origin, setOrigin] = useState<Location>(
    initialOrigin || { address: 'Trujillo Centro, La Libertad, Perú', lat: -8.11189, lng: -79.02875 }
  );
  const [destination, setDestination] = useState<Location>({
    address: '',
    lat: -8.12189,
    lng: -79.01875
  });

  // Package Information
  const [productDescription, setProductDescription] = useState('');
  const [productType, setProductType] = useState<ProductType>(ProductType.NON_PERISHABLE);
  const [declaredValue, setDeclaredValue] = useState<number>(50);
  const [conditionNotes, setConditionNotes] = useState('');

  // The 4 Protagonists Setup
  const [separatePagador, setSeparatePagador] = useState(false);
  const [pagadorName, setPagadorName] = useState(user.fullName || '');
  const [pagadorPhone, setPagadorPhone] = useState(user.phone || '999888777');
  const [pagadorAcceptedTerms, setPagadorAcceptedTerms] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET' | 'YAPE_PLIN'>('WALLET');

  const [receptorName, setReceptorName] = useState('');
  const [receptorPhone, setReceptorPhone] = useState('');
  const [receptorReference, setReceptorReference] = useState('');

  // Mandatory Contingency and Terms Acceptance
  const [acceptedContingency, setAcceptedContingency] = useState(true);
  const [acceptedOperationalTerms, setAcceptedOperationalTerms] = useState(true);

  // States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check pending debt blocking
  const userDebt = user.pendingDebt || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (userDebt > 0) {
      setError(`Debe regularizar su deuda pendiente de S/ ${userDebt.toFixed(2)} antes de iniciar una nueva operación.`);
      return;
    }

    if (!destination.address) {
      setError('Especifique la dirección de entrega de destino.');
      return;
    }

    if (!productDescription.trim()) {
      setError('Ingrese la descripción del producto o paquete a trasladar.');
      return;
    }

    if (!receptorName.trim() || !receptorPhone.trim()) {
      setError('Identifique al Receptor (nombre y teléfono requeridos para el protocolo de entrega).');
      return;
    }

    if (separatePagador && !pagadorAcceptedTerms) {
      setError('El Pagador debe aceptar explícitamente la responsabilidad económica de la operación.');
      return;
    }

    if (!acceptedContingency) {
      setError('Debe aceptar la cláusula de contingencia de devolución al punto de recojo.');
      return;
    }

    if (!acceptedOperationalTerms) {
      setError('Debe aceptar las condiciones de operación, espera y cancelación de Zénith MVP V1.1.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Calculate fare using Zénith pricing engine
      const pricing = calculatePricing(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        origin.address,
        destination.address
      );
      const fare = pricing.totalFare || 12.0;

      // 2. Build Protagonists
      const solicitante: Solicitante = {
        uid: user.uid,
        name: user.fullName || 'Usuario Zénith',
        phone: user.phone || '999888777',
        email: user.email
      };

      const pagador: Pagador = {
        uid: separatePagador ? `ext_${Date.now()}` : user.uid,
        name: pagadorName,
        phone: pagadorPhone,
        acceptedEconomicTerms: true,
        paymentMethod
      };

      const receptor: Receptor = {
        name: receptorName,
        phone: receptorPhone,
        address: destination.address,
        reference: receptorReference,
        lat: destination.lat,
        lng: destination.lng,
        deliveryNotes: conditionNotes
      };

      // 3. Package Info
      const packageInfo: PackageInfo = {
        description: productDescription,
        type: productType,
        declaredValue,
        packageConditionNotes: conditionNotes,
        initialPhotos: []
      };

      // 4. Evidence Level
      const evidenceLevel = OperationalEngine.determineEvidenceLevel(packageInfo);

      // 5. Build Initial Delivery Operation in Firestore
      const newRideDoc = await addDoc(collection(db, 'rides'), {
        passengerId: user.uid,
        passengerName: user.fullName,
        solicitante,
        pagador,
        receptor,
        origin,
        destination,
        protectedPrice: fare,
        pricingSeal: pricing.seal || `ZENITH-SEAL-${Date.now()}`,
        pricingVersion: '2.0.1-enterprise',
        distance: pricing.distance || 3.5,
        duration: pricing.duration || 12,
        
        // 4 State Dimensions
        status: RideStatus.SEARCHING_DRIVER,
        solicitudeStatus: SolicitudeStatus.REQUESTED,
        transitStatus: TransitStatus.IDLE,
        deliveryStatus: DeliveryStatus.PENDING,
        custodyStatus: CustodyStatus.NONE,

        evidenceLevel,
        packageInfo,
        returnContingency: {
          agreed: true,
          returnLocation: origin,
          returnFareAdditional: Number((fare * 0.8).toFixed(2))
        },
        communicationAttempts: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Record Event
      await OperationalEngine.recordEvent(
        newRideDoc.id,
        { role: 'SOLICITANTE', id: user.uid, name: user.fullName },
        'SOLICITUDE_CREATED',
        `Solicitud de entrega creada para motorizado. Producto: "${productDescription}" (${productType === ProductType.PERISHABLE ? 'Perecible - 60 min ventana' : 'No Perecible - 48h'}). Nivel de evidencia: ${evidenceLevel}.`,
        origin.lat,
        origin.lng,
        { fare, evidenceLevel, productType }
      );

      onOrderCreated(newRideDoc.id);
      onClose();
    } catch (err: unknown) {
      console.error('[ZENITH-ORDER-ERROR]', err);
      setError(err instanceof Error ? err.message : 'Error al crear la solicitud de entrega.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0c0d0e] border border-[#39FF14]/30 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-left my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#39FF14]/15 border border-[#39FF14]/40 flex items-center justify-center text-[#39FF14]">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                Nueva Operación de Entrega
              </h2>
              <p className="text-[10px] font-mono text-[#39FF14] uppercase tracking-widest font-bold">
                ZÉNITH MVP V1.1 — PROTOCOLO MOTORIZADO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Debt Blocker Notice if applicable */}
        {userDebt > 0 && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono space-y-2">
            <div className="flex items-center gap-2 font-bold uppercase">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>Deuda Pendiente de Regularización</span>
            </div>
            <p className="text-[11px] text-gray-300">
              Usted mantiene una obligación económica pendiente de <strong className="text-white">S/ {userDebt.toFixed(2)}</strong> ({user.pendingDebtReason || 'Penalidad de cancelación previa'}). La regla de Zénith estipula la regularización de la deuda antes de iniciar nuevas operaciones.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: UBICACIONES (RECOJO & ENTREGA) */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-black flex items-center gap-2">
              <MapPin size={14} className="text-[#39FF14]" />
              1. Puntos Operacionales de Recojo y Destino
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Punto de Recojo (Origen)</span>
                <input
                  type="text"
                  value={origin.address}
                  onChange={(e) => setOrigin({ ...origin, address: e.target.value })}
                  placeholder="Ej: Av. Larco 450, Trujillo"
                  className="w-full bg-transparent text-sm text-white font-medium focus:outline-none"
                  required
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Punto de Entrega (Destino Inmutable)</span>
                <PlacesAutocomplete
                  value={destination.address}
                  onLocationSelect={(loc) => setDestination(loc)}
                  placeholder="Ingrese dirección de entrega..."
                  icon={<MapPin size={16} className="text-[#39FF14]" />}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PRODUCTO Y TIPO DE CUSTODIA */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-black flex items-center gap-2">
              <Package size={14} className="text-[#39FF14]" />
              2. Caracterización del Producto y Regla de Custodia
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Descripción del Producto</span>
                <input
                  type="text"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Ej: Documentos legales / Paquete de repuestos / Alimentos"
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                  required
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Valor Declarado (S/)</span>
                <input
                  type="number"
                  min="0"
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(Number(e.target.value))}
                  className="w-full bg-transparent text-sm text-white focus:outline-none font-mono font-bold"
                />
              </div>
            </div>

            {/* Perishable vs Non-Perishable Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setProductType(ProductType.NON_PERISHABLE)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  productType === ProductType.NON_PERISHABLE
                    ? 'bg-[#39FF14]/15 border-[#39FF14] text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase">No Perecible</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/40 text-emerald-400 font-black">
                    48 HORAS CUSTODIA
                  </span>
                </div>
                <p className="text-[10px] text-gray-300">
                  En caso de no completarse la entrega, el custodio conserva el producto por hasta 48 horas para solicitud de Pedido 2 / Recuperación.
                </p>
              </div>

              <div
                onClick={() => setProductType(ProductType.PERISHABLE)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  productType === ProductType.PERISHABLE
                    ? 'bg-amber-500/20 border-amber-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase text-amber-400">Perecible (Comida / Frescos)</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/40 text-amber-400 font-black">
                    60 MINUTOS VENTANA
                  </span>
                </div>
                <p className="text-[10px] text-gray-300">
                  Ventana de recuperación estricta de 60 minutos tras entrega fallida. Pasado este tiempo la custodia expira automáticamente.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: LOS 4 PROTAGONISTAS (RECEPTOR Y PAGADOR) */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-black flex items-center gap-2">
              <UserCheck size={14} className="text-[#39FF14]" />
              3. Identificación de Protagonistas (Receptor y Pagador)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Nombre del Receptor</span>
                <input
                  type="text"
                  value={receptorName}
                  onChange={(e) => setReceptorName(e.target.value)}
                  placeholder="Persona que recibe y dará el OTP"
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                  required
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1">
                <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">Teléfono del Receptor</span>
                <input
                  type="tel"
                  value={receptorPhone}
                  onChange={(e) => setReceptorPhone(e.target.value)}
                  placeholder="Para protocolo de 4 niveles de comunicación"
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Separate Pagador Toggle */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-300">
                <input
                  type="checkbox"
                  checked={separatePagador}
                  onChange={(e) => setSeparatePagador(e.target.checked)}
                  className="accent-[#39FF14]"
                />
                <span>El Pagador es una persona o empresa diferente al Solicitante</span>
              </label>

              {separatePagador && (
                <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={pagadorName}
                    onChange={(e) => setPagadorName(e.target.value)}
                    placeholder="Razón Social o Nombre del Pagador"
                    className="bg-black/50 border border-white/10 p-2 rounded-xl text-xs text-white"
                  />
                  <input
                    type="tel"
                    value={pagadorPhone}
                    onChange={(e) => setPagadorPhone(e.target.value)}
                    placeholder="Teléfono del Pagador"
                    className="bg-black/50 border border-white/10 p-2 rounded-xl text-xs text-white"
                  />
                  <label className="sm:col-span-2 flex items-center gap-2 text-[10px] text-[#39FF14] font-mono">
                    <input
                      type="checkbox"
                      checked={pagadorAcceptedTerms}
                      onChange={(e) => setPagadorAcceptedTerms(e.target.checked)}
                      className="accent-[#39FF14]"
                    />
                    <span>El pagador asume expresamente la responsabilidad económica y costos de espera/cancelación.</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: CLÁUSULA DE CONTINGENCIA Y CONDICIONES (Secciones 24 y 26) */}
          <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[11px] font-mono text-[#39FF14] uppercase tracking-wider font-black flex items-center gap-2">
              <ShieldCheck size={14} />
              4. Condiciones Operacionales y Contingencia Congelada
            </p>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={acceptedContingency}
                onChange={(e) => setAcceptedContingency(e.target.checked)}
                className="accent-[#39FF14] mt-0.5"
              />
              <span>
                <strong>Contingencia de Devolución:</strong> "En caso de no poder realizar la entrega se devolverá al punto de recojo con el correspondiente pago por el servicio extra más los tiempos de espera."
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={acceptedOperationalTerms}
                onChange={(e) => setAcceptedOperationalTerms(e.target.checked)}
                className="accent-[#39FF14] mt-0.5"
              />
              <span>
                <strong>Protocolo de Espera y Cancelaciones:</strong> 5 minutos de espera incluidos en destino. Penalidad por cancelación de usuario según distancia hacia recojo (&lt;1km: 0%, 1-2km: 15%, &ge;2km: 30%) imputable como deuda. Entrega confirmada exclusivamente con OTP.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 font-mono text-xs uppercase font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || userDebt > 0}
              className="flex-2 py-3.5 rounded-2xl bg-[#39FF14] hover:bg-[#32e012] text-black font-mono text-xs uppercase font-black tracking-wider shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Emitiendo Solicitud...' : 'Emitir Operación Zénith'}
              <ArrowRight size={14} />
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
