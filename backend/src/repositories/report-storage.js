// Explicit projections keep public source IDs and the original response shapes.
const reviewReports = `(SELECT COALESCE(source_report_id,id) id,review_id,reporter_id,reason,description,
  status,admin_note,resolved_at,resolved_by,created_at,updated_at FROM reports WHERE report_type='REVIEW')`;
const transactionReports = `(SELECT COALESCE(source_report_id,id) id,order_id,reporter_id,reported_id,reason,
  description,status,outcome,admin_note,resolved_at,resolved_by,created_at,updated_at
  FROM reports WHERE report_type='TRANSACTION')`;
module.exports = { reviewReports, transactionReports };
