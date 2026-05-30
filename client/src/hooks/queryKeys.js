// Query keys factory for consistent cache management
export const queryKeys = {
  // Auth
  auth: ['auth'],
  me: ['auth', 'me'],

  // Users
  users: ['users'],
  user: (id) => ['users', id],
  departments: ['departments'],
  teams: ['teams'],

  // Companies
  companies: ['companies'],
  company: (id) => ['companies', id],
  companyStats: (id) => ['companies', id, 'stats'],

  // Projects
  projects: ['projects'],
  project: (id) => ['projects', id],
  projectAnalytics: (id) => ['projects', id, 'analytics'],
  projectMembers: (id) => ['projects', id, 'members'],

  // Tasks
  tasks: ['tasks'],
  task: (id) => ['tasks', id],
  myTasks: ['tasks', 'my'],

  // Notifications
  notifications: ['notifications'],
  unreadCount: ['notifications', 'unread'],

  // Activity Logs
  activityLogs: ['activityLogs'],
  dashboardStats: ['activityLogs', 'dashboard'],
};

export default queryKeys;
