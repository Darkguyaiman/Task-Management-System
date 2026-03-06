const pool = require('../config/db');

const isValidDateInput = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const normalizeIdList = (raw) => {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return Array.from(
    new Set(
      arr
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );
};

const getReportsPage = async (req, res, next) => {
  try {
    const selectedUserIds = normalizeIdList(req.query.user_ids);
    const selectedKpiCategoryIds = normalizeIdList(req.query.kpi_category_ids);
    const startDate = isValidDateInput(req.query.start_date) ? String(req.query.start_date) : '';
    const endDate = isValidDateInput(req.query.end_date) ? String(req.query.end_date) : '';

    const [users] = await pool.query(
      `SELECT id, name, role
       FROM users
       ORDER BY name ASC`
    );
    const [kpiCategories] = await pool.query(
      `SELECT id, name
       FROM kpi_categories
       ORDER BY name ASC`
    );

    const where = [];
    const params = [];

    if (selectedUserIds.length > 0) {
      where.push('u.id IN (?)');
      params.push(selectedUserIds);
    }
    if (startDate) {
      where.push('t.due_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('t.due_date <= ?');
      params.push(endDate);
    }
    if (selectedKpiCategoryIds.length > 0) {
      where.push('t.kpi_category_id IN (?)');
      params.push(selectedKpiCategoryIds);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.role AS user_role,
        t.id AS task_id,
        t.title AS task_title,
        t.status AS task_status,
        t.due_date,
        kc.name AS kpi_name,
        ts.completion_status,
        ts.completion_submitted_at,
        ts.proof_path,
        ts.proof_original_name
      FROM task_staff ts
      INNER JOIN users u ON u.id = ts.user_id
      INNER JOIN tasks t ON t.id = ts.task_id
      INNER JOIN kpi_categories kc ON kc.id = t.kpi_category_id
      ${whereSql}
      ORDER BY u.name ASC, t.due_date DESC, t.id DESC`,
      params
    );

    const todayIso = new Date().toISOString().slice(0, 10);
    const summaryMap = new Map();

    rows.forEach((row) => {
      if (!summaryMap.has(row.user_id)) {
        summaryMap.set(row.user_id, {
          user_id: row.user_id,
          user_name: row.user_name,
          user_role: row.user_role,
          assigned_count: 0,
          submitted_count: 0,
          task_completed_count: 0,
          overdue_count: 0,
        });
      }

      const current = summaryMap.get(row.user_id);
      current.assigned_count += 1;
      if (row.completion_status === 'submitted') current.submitted_count += 1;
      if (row.task_status === 'completed') current.task_completed_count += 1;
      if (String(row.due_date).slice(0, 10) < todayIso && row.task_status !== 'completed') {
        current.overdue_count += 1;
      }
    });

    const summaryRows = Array.from(summaryMap.values()).map((item) => {
      const completionRate = item.assigned_count > 0
        ? Number(((item.submitted_count / item.assigned_count) * 100).toFixed(1))
        : 0;
      return {
        ...item,
        pending_submission_count: item.assigned_count - item.submitted_count,
        completion_rate: completionRate,
      };
    });

    const totals = summaryRows.reduce(
      (acc, row) => {
        acc.assigned += row.assigned_count;
        acc.submitted += row.submitted_count;
        acc.pending += row.pending_submission_count;
        acc.overdue += row.overdue_count;
        return acc;
      },
      { assigned: 0, submitted: 0, pending: 0, overdue: 0 }
    );

    const overallRate = totals.assigned > 0
      ? Number(((totals.submitted / totals.assigned) * 100).toFixed(1))
      : 0;

    return res.render('reports/index', {
      title: 'Reports',
      users,
      kpiCategories,
      summaryRows,
      taskRows: rows,
      totals: {
        ...totals,
        completion_rate: overallRate,
      },
      filters: {
        user_ids: selectedUserIds,
        start_date: startDate,
        end_date: endDate,
        kpi_category_ids: selectedKpiCategoryIds,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getReportsPage,
};
