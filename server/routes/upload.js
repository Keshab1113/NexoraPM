import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { uploadAttachment, getAttachments, deleteAttachment } from '../controllers/uploadController.js';
import { upload } from '../utils/upload.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Upload attachment to task
router.post(
  '/tasks/:taskId/attachments',
  upload.single('file'),
  uploadAttachment
);

// Get task attachments
router.get('/tasks/:taskId/attachments', getAttachments);

// Delete attachment
router.delete(
  '/tasks/:taskId/attachments/:attachmentId',
  rbac('super_admin', 'company_admin', 'manager', 'project_admin', 'employee'),
  deleteAttachment
);

export default router;