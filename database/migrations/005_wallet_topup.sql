-- 005: Billetera del motorizado (deuda de comisión) y recarga Yape manual (V1).
-- Reutiliza las tablas `wallets`, `wallet_movements` y `topup_requests` ya creadas en schema.sql.
-- Para la V1 manual (sin OCR/IA) agregamos solo lo que falta para un flujo
-- "el motorizado escribe el número de operación Yape -> el admin lo revisa y acredita".

ALTER TABLE topup_requests
  ADD COLUMN IF NOT EXISTS operation_number VARCHAR(30) NULL AFTER requested_amount,
  ADD COLUMN IF NOT EXISTS rejection_reason  VARCHAR(255) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS reviewed_by       VARCHAR(64)  NULL AFTER rejection_reason,
  ADD COLUMN IF NOT EXISTS reviewed_at       DATETIME(3)  NULL AFTER reviewed_by;

INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('wallet_debt_limit', '2.00', 'Deuda máxima (S/) de comisión antes de bloquear la conexión del motorizado (modelo InDrive: nunca acumula, se bloquea casi al llegar a 0)');

-- Si la migración ya se había aplicado con el valor viejo (50.00), lo corrige.
UPDATE app_settings
  SET setting_value = '2.00',
      description = 'Deuda máxima (S/) de comisión antes de bloquear la conexión del motorizado (modelo InDrive: nunca acumula, se bloquea casi al llegar a 0)'
  WHERE setting_key = 'wallet_debt_limit';

INSERT IGNORE INTO schema_migrations (version) VALUES ('005_wallet_topup');
