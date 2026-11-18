-- 007: Suscripciones Web Push (reemplazo de Firebase Cloud Messaging, ya quitado).
-- Un usuario puede tener varias suscripciones (varios celulares/navegadores);
-- se identifican por el endpoint único que entrega el navegador.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          VARCHAR(64)   NOT NULL,
  user_id     VARCHAR(64)   NOT NULL,
  endpoint    VARCHAR(512)  NOT NULL,
  p256dh      VARCHAR(255)  NOT NULL,
  auth        VARCHAR(255)  NOT NULL,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint),
  KEY ix_push_user (user_id),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('007_push_subscriptions');
