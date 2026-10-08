-- Expand first; retain the source table until data and application checks pass.
ALTER TABLE seller_verification_requests
  ADD COLUMN document_id_floor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN id_front_id BIGINT UNSIGNED NULL,
  ADD COLUMN id_front_storage_path VARCHAR(500) NULL,
  ADD COLUMN id_front_mime_type VARCHAR(100) NULL,
  ADD COLUMN id_front_file_size INT UNSIGNED NULL,
  ADD COLUMN id_front_sha256 CHAR(64) NULL,
  ADD COLUMN id_front_created_at DATETIME(3) NULL,
  ADD COLUMN id_back_id BIGINT UNSIGNED NULL,
  ADD COLUMN id_back_storage_path VARCHAR(500) NULL,
  ADD COLUMN id_back_mime_type VARCHAR(100) NULL,
  ADD COLUMN id_back_file_size INT UNSIGNED NULL,
  ADD COLUMN id_back_sha256 CHAR(64) NULL,
  ADD COLUMN id_back_created_at DATETIME(3) NULL,
  ADD COLUMN selfie_id BIGINT UNSIGNED NULL,
  ADD COLUMN selfie_storage_path VARCHAR(500) NULL,
  ADD COLUMN selfie_mime_type VARCHAR(100) NULL,
  ADD COLUMN selfie_file_size INT UNSIGNED NULL,
  ADD COLUMN selfie_sha256 CHAR(64) NULL,
  ADD COLUMN selfie_created_at DATETIME(3) NULL;

-- Reserve IDs above every historical document ID for future uploads.
SET @seller_document_floor = (SELECT COALESCE(MAX(id),0) FROM seller_verification_documents);
SET @seller_document_default = CONCAT('ALTER TABLE seller_verification_requests ALTER COLUMN document_id_floor SET DEFAULT ', @seller_document_floor);
PREPARE seller_document_default FROM @seller_document_default;
EXECUTE seller_document_default;
DEALLOCATE PREPARE seller_document_default;
UPDATE seller_verification_requests SET document_id_floor=@seller_document_floor, updated_at=updated_at;

UPDATE seller_verification_requests r
JOIN seller_verification_documents d ON d.request_id=r.id AND d.document_type='ID_FRONT'
SET r.id_front_id=d.id,
    r.id_front_storage_path=d.storage_path,
    r.id_front_mime_type=d.mime_type,
    r.id_front_file_size=d.file_size,
    r.id_front_sha256=d.sha256,
    r.id_front_created_at=d.created_at,
    r.updated_at=r.updated_at;

UPDATE seller_verification_requests r
JOIN seller_verification_documents d ON d.request_id=r.id AND d.document_type='ID_BACK'
SET r.id_back_id=d.id,
    r.id_back_storage_path=d.storage_path,
    r.id_back_mime_type=d.mime_type,
    r.id_back_file_size=d.file_size,
    r.id_back_sha256=d.sha256,
    r.id_back_created_at=d.created_at,
    r.updated_at=r.updated_at;

UPDATE seller_verification_requests r
JOIN seller_verification_documents d ON d.request_id=r.id AND d.document_type='SELFIE'
SET r.selfie_id=d.id,
    r.selfie_storage_path=d.storage_path,
    r.selfie_mime_type=d.mime_type,
    r.selfie_file_size=d.file_size,
    r.selfie_sha256=d.sha256,
    r.selfie_created_at=d.created_at,
    r.updated_at=r.updated_at;

ALTER TABLE seller_verification_requests
  ADD UNIQUE KEY uq_seller_id_front_document (id_front_id),
  ADD CONSTRAINT chk_seller_id_front_document CHECK (
    (id_front_id IS NULL AND id_front_storage_path IS NULL AND id_front_mime_type IS NULL AND id_front_file_size IS NULL AND id_front_sha256 IS NULL AND id_front_created_at IS NULL) OR
    (id_front_id IS NOT NULL AND id_front_storage_path IS NOT NULL AND id_front_mime_type IS NOT NULL AND id_front_file_size IS NOT NULL AND id_front_sha256 IS NOT NULL AND id_front_created_at IS NOT NULL)
  ),
  ADD UNIQUE KEY uq_seller_id_back_document (id_back_id),
  ADD CONSTRAINT chk_seller_id_back_document CHECK (
    (id_back_id IS NULL AND id_back_storage_path IS NULL AND id_back_mime_type IS NULL AND id_back_file_size IS NULL AND id_back_sha256 IS NULL AND id_back_created_at IS NULL) OR
    (id_back_id IS NOT NULL AND id_back_storage_path IS NOT NULL AND id_back_mime_type IS NOT NULL AND id_back_file_size IS NOT NULL AND id_back_sha256 IS NOT NULL AND id_back_created_at IS NOT NULL)
  ),
  ADD UNIQUE KEY uq_seller_selfie_document (selfie_id),
  ADD CONSTRAINT chk_seller_selfie_document CHECK (
    (selfie_id IS NULL AND selfie_storage_path IS NULL AND selfie_mime_type IS NULL AND selfie_file_size IS NULL AND selfie_sha256 IS NULL AND selfie_created_at IS NULL) OR
    (selfie_id IS NOT NULL AND selfie_storage_path IS NOT NULL AND selfie_mime_type IS NOT NULL AND selfie_file_size IS NOT NULL AND selfie_sha256 IS NOT NULL AND selfie_created_at IS NOT NULL)
  );
