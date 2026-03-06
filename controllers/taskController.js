const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');

const VALID_STATUSES = ['pending', 'in_progress', 'completed'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHUNK_BYTES = 750 * 1024;
const ALLOWED_PROOF_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/pjpeg',
]);
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const CHUNK_TMP_DIR = path.join(UPLOADS_DIR, 'tmp');

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

const buildTaskFilter = (query) => {
  const conditions = [];
  const params = [];

  if (query.search && String(query.search).trim()) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    const raw = String(query.search).trim();
    const escaped = raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const term = `%${escaped}%`;
    params.push(term, term);
  }

  if (query.user_id) {
    conditions.push('EXISTS (SELECT 1 FROM task_staff ts WHERE ts.task_id = t.id AND ts.user_id = ?)');
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

const buildStaffTaskFilter = (query, userId) => {
  const conditions = ['ts.user_id = ?'];
  const params = [userId];

  if (query.search && String(query.search).trim()) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
    const raw = String(query.search).trim();
    const escaped = raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const term = `%${escaped}%`;
    params.push(term, term);
  }

  if (query.status && VALID_STATUSES.includes(query.status)) {
    conditions.push('t.status = ?');
    params.push(query.status);
  }

  if (query.due_date) {
    conditions.push('t.due_date = ?');
    params.push(query.due_date);
  }

  return {
    whereClause: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
};

const fetchTaskFormData = async () => {
  const [staff] = await pool.query(
    `SELECT id, name, email FROM users WHERE role = 'staff' ORDER BY name ASC`
  );
  const [categories] = await pool.query(
    `SELECT id, name FROM kpi_categories ORDER BY name ASC`
  );
  return { staff, categories };
};

const fetchKpiCategoriesByTaskIds = async (taskIds) => {
  const map = {};
  if (!taskIds || taskIds.length === 0) return map;

  const [rows] = await pool.query(
    `SELECT
      tkc.task_id,
      kc.id,
      kc.name
     FROM task_kpi_categories tkc
     INNER JOIN kpi_categories kc ON kc.id = tkc.kpi_category_id
     WHERE tkc.task_id IN (?)
     ORDER BY kc.name ASC`,
    [taskIds]
  );

  rows.forEach((row) => {
    if (!map[row.task_id]) map[row.task_id] = [];
    map[row.task_id].push({ id: row.id, name: row.name });
  });

  return map;
};

const sanitizeFileName = (fileName) => {
  const base = path.basename(String(fileName || 'proof'));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || 'proof';
};

const ensureUploadDirs = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(CHUNK_TMP_DIR, { recursive: true });
};

const removeFileSafe = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (_) {
    // Ignore cleanup errors
  }
};

const resolveProofPathFromRelative = (relativePath) => {
  const raw = String(relativePath || '').replace(/\\/g, '/');
  if (!raw) return null;
  if (!raw.startsWith('uploads/')) return null;
  const normalized = path.normalize(raw);
  const normalizedForward = normalized.replace(/\\/g, '/');
  if (!normalizedForward.startsWith('uploads/')) return null;
  const absolute = path.join(__dirname, '..', 'public', normalized);
  return absolute;
};

