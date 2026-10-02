// ============================================================================
// ZÉNITH
// Module : Driver / Wallet Topup Modal V1 (Pilot Yape Personal con Validación Humana)
// Layer  : UI Component
// File   : DriverTopupModal.tsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Send,
  Upload,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldCheck,
  Eye,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { WalletService } from '../../services/WalletService';
import { TopupRequest, TopupStatus } from '../../types';

interface DriverTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentBalance: number;
}

export const DriverTopupModal: React.FC<DriverTopupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentBalance
}) => {
  const [amount, setAmount] = useState<number>(20);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTopup, setActiveTopup] = useState<TopupRequest | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [operatorMode, setOperatorMode] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Campos para la validación humana del operador
  const [operatorReceivedAmount, setOperatorReceivedAmount] = useState<string>('');
  const [operatorOpNumber, setOperatorOpNumber] = useState<string>('');
  const [operatorPayerName, setOperatorPayerName] = useState<string>('');
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  // Datos oficiales del Yape receptor para el Piloto
  const OFFICIAL_YAPE_PHONE = '973261225';
  const OFFICIAL_YAPE_FORMATTED = '+51 973 261 225';
  const OFFICIAL_YAPE_NAME = 'ZÉNITH Operaciones Piloto';

  // Sincronizar inputs de operador cuando cambia el topup activo
  useEffect(() => {
    if (activeTopup) {
      setOperatorReceivedAmount(activeTopup.requestedAmount.toString());
      setOperatorPayerName(activeTopup.driverName || '');
    }
  }, [activeTopup]);

  // Polling automático mientras el topup esté en proceso
  useEffect(() => {
    let interval: any = null;
    if (activeTopup && activeTopup.status !== 'CREDITED' && activeTopup.status !== 'REJECTED') {
      interval = setInterval(async () => {
        try {
          const updated = await WalletService.getTopupStatus(activeTopup.id);
          setActiveTopup(updated);
          if (updated.status === 'CREDITED') {
            onSuccess();
          }
        } catch (e) {
          console.warn('[TOPUP-POLL] Error consultando estado:', e);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTopup]);

  if (!isOpen) return null;

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;

  // 1. Crear Solicitud de Recarga
  const handleCreateRequest = async () => {
    if (!effectiveAmount || effectiveAmount <= 0 || isNaN(effectiveAmount)) {
      setErrorMessage('Por favor ingrese un monto válido mayor a S/ 0.00');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const topup = await WalletService.createTopupRequest(effectiveAmount);
      setActiveTopup(topup);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al iniciar la solicitud de recarga.');
    } finally {
      setLoading(false);
    }
  };

  // Copiar al portapapeles
  const copyToClipboard = (text: string, isPhone = false) => {
    navigator.clipboard.writeText(text);
    if (isPhone) {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Abrir WhatsApp con mensaje prellenado
  const handleOpenWhatsApp = () => {
    if (!activeTopup) return;
    const message = encodeURIComponent(
      `Hola ZÉNITH, envío mi comprobante de recarga de S/ ${activeTopup.requestedAmount.toFixed(2)} con Código de Referencia: ${activeTopup.referenceCode}`
    );
    window.open(`https://wa.me/51${OFFICIAL_YAPE_PHONE}?text=${message}`, '_blank');
  };

  // Subir comprobante desde la app (evidencia auxiliar opcional)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        if (activeTopup) {
          setSubmittingReceipt(true);
          try {
            const updated = await WalletService.submitReceipt(activeTopup.id, base64);
            setActiveTopup(updated);
          } catch (err: any) {
            setErrorMessage(err.message || 'Error subiendo comprobante');
          } finally {
            setSubmittingReceipt(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Operador confirma movimiento real en el Yape receptor
  const handleOperatorConfirmMovement = async () => {
    if (!activeTopup) return;
    const received = parseFloat(operatorReceivedAmount);
    if (isNaN(received) || received <= 0) {
      setErrorMessage('Ingrese un monto recibido válido mayor a S/ 0.00');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const now = new Date();
      const bankMovement = {
        amount: received,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        payerName: operatorPayerName || activeTopup.driverName,
        operationNumber: operatorOpNumber || `OP-${Math.floor(100000 + Math.random() * 900000)}`,
        operatorNotes: operatorNotes || 'Validado visualmente en el Yape receptor oficial de ZÉNITH.'
      };

      const updated = await WalletService.reconcileTopup(activeTopup.id, bankMovement);
      setActiveTopup(updated);
    } catch (e: any) {
      setErrorMessage(e.message || 'Error en confirmación de operador');
    } finally {
      setLoading(false);
    }
  };

  // Operador aprueba manualmente caso en REVIEW
  const handleOperatorApproveReview = async () => {
    if (!activeTopup) return;
    setLoading(true);
    try {
      const updated = await WalletService.approveReviewTopup(
        activeTopup.id,
        operatorNotes || 'Aprobado manualmente tras validación de extracto.'
      );
      setActiveTopup(updated);
    } catch (e: any) {
      setErrorMessage(e.message || 'Error aprobando revisión.');
    } finally {
      setLoading(false);
    }
  };

  // Operador rechaza recarga
  const handleOperatorReject = async () => {
    if (!activeTopup) return;
    if (!rejectReason) {
      setErrorMessage('Especifique el motivo del rechazo.');
      return;
    }

    setLoading(true);
    try {
      const updated = await WalletService.rejectTopup(activeTopup.id, rejectReason);
      setActiveTopup(updated);
      setShowRejectInput(false);
    } catch (e: any) {
      setErrorMessage(e.message || 'Error rechazando solicitud.');
    } finally {
      setLoading(false);
    }
  };

  // Operador ejecuta acreditación atómica
  const handleOperatorCredit = async () => {
    if (!activeTopup) return;
    setLoading(true);
    try {
      await WalletService.creditVerifiedTopup(activeTopup.id);
      const updated = await WalletService.getTopupStatus(activeTopup.id);
      setActiveTopup(updated);
      onSuccess();
    } catch (e: any) {
      setErrorMessage(e.message || 'Error en acreditación atómica.');
    } finally {
      setLoading(false);
    }
  };

  // Render del estado actual
  const renderStatusBadge = (status: TopupStatus) => {
    switch (status) {
      case 'CREATED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-[11px] font-mono font-bold">
            <Clock size={12} /> Pendiente de Yape
          </span>
        );
      case 'RECEIPT_SUBMITTED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-[11px] font-mono font-bold">
            <Upload size={12} /> Comprobante Recibido (Pendiente Revisión)
          </span>
        );
      case 'EXTRACTED_BY_AI':
      case 'RECONCILING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-[11px] font-mono font-bold">
            <Clock size={12} /> En Verificación Humana
          </span>
        );
      case 'REVIEW':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-full text-[11px] font-mono font-bold">
            <AlertCircle size={12} /> En Revisión Manual ZÉNITH
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[11px] font-mono font-bold">
            <ShieldCheck size={12} /> Ingreso Confirmado por Operador
          </span>
        );
      case 'CREDITED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-[#39FF14]/15 border border-[#39FF14]/40 text-[#39FF14] rounded-full text-[11px] font-mono font-bold">
            <CheckCircle2 size={12} /> ¡Saldo Acreditado en Wallet!
          </span>
        );
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full text-[11px] font-mono font-bold">
            <XCircle size={12} /> Solicitud Rechazada
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl text-white">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
              Y
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wider uppercase font-mono">
                Recargar Wallet · Yape
              </h3>
              <p className="text-[10px] text-gray-400">Piloto V1 · Validación Humana en Cuenta Receptora</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Mensaje de error si existe */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PASO 1: Si no hay solicitud activa, formulario de monto */}
          {!activeTopup ? (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950/80 border border-white/5 rounded-2xl">
                <p className="text-xs text-gray-400 mb-1">Saldo actual en Billetera:</p>
                <p className="text-2xl font-black font-mono text-[#39FF14]">
                  S/ {currentBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Selecciona el Monto a Recargar:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-3 text-xs font-mono font-black rounded-xl border transition-all ${
                        amount === amt && !customAmount
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                          : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/20'
                      }`}
                    >
                      S/ {amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1">
                  O introduce un monto personalizado (Soles):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-gray-400">S/</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Otro monto..."
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Modelo de Prepago Estricto ZÉNITH
                </p>
                <p className="text-gray-400">
                  El saldo se utilizará exclusivamente para cubrir la comisión de plataforma (13%) de los viajes aceptados.
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleCreateRequest}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-mono font-black py-3 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Generar Solicitud de Recarga'}
              </button>
            </div>
          ) : (
            /* PASO 2: Instrucciones de Yape y Seguimiento de la Solicitud */
            <div className="space-y-4">
              
              {/* Badge de Estado */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-gray-400">Estado de Recarga:</span>
                {renderStatusBadge(activeTopup.status)}
              </div>

              {/* AVISO LEGAL / NORMA FUNDAMENTAL OBLIGATORIA */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200 font-mono">
                <AlertCircle size={16} className="shrink-0 text-amber-400 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Aviso Operativo:</strong> El comprobante no confirma el pago. La recarga se acredita únicamente después de verificar el ingreso real de fondos en la cuenta receptora de ZÉNITH.
                </p>
              </div>

              {/* Tarjeta de Instrucción Principal */}
              <div className="bg-gradient-to-br from-purple-950/40 via-neutral-950 to-neutral-950 border border-purple-500/30 rounded-2xl p-5 space-y-3">
                <div className="text-center pb-2 border-b border-white/10">
                  <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest">
                    Monto a Enviar por Yape
                  </span>
                  <p className="text-3xl font-black font-mono text-white mt-1">
                    S/ {activeTopup.requestedAmount.toFixed(2)}
                  </p>
                </div>

                {/* Número Receptor */}
                <div className="flex items-center justify-between p-3 bg-black/60 border border-white/5 rounded-xl">
                  <div>
                    <span className="text-[10px] font-mono text-gray-400 uppercase">Yape ZÉNITH Piloto:</span>
                    <p className="text-sm font-black font-mono text-purple-400">{OFFICIAL_YAPE_FORMATTED}</p>
                    <p className="text-[10px] text-gray-400">{OFFICIAL_YAPE_NAME}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(OFFICIAL_YAPE_PHONE, true)}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono flex items-center gap-1 text-gray-300"
                  >
                    {copiedPhone ? <Check size={14} className="text-[#39FF14]" /> : <Copy size={14} />}
                    <span>{copiedPhone ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Código de Referencia Obligatorio */}
                <div className="flex items-center justify-between p-3 bg-purple-600/10 border border-purple-500/30 rounded-xl">
                  <div>
                    <span className="text-[10px] font-mono text-purple-300 uppercase font-bold">
                      Código de Referencia Único:
                    </span>
                    <p className="text-base font-black font-mono text-white tracking-widest">
                      {activeTopup.referenceCode}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(activeTopup.referenceCode, false)}
                    className="p-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-lg text-xs font-mono flex items-center gap-1 text-purple-300"
                  >
                    {copiedCode ? <Check size={14} className="text-[#39FF14]" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Botón WhatsApp & Subida de Comprobante Opcional */}
              {activeTopup.status !== 'CREDITED' && activeTopup.status !== 'REJECTED' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Send size={15} />
                    YA REALICÉ EL YAPE (Avisar por WhatsApp)
                  </button>

                  <div className="text-center text-[10px] text-gray-400">
                    O adjunta la captura en la app como evidencia auxiliar opcional:
                  </div>

                  <label className="w-full py-2.5 bg-neutral-950 border border-dashed border-white/20 hover:border-purple-500/50 rounded-xl flex items-center justify-center gap-2 text-xs font-mono text-gray-300 cursor-pointer transition-all">
                    <Upload size={14} className="text-purple-400" />
                    <span>{submittingReceipt ? 'Guardando comprobante...' : 'Adjuntar Captura del Comprobante (Opcional)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={submittingReceipt}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Si se adjuntó comprobante, mostrar botón de previsualización */}
              {activeTopup.receiptBase64 && (
                <div className="p-3 bg-neutral-950/80 border border-white/5 rounded-xl text-xs space-y-2 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                      <FileText size={12} className="text-purple-400" /> Comprobante Visual Registrado:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReceiptPreview(!showReceiptPreview)}
                      className="text-purple-400 hover:text-purple-300 text-[11px] flex items-center gap-1"
                    >
                      <Eye size={12} /> {showReceiptPreview ? 'Ocultar' : 'Ver Captura'}
                    </button>
                  </div>
                  {showReceiptPreview && (
                    <div className="pt-2">
                      <img
                        src={activeTopup.receiptBase64}
                        alt="Comprobante Yape"
                        className="max-h-48 rounded-lg border border-white/10 mx-auto object-contain"
                      />
                    </div>
                  )}
                  <p className="text-[9px] text-gray-500 italic">
                    * Evidencia auxiliar para verificación visual del operador.
                  </p>
                </div>
              )}

              {/* Mensaje de Éxito cuando se acredita */}
              {activeTopup.status === 'CREDITED' && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                  <CheckCircle2 size={32} className="text-[#39FF14] mx-auto" />
                  <h4 className="text-sm font-black font-mono text-[#39FF14] uppercase">
                    ¡Recarga de S/ {activeTopup.verifiedAmount?.toFixed(2) || activeTopup.requestedAmount.toFixed(2)} Acreditada!
                  </h4>
                  <p className="text-xs text-gray-300">
                    Tu saldo ha sido actualizado de forma atómica en Billetera. Ya estás habilitado para recibir carreras.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTopup(null);
                      onClose();
                    }}
                    className="mt-2 py-2 px-6 bg-[#39FF14] text-black font-mono font-black text-xs rounded-xl uppercase tracking-wider"
                  >
                    Cerrar y Continuar
                  </button>
                </div>
              )}

              {/* CONSOLA DE VALIDACIÓN HUMANA DEL OPERADOR */}
              <div className="pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setOperatorMode(!operatorMode)}
                  className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800 border border-white/10 rounded-xl text-[11px] font-mono text-purple-400 hover:text-purple-300 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <UserCheck size={14} /> Consola de Operador Humano (Revisión Bancaria)
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {operatorMode ? 'Ocultar' : 'Abrir'}
                  </span>
                </button>

                {operatorMode && activeTopup.status !== 'CREDITED' && (
                  <div className="mt-3 p-4 bg-purple-950/25 border border-purple-500/30 rounded-2xl space-y-3 text-xs">
                    <div className="border-b border-purple-500/20 pb-2">
                      <p className="font-mono font-bold text-purple-200 text-xs flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-purple-400" /> Verificación de Fondos en Yape Receptor
                      </p>
                      <p className="text-[10px] text-gray-400">
                        El operador debe consultar la app de Yape de Zénith e ingresar los datos del extracto.
                      </p>
                    </div>

                    {/* Formulario de Confirmación Real */}
                    <div className="space-y-2 font-mono text-[11px]">
                      <div>
                        <label className="text-gray-400 block mb-0.5">Monto Real Recibido (S/):</label>
                        <input
                          type="number"
                          step="0.10"
                          value={operatorReceivedAmount}
                          onChange={(e) => setOperatorReceivedAmount(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500"
                          placeholder="Monto exacto..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-gray-400 block mb-0.5">N° Operación (Opcional):</label>
                          <input
                            type="text"
                            value={operatorOpNumber}
                            onChange={(e) => setOperatorOpNumber(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-purple-500"
                            placeholder="Ej. OP-482910"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-0.5">Titular Pagador:</label>
                          <input
                            type="text"
                            value={operatorPayerName}
                            onChange={(e) => setOperatorPayerName(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-purple-500"
                            placeholder="Nombre del emisor..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-gray-400 block mb-0.5">Observación / Notas del Operador:</label>
                        <input
                          type="text"
                          value={operatorNotes}
                          onChange={(e) => setOperatorNotes(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500"
                          placeholder="Ej. Movimiento confirmado en extracto BCP..."
                        />
                      </div>
                    </div>

                    {/* Botones de Acción Operativa */}
                    <div className="pt-2 flex flex-col gap-2">
                      {activeTopup.status !== 'VERIFIED' && (
                        <button
                          type="button"
                          onClick={handleOperatorConfirmMovement}
                          disabled={loading}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check size={14} /> 1. Confirmar Ingreso en Yape Receptor
                        </button>
                      )}

                      {/* Si está en REVIEW, botón de aprobación */}
                      {activeTopup.status === 'REVIEW' && (
                        <button
                          type="button"
                          onClick={handleOperatorApproveReview}
                          disabled={loading}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ShieldCheck size={14} /> Aprobar Manualmente Caso en REVIEW
                        </button>
                      )}

                      {/* Si está en VERIFIED, botón de acreditación atómica */}
                      {activeTopup.status === 'VERIFIED' && (
                        <button
                          type="button"
                          onClick={handleOperatorCredit}
                          disabled={loading}
                          className="w-full py-2.5 bg-[#39FF14] hover:bg-[#32e010] text-black font-mono font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-[#39FF14]/20"
                        >
                          <CheckCircle2 size={15} /> 2. Ejecutar Acreditación Atómica en Wallet
                        </button>
                      )}

                      {/* Rechazo */}
                      {!showRejectInput ? (
                        <button
                          type="button"
                          onClick={() => setShowRejectInput(true)}
                          className="text-[10px] font-mono text-red-400 hover:text-red-300 text-center py-1 cursor-pointer"
                        >
                          Rechazar esta solicitud...
                        </button>
                      ) : (
                        <div className="p-2.5 bg-red-950/30 border border-red-500/30 rounded-xl space-y-2">
                          <input
                            type="text"
                            placeholder="Motivo del rechazo..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleOperatorReject}
                              disabled={loading}
                              className="flex-1 py-1 bg-red-600 text-white rounded text-[10px] font-mono font-bold cursor-pointer"
                            >
                              Confirmar Rechazo
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRejectInput(false)}
                              className="px-2 py-1 bg-white/10 text-gray-300 rounded text-[10px] font-mono cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Botón para iniciar otra recarga */}
              {activeTopup.status !== 'CREDITED' && (
                <button
                  type="button"
                  onClick={() => setActiveTopup(null)}
                  className="w-full py-2 text-center text-xs font-mono text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancelar o Iniciar otra solicitud
                </button>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
