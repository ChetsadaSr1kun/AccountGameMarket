ALTER TABLE transaction_reports
  ADD COLUMN outcome ENUM(
    'ACTION_TAKEN',
    'NO_VIOLATION'
  ) NULL AFTER status;


UPDATE transaction_reports
SET outcome = 'NO_VIOLATION'
WHERE status = 'DISMISSED';


UPDATE transaction_reports
SET outcome = 'ACTION_TAKEN'
WHERE status = 'RESOLVED';


UPDATE transaction_reports
SET status = 'PENDING'
WHERE status = 'REVIEWED';


UPDATE transaction_reports
SET status = 'RESOLVED'
WHERE status = 'DISMISSED';


ALTER TABLE transaction_reports
  MODIFY COLUMN status ENUM(
    'PENDING',
    'RESOLVED'
  ) NOT NULL DEFAULT 'PENDING';