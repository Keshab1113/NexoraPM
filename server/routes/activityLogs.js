import express from 'express';
import { getActivityLogs, getDashboardStats } from '../controllers/activityLogController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getActivityLogs);
router.get('/dashboard', getDashboardStats);

export default router;