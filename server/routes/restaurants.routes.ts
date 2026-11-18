import { Router, Request, Response } from 'express';
import { requireSession, SessionRequest } from '../middlewares/session.middleware';
import { RestaurantService } from '../services/restaurant.service';
import { RideService } from '../services/ride.service';
import { HttpError } from '../services/http-error';
import type { ServerQuoteResult } from '../services/pricing.service';

const router = Router();
router.use(requireSession);

const uid = (req: Request) => (req as SessionRequest).session?.sub || '';

const handle = (fn: (req: Request) => Promise<unknown>, okStatus = 200) => async (req: Request, res: Response) => {
  try {
    const data = await fn(req);
    res.status(okStatus).json({ success: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('[RESTAURANTS] Error inesperado:', err);
    res.status(500).json({ success: false, message: 'Error del servidor. Intenta de nuevo.' });
  }
};

// ------------------------------------------------------- Público (cliente)
/** GET /api/restaurants — restaurantes abiertos para pedir comida. */
router.get('/', handle(async (req) => ({
  restaurants: await RestaurantService.listOpen(typeof req.query.city === 'string' ? req.query.city : undefined),
})));

router.get('/:id/menu', handle(async (req) => ({ menu: await RestaurantService.listMenuPublic(req.params.id) })));

/**
 * POST /api/restaurants/:id/orders — pedido de comida.
 * Body: { quote (del mismo /api/pricing/quote, origin=restaurante, destination=cliente),
 *         items: [{menuItemId, quantity}], paymentMethod, notes, idempotencyKey }
 */
router.post('/:id/orders', handle(async (req) => {
  const restaurantId = req.params.id;
  const { restaurant, priced, subtotal } = await RestaurantService.priceOrderItems(restaurantId, req.body?.items);

  const r = await RideService.requestRide({
    quote: req.body?.quote as ServerQuoteResult,
    passengerId: uid(req),
    paymentMethod: req.body?.paymentMethod,
    idempotencyKey: req.body?.idempotencyKey,
    orderType: 'FOOD',
    restaurantId,
    food: {
      restaurantId,
      restaurantName: restaurant.name,
      items: priced,
      subtotal,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 300) : undefined,
    },
  });
  return { ride: r.ride, otpCode: r.otpCode, idempotent: r.idempotent, subtotal };
}, 201));

// ------------------------------------------------------- Dueño del restaurante
router.get('/mine', handle(async (req) => ({ restaurant: await RestaurantService.myRestaurant(uid(req)) })));

router.post('/mine', handle(async (req) => ({
  restaurant: await RestaurantService.create({
    ownerUserId: uid(req),
    name: req.body?.name,
    address: req.body?.address,
    lat: Number(req.body?.lat),
    lng: Number(req.body?.lng),
    city: req.body?.city,
    phone: req.body?.phone,
    photoUrl: req.body?.photoUrl,
  }),
}), 201));

router.patch('/:id/open', handle(async (req) => ({
  restaurant: await RestaurantService.setOpen(req.params.id, uid(req), Boolean(req.body?.isOpen)),
})));

router.get('/:id/menu/mine', handle(async (req) => ({
  menu: await RestaurantService.listMenuOwner(req.params.id, uid(req)),
})));

router.post('/:id/menu', handle(async (req) => ({
  item: await RestaurantService.addMenuItem(req.params.id, uid(req), {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    photoUrl: req.body?.photoUrl,
    isAvailable: req.body?.isAvailable,
    sortOrder: req.body?.sortOrder,
  }),
}), 201));

router.patch('/:id/menu/:itemId', handle(async (req) => ({
  item: await RestaurantService.updateMenuItem(req.params.id, uid(req), req.params.itemId, {
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    photoUrl: req.body?.photoUrl,
    isAvailable: req.body?.isAvailable,
    sortOrder: req.body?.sortOrder,
  }),
})));

export default router;
