import pool from '../config/db.js';

// Get all tasks
export const getAllTasks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, priority, projectId, assignedTo, dueDate } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT t.*, p.name as project_name,
                        u.first_name as assignee_first_name, u.last_name as assignee_last_name, u.avatar as assignee_avatar,
                        c.first_name as creator_first_name, c.last_name as creator_last_name
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 LEFT JOIN users u ON t.assigned_to = u.id
                 LEFT JOIN users c ON t.created_by = c.id
                 WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as total FROM tasks t WHERE 1=1';
    const params = [];
    const countParams = [];

    // Filter by company for non-super_admin users
    if (req.user.role !== 'super_admin') {
      query += ' AND p.company_id = ?';
      countQuery += ' AND p.company_id = ?';
      params.push(req.user.companyId);
      countParams.push(req.user.companyId);
    }

    if (search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      countQuery += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND t.status = ?';
      countQuery += ' AND t.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (priority) {
      query += ' AND t.priority = ?';
      countQuery += ' AND t.priority = ?';
      params.push(priority);
      countParams.push(priority);
    }

    if (projectId) {
      query += ' AND t.project_id = ?';
      countQuery += ' AND t.project_id = ?';
      params.push(projectId);
      countParams.push(projectId);
    }

    if (assignedTo) {
      query += ' AND t.assigned_to = ?';
      countQuery += ' AND t.assigned_to = ?';
      params.push(assignedTo);
      countParams.push(assignedTo);
    }

    if (dueDate) {
      query += ' AND t.due_date = ?';
      countQuery += ' AND t.due_date = ?';
      params.push(dueDate);
      countParams.push(dueDate);
    }

    query += ' ORDER BY t.position ASC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [tasks] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      tasks,
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

// Get task by ID
export const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [tasks] = await pool.query(
      `SELECT t.*, p.name as project_name, p.company_id,
              u.first_name as assignee_first_name, u.last_name as assignee_last_name, u.avatar as assignee_avatar,
              c.first_name as creator_first_name, c.last_name as creator_last_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users c ON t.created_by = c.id
       WHERE t.id = ?`,
      [id]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get comments
    const [comments] = await pool.query(
      `SELECT tc.*, u.first_name, u.last_name, u.avatar
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = ?
       ORDER BY tc.created_at ASC`,
      [id]
    );

    // Get attachments
    const [attachments] = await pool.query(
      `SELECT ta.*, u.first_name, u.last_name
       FROM task_attachments ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.task_id = ?
       ORDER BY ta.created_at DESC`,
      [id]
    );

    // Get subtasks
    const [subtasks] = await pool.query(
      `SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY position ASC`,
      [id]
    );

    res.json({
      task: { ...tasks[0], comments, attachments, subtasks },
    });
  } catch (error) {
    next(error);
  }
};

// Create task
export const createTask = async (req, res, next) => {
  try {
    const { projectId, title, description, status, priority, assignedTo, dueDate, estimatedHours, parentTaskId, tags } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ error: 'Project ID and title are required' });
    }

    // Check project exists and user has access
    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get max position for the project
    const [[{ maxPos }]] = await pool.query(
      'SELECT COALESCE(MAX(position), 0) as maxPos FROM tasks WHERE project_id = ? AND parent_task_id IS NULL',
      [projectId]
    );

    const [result] = await pool.query(
      `INSERT INTO tasks (project_id, parent_task_id, title, description, status, priority, assigned_to, due_date, estimated_hours, position, tags, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, parentTaskId || null, title, description, status || 'todo', priority || 'medium', assignedTo, dueDate, estimatedHours, maxPos + 1, JSON.stringify(tags || []), req.user.id]
    );

    const [tasks] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);

    // Create notification for assignee
    if (assignedTo) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES (?, ?, ?, ?, ?)`,
        [assignedTo, 'task_assigned', 'New task assigned', `You have been assigned to "${title}"`, `/tasks/${result.insertId}`]
      );
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, projects[0].company_id, 'task_created', 'task', result.insertId, JSON.stringify({ title, projectId })]
    );

    res.status(201).json({ task: tasks[0] });
  } catch (error) {
    next(error);
  }
};

// Update task
export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, assignedTo, dueDate, estimatedHours, actualHours, position, tags } = req.body;

    const [existing] = await pool.query(
      `SELECT t.*, p.company_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user is assigned to or has permission
    if (req.user.role !== 'super_admin' && req.user.role !== 'company_admin' && req.user.role !== 'manager') {
      if (existing[0].assigned_to !== req.user.id && existing[0].created_by !== req.user.id) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }

    await pool.query(
      `UPDATE tasks SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       status = COALESCE(?, status),
       priority = COALESCE(?, priority),
       assigned_to = COALESCE(?, assigned_to),
       due_date = COALESCE(?, due_date),
       estimated_hours = COALESCE(?, estimated_hours),
       actual_hours = COALESCE(?, actual_hours),
       position = COALESCE(?, position),
       tags = COALESCE(?, tags)
       WHERE id = ?`,
      [title, description, status, priority, assignedTo, dueDate, estimatedHours, actualHours, position, tags ? JSON.stringify(tags) : null, id]
    );

    const [tasks] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);

    // Notify on assignment change
    if (assignedTo && assignedTo !== existing[0].assigned_to) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES (?, ?, ?, ?, ?)`,
        [assignedTo, 'task_assigned', 'Task assigned', `You have been assigned to "${tasks[0].title}"`, `/tasks/${id}`]
      );
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, existing[0].company_id, 'task_updated', 'task', parseInt(id), JSON.stringify(req.body)]
    );

    res.json({ task: tasks[0] });
  } catch (error) {
    next(error);
  }
};

// Delete task
export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await pool.query('DELETE FROM tasks WHERE id = ?', [id]);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Add comment
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const [task] = await pool.query(
      `SELECT t.*, p.company_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?`,
      [id]
    );

    if (task.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)',
      [id, req.user.id, content]
    );

    const [comments] = await pool.query(
      `SELECT tc.*, u.first_name, u.last_name, u.avatar
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ?`,
      [result.insertId]
    );

    // Notify task assignee
    if (task[0].assigned_to && task[0].assigned_to !== req.user.id) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES (?, ?, ?, ?, ?)`,
        [task[0].assigned_to, 'comment_added', 'New comment', `${req.user.first_name} commented on "${task[0].title}"`, `/tasks/${id}`]
      );
    }

    res.status(201).json({ comment: comments[0] });
  } catch (error) {
    next(error);
  }
};

// Get my tasks (tasks assigned to current user)
export const getMyTasks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT t.*, p.name as project_name
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.assigned_to = ?`;
    let countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE assigned_to = ?';
    const params = [req.user.id];
    const countParams = [req.user.id];

    if (status) {
      query += ' AND t.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    query += ' ORDER BY t.due_date ASC, t.priority DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [tasks] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      tasks,
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