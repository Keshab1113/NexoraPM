import express from 'express';
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyStats,
} from '../controllers/companyController.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Super admin routes
router.get('/', rbac('super_admin'), getAllCompanies);
router.post('/', rbac('super_admin'), createCompany);
router.delete('/:id', rbac('super_admin'), deleteCompany);

// Company management (super admin and company admin)
router.get('/:id', getCompanyById);
router.put('/:id', rbac('super_admin', 'company_admin'), updateCompany);
router.get('/:id/stats', rbac('super_admin', 'company_admin'), getCompanyStats);

export default router;