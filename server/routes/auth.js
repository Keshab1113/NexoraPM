import express from 'express';
import { register, login, refresh, forgotPassword, resetPassword, logout, getMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);

// Protected routes
router.get('/me', authMiddleware, getMe);

export default router;