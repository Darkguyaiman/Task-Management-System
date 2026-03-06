DROP DATABASE IF EXISTS task_system;
CREATE DATABASE task_system;
USE task_system;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password VARCHAR(255) NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  designation VARCHAR(120) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE kpi_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kpi_category_id INT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_kpi_category
    FOREIGN KEY (kpi_category_id) REFERENCES kpi_categories(id)
    ON DELETE RESTRICT,
  INDEX idx_tasks_kpi_category_id (kpi_category_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_due_date (due_date)
);

CREATE TABLE task_kpi_categories (
  task_id INT UNSIGNED NOT NULL,
  kpi_category_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, kpi_category_id),
  CONSTRAINT fk_task_kpi_categories_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_kpi_categories_kpi
    FOREIGN KEY (kpi_category_id) REFERENCES kpi_categories(id) ON DELETE CASCADE,
  INDEX idx_task_kpi_categories_kpi (kpi_category_id)
);

CREATE TABLE task_staff (
  task_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  completion_status ENUM('not_submitted', 'submitted') NOT NULL DEFAULT 'not_submitted',
  completion_remarks TEXT NULL,
  completion_submitted_at DATETIME NULL,
  proof_path VARCHAR(255) NULL,
  proof_original_name VARCHAR(255) NULL,
  proof_mime_type VARCHAR(120) NULL,
  proof_size_bytes INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT fk_task_staff_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_staff_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_staff_user_id (user_id)
);

CREATE TABLE sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT(11) UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id),
  INDEX idx_sessions_expires (expires)
) ENGINE=InnoDB;

INSERT INTO kpi_categories (name) VALUES
  ('Customer Satisfaction'),
  ('Productivity'),
  ('Quality Assurance'),
  ('Revenue Growth'),
  ('Operational Efficiency'),
  ('Learning and Development');

INSERT INTO users (name, email) VALUES
  ('Alice Johnson', 'alice.johnson@example.com'),
  ('Bob Lee', 'bob.lee@example.com'),
  ('Carla Gomez', 'carla.gomez@example.com');

INSERT INTO tasks (kpi_category_id, title, description, status, due_date) VALUES
  (2, 'Prepare sprint board', 'Create and prioritize backlog items for sprint planning.', 'in_progress', CURRENT_DATE + INTERVAL 2 DAY),
  (1, 'Follow up with enterprise client', 'Collect post-implementation satisfaction feedback.', 'pending', CURRENT_DATE + INTERVAL 1 DAY),
  (3, 'Run regression test suite', 'Validate release candidate across key workflows.', 'completed', CURRENT_DATE),
  (5, 'Optimize onboarding workflow', 'Reduce manual steps in account setup process.', 'pending', CURRENT_DATE + INTERVAL 5 DAY);

INSERT INTO task_kpi_categories (task_id, kpi_category_id) VALUES
  (1, 2),
  (2, 1),
  (3, 3),
  (4, 5);

INSERT INTO task_staff (task_id, user_id) VALUES
  (1, 1),
  (2, 2),
  (3, 3),
  (4, 1);
