// F012 T008: API Explorer page
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { ApiExplorerPanel } from '@/components/playground/api-explorer-panel';

export default function ApiExplorerPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="API Explorer" description="Browse and test AEGIS API endpoints" />
      <div className="mt-4 flex-1 min-h-0">
        <ApiExplorerPanel />
      </div>
    </div>
  );
}
