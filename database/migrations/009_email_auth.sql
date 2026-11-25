-- 009: Login/registro por correo (reemplaza SMS/Twilio para no pagar proveedor
-- de mensajes al inicio). El celular queda como dato opcional de contacto.

ALTER TABLE otp_codes
  MODIFY COLUMN phone VARCHAR(190) NOT NULL,
  MODIFY COLUMN purpose ENUM('LOGIN','VERIFY_PHONE','VERIFY_EMAIL','RESET_PASSWORD') NOT NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('009_email_auth');
