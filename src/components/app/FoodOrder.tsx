/**
 * ZÉNITH — Pedir comida: elegir restaurante, armar el pedido y pedirlo.
 * Reutiliza el mismo motor de precio/despacho que una encomienda
 * (origin = restaurante, destination = dirección del cliente).
 */
import React, { useEffect, useState } from 'react';
import { ChevronLeft, Minus, Plus, Store } from 'lucide-react';
import { FoodApi, PricingApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import type { ApiMenuItem, ApiQuote, ApiRestaurant, ApiRide, Place } from '../../api/types';
import AddressPicker from './AddressPicker';
import { Card, PrimaryButton, ErrorText, Row, soles, PAYMENT_LABEL } from './ui';

type Payment = 'cash' | 'yape' | 'plin';
type Cart = Record<string, number>; // menuItemId -> cantidad

export default function FoodOrder({ onOrdered }: { onOrdered: (ride: ApiRide) => void }) {
  const [restaurants, setRestaurants] = useState<ApiRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<ApiRestaurant | null>(null);
  const [menu, setMenu] = useState<ApiMenuItem[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [destination, setDestination] = useState<Place | null>(null);
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<Payment>('cash');
  const [quote, setQuote] = useState<ApiQuote | null>(null);

  const act = async (fn: () => Promise<void>) => {
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

  useEffect(() => {
    void act(async () => setRestaurants(await FoodApi.listOpen())).finally(() => setLoading(false));
  }, []);

  const openRestaurant = (r: ApiRestaurant) => act(async () => {
    setSelected(r);
    setCart({});
    setQuote(null);
    setMenu(await FoodApi.menu(r.id));
  });

  const back = () => {
    setSelected(null);
    setMenu([]);
    setCart({});
    setQuote(null);
  };

  const setQty = (itemId: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = Math.min(50, qty);
      return next;
    });

  const items: Array<{ menuItemId: string; quantity: number; item: ApiMenuItem | undefined }> =
    Object.entries(cart).map(([menuItemId, quantity]) => ({
      menuItemId, quantity: Number(quantity), item: menu.find((m) => m.id === menuItemId),
    }));
  const subtotal = items.reduce((s: number, { item, quantity }) => s + (item?.price || 0) * quantity, 0);

  // Cambiar algo del pedido invalida la cotización ya calculada.
  useEffect(() => setQuote(null), [destination, cart]);

  const getQuote = () => act(async () => {
    if (!selected) return;
    if (items.length === 0) throw new Error('Agrega al menos un plato.');
    if (!destination) throw new Error('Elige a dónde te llevamos el pedido.');
    setQuote(await PricingApi.quote(
      { address: selected.address, lat: selected.lat, lng: selected.lng },
      destination,
    ));
  });

  const order = () => act(async () => {
    if (!selected || !quote) return;
    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      setQuote(null);
      throw new Error('El precio venció. Vuelve a calcularlo.');
    }
    const { ride } = await FoodApi.order(
      selected.id, quote,
      items.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })),
      payment, notes.trim() || undefined,
    );
    onOrdered(ride);
  });

  if (loading) return <p className="text-sm text-gray-500 font-mono">Cargando restaurantes…</p>;

  // ---- Lista de restaurantes ----
  if (!selected) {
    return (
      <div className="space-y-3">
        {restaurants.length === 0 && (
          <Card><p className="text-sm text-gray-400 text-center">Ningún restaurante está publicando su menú todavía.</p></Card>
        )}
        {restaurants.map((r) => (
          <button key={r.id} type="button" onClick={() => openRestaurant(r)} className="w-full text-left">
            <Card className="hover:border-[#39FF14]/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center text-[#39FF14] shrink-0">
                  <Store size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.address}</p>
                </div>
              </div>
            </Card>
          </button>
        ))}
        <ErrorText text={error} />
      </div>
    );
  }

  // ---- Menú del restaurante elegido + carrito ----
  return (
    <div className="space-y-4">
      <button type="button" onClick={back} className="flex items-center gap-1 text-xs font-mono uppercase text-gray-400 hover:text-white">
        <ChevronLeft size={14} /> Otros restaurantes
      </button>

      <Card>
        <div className="flex items-center gap-2 text-[#39FF14]">
          <Store size={18} />
          <h2 className="font-black uppercase italic">{selected.name}</h2>
        </div>
        <p className="text-xs text-gray-500">{selected.address}</p>
      </Card>

      <div className="space-y-2">
        {menu.length === 0 && <p className="text-xs text-gray-500 font-mono text-center py-4">Este restaurante no tiene platos disponibles.</p>}
        {menu.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <div key={item.id}>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                  <p className="text-[#39FF14] font-black">{soles(item.price)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setQty(item.id, qty - 1)} disabled={qty === 0} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 flex items-center justify-center">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-mono">{qty}</span>
                  <button type="button" onClick={() => setQty(item.id, qty + 1)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </Card>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <Card>
          <p className="text-[10px] font-mono uppercase text-gray-500 tracking-widest">Tu pedido</p>
          {items.map(({ item, quantity, menuItemId }) => item && (
            <React.Fragment key={menuItemId}>
              <Row label={`${quantity}x ${item.name}`} value={soles(item.price * quantity)} />
            </React.Fragment>
          ))}
          <Row label="Subtotal" value={soles(subtotal)} />

          <AddressPicker label="¿A dónde lo llevamos?" value={destination} onChange={setDestination} allowGps />
          <input
            className="w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/60 rounded-xl px-3 py-2.5 text-sm outline-none"
            placeholder="Nota para el restaurante o el motorizado (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
          />

          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'yape', 'plin'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPayment(p)}
                className={`py-2.5 rounded-xl border text-xs font-mono uppercase font-bold ${payment === p ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-white/10 text-gray-400'}`}
              >
                {PAYMENT_LABEL[p]}
              </button>
            ))}
          </div>

          {quote ? (
            <div className="space-y-3">
              <Row label="Comida" value={soles(subtotal)} />
              <Row label="Envío" value={soles(quote.totalFare)} />
              <div className="flex items-end justify-between border-t border-white/10 pt-3">
                <p className="text-[10px] font-mono uppercase text-gray-500">Total a pagar</p>
                <p className="text-3xl font-black text-[#39FF14]">{soles(subtotal + quote.totalFare)}</p>
              </div>
              <PrimaryButton busy={busy} onClick={order}>Hacer el pedido</PrimaryButton>
            </div>
          ) : (
            <PrimaryButton busy={busy} disabled={!destination} onClick={getQuote}>Ver precio de envío</PrimaryButton>
          )}
          <ErrorText text={error} />
        </Card>
      )}
    </div>
  );
}
