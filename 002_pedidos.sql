-- =====================================================================
-- ZÉNITH — Migración 002: ciclo de pedidos (cotizar, pedir, ofrecer, aceptar, OTP)
-- Seguro de ejecutar más de una vez (IF NOT EXISTS / INSERT IGNORE).
-- =====================================================================

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS order_type        VARCHAR(10)   NOT NULL DEFAULT 'DELIVERY' AFTER status,
  ADD COLUMN IF NOT EXISTS city              VARCHAR(80)   NULL AFTER order_type,
  ADD COLUMN IF NOT EXISTS quote_id          VARCHAR(80)   NULL AFTER pricing_version,
  ADD COLUMN IF NOT EXISTS normal_fare       DECIMAL(12,2) NULL AFTER protected_price,
  ADD COLUMN IF NOT EXISTS multiplier        DECIMAL(4,2)  NULL AFTER normal_fare,
  ADD COLUMN IF NOT EXISTS payment_method    VARCHAR(20)   NOT NULL DEFAULT 'cash' AFTER multiplier,
  -- Código de recojo/abordaje (4 dígitos). Solo lo ve el cliente; el motorizado lo pide para iniciar.
  ADD COLUMN IF NOT EXISTS otp_code          CHAR(4)       NULL AFTER evidence_level,
  ADD COLUMN IF NOT EXISTS otp_hash          CHAR(64)      NULL AFTER otp_code,
  ADD COLUMN IF NOT EXISTS otp_attempts      TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER otp_hash,
  ADD COLUMN IF NOT EXISTS otp_expires_at    DATETIME(3)   NULL AFTER otp_attempts,
  ADD COLUMN IF NOT EXISTS otp_verified      TINYINT(1)    NOT NULL DEFAULT 0 AFTER otp_expires_at,
  ADD COLUMN IF NOT EXISTS search_expires_at DATETIME(3)   NULL AFTER otp_verified,
  ADD COLUMN IF NOT EXISTS accepted_at       DATETIME(3)   NULL AFTER search_expires_at,
  ADD COLUMN IF NOT EXISTS started_at        DATETIME(3)   NULL AFTER accepted_at;

-- Una clave de idempotencia por pedido (evita pedidos duplicados por doble toque)
ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS payload_hash CHAR(64) NULL AFTER resource_id;

-- Búsqueda rápida de pedidos que esperan motorizado
CREATE INDEX IF NOT EXISTS ix_rides_search ON rides (status, search_expires_at);
-- Ofertas vigentes por motorizado
CREATE INDEX IF NOT EXISTS ix_asg_offer ON assignments (status, expires_at);

INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('search_timeout_seconds',  '300', 'Segundos máximos buscando motorizado antes de dar el pedido por vencido'),
  ('dispatch_max_km',         '6',   'Distancia máxima (km en línea recta) del motorizado al punto de recojo'),
  ('driver_fresh_seconds',    '120', 'Segundos sin señal GPS para considerar a un motorizado desconectado'),
  ('pickup_otp_minutes',      '60',  'Minutos de validez del código de recojo');

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_pedidos');
