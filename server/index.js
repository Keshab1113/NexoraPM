import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

import pool from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import notificationRoutes from './routes/notifications.js';
import activityLogRoutes from './routes/activityLogs.js';
import uploadRoutes from './routes/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Auth rate limiting (stricter for auth endpoints)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/auth', authLimiter);

// Ensure uploads directory exists
const uploadsDir = join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static files for uploads
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/uploads', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Authenticate socket connection
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwtModule = await import('jsonwebtoken');
      const jwt = jwtModule.default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.companyId = decoded.companyId;

      // Join company room for broadcast
      if (decoded.companyId) {
        socket.join(`company:${decoded.companyId}`);
      }

      console.log(`User ${decoded.id} authenticated`);
    } catch (error) {
      console.log('Socket auth failed:', error.message);
    }
  }

  // Join project room
  socket.on('join:project', (projectId) => {
    socket.join(`project:${projectId}`);
    console.log(`Socket ${socket.id} joined project:${projectId}`);
  });

  // Leave project room
  socket.on('leave:project', (projectId) => {
    socket.leave(`project:${projectId}`);
  });

  // Join user-specific notification room
  socket.on('join:user', (userId) => {
    socket.join(`user:${userId}`);
  });

  // Handle task updates
  socket.on('task:update', async (data) => {
    const { taskId, projectId, updates } = data;
    // Broadcast to project room
    io.to(`project:${projectId}`).emit('task:updated', { taskId, updates });
  });

  // Handle new comments
  socket.on('comment:new', async (data) => {
    const { taskId, projectId, comment } = data;
    io.to(`project:${projectId}`).emit('comment:added', { taskId, comment });
  });

  // Handle typing indicator
  socket.on('typing:start', (data) => {
    const { taskId, user } = data;
    socket.to(`project:${data.projectId}`).emit('user:typing', { taskId, user });
  });

  socket.on('typing:stop', (data) => {
    const { taskId } = data;
    socket.to(`project:${data.projectId}`).emit('user:stopped_typing', { taskId });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible in routes
app.set('io', io);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           NexoraPM Server Started Successfully         ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  🚀 Server running on: http://localhost:${PORT}           ║`);
  console.log(`║  📦 Environment: ${process.env.NODE_ENV || 'development'}                        ║`);
  console.log('║  🗄️  Database: MySQL                                      ║');
  console.log('║  🔌 Socket.IO: Enabled                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
});

export { app, io };