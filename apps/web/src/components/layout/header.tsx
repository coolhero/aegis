// T010: Header with user menu
'use client';

import { useAuth } from '@/hooks/use-auth';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between" data-testid="header">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="text-sm">
              <span className="font-medium text-gray-900">{user.name}</span>
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full text-gray-600">{user.role}</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
              data-testid="logout-button"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
