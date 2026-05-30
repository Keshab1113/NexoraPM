import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '../services/api';
import { queryKeys } from './queryKeys';

// Get all tasks with filters
export const useTasks = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.tasks, params],
    queryFn: async () => {
      const { data } = await taskApi.getAll(params);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Get single task by ID
export const useTask = (id) => {
  return useQuery({
    queryKey: queryKeys.task(id),
    queryFn: async () => {
      const { data } = await taskApi.getById(id);
      return data;
    },
    enabled: !!id,
  });
};

// Get current user's tasks
export const useMyTasks = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.myTasks, params],
    queryFn: async () => {
      const { data } = await taskApi.getMyTasks(params);
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
};

// Create task mutation
export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData) => {
      const { data } = await taskApi.create(taskData);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      // If task belongs to a project, invalidate project tasks too
      if (data.task?.project_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.project(data.task.project_id),
        });
      }
    },
  });
};

// Update task mutation
export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await taskApi.update(id, updates);
      return data;
    },
    onSuccess: (data, variables) => {
      // Update specific task cache
      queryClient.invalidateQueries({ queryKey: queryKeys.task(variables.id) });
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      // Invalidate my tasks in case assigned to current user
      queryClient.invalidateQueries({ queryKey: queryKeys.myTasks });
    },
  });
};

// Delete task mutation
export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await taskApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.myTasks });
    },
  });
};

// Add comment mutation
export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, content }) => {
      const { data } = await taskApi.addComment(taskId, content);
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate task to get updated comments
      queryClient.invalidateQueries({ queryKey: queryKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
};

export default {
  useTasks,
  useTask,
  useMyTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useAddComment,
};
