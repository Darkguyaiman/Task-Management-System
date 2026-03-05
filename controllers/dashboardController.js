const pool = require('../config/db');

const getDashboard = async (req, res, next) => {
  try {
    const [summaryRows] = await pool.query(
      `SELECT
        COUNT(t.id) AS total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
        SUM(CASE WHEN t.due_date = CURRENT_DATE THEN 1 ELSE 0 END) AS due_today
      FROM tasks t`
    );

    const summary = summaryRows[0] || {
      total_tasks: 0,
      completed_tasks: 0,
      pending_tasks: 0,
      due_today: 0
    };

    res.render('dashboard', {
      title: 'Dashboard',
      summary: {
        total_tasks: Number(summary.total_tasks || 0),
        completed_tasks: Number(summary.completed_tasks || 0),
        pending_tasks: Number(summary.pending_tasks || 0),
        due_today: Number(summary.due_today || 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard
};