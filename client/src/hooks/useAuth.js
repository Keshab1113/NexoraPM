import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const { user, isAuthenticated, login, register, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (email, password) => {
    const user = await login(email, password);
    return user;
  };

  const handleRegister = async (data) => {
    const user = await register(data);
    return user;
  };

  const handleLogout = async () => {
    await logout();
  };

  return {
    user,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  };
};

export const useRequireAuth = (redirectTo = '/login') => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, navigate, redirectTo]);

  return { isAuthenticated, user };
};

export const useRequireRole = (allowedRoles, redirectTo = '/dashboard') => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user && !allowedRoles.includes(user.role)) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, user, navigate, allowedRoles, redirectTo]);

  return { isAuthenticated, user };
};