import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  MessageSquare,
  Paperclip,
  MoreVertical,
  Send,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar, AvatarFallback } from '../../components/ui/Avatar';
import { Textarea } from '../../components/ui/Textarea';
import { useTask, useUpdateTask, useAddComment } from '../../hooks/useTasks';
import { getStatusColor, getPriorityColor, formatDate, getInitials, timeAgo } from '../../lib/utils';
import { Skeleton } from '../../components/ui/Skeleton';

const TaskDetailPage = () => {
  const { id } = useParams();
  const [comment, setComment] = useState('');

  const { data, isLoading, error } = useTask(id);
  const updateTask = useUpdateTask();
  const addComment = useAddComment();

  const task = data?.task;

  const handleStatusChange = async (newStatus) => {
    try {
      await updateTask.mutateAsync({ id, status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    try {
      await addComment.mutateAsync({ taskId: id, content: comment });
      setComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          Failed to load task. Please try again.
        </div>
        <Link to="/tasks">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tasks
          </Button>
        </Link>
      </div>
    );
  }

  const comments = task.comments || [];
  const attachments = task.attachments || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/tasks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-muted-foreground">
            in <span className="text-primary">{task.project_name}</span>
          </p>
        </div>
        <Button>Save Changes</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {task.description || 'No description provided.'}
              </p>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {comments.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No comments yet</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{getInitials(c.first_name, c.last_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {c.first_name} {c.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.content}</p>
                    </div>
                  </div>
                ))
              )}

              {/* Add comment */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Avatar className="w-10 h-10">
                  <AvatarFallback>ME</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder="Write a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mb-2"
                  />
                  <Button
                    size="sm"
                    onClick={handleSubmitComment}
                    disabled={!comment.trim() || addComment.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {addComment.isPending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <div className="mt-1">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="testing">Testing</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Priority</label>
                <div className="mt-1">
                  <Badge className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assignee</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback>
                        {getInitials(task.assignee_first_name, task.assignee_last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {task.assignee_first_name} {task.assignee_last_name || 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium">{formatDate(task.due_date) || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Estimated</p>
                  <p className="text-sm font-medium">{task.estimated_hours || 0} hours</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Attachments</p>
                  <p className="text-sm font-medium">{attachments.length} files</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;