-- =====================================================================
-- ZÉNITH — Migración 003: marketplace de comida (restaurantes y menú)
-- Los restaurantes publican su menú gratis; Zénith no les cobra nada.
-- El pedido de comida reutiliza la tabla `rides` ya existente
-- (origin = restaurante, destination = cliente, order_type = 'FOOD'),
-- así se reaprovecha todo el motor de precio, despacho, OTP y realtime.
-- Seguro de ejecutar más de una vez (IF NOT EXISTS / INSERT IGNORE).
-- =====================================================================

CREATE TABLE IF NOT EXISTS restaurants (
  id            VARCHAR(64)   NOT NULL,
  owner_user_id VARCHAR(64)   NOT NULL,
  name          VARCHAR(150)  NOT NULL,
  phone         VARCHAR(20)   NULL,
  address       VARCHAR(255)  NOT NULL,
  lat           DECIMAL(10,7) NOT NULL,
  lng           DECIMAL(10,7) NOT NULL,
  city          VARCHAR(80)   NULL,
  photo_url     VARCHAR(255)  NULL,
  is_open       TINYINT(1)    NOT NULL DEFAULT 1,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_restaurants_owner (owner_user_id),
  KEY ix_restaurants_open (is_active, is_open, city),
  CONSTRAINT fk_restaurants_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
  id            VARCHAR(64)   NOT NULL,
  restaurant_id VARCHAR(64)   NOT NULL,
  name          VARCHAR(150)  NOT NULL,
  description   VARCHAR(300)  NULL,
  price         DECIMAL(10,2) NOT NULL,
  photo_url     VARCHAR(255)  NULL,
  is_available  TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order    SMALLINT      NOT NULL DEFAULT 0,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_menu_restaurant (restaurant_id, is_available, sort_order),
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El pedido de comida vive en `rides` (order_type='FOOD'); esta columna permite
-- ubicar rápido todos los pedidos de un restaurante sin tener que leer el JSON.
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS restaurant_id VARCHAR(64) NULL AFTER order_type;

CREATE INDEX IF NOT EXISTS ix_rides_restaurant ON rides (restaurant_id, created_at);

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_restaurantes');
