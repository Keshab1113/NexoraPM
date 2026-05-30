import { motion } from 'framer-motion';
import {
  Users,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Clock,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar, AvatarFallback } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useMyTasks } from '../../hooks/useTasks';
import { formatDate, getStatusColor, getInitials } from '../../lib/utils';
import { Skeleton } from '../../components/ui/Skeleton';

const StatCard = ({ icon: Icon, title, value, subtitle, trend, isLoading }) => (
  <Card className="glass-card-hover">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <p className="text-3xl font-bold">{value}</p>
          )}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-sm">
          <TrendingUp className="w-4 h-4 text-success" />
          <span className="text-success">{trend}</span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const { data: statsData, isLoading: statsLoading } = useDashboardStats(user?.companyId);
  const { data: tasksData, isLoading: tasksLoading } = useMyTasks({ limit: 5 });

  const stats = statsData?.stats || {
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalUsers: 0,
  };

  const recentTasks = tasksData?.tasks || [];
  const recentActivity = statsData?.recentActivity || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {user?.firstName || user?.first_name}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your projects today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10">
            <Clock className="w-3 h-3 mr-1" />
            {stats.overdueTasks || 0} tasks overdue
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={FolderKanban}
          title="Total Projects"
          value={stats.totalProjects}
          subtitle={`${stats.activeProjects} active`}
          trend={stats.projectGrowth ? `+${stats.projectGrowth}%` : null}
          isLoading={statsLoading}
        />
        <StatCard
          icon={CheckSquare}
          title="Total Tasks"
          value={stats.totalTasks}
          subtitle={`${stats.completedTasks} completed`}
          trend={stats.taskGrowth ? `+${stats.taskGrowth}%` : null}
          isLoading={statsLoading}
        />
        <StatCard
          icon={Users}
          title="Team Members"
          value={stats.totalUsers}
          subtitle="Across all projects"
          isLoading={statsLoading}
        />
        <StatCard
          icon={TrendingUp}
          title="Completion Rate"
          value={`${stats.completionRate || 0}%`}
          subtitle="This month"
          isLoading={statsLoading}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks assigned to you yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>
                            {getInitials(
                              task.assignee_first_name,
                              task.assignee_last_name
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.project_name} • Due {formatDate(task.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(task.status)}>
                          {task.status?.replace('_', ' ')}
                        </Badge>
                        <Badge className={getStatusColor(task.priority)} variant="outline">
                          {task.priority}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(
                            activity.user_first_name,
                            activity.user_last_name
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">
                            {activity.user_first_name} {activity.user_last_name}
                          </span>{' '}
                          <span className="text-muted-foreground">{activity.action}</span>{' '}
                          <span className="font-medium">{activity.entity_name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.created_at, 'relative')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium">
                + Create New Project
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm">
                Create New Task
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm">
                Invite Team Member
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
