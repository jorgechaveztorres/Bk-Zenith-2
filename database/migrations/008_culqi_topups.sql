-- 008: Recarga de billetera vía Culqi (tarjeta/Yape con menos fricción), sin
-- reemplazar la recarga manual (queda como respaldo si Culqi falla).

ALTER TABLE topup_requests
  ADD COLUMN IF NOT EXISTS payment_method  ENUM('YAPE_MANUAL','CULQI') NOT NULL DEFAULT 'YAPE_MANUAL' AFTER operation_number,
  ADD COLUMN IF NOT EXISTS culqi_charge_id VARCHAR(64)   NULL AFTER payment_method,
  ADD COLUMN IF NOT EXISTS gross_amount    DECIMAL(12,2) NULL AFTER culqi_charge_id,
  ADD COLUMN IF NOT EXISTS fee_amount      DECIMAL(12,2) NULL AFTER gross_amount;

-- Comisión de Culqi, configurable sin recompilar (ajusta el % y el fijo según tu panel Culqi).
INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('culqi_fee_pct',   '3.99', 'Comisión porcentual de Culqi sobre cada recarga (se descuenta del monto acreditado al motorizado)'),
  ('culqi_fee_fixed', '0.50', 'Comisión fija de Culqi (S/) por cada recarga, además del porcentaje');

INSERT IGNORE INTO schema_migrations (version) VALUES ('008_culqi_topups');
