CREATE TABLE reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  report_type ENUM('REVIEW','TRANSACTION') NOT NULL,
  source_report_id BIGINT UNSIGNED NULL,
  review_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reported_id BIGINT UNSIGNED NULL,
  reason VARCHAR(40) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('PENDING','REVIEWED','DISMISSED','REMOVED','RESOLVED') NOT NULL DEFAULT 'PENDING',
  outcome ENUM('ACTION_TAKEN','NO_VIOLATION') NULL,
  admin_note VARCHAR(500) NULL,
  resolved_at DATETIME NULL,
  resolved_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reports_source (report_type,source_report_id),
  UNIQUE KEY uq_reports_review_reporter (review_id,reporter_id),
  UNIQUE KEY uq_reports_order_reporter (order_id,reporter_id),
  KEY idx_reports_type_status_created (report_type,status,created_at),
  CONSTRAINT fk_reports_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reports_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reports_reported FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_reports_target CHECK (
    (report_type='REVIEW' AND review_id IS NOT NULL AND order_id IS NULL AND reported_id IS NULL
      AND status IN ('PENDING','REVIEWED','DISMISSED','REMOVED') AND outcome IS NULL)
    OR (report_type='TRANSACTION' AND review_id IS NULL AND order_id IS NOT NULL AND reported_id IS NOT NULL
      AND status IN ('PENDING','RESOLVED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO reports (report_type,source_report_id,review_id,reporter_id,reason,description,status,
  admin_note,resolved_at,resolved_by,created_at,updated_at)
SELECT 'REVIEW',id,review_id,reporter_id,reason,description,status,
  admin_note,resolved_at,resolved_by,created_at,updated_at FROM review_reports ORDER BY id;
INSERT INTO reports (report_type,source_report_id,order_id,reporter_id,reported_id,reason,description,status,outcome,
  admin_note,resolved_at,resolved_by,created_at,updated_at)
SELECT 'TRANSACTION',id,order_id,reporter_id,reported_id,reason,description,status,outcome,
  admin_note,resolved_at,resolved_by,created_at,updated_at FROM transaction_reports ORDER BY id;
SET @report_next_id = (SELECT GREATEST(COALESCE(MAX(id),0),COALESCE(MAX(source_report_id),0))+1 FROM reports);
SET @report_sequence_sql = CONCAT('ALTER TABLE reports AUTO_INCREMENT=', @report_next_id);
PREPARE report_sequence FROM @report_sequence_sql;
EXECUTE report_sequence;
DEALLOCATE PREPARE report_sequence;
