import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// Hook to handle socket-based query invalidation
export const useSocketListener = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Handle task updates from socket
    const handleTaskUpdated = (event) => {
      const { taskId, updates } = event.detail || event.data || {};
      console.log('Invalidating task queries due to socket update:', taskId);
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        queryClient.invalidateQueries({ queryKey: queryKeys.myTasks });
      }
    };

    // Handle comment additions from socket
    const handleCommentAdded = (event) => {
      const { taskId } = event.detail || event.data || {};
      console.log('Invalidating task queries due to new comment:', taskId);
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      }
    };

    // Handle new notifications
    const handleNewNotification = (event) => {
      console.log('Invalidating notification queries due to new notification');
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    };

    // Listen for custom events dispatched from socket context
    window.addEventListener('socket:taskUpdated', handleTaskUpdated);
    window.addEventListener('socket:commentAdded', handleCommentAdded);

    return () => {
      window.removeEventListener('socket:taskUpdated', handleTaskUpdated);
      window.removeEventListener('socket:commentAdded', handleCommentAdded);
    };
  }, [queryClient]);
};

export default useSocketListener;