const listTasks = async (req, res, next) => {
  try {
    const currentUser = req.session && req.session.user ? req.session.user : null;
    if (currentUser && currentUser.role === 'staff') {
      const userId = Number(currentUser.id);
      const { whereClause, params } = buildStaffTaskFilter(req.query, userId);

      const [tasks] = await pool.query(
        `SELECT
          t.id,
          t.kpi_category_id,
          t.title,
          t.description,
          t.status,
          t.due_date,
          t.created_at,
          ts.completion_status,
          ts.completion_remarks,
          ts.completion_submitted_at,
          ts.proof_path,
          ts.proof_original_name,
          ts.proof_size_bytes
        FROM task_staff ts
        INNER JOIN tasks t ON t.id = ts.task_id
        ${whereClause}
        ORDER BY t.due_date ASC, t.created_at DESC`,
        params
      );

      const kpiByTask = await fetchKpiCategoriesByTaskIds(tasks.map((t) => t.id));
      tasks.forEach((t) => {
        t.kpi_categories = kpiByTask[t.id] || [];
        t.kpi_category_name = t.kpi_categories.map((c) => c.name).join(', ');
      });

      return res.render('tasks/staff', {
        title: 'My Tasks',
        tasks,
        filters: {
          search: req.query.search || '',
          status: req.query.status || '',
          due_date: req.query.due_date || '',
        }
      });
    }

    const { whereClause, params } = buildTaskFilter(req.query);

    const [tasks] = await pool.query(
      `SELECT
        t.id,
        t.kpi_category_id,
        t.title,
        t.description,
        t.status,
        t.due_date,
        t.created_at
      FROM tasks t
      ${whereClause}
      ORDER BY t.due_date ASC, t.created_at DESC`,
      params
    );

    const kpiByTask = await fetchKpiCategoriesByTaskIds(tasks.map((t) => t.id));
    tasks.forEach((t) => {
      t.kpi_categories = kpiByTask[t.id] || [];
      t.kpi_category_name = t.kpi_categories.map((c) => c.name).join(', ');
    });

    const taskIds = tasks.map((t) => t.id);
    const staffByTask = {};
    if (taskIds.length > 0) {
      const [rows] = await pool.query(
        `SELECT
           ts.task_id,
           ts.user_id,
           ts.completion_status,
           ts.completion_submitted_at,
           ts.proof_path,
           ts.proof_original_name,
           ts.proof_mime_type,
           ts.proof_size_bytes,
           u.name
         FROM task_staff ts
         INNER JOIN users u ON u.id = ts.user_id
         WHERE ts.task_id IN (?) ORDER BY ts.task_id, u.name`,
        [taskIds]
      );
      rows.forEach((r) => {
        if (!staffByTask[r.task_id]) staffByTask[r.task_id] = [];
        staffByTask[r.task_id].push({
          id: r.user_id,
          name: r.name,
          completion_status: r.completion_status,
          completion_submitted_at: r.completion_submitted_at,
          proof_path: r.proof_path,
          proof_original_name: r.proof_original_name,
          proof_mime_type: r.proof_mime_type,
          proof_size_bytes: r.proof_size_bytes,
        });
      });
    }
    tasks.forEach((t) => {
      t.assigned_staff = staffByTask[t.id] || [];
    });

    const { staff, categories } = await fetchTaskFormData();

    return res.render('tasks/index', {
      title: 'Tasks',
      tasks,
      staff,
      categories,
      filters: {
        search: req.query.search || '',
        user_id: req.query.user_id || '',
        status: req.query.status || '',
        due_date: req.query.due_date || '',
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getTaskDetail = async (req, res, next) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  try {
    const currentUser = req.session && req.session.user ? req.session.user : null;
    if (!currentUser) {
      return res.redirect('/login');
    }

    const userId = Number(currentUser.id);
    const [rows] = await pool.query(
      `SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.due_date,
        t.created_at,
        kc.name AS kpi_category_name,
        ts.completion_status,
        ts.completion_remarks,
        ts.completion_submitted_at,
        ts.proof_path,
        ts.proof_original_name,
        ts.proof_mime_type,
        ts.proof_size_bytes
      FROM task_staff ts
      INNER JOIN tasks t ON t.id = ts.task_id
      INNER JOIN kpi_categories kc ON kc.id = t.kpi_category_id
      WHERE ts.task_id = ? AND ts.user_id = ?
      LIMIT 1`,
      [taskId, userId]
    );

    if (rows.length === 0) {
      if (currentUser.role === 'admin') {
        return res.redirect(`/tasks/${taskId}/edit`);
      }
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Task not found or you are not assigned to it.',
        error: null,
      });
    }

    return res.render('tasks/staff-detail', {
      title: 'Task Details',
      task: rows[0],
      maxFileSizeMb: 5,
      chunkSizeKb: 750,
    });
  } catch (error) {
    return next(error);
  }
};

const getTaskSubmissions = async (req, res, next) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  try {
    const [taskRows] = await pool.query(
      `SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.due_date,
        kc.name AS kpi_category_name
      FROM tasks t
      INNER JOIN kpi_categories kc ON kc.id = t.kpi_category_id
      WHERE t.id = ?
      LIMIT 1`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).send('Task not found');
    }

    const [submissionRows] = await pool.query(
      `SELECT
        ts.user_id,
        u.name AS user_name,
        u.role AS user_role,
        ts.completion_status,
        ts.completion_remarks,
        ts.completion_submitted_at,
        ts.proof_path,
        ts.proof_original_name,
        ts.proof_size_bytes
      FROM task_staff ts
      INNER JOIN users u ON u.id = ts.user_id
      WHERE ts.task_id = ?
      ORDER BY u.name ASC`,
      [taskId]
    );

    return res.render('tasks/submissions', {
      title: 'Task Submissions',
      task: taskRows[0],
      submissions: submissionRows,
    });
  } catch (error) {
    return next(error);
  }
};

