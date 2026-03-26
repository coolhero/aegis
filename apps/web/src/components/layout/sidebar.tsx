// T010: Sidebar navigation
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'member', 'viewer'] },
  { href: '/dashboard/usage', label: 'Usage', icon: '📈', roles: ['admin', 'member', 'viewer'] },
  { href: '/dashboard/budget', label: 'Budget', icon: '💰', roles: ['admin', 'member', 'viewer'] },
  { href: '/dashboard/users', label: 'Users', icon: '👥', roles: ['admin'] },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: '🔑', roles: ['admin', 'member'] },
  { href: '/dashboard/logs', label: 'Logs', icon: '📋', roles: ['admin', 'member', 'viewer'] },
  { href: '/dashboard/realtime', label: 'Realtime', icon: '⚡', roles: ['admin', 'member', 'viewer'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role || 'viewer';

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="hidden md:block w-64 bg-white border-r min-h-screen p-4 flex-shrink-0" data-testid="sidebar">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">AEGIS</h1>
        <p className="text-sm text-gray-500">Admin Dashboard</p>
      </div>
      <nav className="space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
