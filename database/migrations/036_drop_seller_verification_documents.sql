-- Contract only after repository cutover and verified source parity.
CREATE TEMPORARY TABLE seller_document_drop_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO seller_document_drop_guard SELECT COUNT(*)
FROM seller_verification_documents d LEFT JOIN seller_verification_requests r ON r.id=d.request_id
WHERE d.document_type='ID_FRONT' AND (r.id IS NULL OR NOT (d.id <=> r.id_front_id AND d.storage_path <=> r.id_front_storage_path AND d.mime_type <=> r.id_front_mime_type AND d.file_size <=> r.id_front_file_size AND d.sha256 <=> r.id_front_sha256 AND d.created_at <=> r.id_front_created_at));
INSERT INTO seller_document_drop_guard SELECT COUNT(*)
FROM seller_verification_documents d LEFT JOIN seller_verification_requests r ON r.id=d.request_id
WHERE d.document_type='ID_BACK' AND (r.id IS NULL OR NOT (d.id <=> r.id_back_id AND d.storage_path <=> r.id_back_storage_path AND d.mime_type <=> r.id_back_mime_type AND d.file_size <=> r.id_back_file_size AND d.sha256 <=> r.id_back_sha256 AND d.created_at <=> r.id_back_created_at));
INSERT INTO seller_document_drop_guard SELECT COUNT(*)
FROM seller_verification_documents d LEFT JOIN seller_verification_requests r ON r.id=d.request_id
WHERE d.document_type='SELFIE' AND (r.id IS NULL OR NOT (d.id <=> r.selfie_id AND d.storage_path <=> r.selfie_storage_path AND d.mime_type <=> r.selfie_mime_type AND d.file_size <=> r.selfie_file_size AND d.sha256 <=> r.selfie_sha256 AND d.created_at <=> r.selfie_created_at));
DROP TABLE seller_verification_documents;
DROP TEMPORARY TABLE seller_document_drop_guard;
