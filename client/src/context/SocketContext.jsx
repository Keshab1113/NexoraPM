import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore, useNotificationStore } from '../store/authStore';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  const { accessToken, isAuthenticated } = useAuthStore();
  const { addNotification } = useNotificationStore();

  // Separate effect for socket connection to ensure proper token access
  useEffect(() => {
    // Delay socket connection until auth store is hydrated from localStorage
    const token = useAuthStore.getState().accessToken;

    if (!token || !isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        isConnectedRef.current = false;
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

    // Clean up existing socket if any
    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      isConnectedRef.current = true;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      isConnectedRef.current = false;
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
      isConnectedRef.current = false;
    });

    // Listen for notifications
    newSocket.on('notification:new', (notification) => {
      console.log('New notification:', notification);
      addNotification(notification);
    });

    // Listen for task updates
    newSocket.on('task:updated', (data) => {
      console.log('Task updated via socket:', data);
      window.dispatchEvent(new CustomEvent('socket:taskUpdated', { data }));
    });

    // Listen for comment additions
    newSocket.on('comment:added', (data) => {
      console.log('Comment added via socket:', data);
      window.dispatchEvent(new CustomEvent('socket:commentAdded', { data }));
    });

    // Listen for user typing
    newSocket.on('user:typing', (data) => {
      console.log('User typing:', data);
      window.dispatchEvent(new CustomEvent('socket:userTyping', { data }));
    });

    // Listen for user stopped typing
    newSocket.on('user:stopped_typing', (data) => {
      console.log('User stopped typing:', data);
      window.dispatchEvent(new CustomEvent('socket:userStoppedTyping', { data }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  const emit = useCallback((event, data) => {
    if (socket && isConnectedRef.current) {
      socket.emit(event, data);
    }
  }, [socket]);

  const joinProject = useCallback((projectId) => {
    emit('join:project', projectId);
  }, [emit]);

  const leaveProject = useCallback((projectId) => {
    emit('leave:project', projectId);
  }, [emit]);

  const joinUser = useCallback((userId) => {
    emit('join:user', userId);
  }, [emit]);

  const emitTaskUpdate = useCallback((taskId, projectId, updates) => {
    emit('task:update', { taskId, projectId, updates });
  }, [emit]);

  const emitNewComment = useCallback((taskId, projectId, comment) => {
    emit('comment:new', { taskId, projectId, comment });
  }, [emit]);

  const emitTyping = useCallback((taskId, projectId, user) => {
    emit('typing:start', { taskId, projectId, user });
  }, [emit]);

  const emitStopTyping = useCallback((taskId, projectId) => {
    emit('typing:stop', { taskId, projectId });
  }, [emit]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinProject,
        leaveProject,
        joinUser,
        emitTaskUpdate,
        emitNewComment,
        emitTyping,
        emitStopTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};