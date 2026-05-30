import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Get all users
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status, companyId } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, u.role, u.status,
                        u.company_id, u.department_id, u.team_id, u.last_login, u.created_at,
                        c.name as company_name, d.name as department_name, t.name as team_name
                 FROM users u
                 LEFT JOIN companies c ON u.company_id = c.id
                 LEFT JOIN departments d ON u.department_id = d.id
                 LEFT JOIN teams t ON u.team_id = t.id
                 WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const params = [];
    const countParams = [];

    // Filter by company for non-super_admin users
    if (req.user.role !== 'super_admin') {
      query += ' AND u.company_id = ?';
      countQuery += ' AND company_id = ?';
      params.push(req.user.companyId);
      countParams.push(req.user.companyId);
    } else if (companyId) {
      query += ' AND u.company_id = ?';
      countQuery += ' AND company_id = ?';
      params.push(companyId);
      countParams.push(companyId);
    }

    if (search) {
      query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      countQuery += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ' AND u.role = ?';
      countQuery += ' AND role = ?';
      params.push(role);
      countParams.push(role);
    }

    if (status) {
      query += ' AND u.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({
      users,
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

// Get user by ID
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [users] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, u.role, u.status,
              u.company_id, u.department_id, u.team_id, u.phone, u.last_login, u.created_at,
              c.name as company_name, d.name as department_name, t.name as team_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    next(error);
  }
};

// Create user (invite)
export const createUser = async (req, res, next) => {
  try {
    const { email, firstName, lastName, role, departmentId, teamId, companyId } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, first name, and last name are required' });
    }

    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Determine company_id
    const targetCompanyId = companyId || req.user.companyId;

    // Check permissions for role assignment
    const allowedRoles = ['employee', 'project_admin'];
    if (role === 'manager') {
      if (!['super_admin', 'company_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only admins can create managers' });
      }
      allowedRoles.push('manager');
    }
    if (role === 'company_admin') {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only super admin can create company admins' });
      }
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [result] = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, department_id, team_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetCompanyId, email, passwordHash, firstName, lastName, role || 'employee', departmentId, teamId, 'pending']
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, targetCompanyId, 'user_invited', 'user', result.insertId, JSON.stringify({ email, role })]
    );

    // TODO: Send invitation email with temp password
    console.log(`Invitation for ${email}, temp password: ${tempPassword}`);

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

    res.status(201).json({
      user: users[0],
      message: 'User invited successfully. They will receive an email with login instructions.',
    });
  } catch (error) {
    next(error);
  }
};

// Update user
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, departmentId, teamId, status, phone, avatar } = req.body;

    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions for role change
    if (role && role !== existing[0].role) {
      if (req.user.role !== 'super_admin' && req.user.role !== 'company_admin') {
        return res.status(403).json({ error: 'Only admins can change user roles' });
      }
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only super admin can assign super admin role' });
      }
    }

    // Check company access
    if (existing[0].company_id !== req.user.companyId && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query(
      `UPDATE users SET
       first_name = COALESCE(?, first_name),
       last_name = COALESCE(?, last_name),
       role = COALESCE(?, role),
       department_id = COALESCE(?, department_id),
       team_id = COALESCE(?, team_id),
       status = COALESCE(?, status),
       phone = COALESCE(?, phone),
       avatar = COALESCE(?, avatar)
       WHERE id = ?`,
      [firstName, lastName, role, departmentId, teamId, status, phone, avatar, id]
    );

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, existing[0].company_id, 'user_updated', 'user', parseInt(id), JSON.stringify(req.body)]
    );

    res.json({ user: users[0] });
  } catch (error) {
    next(error);
  }
};

// Delete user
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check company access
    if (existing[0].company_id !== req.user.companyId && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, existing[0].company_id, 'user_deleted', 'user', parseInt(id), JSON.stringify({ email: existing[0].email })]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get departments
export const getDepartments = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'super_admin' ? req.query.companyId : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const [departments] = await pool.query(
      'SELECT * FROM departments WHERE company_id = ? ORDER BY name',
      [companyId]
    );

    res.json({ departments });
  } catch (error) {
    next(error);
  }
};

// Create department
export const createDepartment = async (req, res, next) => {
  try {
    const { name, description, companyId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const targetCompanyId = companyId || req.user.companyId;

    const [result] = await pool.query(
      'INSERT INTO departments (company_id, name, description) VALUES (?, ?, ?)',
      [targetCompanyId, name, description]
    );

    const [departments] = await pool.query('SELECT * FROM departments WHERE id = ?', [result.insertId]);

    res.status(201).json({ department: departments[0] });
  } catch (error) {
    next(error);
  }
};

// Get teams
export const getTeams = async (req, res, next) => {
  try {
    const companyId = req.user.role === 'super_admin' ? req.query.companyId : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const [teams] = await pool.query(
      `SELECT t.*, d.name as department_name
       FROM teams t
       LEFT JOIN departments d ON t.department_id = d.id
       WHERE t.company_id = ?
       ORDER BY t.name`,
      [companyId]
    );

    res.json({ teams });
  } catch (error) {
    next(error);
  }
};

// Create team
export const createTeam = async (req, res, next) => {
  try {
    const { name, description, departmentId, companyId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const targetCompanyId = companyId || req.user.companyId;

    const [result] = await pool.query(
      'INSERT INTO teams (company_id, department_id, name, description) VALUES (?, ?, ?, ?)',
      [targetCompanyId, departmentId, name, description]
    );

    const [teams] = await pool.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);

    res.status(201).json({ team: teams[0] });
  } catch (error) {
    next(error);
  }
};