const getAddTask = async (req, res, next) => {
  try {
    const { staff, categories } = await fetchTaskFormData();
    res.render('tasks/form', {
      title: 'Add Task',
      staff,
      categories,
      formError: null,
      oldInput: {},
    });
  } catch (error) {
    next(error);
  }
};

const createTask = async (req, res, next) => {
  const { title, description, status, due_date } = req.body;
  const kpiCategoryIds = normalizeIdList(req.body.kpi_category_ids || req.body.kpi_category_id);
  const staffIds = [].concat(req.body.staff_ids || []).filter(Boolean).map(Number);

  if (kpiCategoryIds.length === 0 || !title || !status || !due_date) {
    try {
      const { staff, categories } = await fetchTaskFormData();
      return res.status(400).render('tasks/form', {
        title: 'Add Task',
        staff,
        categories,
        formError: 'KPI category, title, status, and due date are required. Select at least one staff.',
        oldInput: { staff_ids: staffIds, kpi_category_ids: kpiCategoryIds, title, description, status, due_date },
      });
    } catch (error) {
      return next(error);
    }
  }

  if (staffIds.length === 0) {
    try {
      const { staff, categories } = await fetchTaskFormData();
      return res.status(400).render('tasks/form', {
        title: 'Add Task',
        staff,
        categories,
        formError: 'Select at least one staff to assign to this task.',
        oldInput: { staff_ids: [], kpi_category_ids: kpiCategoryIds, title, description, status, due_date },
      });
    } catch (error) {
      return next(error);
    }
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).send('Invalid task status');
  }

  try {
    const primaryKpiCategoryId = kpiCategoryIds[0];
    const [result] = await pool.query(
      `INSERT INTO tasks (kpi_category_id, title, description, status, due_date)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(primaryKpiCategoryId), title.trim(), description ? description.trim() : null, status, due_date]
    );
    const taskId = result.insertId;

    for (const kpiCategoryId of kpiCategoryIds) {
      await pool.query(
        'INSERT INTO task_kpi_categories (task_id, kpi_category_id) VALUES (?, ?)',
        [taskId, kpiCategoryId]
      );
    }

    for (const userId of staffIds) {
      await pool.query('INSERT INTO task_staff (task_id, user_id) VALUES (?, ?)', [taskId, userId]);
    }
    return res.redirect('/tasks');
  } catch (error) {
    return next(error);
  }
};

const getEditTask = async (req, res, next) => {
  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  try {
    const [taskRows] = await pool.query(
      `SELECT id, kpi_category_id, title, description, status, due_date
       FROM tasks WHERE id = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).send('Task not found');
    }

    const [assignedRows] = await pool.query(
      'SELECT user_id FROM task_staff WHERE task_id = ?',
      [taskId]
    );
    const assignedStaffIds = assignedRows.map((r) => r.user_id);
    const [taskKpiRows] = await pool.query(
      'SELECT kpi_category_id FROM task_kpi_categories WHERE task_id = ? ORDER BY kpi_category_id ASC',
      [taskId]
    );
    const selectedKpiCategoryIds = taskKpiRows.length > 0
      ? taskKpiRows.map((r) => r.kpi_category_id)
      : (taskRows[0].kpi_category_id ? [taskRows[0].kpi_category_id] : []);

    const { staff, categories } = await fetchTaskFormData();

    return res.render('tasks/form', {
      title: 'Edit Task',
      task: taskRows[0],
      staff,
      categories,
      assignedStaffIds,
      selectedKpiCategoryIds,
      formError: null,
    });
  } catch (error) {
    return next(error);
  }
};

