-- Task–staff many-to-many: one task can have multiple staff assigned.
-- Step 1: Create junction table.
CREATE TABLE task_staff (
  task_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT fk_task_staff_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_staff_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_staff_user_id (user_id)
);

-- Step 2: Migrate existing single assignee into task_staff.
INSERT INTO task_staff (task_id, user_id)
SELECT id, user_id FROM tasks WHERE user_id IS NOT NULL;

-- Step 3: Drop FK and indexes that reference user_id on tasks, then drop column.
ALTER TABLE tasks
  DROP FOREIGN KEY fk_tasks_user,
  DROP INDEX idx_tasks_user_id,
  DROP INDEX idx_tasks_user_status;

ALTER TABLE tasks
  DROP COLUMN user_id;
