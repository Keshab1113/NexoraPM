import pool from '../config/db.js';

// Get all projects
export const getAllProjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, priority, companyId } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT p.*, c.name as company_name, u.first_name as creator_first_name, u.last_name as creator_last_name,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_task_count
                 FROM projects p
                 JOIN companies c ON p.company_id = c.id
                 JOIN users u ON p.created_by = u.id
                 WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as total FROM projects WHERE 1=1';
    const params = [];
    const countParams = [];

    // Filter by company for non-super_admin users
    if (req.user.role !== 'super_admin') {
      query += ' AND p.company_id = ?';
      countQuery += ' AND company_id = ?';
      params.push(req.user.companyId);
      countParams.push(req.user.companyId);
    } else if (companyId) {
      query += ' AND p.company_id = ?';
      countQuery += ' AND company_id = ?';
      params.push(companyId);
      countParams.push(companyId);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      countQuery += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND p.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (priority) {
      query += ' AND p.priority = ?';
      countQuery += ' AND priority = ?';
      params.push(priority);
      countParams.push(priority);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [projects] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      projects,
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

// Get project by ID
export const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [projects] = await pool.query(
      `SELECT p.*, c.name as company_name, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM projects p
       JOIN companies c ON p.company_id = c.id
       JOIN users u ON p.created_by = u.id
       WHERE p.id = ?`,
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project members
    const [members] = await pool.query(
      `SELECT pm.*, u.email, u.first_name, u.last_name, u.avatar, u.role as user_role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?`,
      [id]
    );

    // Get tasks summary
    const [[taskStats]] = await pool.query(
      `SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
       FROM tasks WHERE project_id = ?`,
      [id]
    );

    res.json({
      project: { ...projects[0], members, taskStats },
    });
  } catch (error) {
    next(error);
  }
};

// Create project
export const createProject = async (req, res, next) => {
  try {
    const { name, description, status, priority, startDate, endDate, budget, companyId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const targetCompanyId = companyId || req.user.companyId;

    // Check permissions
    if (req.user.role !== 'super_admin' && req.user.role !== 'company_admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Only admins and managers can create projects' });
    }

    const [result] = await pool.query(
      `INSERT INTO projects (company_id, name, description, status, priority, start_date, end_date, budget, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetCompanyId, name, description, status || 'pending', priority || 'medium', startDate, endDate, budget, req.user.id]
    );

    // Add creator as project admin
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [result.insertId, req.user.id, 'admin']
    );

    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [result.insertId]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, targetCompanyId, 'project_created', 'project', result.insertId, JSON.stringify({ name })]
    );

    res.status(201).json({ project: projects[0] });
  } catch (error) {
    next(error);
  }
};

// Update project
export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, status, priority, startDate, endDate, budget } = req.body;

    const [existing] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    const isMember = await pool.query(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ? AND role = ?',
      [id, req.user.id, 'admin']
    );

    if (req.user.role !== 'super_admin' && req.user.role !== 'company_admin' && req.user.role !== 'manager' && isMember[0].length === 0) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.query(
      `UPDATE projects SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       status = COALESCE(?, status),
       priority = COALESCE(?, priority),
       start_date = COALESCE(?, start_date),
       end_date = COALESCE(?, end_date),
       budget = COALESCE(?, budget)
       WHERE id = ?`,
      [name, description, status, priority, startDate, endDate, budget, id]
    );

    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, existing[0].company_id, 'project_updated', 'project', parseInt(id), JSON.stringify(req.body)]
    );

    res.json({ project: projects[0] });
  } catch (error) {
    next(error);
  }
};

// Delete project
export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && req.user.role !== 'company_admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.query('DELETE FROM projects WHERE id = ?', [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, existing[0].company_id, 'project_deleted', 'project', parseInt(id), JSON.stringify({ name: existing[0].name })]
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Add project member
export const addProjectMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const [project] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = ?',
      [id, userId, role || 'member', role || 'member']
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, project[0].company_id, 'project_member_added', 'project', parseInt(id), JSON.stringify({ userId, role })]
    );

    res.json({ message: 'Member added successfully' });
  } catch (error) {
    next(error);
  }
};

// Remove project member
export const removeProjectMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    const [project] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await pool.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [id, memberId]);

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

// Get project analytics
export const getProjectAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [project] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Task distribution by status
    const [taskByStatus] = await pool.query(
      `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status`,
      [id]
    );

    // Task distribution by priority
    const [taskByPriority] = await pool.query(
      `SELECT priority, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY priority`,
      [id]
    );

    // Task distribution by assignee
    const [taskByAssignee] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, COUNT(t.id) as task_count,
              SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_count
       FROM users u
       LEFT JOIN tasks t ON u.id = t.assigned_to AND t.project_id = ?
       JOIN project_members pm ON u.id = pm.user_id AND pm.project_id = ?
       GROUP BY u.id, u.first_name, u.last_name`,
      [id, id]
    );

    // Recent activity
    const [recentActivity] = await pool.query(
      `SELECT al.*, u.first_name, u.last_name
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = 'task' AND al.entity_id IN (SELECT id FROM tasks WHERE project_id = ?)
       ORDER BY al.created_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      project: project[0],
      analytics: {
        tasksByStatus: taskByStatus,
        tasksByPriority: taskByPriority,
        tasksByAssignee: taskByAssignee,
        recentActivity: recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};