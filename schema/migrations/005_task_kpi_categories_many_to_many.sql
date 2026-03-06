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

INSERT INTO task_kpi_categories (task_id, kpi_category_id)
SELECT t.id, t.kpi_category_id
FROM tasks t
WHERE t.kpi_category_id IS NOT NULL;
