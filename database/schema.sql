-- =====================================================================
-- ZÉNITH — Esquema MySQL/MariaDB (reemplaza Firestore)
-- Base: shocos_zenith (cPanel shocos.nom.pe)
-- Fuente: colecciones Firestore de Bk-Zenith-2
--   (main + fix/security-hardening-financial-access)
-- Dinero: DECIMAL(12,2) en soles (PEN). Fechas: DATETIME(3) en UTC.
-- Los datos anidados que Firestore guardaba dentro del documento
-- (protagonistas, paquete, incidencias...) van en columnas JSON.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------
-- 1. IDENTIDAD Y SESIONES (reemplaza Firebase Auth + users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  VARCHAR(64)   NOT NULL,
  full_name           VARCHAR(150)  NOT NULL,
  email               VARCHAR(190)  NULL,
  phone               VARCHAR(20)   NULL,
  password_hash       VARCHAR(255)  NULL,
  dni                 VARCHAR(15)   NULL,
  role                ENUM('passenger','driver') NOT NULL DEFAULT 'passenger',
  roles_enabled       JSON          NULL,
  active_role         VARCHAR(20)   NULL,
  phone_verified      TINYINT(1)    NOT NULL DEFAULT 0,
  email_verified      TINYINT(1)    NOT NULL DEFAULT 0,
  rating              DECIMAL(3,2)  NOT NULL DEFAULT 5.00,
  photo_url           VARCHAR(500)  NULL,
  is_admin            TINYINT(1)    NOT NULL DEFAULT 0,
  is_blocked          TINYINT(1)    NOT NULL DEFAULT 0,
  onboarding_complete TINYINT(1)    NOT NULL DEFAULT 0,
  kyc_status          ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  city                VARCHAR(80)   NULL,
  pending_debt        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  pending_debt_reason VARCHAR(255)  NULL,
  settings            JSON          NULL,
  favorites           JSON          NULL,
  created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(64)  NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  device_info VARCHAR(255) NULL,
  expires_at  DATETIME(3)  NOT NULL,
  revoked_at  DATETIME(3)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_hash (token_hash),
  KEY ix_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_codes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone       VARCHAR(20)  NOT NULL,
  purpose     ENUM('LOGIN','VERIFY_PHONE','RESET_PASSWORD') NOT NULL,
  code_hash   CHAR(64)     NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME(3)  NOT NULL,
  used_at     DATETIME(3)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_otp_phone (phone, purpose, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documentos KYC (DNI, licencia, SOAT, selfie...). Archivos en el servidor, no en Storage.
CREATE TABLE IF NOT EXISTS user_documents (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          VARCHAR(64)  NOT NULL,
  doc_type         ENUM('DNI_FRENTE','DNI_DORSO','SELFIE_DNI','LICENCIA','SOAT','TARJETA_PROPIEDAD','CERTIJOVEN','FOTO_VEHICULO','FOTO_PERFIL','OTRO') NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  mime_type        VARCHAR(60)  NULL,
  size_bytes       INT UNSIGNED NULL,
  status           ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  rejection_reason VARCHAR(255) NULL,
  reviewed_by      VARCHAR(64)  NULL,
  reviewed_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_docs_user (user_id, doc_type),
  KEY ix_docs_status (status),
  CONSTRAINT fk_docs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. MOTORIZADOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id                     VARCHAR(64)  NOT NULL,
  status                      ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  availability                TINYINT(1)   NOT NULL DEFAULT 0,
  rating                      DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  vehicle_category            VARCHAR(40)  NULL,
  vehicle_plate               VARCHAR(15)  NULL,
  vehicle_brand               VARCHAR(60)  NULL,
  vehicle_model               VARCHAR(60)  NULL,
  vehicle_year                SMALLINT     NULL,
  vehicle_color               VARCHAR(30)  NULL,
  license_number              VARCHAR(30)  NULL,
  license_expiry              DATE         NULL,
  yape_plin_phone             VARCHAR(20)  NULL,
  app_version                 VARCHAR(20)  NULL,
  last_connection             DATETIME(3)  NULL,
  daily_cancellations_count   SMALLINT     NOT NULL DEFAULT 0,
  last_cancellation_date      DATE         NULL,
  daily_breakdowns_count      SMALLINT     NOT NULL DEFAULT 0,
  last_breakdown_date         DATE         NULL,
  suspended_until             DATETIME(3)  NULL,
  created_at                  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_driver_plate (vehicle_plate),
  KEY ix_driver_status (status),
  CONSTRAINT fk_driver_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presencia en vivo (antes drivers_online). Se actualiza con el GPS.
CREATE TABLE IF NOT EXISTS drivers_online (
  driver_id       VARCHAR(64)  NOT NULL,
  status          ENUM('AVAILABLE','BUSY','OFFLINE') NOT NULL DEFAULT 'AVAILABLE',
  current_ride_id VARCHAR(64)  NULL,
  lat             DECIMAL(10,7) NOT NULL,
  lng             DECIMAL(10,7) NOT NULL,
  heading         SMALLINT     NULL,
  speed_kmh       DECIMAL(5,1) NULL,
  city            VARCHAR(80)  NULL,
  last_active     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (driver_id),
  KEY ix_online_status (status, last_active),
  KEY ix_online_geo (lat, lng),
  CONSTRAINT fk_online_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. PEDIDOS / VIAJES (antes rides)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rides (
  id                          VARCHAR(64)   NOT NULL,
  passenger_id                VARCHAR(64)   NOT NULL,
  passenger_name              VARCHAR(150)  NULL,
  passenger_phone             VARCHAR(20)   NULL,
  driver_id                   VARCHAR(64)   NULL,
  driver_name                 VARCHAR(150)  NULL,
  driver_phone                VARCHAR(20)   NULL,
  status                      ENUM('REQUESTED','SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_ARRIVING','WAITING_FOR_OTP','IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'REQUESTED',

  origin_address              VARCHAR(255)  NOT NULL,
  origin_lat                  DECIMAL(10,7) NOT NULL,
  origin_lng                  DECIMAL(10,7) NOT NULL,
  origin_place_id             VARCHAR(255)  NULL,
  destination_address         VARCHAR(255)  NOT NULL,
  destination_lat             DECIMAL(10,7) NOT NULL,
  destination_lng             DECIMAL(10,7) NOT NULL,
  destination_place_id        VARCHAR(255)  NULL,
  distance_km                 DECIMAL(8,3)  NULL,
  duration_min                DECIMAL(8,2)  NULL,
  driver_lat                  DECIMAL(10,7) NULL,
  driver_lng                  DECIMAL(10,7) NULL,

  -- Precio protegido (PricingEngine + sello HMAC)
  protected_price             DECIMAL(12,2) NOT NULL,
  pricing_seal                VARCHAR(255)  NOT NULL,
  pricing_version             VARCHAR(30)   NOT NULL,
  assignment_engine_version   VARCHAR(30)   NULL,
  financial_engine_version    VARCHAR(30)   NULL,
  ride_audit_id               VARCHAR(64)   NULL,
  otp_validation_id           VARCHAR(64)   NULL,

  -- Dominio operativo MVP V1.1
  solicitude_status           ENUM('REQUESTED','ASSIGNED','ACTIVE','COMPLETED','CANCELLED','CLOSED') NULL,
  transit_status              ENUM('IDLE','TO_PICKUP','AT_PICKUP','IN_TRANSIT','AT_DESTINATION','RETURNING_TO_ORIGIN','RETURNED') NULL,
  delivery_status             ENUM('PENDING','DELIVERED_OTP','DELIVERY_FAILED','REJECTED') NULL,
  custody_status              ENUM('NONE','IN_TRANSIT_CUSTODY','ACTIVE_CUSTODY','CUSTODY_TRANSFERRED','CUSTODY_EXPIRED','DISPOSED') NULL,
  evidence_level              ENUM('E1_SIMPLE','E2_CONFIRMED','E3_SENSITIVE','E4_SPECIAL') NULL,
  delivery_otp_hash           CHAR(64)      NULL,
  delivery_otp_verified       TINYINT(1)    NOT NULL DEFAULT 0,
  solicitante                 JSON          NULL,
  pagador                     JSON          NULL,
  receptor                    JSON          NULL,
  motorizado                  JSON          NULL,
  package_info                JSON          NULL,
  communication_attempts      JSON          NULL,
  destination_change_request  JSON          NULL,
  return_contingency          JSON          NULL,
  incidents                   JSON          NULL,

  pickup_arrived_at           DATETIME(3)   NULL,
  destination_arrived_at      DATETIME(3)   NULL,
  included_wait_minutes       SMALLINT      NOT NULL DEFAULT 5,
  wait_started_at             DATETIME(3)   NULL,
  additional_wait_blocks_requested SMALLINT NOT NULL DEFAULT 0,
  additional_wait_blocks_accepted  SMALLINT NOT NULL DEFAULT 0,
  additional_wait_cost        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  is_recovery_order           TINYINT(1)    NOT NULL DEFAULT 0,
  original_operation_id       VARCHAR(64)   NULL,
  custody_expires_at          DATETIME(3)   NULL,
  custody_disposed_at         DATETIME(3)   NULL,
  driver_started_trip_at      DATETIME(3)   NULL,
  driver_start_distance_to_pickup DECIMAL(8,3) NULL,

  rating                      TINYINT       NULL,
  feedback                    VARCHAR(500)  NULL,
  settlement_id               VARCHAR(80)   NULL,
  settlement_state            VARCHAR(20)   NULL,
  cancelled_by                VARCHAR(64)   NULL,
  cancel_reason               VARCHAR(255)  NULL,
  completed_at                DATETIME(3)   NULL,
  created_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_rides_status (status, created_at),
  KEY ix_rides_passenger (passenger_id, created_at),
  KEY ix_rides_driver (driver_id, created_at),
  KEY ix_rides_original (original_operation_id),
  CONSTRAINT fk_rides_passenger FOREIGN KEY (passenger_id) REFERENCES users(id),
  CONSTRAINT fk_rides_driver    FOREIGN KEY (driver_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ofertas de despacho (15 s por motorizado)
CREATE TABLE IF NOT EXISTS assignments (
  id              VARCHAR(100) NOT NULL,
  ride_id         VARCHAR(64)  NOT NULL,
  driver_id       VARCHAR(64)  NOT NULL,
  driver_name     VARCHAR(150) NULL,
  distance_km     DECIMAL(8,3) NULL,
  attempt_number  SMALLINT     NOT NULL DEFAULT 1,
  status          ENUM('OFFERED','ACCEPTED','REJECTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'OFFERED',
  assigned_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at      DATETIME(3)  NOT NULL,
  responded_at    DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY ix_asg_ride (ride_id, status),
  KEY ix_asg_driver (driver_id, status),
  CONSTRAINT fk_asg_ride   FOREIGN KEY (ride_id)   REFERENCES rides(id) ON DELETE CASCADE,
  CONSTRAINT fk_asg_driver FOREIGN KEY (driver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispatch_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id         VARCHAR(64)  NOT NULL,
  driver_id       VARCHAR(64)  NULL,
  assignment_id   VARCHAR(100) NULL,
  event           VARCHAR(50)  NOT NULL,
  attempt_number  SMALLINT     NULL,
  distance_km     DECIMAL(8,3) NULL,
  details         VARCHAR(500) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_dlog_ride (ride_id),
  KEY ix_dlog_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trazabilidad inmutable de cada operación (event sourcing)
CREATE TABLE IF NOT EXISTS operational_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id     VARCHAR(64)   NOT NULL,
  stop_id     VARCHAR(64)   NULL,
  lat         DECIMAL(10,7) NULL,
  lng         DECIMAL(10,7) NULL,
  actor_role  ENUM('SOLICITANTE','PAGADOR','RECEPTOR','MOTORIZADO','SYSTEM','ADMIN') NOT NULL,
  actor_id    VARCHAR(64)   NOT NULL,
  actor_name  VARCHAR(150)  NULL,
  action      VARCHAR(60)   NOT NULL,
  result      VARCHAR(60)   NULL,
  metadata    JSON          NULL,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_opev_ride (ride_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Evidencia fotográfica (E3/E4): recojo, entrega, incidencias
CREATE TABLE IF NOT EXISTS ride_evidence (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id     VARCHAR(64)   NOT NULL,
  uploaded_by VARCHAR(64)   NOT NULL,
  stage       ENUM('PICKUP','DELIVERY','INCIDENT','CUSTODY','RETURN') NOT NULL,
  file_path   VARCHAR(500)  NOT NULL,
  lat         DECIMAL(10,7) NULL,
  lng         DECIMAL(10,7) NULL,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_evid_ride (ride_id),
  CONSTRAINT fk_evid_ride FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id     VARCHAR(64)  NOT NULL,
  sender_id   VARCHAR(64)  NOT NULL,
  sender_name VARCHAR(150) NULL,
  sender_role VARCHAR(20)  NOT NULL,
  message     VARCHAR(1000) NOT NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_chat_ride (ride_id, created_at),
  CONSTRAINT fk_chat_ride FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scheduled_rides (
  id                  VARCHAR(64)   NOT NULL,
  passenger_id        VARCHAR(64)   NOT NULL,
  origin              JSON          NOT NULL,
  destination         JSON          NOT NULL,
  price               DECIMAL(12,2) NOT NULL,
  scheduled_at        DATETIME(3)   NOT NULL,
  status              ENUM('pending','active','cancelled') NOT NULL DEFAULT 'pending',
  created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_sched_when (status, scheduled_at),
  CONSTRAINT fk_sched_passenger FOREIGN KEY (passenger_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS emergency_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id     VARCHAR(64)   NULL,
  user_id     VARCHAR(64)   NOT NULL,
  user_role   VARCHAR(20)   NOT NULL,
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL,
  address     VARCHAR(255)  NULL,
  comment     VARCHAR(500)  NULL,
  resolved    TINYINT(1)    NOT NULL DEFAULT 0,
  resolved_by VARCHAR(64)   NULL,
  resolved_at DATETIME(3)   NULL,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_emerg_open (resolved, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Evita pedidos duplicados por doble toque / reintentos de red
CREATE TABLE IF NOT EXISTS idempotency_keys (
  idem_key    VARCHAR(128) NOT NULL,
  user_id     VARCHAR(64)  NULL,
  scope       VARCHAR(40)  NOT NULL,
  resource_id VARCHAR(64)  NULL,
  response    JSON         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (idem_key),
  KEY ix_idem_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. BILLETERA DEL MOTORIZADO (modelo InDrive: el cliente no tiene billetera)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  driver_id              VARCHAR(64)   NOT NULL,
  available_balance      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  retained_balance       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  digital_balance        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cash_debt              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  pending_balance        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  promotional_balance    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  compensation_balance   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  accumulated_commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  version                INT UNSIGNED  NOT NULL DEFAULT 0,
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (driver_id),
  CONSTRAINT fk_wallet_driver FOREIGN KEY (driver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada movimiento de saldo. Nunca se borra ni se edita.
CREATE TABLE IF NOT EXISTS wallet_movements (
  id             VARCHAR(80)   NOT NULL,
  driver_id      VARCHAR(64)   NOT NULL,
  type           ENUM('deposit','ride_earning','fee','cash_compensation','topup_yape','platform_commission','penalty','adjustment') NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  balance_after  DECIMAL(12,2) NOT NULL,
  description    VARCHAR(255)  NULL,
  reference_id   VARCHAR(80)   NULL,
  topup_id       VARCHAR(64)   NULL,
  ride_id        VARCHAR(64)   NULL,
  created_by     VARCHAR(64)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_wmov_driver (driver_id, created_at),
  KEY ix_wmov_ride (ride_id),
  CONSTRAINT fk_wmov_wallet FOREIGN KEY (driver_id) REFERENCES wallets(driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recarga Yape (TOPUP V1)
CREATE TABLE IF NOT EXISTS topup_requests (
  id                     VARCHAR(64)   NOT NULL,
  reference_code         VARCHAR(20)   NOT NULL,
  driver_id              VARCHAR(64)   NOT NULL,
  driver_name            VARCHAR(150)  NULL,
  driver_phone           VARCHAR(20)   NULL,
  requested_amount       DECIMAL(12,2) NOT NULL,
  verified_amount        DECIMAL(12,2) NULL,
  status                 ENUM('CREATED','RECEIPT_SUBMITTED','EXTRACTED_BY_AI','RECONCILING','VERIFIED','REVIEW','REJECTED','CREDITED') NOT NULL DEFAULT 'CREATED',
  receipt_path           VARCHAR(500)  NULL,
  ai_extraction          JSON          NULL,
  bank_movement_id       VARCHAR(64)   NULL,
  reconciliation         JSON          NULL,
  expires_at             DATETIME(3)   NOT NULL,
  credited_at            DATETIME(3)   NULL,
  credited_tx_id         VARCHAR(80)   NULL,
  final_balance_snapshot DECIMAL(12,2) NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_topup_ref (reference_code),
  KEY ix_topup_driver (driver_id, created_at),
  KEY ix_topup_status (status),
  CONSTRAINT fk_topup_driver FOREIGN KEY (driver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial de estados de cada recarga (antes auditHistory dentro del documento)
CREATE TABLE IF NOT EXISTS topup_audit (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  topup_id    VARCHAR(64)  NOT NULL,
  from_status VARCHAR(20)  NOT NULL,
  to_status   VARCHAR(20)  NOT NULL,
  actor_id    VARCHAR(64)  NOT NULL,
  actor_role  ENUM('driver','operator','system','ai') NOT NULL,
  reason      VARCHAR(255) NULL,
  metadata    JSON         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_taudit_topup (topup_id, created_at),
  CONSTRAINT fk_taudit_topup FOREIGN KEY (topup_id) REFERENCES topup_requests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Movimientos Yape que el operador confirma en su celular
CREATE TABLE IF NOT EXISTS bank_movements (
  id               VARCHAR(64)   NOT NULL,
  source           VARCHAR(30)   NOT NULL DEFAULT 'YAPE_PERSONAL_MANUAL',
  amount           DECIMAL(12,2) NOT NULL,
  movement_date    DATE          NOT NULL,
  movement_time    TIME          NOT NULL,
  payer_name       VARCHAR(150)  NOT NULL,
  security_code    VARCHAR(10)   NULL,
  operation_number VARCHAR(30)   NULL,
  operator_id      VARCHAR(64)   NOT NULL,
  operator_notes   VARCHAR(255)  NULL,
  status           ENUM('UNCLAIMED','MATCHED','DISPUTED') NOT NULL DEFAULT 'UNCLAIMED',
  matched_topup_id VARCHAR(64)   NULL,
  confirmed_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bank_operation (source, operation_number),
  KEY ix_bank_status (status, movement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Candado anti doble acreditación del mismo Yape
CREATE TABLE IF NOT EXISTS processed_bank_movements (
  movement_fingerprint VARCHAR(128) NOT NULL,
  topup_id             VARCHAR(64)  NOT NULL,
  reference_code       VARCHAR(20)  NULL,
  driver_id            VARCHAR(64)  NOT NULL,
  amount               DECIMAL(12,2) NOT NULL,
  operator_id          VARCHAR(64)  NOT NULL,
  credited_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (movement_fingerprint),
  UNIQUE KEY uq_pbm_topup (topup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. LIQUIDACIÓN Y CONTABILIDAD (partida doble)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ride_settlements (
  id               VARCHAR(80)   NOT NULL,
  ride_id          VARCHAR(64)   NOT NULL,
  passenger_id     VARCHAR(64)   NULL,
  driver_id        VARCHAR(64)   NOT NULL,
  gross_amount     DECIMAL(12,2) NOT NULL,
  commission_rate  DECIMAL(5,4)  NOT NULL,
  commission       DECIMAL(12,2) NOT NULL,
  driver_net       DECIMAL(12,2) NOT NULL,
  currency         CHAR(3)       NOT NULL DEFAULT 'PEN',
  settlement_state ENUM('SETTLED','REVERSED') NOT NULL DEFAULT 'SETTLED',
  total_debit      DECIMAL(12,2) NOT NULL,
  total_credit     DECIMAL(12,2) NOT NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settle_ride (ride_id),
  KEY ix_settle_driver (driver_id, created_at),
  CONSTRAINT fk_settle_ride FOREIGN KEY (ride_id) REFERENCES rides(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounting_entries (
  id             VARCHAR(80)   NOT NULL,
  type           ENUM('RIDE_SETTLEMENT','WALLET_TOPUP_CREDIT','PENALTY','COMPENSATION','ADJUSTMENT') NOT NULL,
  ride_id        VARCHAR(64)   NULL,
  topup_id       VARCHAR(64)   NULL,
  driver_id      VARCHAR(64)   NULL,
  passenger_id   VARCHAR(64)   NULL,
  reference_code VARCHAR(20)   NULL,
  operator_id    VARCHAR(64)   NULL,
  currency       CHAR(3)       NOT NULL DEFAULT 'PEN',
  total_debit    DECIMAL(12,2) NOT NULL,
  total_credit   DECIMAL(12,2) NOT NULL,
  description    VARCHAR(255)  NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_acc_type (type, created_at),
  KEY ix_acc_driver (driver_id, created_at),
  CONSTRAINT ck_acc_balanced CHECK (total_debit = total_credit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounting_lines (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id  VARCHAR(80)   NOT NULL,
  account   VARCHAR(60)   NOT NULL,
  side      ENUM('DEBIT','CREDIT') NOT NULL,
  amount    DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_lines_entry (entry_id),
  KEY ix_lines_account (account),
  CONSTRAINT fk_lines_entry FOREIGN KEY (entry_id) REFERENCES accounting_entries(id),
  CONSTRAINT ck_lines_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. NOTIFICACIONES, AUDITORÍA Y CONFIGURACIÓN
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(64)  NOT NULL,
  title       VARCHAR(150) NOT NULL,
  message     VARCHAR(500) NOT NULL,
  type        ENUM('info','success','alert','promo') NOT NULL DEFAULT 'info',
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  data        JSON         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens push del celular (FCM sigue sirviendo para notificaciones sin Firestore)
CREATE TABLE IF NOT EXISTS push_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(64)  NOT NULL,
  token       VARCHAR(255) NOT NULL,
  platform    ENUM('android','ios','web') NOT NULL DEFAULT 'android',
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_token (token),
  KEY ix_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    VARCHAR(64)  NULL,
  actor_role  VARCHAR(20)  NULL,
  action      VARCHAR(80)  NOT NULL,
  target_type VARCHAR(40)  NULL,
  target_id   VARCHAR(80)  NULL,
  details     JSON         NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_audit_target (target_type, target_id),
  KEY ix_audit_actor (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Telemetría, alertas de fraude/flota, choques (antes 5 colecciones sueltas)
CREATE TABLE IF NOT EXISTS system_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type        ENUM('TELEMETRY','FRAUD_ALERT','FLEET_ALERT','CRASH','OTHER') NOT NULL,
  severity    ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  user_id     VARCHAR(64)  NULL,
  ride_id     VARCHAR(64)  NULL,
  payload     JSON         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_sysev_type (type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parámetros de negocio editables sin recompilar
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(80)  NOT NULL,
  setting_value JSON         NOT NULL,
  description   VARCHAR(255) NULL,
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(40) NOT NULL,
  applied_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('platform_commission_rate', '0.10', 'Comisión de Zénith por pedido: 10% (decidido 16-11-2026)'),
  ('commission_min_amount',    '0.50', 'Comisión mínima por pedido en soles'),
  ('new_driver_free_days',     '14',   'Días con 0% de comisión para motorizados nuevos'),
  ('offer_timeout_seconds',    '15',   'Segundos que un motorizado tiene para aceptar una oferta'),
  ('included_wait_minutes',    '5',    'Minutos de espera incluidos en el recojo');

INSERT IGNORE INTO schema_migrations (version) VALUES ('001_initial');
