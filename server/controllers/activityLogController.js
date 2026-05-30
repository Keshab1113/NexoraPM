import pool from '../config/db.js';

// Get activity logs
export const getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, entityType, entityId, userId, companyId } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT al.*, u.first_name, u.last_name, u.avatar,
                        c.name as company_name
                 FROM activity_logs al
                 JOIN users u ON al.user_id = u.id
                 LEFT JOIN companies c ON al.company_id = c.id
                 WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as total FROM activity_logs WHERE 1=1';
    const params = [];
    const countParams = [];

    // Filter by company for non-super_admin users
    if (req.user.role !== 'super_admin') {
      query += ' AND al.company_id = ?';
      countQuery += ' AND company_id = ?';
      params.push(req.user.companyId);
      countParams.push(req.user.companyId);
    } else if (companyId) {
      query += ' AND al.company_id = ?';
      countQuery += ' AND company_id = ?';
      params.push(companyId);
      countParams.push(companyId);
    }

    if (entityType) {
      query += ' AND al.entity_type = ?';
      countQuery += ' AND entity_type = ?';
      params.push(entityType);
      countParams.push(entityType);
    }

    if (entityId) {
      query += ' AND al.entity_id = ?';
      countQuery += ' AND entity_id = ?';
      params.push(entityId);
      countParams.push(entityId);
    }

    if (userId) {
      query += ' AND al.user_id = ?';
      countQuery += ' AND user_id = ?';
      params.push(userId);
      countParams.push(userId);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get dashboard stats
export const getDashboardStats = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'super_admin' ? req.query.companyId : req.user.companyId;

    // User stats
    const [[userStats]] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as employees
       FROM users WHERE company_id = ?`,
      [companyId]
    );

    // Project stats
    const [[projectStats]] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM projects WHERE company_id = ?`,
      [companyId]
    );

    // Task stats
    const [[taskStats]] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN t.due_date < CURDATE() AND t.status != 'completed' THEN 1 ELSE 0 END) as overdue
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.company_id = ?`,
      [companyId]
    );

    // Recent tasks
    const [recentTasks] = await pool.query(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.company_id = ?
       ORDER BY t.created_at DESC LIMIT 5`,
      [companyId]
    );

    // Recent activity
    const [recentActivity] = await pool.query(
      `SELECT al.*, u.first_name, u.last_name
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.company_id = ?
       ORDER BY al.created_at DESC LIMIT 10`,
      [companyId]
    );

    // Projects by status
    const [projectsByStatus] = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM projects WHERE company_id = ?
       GROUP BY status`,
      [companyId]
    );

    // Tasks by priority
    const [tasksByPriority] = await pool.query(
      `SELECT t.priority, COUNT(*) as count
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.company_id = ?
       GROUP BY t.priority`,
      [companyId]
    );

    res.json({
      stats: {
        users: userStats,
        projects: projectStats,
        tasks: taskStats,
      },
      recentTasks,
      recentActivity,
      projectsByStatus,
      tasksByPriority,
    });
  } catch (error) {
    next(error);
  }
};