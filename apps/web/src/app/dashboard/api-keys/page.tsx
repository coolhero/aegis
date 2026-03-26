// T030: API Keys management page
'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingSkeleton } from '@/components/states/loading-skeleton';
import { ErrorState } from '@/components/states/error-state';
import { useAuth } from '@/hooks/use-auth';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/use-api-keys';
import type { ApiKey } from '@/types/api';

export default function ApiKeysPage() {
  const { canManageApiKeys } = useAuth();
  const { data: keys, isLoading, isError, refetch } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'key_prefix', header: 'Key', render: (k: ApiKey) => `...${k.key_prefix}` },
    { key: 'created_at', header: 'Created', render: (k: ApiKey) => new Date(k.created_at).toLocaleDateString() },
    { key: 'last_used_at', header: 'Last Used', render: (k: ApiKey) => k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never' },
    {
      key: 'status',
      header: 'Status',
      render: (k: ApiKey) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${k.revoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {k.revoked ? 'Revoked' : 'Active'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (k: ApiKey) =>
        !k.revoked && canManageApiKeys ? (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmRevoke(k.id); }}
            className="text-xs text-red-600 hover:underline"
          >
            Revoke
          </button>
        ) : null,
    },
  ];

  const handleCreate = () => {
    createKey.mutate(
      { name: newKeyName, scopes: ['*'] },
      {
        onSuccess: (data) => {
          setCreatedKey(data.key);
          setNewKeyName('');
          setShowCreate(false);
        },
      },
    );
  };

  const handleRevoke = () => {
    if (confirmRevoke) {
      revokeKey.mutate(confirmRevoke, { onSuccess: () => setConfirmRevoke(null) });
    }
  };

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Manage API keys for your organization"
        action={
          canManageApiKeys && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 admin-action"
            >
              Create API Key
            </button>
          )
        }
      />

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorState message="Failed to load API keys." onRetry={() => refetch()} />}
      {keys && <DataTable columns={columns} data={keys} />}

      {createdKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="api-key-modal">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-2">API Key Created</h3>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
              <p className="text-sm text-yellow-800 font-medium mb-1">Copy this key now. You won't be able to see it again.</p>
            </div>
            <code className="block p-3 bg-gray-100 rounded-md text-sm break-all" data-testid="full-api-key">{createdKey}</code>
            <button
              onClick={() => setCreatedKey(null)}
              className="mt-4 w-full py-2 bg-blue-600 text-white rounded-md text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create API Key</h3>
            <input
              type="text"
              placeholder="Key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-md">Cancel</button>
              <button onClick={handleCreate} disabled={!newKeyName || createKey.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md">Create</button>
            </div>
          </div>
        </div>
      )}

      {confirmRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-2">Revoke API Key?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone. The key will stop working immediately.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRevoke(null)} className="px-4 py-2 text-sm border rounded-md">Cancel</button>
              <button onClick={handleRevoke} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md">Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
