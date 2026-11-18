/**
 * ZÉNITH — Billetera del motorizado.
 * Muestra la deuda de comisión acumulada y deja pedir una recarga Yape
 * (el admin la revisa y la acredita desde el panel admin).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, Clock, Check, X, AlertTriangle, CreditCard } from 'lucide-react';
import { WalletApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import { openCulqiCheckout } from '../../culqi';
import type { ApiTopup, ApiWallet, ApiWalletMovement } from '../../api/types';
import { Card, PrimaryButton, GhostButton, ErrorText, Row, soles } from './ui';

const MOVEMENT_LABEL: Record<string, string> = {
  platform_commission: 'Comisión Zénith',
  topup_yape: 'Recarga Yape',
  deposit: 'Depósito',
  fee: 'Cargo',
  cash_compensation: 'Compensación',
  penalty: 'Penalidad',
  adjustment: 'Ajuste',
};

const TOPUP_LABEL: Record<string, { text: string; className: string }> = {
  RECEIPT_SUBMITTED: { text: 'En revisión', className: 'text-yellow-400 border-yellow-400/40' },
  CREDITED: { text: 'Acreditada', className: 'text-[#39FF14] border-[#39FF14]/40' },
  REJECTED: { text: 'Rechazada', className: 'text-red-400 border-red-400/40' },
};

export default function WalletHome() {
  const [wallet, setWallet] = useState<ApiWallet | null>(null);
  const [movements, setMovements] = useState<ApiWalletMovement[]>([]);
  const [topups, setTopups] = useState<ApiTopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [operationNumber, setOperationNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [culqi, setCulqi] = useState<{ enabled: boolean; publicKey: string | null }>({ enabled: false, publicKey: null });
  const [culqiBusy, setCulqiBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [w, m, t] = await Promise.all([WalletApi.me(), WalletApi.movements(), WalletApi.myTopups()]);
      setWallet(w);
      setMovements(m);
      setTopups(t);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { WalletApi.culqiConfig().then(setCulqi).catch(() => undefined); }, []);

  const hasPending = topups.some((t) => t.status === 'RECEIPT_SUBMITTED');

  const payWithCulqi = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 5) {
      setError('Ingresa un monto válido (mínimo S/ 5).');
      return;
    }
    if (!culqi.publicKey) return;
    setError('');
    setCulqiBusy(true);
    try {
      const token = await openCulqiCheckout(culqi.publicKey, n);
      await WalletApi.culqiCharge(token, n);
      setAmount('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCulqiBusy(false);
    }
  };

  const submitTopup = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 5) {
      setError('Ingresa un monto válido (mínimo S/ 5).');
      return;
    }
    if (!operationNumber.trim()) {
      setError('Escribe el número de operación de tu Yape.');
      return;
    }
    setBusy(true);
    setError('');
    WalletApi.requestTopup(n, operationNumber.trim())
      .then(() => {
        setAmount('');
        setOperationNumber('');
        return load();
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  if (loading && !wallet) return <p className="text-sm text-gray-500 font-mono">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#39FF14]">
        <Wallet size={22} />
        <h2 className="text-lg font-black uppercase italic">Mi billetera</h2>
      </div>

      <ErrorText text={error} />

      {wallet && (
        <Card className={wallet.blocked ? 'border-red-500/50' : ''}>
          <Row label="Deuda de comisión" value={<span className={wallet.cashDebt > 0 ? 'text-yellow-400' : 'text-[#39FF14]'}>{soles(wallet.cashDebt)}</span>} />
          <Row label="Comisión acumulada" value={soles(wallet.accumulatedCommission)} />
          {wallet.isInFreePeriod && wallet.freeUntil && (
            <p className="text-xs text-[#39FF14] font-mono flex items-center gap-1.5">
              <Clock size={13} /> Sin comisión hasta el {new Date(wallet.freeUntil).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
            </p>
          )}
          {wallet.blocked && (
            <p className="text-xs text-red-400 font-mono flex items-center gap-1.5">
              <AlertTriangle size={13} /> Deuda sobre S/ {wallet.debtLimit.toFixed(2)}: no puedes conectarte hasta recargar.
            </p>
          )}
        </Card>
      )}

      <Card>
        <p className="text-sm font-bold">Recargar por Yape</p>
        <p className="text-xs text-gray-400">Yapea a la cuenta de Zénith y escribe aquí el número de operación. Un admin la revisa y la acredita contra tu deuda.</p>
        {hasPending ? (
          <p className="text-xs text-yellow-400 font-mono">Ya tienes una recarga esperando revisión.</p>
        ) : (
          <div className="space-y-2">
            <input
              className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none"
              placeholder="Monto (S/)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            {culqi.enabled && (
              <>
                <PrimaryButton busy={culqiBusy} onClick={payWithCulqi}>
                  <CreditCard size={16} /> Pagar con Yape o tarjeta
                </PrimaryButton>
                <p className="text-[10px] text-gray-500 text-center">Se acredita al instante. Se descuenta una comisión del cobro.</p>
                <p className="text-[10px] text-gray-600 text-center">— o si prefieres, Yape manual abajo —</p>
              </>
            )}

            <input
              className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14] rounded-xl px-3 py-2.5 text-sm outline-none"
              placeholder="Número de operación Yape"
              value={operationNumber}
              onChange={(e) => setOperationNumber(e.target.value)}
              maxLength={30}
            />
            <GhostButton onClick={submitTopup} disabled={busy}>{busy ? 'Enviando…' : 'Pedir recarga manual (revisión del admin)'}</GhostButton>
          </div>
        )}
      </Card>

      {topups.length > 0 && (
        <Card>
          <p className="text-sm font-bold">Mis recargas</p>
          <div className="space-y-2">
            {topups.map((t) => {
              const label = TOPUP_LABEL[t.status];
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{soles(t.requestedAmount)}{t.paymentMethod === 'CULQI' && <span className="text-gray-500 font-mono text-[10px] ml-1">(Culqi, cobro {soles(t.grossAmount ?? t.requestedAmount)})</span>}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{new Date(t.createdAt).toLocaleDateString('es-PE')}{t.operationNumber ? ` · Op. ${t.operationNumber}` : ''}</p>
                    {t.status === 'REJECTED' && t.rejectionReason && <p className="text-[10px] text-red-400 font-mono">{t.rejectionReason}</p>}
                  </div>
                  <span className={`text-[10px] font-mono uppercase border rounded-lg px-2 py-1 shrink-0 ${label?.className || 'text-gray-400 border-white/10'}`}>
                    {label?.text || t.status}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {movements.length > 0 && (
        <Card>
          <p className="text-sm font-bold">Movimientos</p>
          <div className="space-y-2">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{MOVEMENT_LABEL[m.type] || m.type}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{new Date(m.createdAt).toLocaleDateString('es-PE')}</p>
                </div>
                <span className={`font-mono text-sm shrink-0 flex items-center gap-1 ${m.type === 'topup_yape' ? 'text-[#39FF14]' : 'text-yellow-400'}`}>
                  {m.type === 'topup_yape' ? <Check size={12} /> : <X size={12} />}
                  {soles(m.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