const updateTask = async (req, res, next) => {
  const taskId = Number(req.params.id);
  const { title, description, status, due_date } = req.body;
  const kpiCategoryIds = normalizeIdList(req.body.kpi_category_ids || req.body.kpi_category_id);
  const staffIds = [].concat(req.body.staff_ids || []).filter(Boolean).map(Number);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  if (kpiCategoryIds.length === 0 || !title || !status || !due_date) {
    try {
      const [taskRows] = await pool.query(
        'SELECT id, kpi_category_id, title, description, status, due_date FROM tasks WHERE id = ?',
      [taskId]
      );
      if (taskRows.length === 0) return res.status(404).send('Task not found');
      const { staff, categories } = await fetchTaskFormData();
      return res.status(400).render('tasks/form', {
        title: 'Edit Task',
        task: { ...taskRows[0], title, description, status, due_date },
        staff,
        categories,
        assignedStaffIds: staffIds,
        selectedKpiCategoryIds: kpiCategoryIds,
        formError: 'All required fields must be filled. Select at least one staff.',
      });
    } catch (error) {
      return next(error);
    }
  }

  if (staffIds.length === 0) {
    try {
      const [taskRows] = await pool.query(
        'SELECT id, kpi_category_id, title, description, status, due_date FROM tasks WHERE id = ?',
        [taskId]
      );
      if (taskRows.length === 0) return res.status(404).send('Task not found');
      const { staff, categories } = await fetchTaskFormData();
      const [assignedRows] = await pool.query('SELECT user_id FROM task_staff WHERE task_id = ?', [taskId]);
      const [taskKpiRows] = await pool.query(
        'SELECT kpi_category_id FROM task_kpi_categories WHERE task_id = ? ORDER BY kpi_category_id ASC',
        [taskId]
      );
      return res.status(400).render('tasks/form', {
        title: 'Edit Task',
        task: taskRows[0],
        staff,
        categories,
        assignedStaffIds: assignedRows.map((r) => r.user_id),
        selectedKpiCategoryIds: taskKpiRows.map((r) => r.kpi_category_id),
        formError: 'Select at least one staff to assign to this task.',
      });
    } catch (error) {
      return next(error);
    }
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).send('Invalid task status');
  }

  try {
    const primaryKpiCategoryId = kpiCategoryIds[0];
    const [result] = await pool.query(
      `UPDATE tasks
       SET kpi_category_id = ?, title = ?, description = ?, status = ?, due_date = ?
       WHERE id = ?`,
      [Number(primaryKpiCategoryId), title.trim(), description ? description.trim() : null, status, due_date, taskId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send('Task not found');
    }

    await pool.query('DELETE FROM task_staff WHERE task_id = ?', [taskId]);
    for (const userId of staffIds) {
      await pool.query('INSERT INTO task_staff (task_id, user_id) VALUES (?, ?)', [taskId, userId]);
    }

    await pool.query('DELETE FROM task_kpi_categories WHERE task_id = ?', [taskId]);
    for (const kpiCategoryId of kpiCategoryIds) {
      await pool.query(
        'INSERT INTO task_kpi_categories (task_id, kpi_category_id) VALUES (?, ?)',
        [taskId, kpiCategoryId]
      );
    }

    return res.redirect('/tasks');
  } catch (error) {
    return next(error);
  }
};

const deleteTask = async (req, res, next) => {
  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).send('Invalid task id');
  }

  try {
    const [proofRows] = await pool.query(
      `SELECT proof_path
       FROM task_staff
       WHERE task_id = ? AND proof_path IS NOT NULL AND proof_path <> ''`,
      [taskId]
    );

    await pool.query(
      `DELETE FROM tasks
       WHERE id = ?`,
      [taskId]
    );

    const uniqueProofPaths = Array.from(new Set(proofRows.map((row) => row.proof_path).filter(Boolean)));
    for (const proofPath of uniqueProofPaths) {
      const absolutePath = resolveProofPathFromRelative(proofPath);
      if (absolutePath) {
        await removeFileSafe(absolutePath);
      }
    }

    return res.redirect('/tasks');
  } catch (error) {
    return next(error);
  }
};

const reopenStaffSubmission = async (req, res, next) => {
  const taskId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).send('Invalid task/user id');
  }

  try {
    const [rows] = await pool.query(
      `SELECT task_id
       FROM task_staff
       WHERE task_id = ? AND user_id = ?
       LIMIT 1`,
      [taskId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).send('Assignment not found');
    }

    await pool.query(
      `UPDATE task_staff
       SET
         completion_status = 'not_submitted',
         completion_remarks = NULL,
         completion_submitted_at = NULL
       WHERE task_id = ? AND user_id = ?`,
      [taskId, userId]
    );

    return res.redirect('/tasks');
  } catch (error) {
    return next(error);
  }
};

