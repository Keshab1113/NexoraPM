import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../services/api';
import { queryKeys } from './queryKeys';

// Get all notifications with filters
export const useNotifications = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.notifications, params],
    queryFn: async () => {
      const { data } = await notificationApi.getAll(params);
      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute - notifications change frequently
  });
};

// Get unread notification count
export const useUnreadCount = () => {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => {
      const { data } = await notificationApi.getUnreadCount();
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Poll every 30 seconds as backup to socket
  });
};

// Mark notification as read mutation
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await notificationApi.markAsRead(id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
};

// Mark all notifications as read mutation
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await notificationApi.markAllAsRead();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
};

// Delete notification mutation
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await notificationApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
};

export default {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
};
