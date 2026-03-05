const pool = require('../config/db');

const VALID_STATUSES = ['pending', 'in_progress', 'completed'];

const buildTaskFilter = (query) => {
  const conditions = [];
  const params = [];

  if (query.user_id) {
    conditions.push('t.user_id = ?');
    params.push(Number(query.user_id));
  }

  if (query.status && VALID_STATUSES.includes(query.status)) {
    conditions.push('t.status = ?');
    params.push(query.status);
  }

  if (query.due_date) {
    conditions.push('t.due_date = ?');
    params.push(query.due_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
};

const fetchTaskFormData = async () => {
  const [users] = await pool.query(
    `SELECT
      u.id,
      u.name,
      u.email
    FROM users u
    ORDER BY u.name ASC`
  );

  const [categories] = await pool.query(
    `SELECT
      kc.id,
      kc.name
    FROM kpi_categories kc
    ORDER BY kc.name ASC`
  );

  return { users, categories };
};

const listTasks = async (req, res, next) => {
  try {
    const { whereClause, params } = buildTaskFilter(req.query);

    const [tasks] = await pool.query(
      `SELECT
        t.id,
        t.user_id,
        t.kpi_category_id,
        t.title,
        t.description,
        t.status,
        t.due_date,
        t.created_at,
        u.name AS user_name,
        u.email AS user_email,
        kc.name AS kpi_category_name
      FROM tasks t
      INNER JOIN users u ON u.id = t.user_id
      INNER JOIN kpi_categories kc ON kc.id = t.kpi_category_id
      ${whereClause}
      ORDER BY t.due_date ASC, t.created_at DESC`,
      params
    );

    const { users, categories } = await fetchTaskFormData();

    res.render('tasks/index', {
      title: 'Tasks',
      tasks,
      users,
      categories,
      filters: {
        user_id: req.query.user_id || '',
        status: req.query.status || '',
        due_date: req.query.due_date || ''
      },
      formError: null,
      oldInput: {}
    });
  } catch (error) {
    next(error);
  }
};

const createTask = async (req, res, next) => {
  const { user_id, kpi_category_id, title, description, status, due_date } = req.body;

  if (!user_id || !kpi_category_id || !title || !status || !due_date) {
    try {
      const [tasks] = await pool.query(
        `SELECT
          t.id,
          t.user_id,
          t.kpi_category_id,
          t.title,
          t.description,
          t.status,
          t.due_date,
          t.created_at,
          u.name AS user_name,
          u.email AS user_email,
          kc.name AS kpi_category_name
        FROM tasks t
        INNER JOIN users u ON u.id = t.user_id
        INNER JOIN kpi_categories kc ON kc.id = t.kpi_category_id
        ORDER BY t.due_date ASC, t.created_at DESC`
      );
      const { users, categories } = await fetchTaskFormData();
      return res.status(400).render('tasks/index', {
        title: 'Tasks',
        tasks,
        users,
        categories,
        filters: { user_id: '', status: '', due_date: '' },
        formError: 'User, KPI category, title, status, and due date are required.',
        oldInput: { user_id, kpi_category_id, title, description, status, due_date }
      });
    } catch (error) {
      return next(error);
    }
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).send('Invalid task status');
  }

  try {
    await pool.query(
      `INSERT INTO tasks (user_id, kpi_category_id, title, description, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(user_id), Number(kpi_category_id), title.trim(), description ? description.trim() : null, status, due_date]
    );

    res.redirect('/tasks');
  } catch (error) {
    next(error);
  }
};

const getEditTask = async (req, res, next) => {
  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  try {
    const [taskRows] = await pool.query(
      `SELECT
        t.id,
        t.user_id,
        t.kpi_category_id,
        t.title,
        t.description,
        t.status,
        t.due_date
      FROM tasks t
      WHERE t.id = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).send('Task not found');
    }

    const { users, categories } = await fetchTaskFormData();

    res.render('tasks/edit', {
      title: 'Edit Task',
      task: taskRows[0],
      users,
      categories,
      formError: null
    });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  const taskId = Number(req.params.id);
  const { user_id, kpi_category_id, title, description, status, due_date } = req.body;

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  if (!user_id || !kpi_category_id || !title || !status || !due_date) {
    try {
      const [taskRows] = await pool.query(
        `SELECT
          t.id,
          t.user_id,
          t.kpi_category_id,
          t.title,
          t.description,
          t.status,
          t.due_date
        FROM tasks t
        WHERE t.id = ?`,
        [taskId]
      );

      if (taskRows.length === 0) {
        return res.status(404).send('Task not found');
      }

      const { users, categories } = await fetchTaskFormData();
      return res.status(400).render('tasks/edit', {
        title: 'Edit Task',
        task: {
          ...taskRows[0],
          user_id,
          kpi_category_id,
          title,
          description,
          status,
          due_date
        },
        users,
        categories,
        formError: 'All required fields must be filled.'
      });
    } catch (error) {
      return next(error);
    }
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).send('Invalid task status');
  }

  try {
    const [result] = await pool.query(
      `UPDATE tasks
       SET user_id = ?,
           kpi_category_id = ?,
           title = ?,
           description = ?,
           status = ?,
           due_date = ?
       WHERE id = ?`,
      [Number(user_id), Number(kpi_category_id), title.trim(), description ? description.trim() : null, status, due_date, taskId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send('Task not found');
    }

    res.redirect('/tasks');
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  try {
    await pool.query(
      `DELETE FROM tasks
       WHERE id = ?`,
      [taskId]
    );

    res.redirect('/tasks');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTasks,
  createTask,
  getEditTask,
  updateTask,
  deleteTask
};