-- 006: Documentos del motorizado (fotos de licencia/brevete y del vehículo).
-- El motorizado llena sus datos de vehículo/licencia y sube ambas fotos;
-- eso pasa su estado a UNDER_REVIEW para que el admin lo revise con evidencia,
-- en vez de aprobar solo con el texto que escribió.

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS license_photo_path     VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS vehicle_photo_path      VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS documents_submitted_at  DATETIME(3)  NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('006_driver_documents');
