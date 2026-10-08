CREATE TEMPORARY TABLE report_drop_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO report_drop_guard SELECT COUNT(*) FROM review_reports s
LEFT JOIN reports r ON r.report_type='REVIEW' AND r.source_report_id=s.id
WHERE r.id IS NULL OR NOT (BINARY s.review_id <=> BINARY r.review_id AND BINARY s.reporter_id <=> BINARY r.reporter_id AND BINARY s.reason <=> BINARY r.reason AND BINARY s.description <=> BINARY r.description AND BINARY s.status <=> BINARY r.status AND BINARY s.admin_note <=> BINARY r.admin_note AND BINARY s.resolved_at <=> BINARY r.resolved_at AND BINARY s.resolved_by <=> BINARY r.resolved_by AND BINARY s.created_at <=> BINARY r.created_at AND BINARY s.updated_at <=> BINARY r.updated_at);
INSERT INTO report_drop_guard SELECT COUNT(*) FROM transaction_reports s
LEFT JOIN reports r ON r.report_type='TRANSACTION' AND r.source_report_id=s.id
WHERE r.id IS NULL OR NOT (BINARY s.order_id <=> BINARY r.order_id AND BINARY s.reporter_id <=> BINARY r.reporter_id AND BINARY s.reported_id <=> BINARY r.reported_id AND BINARY s.reason <=> BINARY r.reason AND BINARY s.description <=> BINARY r.description AND BINARY s.status <=> BINARY r.status AND BINARY s.outcome <=> BINARY r.outcome AND BINARY s.admin_note <=> BINARY r.admin_note AND BINARY s.resolved_at <=> BINARY r.resolved_at AND BINARY s.resolved_by <=> BINARY r.resolved_by AND BINARY s.created_at <=> BINARY r.created_at AND BINARY s.updated_at <=> BINARY r.updated_at);
DROP TABLE review_reports;
DROP TABLE transaction_reports;
DROP TEMPORARY TABLE report_drop_guard;
