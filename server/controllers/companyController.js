import pool from '../config/db.js';

// Get all companies (super admin only)
export const getAllCompanies = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT c.*, COUNT(u.id) as user_count
                 FROM companies c
                 LEFT JOIN users u ON c.id = u.company_id`;
    let countQuery = 'SELECT COUNT(*) as total FROM companies';
    const params = [];
    const countParams = [];

    if (status) {
      query += ' WHERE c.status = ?';
      countQuery += ' WHERE status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (search) {
      const searchCondition = ' WHERE c.name LIKE ? OR c.website LIKE ?';
      query += status ? ' AND' + searchCondition : searchCondition;
      countQuery += status ? ' AND' + searchCondition : searchCondition;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [companies] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      companies,
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

// Get company by ID
export const getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [companies] = await pool.query(
      `SELECT c.*, COUNT(u.id) as user_count, COUNT(DISTINCT p.id) as project_count
       FROM companies c
       LEFT JOIN users u ON c.id = u.company_id
       LEFT JOIN projects p ON c.id = p.company_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [id]
    );

    if (companies.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company: companies[0] });
  } catch (error) {
    next(error);
  }
};

// Create company (super admin)
export const createCompany = async (req, res, next) => {
  try {
    const { name, website, address, phone, description, planType } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO companies (name, website, address, phone, description, plan_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, website, address, phone, description, planType || 'free']
    );

    const [companies] = await pool.query('SELECT * FROM companies WHERE id = ?', [result.insertId]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, result.insertId, 'company_created', 'company', result.insertId, JSON.stringify({ name })]
    );

    res.status(201).json({ company: companies[0] });
  } catch (error) {
    next(error);
  }
};

// Update company
export const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, website, address, phone, description, planType, status } = req.body;

    const [existing] = await pool.query('SELECT * FROM companies WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await pool.query(
      `UPDATE companies SET name = COALESCE(?, name), website = COALESCE(?, website),
       address = COALESCE(?, address), phone = COALESCE(?, phone),
       description = COALESCE(?, description), plan_type = COALESCE(?, plan_type),
       status = COALESCE(?, status)
       WHERE id = ?`,
      [name, website, address, phone, description, planType, status, id]
    );

    const [companies] = await pool.query('SELECT * FROM companies WHERE id = ?', [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, parseInt(id), 'company_updated', 'company', parseInt(id), JSON.stringify(req.body)]
    );

    res.json({ company: companies[0] });
  } catch (error) {
    next(error);
  }
};

// Delete company (super admin)
export const deleteCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM companies WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await pool.query('DELETE FROM companies WHERE id = ?', [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'company_deleted', 'company', parseInt(id), JSON.stringify({ name: existing[0].name })]
    );

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get company statistics
export const getCompanyStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[company]] = await pool.query('SELECT * FROM companies WHERE id = ?', [id]);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const [[userStats]] = await pool.query(
      `SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as employees,
        SUM(CASE WHEN role IN ('manager', 'company_admin') THEN 1 ELSE 0 END) as managers
       FROM users WHERE company_id = ?`,
      [id]
    );

    const [[projectStats]] = await pool.query(
      `SELECT
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
       FROM projects WHERE company_id = ?`,
      [id]
    );

    const [[taskStats]] = await pool.query(
      `SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE p.company_id = ?`,
      [id]
    );

    res.json({
      company,
      stats: {
        users: userStats,
        projects: projectStats,
        tasks: taskStats,
      },
    });
  } catch (error) {
    next(error);
  }
};