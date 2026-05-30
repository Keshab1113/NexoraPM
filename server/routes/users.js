import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getDepartments,
  createDepartment,
  getTeams,
  createTeam,
} from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// User routes
router.get('/', rbac('super_admin', 'company_admin', 'manager'), getAllUsers);
router.get('/:id', getUserById);
router.post('/', rbac('super_admin', 'company_admin', 'manager'), createUser);
router.put('/:id', rbac('super_admin', 'company_admin', 'manager'), updateUser);
router.delete('/:id', rbac('super_admin', 'company_admin'), deleteUser);

// Department routes
router.get('/departments', getDepartments);
router.post('/departments', rbac('super_admin', 'company_admin', 'manager'), createDepartment);

// Team routes
router.get('/teams', getTeams);
router.post('/teams', rbac('super_admin', 'company_admin', 'manager'), createTeam);

export default router;