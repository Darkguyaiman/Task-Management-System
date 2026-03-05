DROP DATABASE IF EXISTS task_system;
CREATE DATABASE task_system;
USE task_system;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
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
  user_id INT UNSIGNED NOT NULL,
  kpi_category_id INT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tasks_kpi_category
    FOREIGN KEY (kpi_category_id) REFERENCES kpi_categories(id)
    ON DELETE RESTRICT,
  INDEX idx_tasks_user_id (user_id),
  INDEX idx_tasks_kpi_category_id (kpi_category_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_due_date (due_date),
  INDEX idx_tasks_user_status (user_id, status)
);

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

INSERT INTO tasks (user_id, kpi_category_id, title, description, status, due_date) VALUES
  (1, 2, 'Prepare sprint board', 'Create and prioritize backlog items for sprint planning.', 'in_progress', CURRENT_DATE + INTERVAL 2 DAY),
  (2, 1, 'Follow up with enterprise client', 'Collect post-implementation satisfaction feedback.', 'pending', CURRENT_DATE + INTERVAL 1 DAY),
  (3, 3, 'Run regression test suite', 'Validate release candidate across key workflows.', 'completed', CURRENT_DATE),
  (1, 5, 'Optimize onboarding workflow', 'Reduce manual steps in account setup process.', 'pending', CURRENT_DATE + INTERVAL 5 DAY);