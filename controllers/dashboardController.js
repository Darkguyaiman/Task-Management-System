const pool = require('../config/db');

const getDashboard = async (req, res, next) => {
  try {
    const currentUser = req.session && req.session.user ? req.session.user : null;
    const isAdmin = currentUser && currentUser.role === 'admin';
    const userId = currentUser ? Number(currentUser.id) : null;

    let summary = {};
    let statusData = [];
    let kpiData = [];
    let dueTimeline = [];
    let topPerformers = [];

    if (isAdmin) {
      const [summaryRows] = await pool.query(
        `SELECT
          COUNT(t.id) AS total_tasks,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
          SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
          SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
          SUM(CASE WHEN t.due_date = CURRENT_DATE THEN 1 ELSE 0 END) AS due_today,
          SUM(CASE WHEN t.due_date < CURRENT_DATE AND t.status <> 'completed' THEN 1 ELSE 0 END) AS overdue_tasks,
          SUM(CASE WHEN t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 7 DAY THEN 1 ELSE 0 END) AS due_next_7_days
        FROM tasks t`
      );

      const [staffRows] = await pool.query(
        `SELECT COUNT(*) AS total_staff FROM users WHERE role = 'staff'`
      );

      const [statusRows] = await pool.query(
        `SELECT t.status AS label, COUNT(*) AS value
         FROM tasks t
         GROUP BY t.status`
      );

      const [kpiRows] = await pool.query(
        `SELECT kc.name AS label, COUNT(t.id) AS value
         FROM kpi_categories kc
         LEFT JOIN tasks t ON t.kpi_category_id = kc.id
         GROUP BY kc.id, kc.name
         ORDER BY value DESC, kc.name ASC`
      );

      const [timelineRows] = await pool.query(
        `SELECT DATE_FORMAT(t.due_date, '%Y-%m-%d') AS label, COUNT(*) AS value
         FROM tasks t
         WHERE t.due_date BETWEEN CURRENT_DATE - INTERVAL 3 DAY AND CURRENT_DATE + INTERVAL 10 DAY
         GROUP BY t.due_date
         ORDER BY t.due_date ASC`
      );

      const [performerRows] = await pool.query(
        `SELECT
          u.name,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
          COUNT(ts.task_id) AS assigned_count
         FROM users u
         LEFT JOIN task_staff ts ON ts.user_id = u.id
         LEFT JOIN tasks t ON t.id = ts.task_id
         WHERE u.role = 'staff'
         GROUP BY u.id, u.name
         ORDER BY completed_count DESC, assigned_count DESC, u.name ASC
         LIMIT 6`
      );

      const base = summaryRows[0] || {};
      const totalTasks = Number(base.total_tasks || 0);
      const completedTasks = Number(base.completed_tasks || 0);
      const completionRate = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0;

      summary = {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: Number(base.in_progress_tasks || 0),
        pending_tasks: Number(base.pending_tasks || 0),
        due_today: Number(base.due_today || 0),
        overdue_tasks: Number(base.overdue_tasks || 0),
        due_next_7_days: Number(base.due_next_7_days || 0),
        total_staff: Number((staffRows[0] && staffRows[0].total_staff) || 0),
        completion_rate: completionRate
      };

      statusData = statusRows.map((row) => ({
        label: row.label,
        value: Number(row.value || 0)
      }));
      kpiData = kpiRows.map((row) => ({
        label: row.label,
        value: Number(row.value || 0)
      }));
      dueTimeline = timelineRows.map((row) => ({
        label: row.label,
        value: Number(row.value || 0)
      }));
      topPerformers = performerRows.map((row) => {
        const assigned = Number(row.assigned_count || 0);
        const completed = Number(row.completed_count || 0);
        const rate = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(1)) : 0;
        return {
          name: row.name,
          completed_count: completed,
          assigned_count: assigned,
          completion_rate: rate
        };
      });
    } else {
      const [summaryRows] = await pool.query(
        `SELECT
          COUNT(t.id) AS total_tasks,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
          SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
          SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
          SUM(CASE WHEN t.due_date = CURRENT_DATE THEN 1 ELSE 0 END) AS due_today,
          SUM(CASE WHEN t.due_date < CURRENT_DATE AND t.status <> 'completed' THEN 1 ELSE 0 END) AS overdue_tasks,
          SUM(CASE WHEN t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 7 DAY THEN 1 ELSE 0 END) AS due_next_7_days
        FROM tasks t
        INNER JOIN task_staff ts ON ts.task_id = t.id
        WHERE ts.user_id = ?`,
        [userId]
      );

      const [statusRows] = await pool.query(
        `SELECT t.status AS label, COUNT(*) AS value
         FROM tasks t
         INNER JOIN task_staff ts ON ts.task_id = t.id
         WHERE ts.user_id = ?
         GROUP BY t.status`,
        [userId]
      );

      const [kpiRows] = await pool.query(
        `SELECT kc.name AS label, COUNT(t.id) AS value
         FROM kpi_categories kc
         LEFT JOIN tasks t ON t.kpi_category_id = kc.id
         LEFT JOIN task_staff ts ON ts.task_id = t.id AND ts.user_id = ?
         WHERE ts.user_id IS NOT NULL
         GROUP BY kc.id, kc.name
         ORDER BY value DESC, kc.name ASC`,
        [userId]
      );

      const [timelineRows] = await pool.query(
        `SELECT DATE_FORMAT(t.due_date, '%Y-%m-%d') AS label, COUNT(*) AS value
         FROM tasks t
         INNER JOIN task_staff ts ON ts.task_id = t.id
         WHERE ts.user_id = ?
           AND t.due_date BETWEEN CURRENT_DATE - INTERVAL 3 DAY AND CURRENT_DATE + INTERVAL 10 DAY
         GROUP BY t.due_date
         ORDER BY t.due_date ASC`,
        [userId]
      );

      const base = summaryRows[0] || {};
      const totalTasks = Number(base.total_tasks || 0);
      const completedTasks = Number(base.completed_tasks || 0);
      const completionRate = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0;

      summary = {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: Number(base.in_progress_tasks || 0),
        pending_tasks: Number(base.pending_tasks || 0),
        due_today: Number(base.due_today || 0),
        overdue_tasks: Number(base.overdue_tasks || 0),
        due_next_7_days: Number(base.due_next_7_days || 0),
        completion_rate: completionRate
      };

      statusData = statusRows.map((row) => ({
        label: row.label,
        value: Number(row.value || 0)
      }));
      kpiData = kpiRows.map((row) => ({
        label: row.label,
        value: Number(row.value || 0)
      }));
      dueTimeline = timelineRows.map((row) => ({
        label: row.label,
        value: Number(row.value || 0)
      }));
    }

    res.render('dashboard', {
      title: 'Dashboard',
      isAdmin,
      summary,
      chartData: {
        status: statusData,
        kpi: kpiData,
        dueTimeline
      },
      topPerformers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard
};
