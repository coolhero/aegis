// T006: Auth context — JWT token management in memory
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AuthUser, LoginRequest, LoginResponse, RefreshResponse } from '@/types/api';
import { apiClient } from './api-client';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let refreshTokenStore: string | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    const { accessToken: token, refreshToken: refresh, user: userData } = response.data;
    setAccessToken(token);
    setUser(userData);
    refreshTokenStore = refresh;
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    refreshTokenStore = null;
  }, []);

  const refreshTokenFn = useCallback(async (): Promise<string | null> => {
    if (!refreshTokenStore) return null;
    try {
      const response = await apiClient.post<RefreshResponse>('/auth/refresh', {
        refreshToken: refreshTokenStore,
      });
      const { accessToken: newToken, refreshToken: newRefresh } = response.data;
      setAccessToken(newToken);
      refreshTokenStore = newRefresh;
      return newToken;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    // Try to refresh on mount (if refresh token exists from previous session)
    const tryRefresh = async () => {
      if (refreshTokenStore) {
        await refreshTokenFn();
      }
      setIsLoading(false);
    };
    tryRefresh();
  }, [refreshTokenFn]);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    login,
    logout,
    refreshToken: refreshTokenFn,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
