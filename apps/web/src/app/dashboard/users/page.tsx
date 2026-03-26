// T029: Users management page
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { ErrorState } from '@/components/states/error-state';
import { useAuth } from '@/hooks/use-auth';
import { useUsers, useUpdateUserRole, useCreateUser } from '@/hooks/use-users';
import type { User, Team } from '@/types/api';

export default function UsersPage() {
  const { canManageUsers } = useAuth();
  const { data: users, isLoading, isError, refetch } = useUsers();
  const updateRole = useUpdateUserRole();
  const createUser = useCreateUser();
  const { data: teams } = useQuery({
    queryKey: queryKeys.teams.list,
    queryFn: async () => {
      const res = await apiClient.get<Team[]>('/teams');
      return res.data;
    },
  });
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) =>
        canManageUsers ? (
          <select
            value={user.role}
            onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value })}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="admin">admin</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
        ) : (
          <span className="px-2 py-0.5 text-xs bg-gray-100 rounded-full">{user.role}</span>
        ),
    },
    {
      key: 'team_id',
      header: 'Team',
      render: (user: User) =>
        canManageUsers && teams ? (
          <select
            value={user.team_id || ''}
            onChange={(e) => updateRole.mutate({ userId: user.id, role: user.role, teamId: e.target.value || undefined } as any)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="">No team</option>
            {teams.map((t: Team) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-500">
            {teams?.find((t: Team) => t.id === user.team_id)?.name || '—'}
          </span>
        ),
    },
    { key: 'created_at', header: 'Joined', render: (user: User) => new Date(user.created_at).toLocaleDateString() },
  ];

  const handleInvite = () => {
    createUser.mutate(
      { email: inviteEmail, name: inviteName, role: inviteRole, password: invitePassword },
      {
        onSuccess: () => {
          setShowInvite(false);
          setInviteEmail('');
          setInviteName('');
          setInvitePassword('');
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage organization users"
        action={
          canManageUsers && (
            <button
              onClick={() => setShowInvite(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 admin-action"
            >
              Invite User
            </button>
          )
        }
      />

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorState message="Failed to load users." onRetry={() => refetch()} />}
      {users && <DataTable columns={columns} data={users} />}

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Invite User</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
              <input
                type="password"
                placeholder="Initial Password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm border rounded-md">
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={createUser.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md"
              >
                Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
