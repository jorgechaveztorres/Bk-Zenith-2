-- =====================================================================
-- ZÉNITH — Migración 004: panel admin para aprobar/rechazar motorizados
-- Hoy la aprobación se hace a mano por phpMyAdmin; esta migración agrega
-- lo mínimo para hacerlo desde un panel: por qué se rechazó y quién/cuándo
-- revisó, para no perder trazabilidad.
-- Seguro de ejecutar más de una vez (IF NOT EXISTS).
-- =====================================================================

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS reviewed_by       VARCHAR(64)  NULL AFTER rejection_reason,
  ADD COLUMN IF NOT EXISTS reviewed_at       DATETIME(3)  NULL AFTER reviewed_by;

INSERT IGNORE INTO schema_migrations (version) VALUES ('004_admin_drivers');
