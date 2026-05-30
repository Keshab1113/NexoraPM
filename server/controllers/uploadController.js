import pool from '../config/db.js';

// Upload task attachment
export const uploadAttachment = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify task exists
    const [tasks] = await pool.query(
      `SELECT t.*, p.company_id FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Insert attachment record
    const [result] = await pool.query(
      `INSERT INTO task_attachments (task_id, user_id, filename, original_name, file_type, file_size, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskId, req.user.id, file.filename, file.originalname, file.mimetype, file.size, file.path]
    );

    // Get the created attachment with user info
    const [attachments] = await pool.query(
      `SELECT ta.*, u.first_name, u.last_name, u.avatar
       FROM task_attachments ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.id = ?`,
      [result.insertId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, tasks[0].company_id, 'file_uploaded', 'task_attachment', result.insertId,
       JSON.stringify({ taskId, filename: file.originalname })]
    );

    res.status(201).json({
      message: 'File uploaded successfully',
      attachment: attachments[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get task attachments
export const getAttachments = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const [attachments] = await pool.query(
      `SELECT ta.*, u.first_name, u.last_name, u.avatar
       FROM task_attachments ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.task_id = ?
       ORDER BY ta.created_at DESC`,
      [taskId]
    );

    res.json({ attachments });
  } catch (error) {
    next(error);
  }
};

// Delete attachment
export const deleteAttachment = async (req, res, next) => {
  try {
    const { taskId, attachmentId } = req.params;

    // Verify attachment exists and belongs to task
    const [attachments] = await pool.query(
      'SELECT * FROM task_attachments WHERE id = ? AND task_id = ?',
      [attachmentId, taskId]
    );

    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete the file from storage
    // Note: In production, you'd use fs to delete the actual file
    // fs.unlinkSync(attachments[0].file_path);

    // Delete the record
    await pool.query('DELETE FROM task_attachments WHERE id = ?', [attachmentId]);

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export default {
  uploadAttachment,
  getAttachments,
  deleteAttachment,
};