const submitCompletionWithoutFile = async (req, res, next) => {
  try {
    const currentUser = req.session && req.session.user ? req.session.user : null;
    if (!currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
      return res.status(403).json({ message: 'Only assigned users can submit task completion.' });
    }

    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    const userId = Number(currentUser.id);
    const [assignmentRows] = await pool.query(
      `SELECT task_id, completion_status
       FROM task_staff
       WHERE task_id = ? AND user_id = ?
       LIMIT 1`,
      [taskId, userId]
    );
    if (assignmentRows.length === 0) {
      return res.status(403).json({ message: 'You are not assigned to this task.' });
    }
    if (assignmentRows[0].completion_status === 'submitted') {
      return res.status(409).json({
        message: 'Submission already locked unless admin reopens this task for you.',
      });
    }

    const remarks = String(req.body.remarks || '').trim().slice(0, 1000);

    await pool.query(
      `UPDATE task_staff
       SET
         completion_status = 'submitted',
         completion_remarks = ?,
         completion_submitted_at = NOW()
       WHERE task_id = ? AND user_id = ?`,
      [remarks || null, taskId, userId]
    );

    return res.json({
      done: true,
      message: 'Completion submitted without file.',
    });
  } catch (error) {
    return next(error);
  }
};

const uploadCompletionProofChunk = async (req, res, next) => {
  try {
    const currentUser = req.session && req.session.user ? req.session.user : null;
    if (!currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
      return res.status(403).json({ message: 'Only assigned users can submit task completion proof.' });
    }

    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    const userId = Number(currentUser.id);
    const [assignmentRows] = await pool.query(
      `SELECT task_id, completion_status
       FROM task_staff
       WHERE task_id = ? AND user_id = ?
       LIMIT 1`,
      [taskId, userId]
    );
    if (assignmentRows.length === 0) {
      return res.status(403).json({ message: 'You are not assigned to this task.' });
    }
    if (assignmentRows[0].completion_status === 'submitted') {
      return res.status(409).json({
        message: 'Proof already submitted. Re-submission is locked unless admin reopens this task for you.',
      });
    }

    const uploadIdRaw = String(req.body.upload_id || '').trim();
    const fileNameRaw = String(req.body.file_name || '').trim();
    const mimeType = String(req.body.mime_type || '').trim().toLowerCase();
    const remarks = String(req.body.remarks || '').trim().slice(0, 1000);
    const totalSize = Number(req.body.total_size || 0);
    const totalChunks = Number(req.body.total_chunks || 0);
    const chunkIndex = Number(req.body.chunk_index || 0);
    const chunkBase64 = String(req.body.chunk_base64 || '');

    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(uploadIdRaw)) {
      return res.status(400).json({ message: 'Invalid upload id.' });
    }
    if (!fileNameRaw || !mimeType || !chunkBase64) {
      return res.status(400).json({ message: 'Missing upload fields.' });
    }
    if (!ALLOWED_PROOF_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ message: 'Only PDF, JPG, and PNG files are allowed.' });
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      return res.status(400).json({ message: 'Invalid total chunks.' });
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return res.status(400).json({ message: 'Invalid chunk index.' });
    }
    if (!Number.isInteger(totalSize) || totalSize <= 0 || totalSize > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ message: 'Proof file must be 5MB or smaller.' });
    }

    const chunkBuffer = Buffer.from(chunkBase64, 'base64');
    if (!chunkBuffer.length || chunkBuffer.length > MAX_CHUNK_BYTES) {
      return res.status(400).json({ message: 'Each chunk must be 750KB or smaller.' });
    }

    await ensureUploadDirs();

    const safeName = sanitizeFileName(fileNameRaw);
    const key = `${userId}_${taskId}_${uploadIdRaw}`;
    const partPath = path.join(CHUNK_TMP_DIR, `${key}.part`);
    const metaPath = path.join(CHUNK_TMP_DIR, `${key}.json`);

    let meta;
    try {
      const metaText = await fs.readFile(metaPath, 'utf8');
      meta = JSON.parse(metaText);
    } catch (_) {
      meta = {
        userId,
        taskId,
        uploadId: uploadIdRaw,
        fileName: safeName,
        mimeType,
        totalSize,
        totalChunks,
        nextIndex: 0,
        receivedBytes: 0,
        remarks,
      };
    }

    if (meta.userId !== userId || meta.taskId !== taskId) {
      return res.status(400).json({ message: 'Upload metadata mismatch.' });
    }
    if (meta.fileName !== safeName || meta.mimeType !== mimeType || meta.totalChunks !== totalChunks || meta.totalSize !== totalSize) {
      return res.status(400).json({ message: 'Upload payload changed. Please restart upload.' });
    }
    if (chunkIndex !== meta.nextIndex) {
      return res.status(409).json({
        message: 'Unexpected chunk order.',
        expected_chunk_index: meta.nextIndex,
      });
    }

    await fs.appendFile(partPath, chunkBuffer);
    meta.receivedBytes += chunkBuffer.length;
    meta.nextIndex += 1;
    meta.remarks = remarks;

    if (meta.receivedBytes > MAX_FILE_SIZE_BYTES) {
      await removeFileSafe(partPath);
      await removeFileSafe(metaPath);
      return res.status(400).json({ message: 'Proof file exceeds 5MB limit.' });
    }

    if (meta.nextIndex < meta.totalChunks) {
      await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8');
      return res.json({
        uploaded_chunks: meta.nextIndex,
        total_chunks: meta.totalChunks,
        done: false,
      });
    }

    let finalRelativePath = '';
    let finalMime = mimeType || 'application/octet-stream';
    let finalSize = meta.receivedBytes;
    let finalAbsolutePath = null;

    try {
      const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const isImage = finalMime.startsWith('image/');

      if (isImage) {
        let sharp;
        try {
          sharp = require('sharp');
        } catch (_) {
          throw new Error('Image conversion requires the "sharp" package. Install it and retry.');
        }

        const webpName = `${uniqueName}.webp`;
        const webpPath = path.join(UPLOADS_DIR, webpName);
        await sharp(partPath).webp({ quality: 82 }).toFile(webpPath);
        const stat = await fs.stat(webpPath);

        finalRelativePath = `uploads/${webpName}`;
        finalAbsolutePath = webpPath;
        finalMime = 'image/webp';
        finalSize = stat.size;

        await removeFileSafe(partPath);
      } else {
        const ext = path.extname(safeName).toLowerCase().slice(0, 12);
        const finalName = `${uniqueName}${ext || '.bin'}`;
        const finalPath = path.join(UPLOADS_DIR, finalName);
        await fs.rename(partPath, finalPath);
        const stat = await fs.stat(finalPath);
        finalRelativePath = `uploads/${finalName}`;
        finalAbsolutePath = finalPath;
        finalSize = stat.size;
      }

      if (finalSize > MAX_FILE_SIZE_BYTES) {
        if (finalAbsolutePath) {
          await removeFileSafe(finalAbsolutePath);
        }
        throw new Error('Final proof file exceeds 5MB limit.');
      }

      const [existingRows] = await pool.query(
        `SELECT proof_path
         FROM task_staff
         WHERE task_id = ? AND user_id = ?
         LIMIT 1`,
        [taskId, userId]
      );
      const existingProofPath = existingRows.length > 0 ? existingRows[0].proof_path : null;

      await pool.query(
        `UPDATE task_staff
         SET
           completion_status = 'submitted',
           completion_remarks = ?,
           completion_submitted_at = NOW(),
           proof_path = ?,
           proof_original_name = ?,
           proof_mime_type = ?,
           proof_size_bytes = ?
         WHERE task_id = ? AND user_id = ?`,
        [meta.remarks || null, finalRelativePath, safeName, finalMime, finalSize, taskId, userId]
      );

      if (existingProofPath && existingProofPath !== finalRelativePath) {
        const existingAbsolutePath = resolveProofPathFromRelative(existingProofPath);
        if (existingAbsolutePath) {
          await removeFileSafe(existingAbsolutePath);
        }
      }
    } catch (finalizeError) {
      if (finalAbsolutePath) {
        await removeFileSafe(finalAbsolutePath);
      }
      await removeFileSafe(partPath);
      await removeFileSafe(metaPath);
      return res.status(500).json({ message: finalizeError.message || 'Failed to finalize proof upload.' });
    }

    await removeFileSafe(metaPath);

    return res.json({
      done: true,
      message: 'Proof submitted successfully.',
      proof_path: `/${finalRelativePath}`,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listTasks,
  getAddTask,
  createTask,
  getEditTask,
  getTaskDetail,
  getTaskSubmissions,
  updateTask,
  deleteTask,
  reopenStaffSubmission,
  submitCompletionWithoutFile,
  uploadCompletionProofChunk,
};
