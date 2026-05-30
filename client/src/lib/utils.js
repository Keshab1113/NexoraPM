import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}

export function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export function getStatusColor(status) {
  const colors = {
    // Project statuses
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    planning: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    in_progress: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    review: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    on_hold: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    // Task statuses
    todo: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    testing: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    blocked: 'bg-red-500/10 text-red-500 border-red-500/20',
    // Priority
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    medium: 'bg-green-500/10 text-green-400 border-green-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}

export function getRoleColor(role) {
  const colors = {
    super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    company_admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    manager: 'bg-green-500/10 text-green-400 border-green-500/20',
    project_admin: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    employee: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return colors[role] || colors.employee;
}

export function getPriorityColor(priority) {
  return getStatusColor(priority);
}

export function truncate(str, length = 50) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}