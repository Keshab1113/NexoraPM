import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    const { accessToken } = useAuthStore.getState();

    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('user:online', { userId: useAuthStore.getState().user?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('notification:new', (notification) => {
      this.notifyListeners('notification', notification);
    });

    this.socket.on('task:updated', (data) => {
      this.notifyListeners('taskUpdate', data);
    });

    this.socket.on('comment:added', (data) => {
      this.notifyListeners('comment', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Also add to socket if connected
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  joinProject(projectId) {
    this.emit('join:project', projectId);
  }

  leaveProject(projectId) {
    this.emit('leave:project', projectId);
  }

  joinUserRoom(userId) {
    this.emit('join:user', userId);
  }

  emitTaskUpdate(taskId, projectId, updates) {
    this.emit('task:update', { taskId, projectId, updates });
  }

  emitComment(taskId, projectId, comment) {
    this.emit('comment:new', { taskId, projectId, comment });
  }

  emitTyping(taskId, projectId, user) {
    this.emit('typing:start', { taskId, projectId, user });
  }

  emitStopTyping(taskId, projectId) {
    this.emit('typing:stop', { taskId, projectId });
  }
}

export const socketService = new SocketService();
export default socketService;