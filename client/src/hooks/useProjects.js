import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../services/api';
import { queryKeys } from './queryKeys';

// Get all projects with filters
export const useProjects = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.projects, params],
    queryFn: async () => {
      const { data } = await projectApi.getAll(params);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get single project by ID
export const useProject = (id) => {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: async () => {
      const { data } = await projectApi.getById(id);
      return data;
    },
    enabled: !!id,
  });
};

// Get project analytics
export const useProjectAnalytics = (id) => {
  return useQuery({
    queryKey: queryKeys.projectAnalytics(id),
    queryFn: async () => {
      const { data } = await projectApi.getAnalytics(id);
      return data;
    },
    enabled: !!id,
  });
};

// Create project mutation
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectData) => {
      const { data } = await projectApi.create(projectData);
      return data;
    },
    onSuccess: () => {
      // Invalidate projects list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};

// Update project mutation
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await projectApi.update(id, updates);
      return data;
    },
    onSuccess: (data, variables) => {
      // Update specific project cache
      queryClient.invalidateQueries({ queryKey: queryKeys.project(variables.id) });
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};

// Delete project mutation
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await projectApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};

// Add project member mutation
export const useAddProjectMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...memberData }) => {
      const { data } = await projectApi.addMember(projectId, memberData);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(variables.projectId) });
    },
  });
};

// Remove project member mutation
export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, memberId }) => {
      await projectApi.removeMember(projectId, memberId);
      return { projectId, memberId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(data.projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(data.projectId) });
    },
  });
};

export default {
  useProjects,
  useProject,
  useProjectAnalytics,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useAddProjectMember,
  useRemoveProjectMember,
};
