/**
 * ZÉNITH — Panel simple del restaurante (cualquier cuenta puede publicar el suyo, gratis).
 * Crear el restaurante -> subir platos -> abrir/cerrar. Sin costo de publicación (ADR-004 / FOOD-001).
 */
import React, { useEffect, useState } from 'react';
import { Plus, Store, UtensilsCrossed } from 'lucide-react';
import { FoodApi } from '../../api/endpoints';
import { errorMessage } from '../../api/http';
import AddressPicker from './AddressPicker';
import { Card, PrimaryButton, GhostButton, ErrorText, Row, soles } from './ui';
import type { ApiMenuItem, ApiRestaurant, Place } from '../../api/types';

const smallInput = 'w-full bg-white/5 border border-white/10 focus:border-[#39FF14]/60 rounded-xl px-3 py-2.5 text-sm outline-none';

export default function RestaurantHome() {
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [menu, setMenu] = useState<ApiMenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  const loadMenu = async (restaurantId: string) => setMenu(await FoodApi.myMenu(restaurantId));

  useEffect(() => {
    void (async () => {
      try {
        const r = await FoodApi.mine();
        setRestaurant(r);
        if (r) await loadMenu(r.id);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- Alta del restaurante ----
  const [place, setPlace] = useState<Place | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const create = () => act(async () => {
    if (!name.trim()) throw new Error('Escribe el nombre del restaurante.');
    if (!place) throw new Error('Elige la dirección del restaurante.');
    const r = await FoodApi.create({ name: name.trim(), address: place.address, lat: place.lat, lng: place.lng, phone: phone || undefined });
    setRestaurant(r);
  });

  const toggleOpen = () => restaurant && act(async () => {
    setRestaurant(await FoodApi.setOpen(restaurant.id, !restaurant.isOpen));
  });

  // ---- Alta de plato ----
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const addItem = () => restaurant && act(async () => {
    const price = Number(itemPrice);
    if (!itemName.trim()) throw new Error('Escribe el nombre del plato.');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Precio inválido.');
    await FoodApi.addMenuItem(restaurant.id, { name: itemName.trim(), description: itemDesc.trim() || undefined, price });
    setItemName('');
    setItemDesc('');
    setItemPrice('');
    await loadMenu(restaurant.id);
  });

  const toggleItem = (item: ApiMenuItem) => restaurant && act(async () => {
    await FoodApi.updateMenuItem(restaurant.id, item.id, { isAvailable: !item.isAvailable });
    await loadMenu(restaurant.id);
  });

  if (loading) return <p className="text-sm text-gray-500 font-mono">Cargando…</p>;

  if (!restaurant) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-[#39FF14]">
          <Store size={22} />
          <h2 className="text-lg font-black uppercase italic">Publica tu restaurante gratis</h2>
        </div>
        <p className="text-xs text-gray-400">Sin costo de publicación. Zénith no te cobra comisión por tus ventas de comida.</p>
        <input className={smallInput} placeholder="Nombre del restaurante" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
        <input className={smallInput} placeholder="Celular de contacto (opcional)" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} />
        <AddressPicker label="Dirección del restaurante" value={place} allowGps onChange={setPlace} />
        <PrimaryButton busy={busy} onClick={create}>Publicar restaurante</PrimaryButton>
        <ErrorText text={error} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#39FF14]">
            <Store size={20} />
            <h2 className="text-lg font-black uppercase italic">{restaurant.name}</h2>
          </div>
          <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded-lg border ${restaurant.isOpen ? 'border-[#39FF14] text-[#39FF14]' : 'border-white/10 text-gray-500'}`}>
            {restaurant.isOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
        <Row label="Dirección" value={restaurant.address} />
        <GhostButton busy={busy} onClick={toggleOpen}>{restaurant.isOpen ? 'Cerrar restaurante' : 'Abrir restaurante'}</GhostButton>
        <ErrorText text={error} />
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-gray-300">
          <UtensilsCrossed size={18} />
          <p className="text-[10px] font-mono uppercase tracking-widest">Agregar plato al menú</p>
        </div>
        <input className={smallInput} placeholder="Nombre del plato" value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={150} />
        <input className={smallInput} placeholder="Descripción (opcional)" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} maxLength={300} />
        <input className={smallInput} placeholder="Precio (S/)" inputMode="decimal" value={itemPrice} onChange={(e) => setItemPrice(e.target.value.replace(/[^0-9.]/g, ''))} />
        <PrimaryButton busy={busy} onClick={addItem}><Plus size={14} />Agregar plato</PrimaryButton>
      </Card>

      <div className="space-y-2">
        {menu.length === 0 && <p className="text-xs text-gray-500 font-mono text-center py-4">Aún no tienes platos en el menú.</p>}
        {menu.map((item) => (
          <div key={item.id}>
          <Card className={!item.isAvailable ? 'opacity-50' : ''}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{item.name}</p>
                {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                <p className="text-[#39FF14] font-black">{soles(item.price)}</p>
              </div>
              <GhostButton className="w-auto px-3" busy={busy} onClick={() => toggleItem(item)}>
                {item.isAvailable ? 'Ocultar' : 'Mostrar'}
              </GhostButton>
            </div>
          </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
