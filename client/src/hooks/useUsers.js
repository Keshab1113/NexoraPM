import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/api';
import { queryKeys } from './queryKeys';

// Get all users with filters
export const useUsers = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.users, params],
    queryFn: async () => {
      const { data } = await userApi.getAll(params);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get single user by ID
export const useUser = (id) => {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => {
      const { data } = await userApi.getById(id);
      return data;
    },
    enabled: !!id,
  });
};

// Create user mutation
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData) => {
      const { data } = await userApi.create(userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

// Update user mutation
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await userApi.update(id, updates);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

// Delete user mutation
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await userApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

// Get departments
export const useDepartments = (companyId) => {
  return useQuery({
    queryKey: [...queryKeys.departments, companyId],
    queryFn: async () => {
      const { data } = await userApi.getDepartments(companyId);
      return data;
    },
    enabled: !!companyId,
  });
};

// Create department mutation
export const useCreateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (departmentData) => {
      const { data } = await userApi.createDepartment(departmentData);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.departments, variables.companyId],
      });
    },
  });
};

// Get teams
export const useTeams = (companyId) => {
  return useQuery({
    queryKey: [...queryKeys.teams, companyId],
    queryFn: async () => {
      const { data } = await userApi.getTeams(companyId);
      return data;
    },
    enabled: !!companyId,
  });
};

// Create team mutation
export const useCreateTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamData) => {
      const { data } = await userApi.createTeam(teamData);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.teams, variables.companyId],
      });
    },
  });
};

export default {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useDepartments,
  useCreateDepartment,
  useTeams,
  useCreateTeam,
};
