import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { generateTokens, verifyRefreshToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

// Register new user
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    let companyId = null;
    let userRole = 'company_admin';

    // If company name provided, create new company
    if (companyName) {
      const [companyResult] = await pool.query(
        'INSERT INTO companies (name, status, plan_type) VALUES (?, ?, ?)',
        [companyName, 'active', 'starter']
      );
      companyId = companyResult.insertId;

      // Create default department
      await pool.query(
        'INSERT INTO departments (company_id, name) VALUES (?, ?)',
        [companyId, 'General']
      );
    }

    // Create user
    const emailVerificationToken = uuidv4();
    const [userResult] = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status, email_verified, email_verification_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, email, passwordHash, firstName, lastName, userRole, 'active', true, emailVerificationToken]
    );

    const userId = userResult.insertId;

    // Generate tokens
    const user = { id: userId, email, role: userRole, company_id: companyId };
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, refreshToken, refreshExpiry]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, companyId, 'user_registered', 'user', userId, JSON.stringify({ email })]
    );

    res.status(201).json({
      message: 'Registration successful',
      user: { id: userId, email, firstName, lastName, role: userRole, companyId },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [users] = await pool.query(
      `SELECT u.*, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Generate tokens
    const tokenUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
    };
    const { accessToken, refreshToken } = generateTokens(tokenUser);

    // Store refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, refreshExpiry]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.company_id, 'user_login', 'user', user.id, JSON.stringify({ email }), req.ip]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// Refresh access token
export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if token exists in database
    const [tokens] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW()',
      [refreshToken, decoded.id]
    );

    if (tokens.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user
    const [users] = await pool.query(
      'SELECT id, email, role, company_id FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Delete old refresh token and create new one
    await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, newRefreshToken, refreshExpiry]
    );

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    next(error);
  }
};

// Forgot password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const [users] = await pool.query('SELECT id, first_name FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      // Don't reveal if user exists
      return res.json({ message: 'If email exists, password reset link has been sent' });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, resetExpiry, user.id]
    );

    // TODO: Send email with reset link
    // For now, log the token (in production, send actual email)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, 'password_reset_requested', 'user', user.id, JSON.stringify({ email })]
    );

    res.json({ message: 'If email exists, password reset link has been sent' });
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Find user with valid reset token
    const [users] = await pool.query(
      'SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = users[0].id;

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [passwordHash, userId]
    );

    // Invalidate all refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, 'password_reset_completed', 'user', userId, JSON.stringify({})]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete the specific refresh token
      await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// Get current user
export const getMe = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, u.role, u.status,
              u.company_id, u.department_id, u.team_id, u.phone,
              c.name as company_name, d.name as department_name, t.name as team_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        companyId: user.company_id,
        companyName: user.company_name,
        departmentId: user.department_id,
        departmentName: user.department_name,
        teamId: user.team_id,
        teamName: user.team_name,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
};