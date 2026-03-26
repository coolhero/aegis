// T011: useAuth hook — auth utilities
'use client';

import { useAuthContext } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { LoginRequest } from '@/types/api';

export function useAuth() {
  const auth = useAuthContext();
  const router = useRouter();

  const login = useCallback(
    async (credentials: LoginRequest) => {
      await auth.login(credentials);
      router.push('/dashboard');
    },
    [auth, router],
  );

  const logout = useCallback(() => {
    auth.logout();
    router.push('/login');
  }, [auth, router]);

  const isAdmin = auth.user?.role === 'admin';
  const isMember = auth.user?.role === 'member';
  const isViewer = auth.user?.role === 'viewer';

  const canEdit = isAdmin;
  const canManageUsers = isAdmin;
  const canManageApiKeys = isAdmin || isMember;

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    accessToken: auth.accessToken,
    login,
    logout,
    isAdmin,
    isMember,
    isViewer,
    canEdit,
    canManageUsers,
    canManageApiKeys,
  };
}
