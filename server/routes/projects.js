import express from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getProjectAnalytics,
} from '../controllers/projectController.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllProjects);
router.get('/:id', getProjectById);
router.post('/', rbac('super_admin', 'company_admin', 'manager'), createProject);
router.put('/:id', rbac('super_admin', 'company_admin', 'manager'), updateProject);
router.delete('/:id', rbac('super_admin', 'company_admin', 'manager'), deleteProject);
router.post('/:id/members', rbac('super_admin', 'company_admin', 'manager'), addProjectMember);
router.delete('/:id/members/:memberId', rbac('super_admin', 'company_admin', 'manager'), removeProjectMember);
router.get('/:id/analytics', rbac('super_admin', 'company_admin', 'manager'), getProjectAnalytics);

export default router;