import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login: storeLogin, logout: storeLogout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = useAuthStore.getState().accessToken;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (token) {
        try {
          const response = await authApi.getMe();
          const userData = response.data.user;
          // Ensure user data is properly hydrated
          storeLogin(userData, token, refreshToken);
        } catch (error) {
          // Token might be expired, try to refresh
          if (error.response?.status === 401 && refreshToken) {
            try {
              const refreshResponse = await authApi.refresh(refreshToken);
              const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;
              // Update store with new tokens
              useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
              // Fetch user with new token
              const userResponse = await authApi.getMe();
              storeLogin(userResponse.data.user, newAccessToken, newRefreshToken);
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError);
              storeLogout();
            }
          } else {
            storeLogout();
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authApi.login({ email, password });
    const { user, accessToken, refreshToken } = response.data;
    storeLogin(user, accessToken, refreshToken);
    navigate('/dashboard');
    return user;
  };

  const register = async (data) => {
    const response = await authApi.register(data);
    const { user, accessToken, refreshToken } = response.data;
    storeLogin(user, accessToken, refreshToken);
    navigate('/dashboard');
    return user;
  };

  const logout = async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      await authApi.logout(refreshToken);
    } catch (error) {
      console.error('Logout error:', error);
    }
    storeLogout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};