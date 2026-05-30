import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Avatar, AvatarFallback } from '../../components/ui/Avatar';
import { useTasks, useDeleteTask } from '../../hooks/useTasks';
import { getStatusColor, getPriorityColor, formatDate, getInitials } from '../../lib/utils';
import { Skeleton } from '../../components/ui/Skeleton';

const TasksPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'kanban'
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams = { page, limit: 20 };
  if (searchTerm) queryParams.search = searchTerm;
  if (statusFilter !== 'all') queryParams.status = statusFilter;

  const { data, isLoading, error } = useTasks(queryParams);
  const deleteTask = useDeleteTask();

  const tasks = data?.tasks || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  const getPriorityIcon = (priority) => {
    if (priority === 'critical' || priority === 'high') return <AlertCircle className="w-4 h-4 text-destructive" />;
    if (priority === 'medium') return <Clock className="w-4 h-4 text-warning" />;
    return <CheckCircle className="w-4 h-4 text-muted-foreground" />;
  };

  const handleDeleteTask = async (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask.mutateAsync(taskId);
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            View and manage all your tasks
            {pagination.total > 0 && ` (${pagination.total} total)`}
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
        >
          <option value="all">All Status</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="testing">Testing</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          Failed to load tasks. Please try again.
        </div>
      )}

      {/* Tasks List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No tasks found</p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Task
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <Link to={`/tasks/${task.id}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          {getInitials(task.assignee_first_name, task.assignee_last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {task.project_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(task.priority)}
                        <Badge className={getStatusColor(task.status)}>
                          {task.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm">Due {formatDate(task.due_date)}</p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteTask(e, task.id)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
