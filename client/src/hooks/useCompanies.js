import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi } from '../services/api';
import { queryKeys } from './queryKeys';

// Get all companies with filters
export const useCompanies = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.companies, params],
    queryFn: async () => {
      const { data } = await companyApi.getAll(params);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get single company by ID
export const useCompany = (id) => {
  return useQuery({
    queryKey: queryKeys.company(id),
    queryFn: async () => {
      const { data } = await companyApi.getById(id);
      return data;
    },
    enabled: !!id,
  });
};

// Get company stats
export const useCompanyStats = (id) => {
  return useQuery({
    queryKey: queryKeys.companyStats(id),
    queryFn: async () => {
      const { data } = await companyApi.getStats(id);
      return data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Create company mutation
export const useCreateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyData) => {
      const { data } = await companyApi.create(companyData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
};

// Update company mutation
export const useUpdateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await companyApi.update(id, updates);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.company(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
};

// Delete company mutation
export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await companyApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
};

export default {
  useCompanies,
  useCompany,
  useCompanyStats,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
};
