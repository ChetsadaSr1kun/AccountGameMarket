ALTER TABLE seller_verification_requests
  MODIFY COLUMN status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT';

CREATE TABLE IF NOT EXISTS seller_verification_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('ID_FRONT', 'ID_BACK', 'SELFIE') NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_seller_verification_document_type (request_id, document_type),
  CONSTRAINT fk_seller_verification_documents_request
    FOREIGN KEY (request_id) REFERENCES seller_verification_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
