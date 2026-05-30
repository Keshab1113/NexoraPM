import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityLogApi } from '../services/api';
import { queryKeys } from './queryKeys';

// Get dashboard statistics
export const useDashboardStats = (companyId) => {
  return useQuery({
    queryKey: [...queryKeys.dashboardStats, companyId],
    queryFn: async () => {
      const { data } = await activityLogApi.getDashboardStats(companyId);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Get activity logs with filters
export const useActivityLogs = (params = {}) => {
  return useQuery({
    queryKey: [...queryKeys.activityLogs, params],
    queryFn: async () => {
      const { data } = await activityLogApi.getAll(params);
      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export default {
  useDashboardStats,
  useActivityLogs,
};
