ALTER TABLE task_staff
  ADD COLUMN completion_status ENUM('not_submitted', 'submitted') NOT NULL DEFAULT 'not_submitted' AFTER user_id,
  ADD COLUMN completion_remarks TEXT NULL AFTER completion_status,
  ADD COLUMN completion_submitted_at DATETIME NULL AFTER completion_remarks,
  ADD COLUMN proof_path VARCHAR(255) NULL AFTER completion_submitted_at,
  ADD COLUMN proof_original_name VARCHAR(255) NULL AFTER proof_path,
  ADD COLUMN proof_mime_type VARCHAR(120) NULL AFTER proof_original_name,
  ADD COLUMN proof_size_bytes INT UNSIGNED NULL AFTER proof_mime_type;
