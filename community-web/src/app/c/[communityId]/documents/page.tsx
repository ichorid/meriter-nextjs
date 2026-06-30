'use client';

import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';

function DocumentsInner({ communityId }: { communityId: string }) {
  const docsQuery = trpc.documents.listByCommunity.useQuery({ communityId });

  return (
    <CommunityShell communityId={communityId} active="documents" tgActive="me">
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold tracking-tight">Документы</h1>
        {docsQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}
        <ul className="space-y-3">
          {(docsQuery.data ?? []).map((doc) => (
            <li key={doc.id}>
              <a
                href={`/c/${communityId}/documents/${doc.id}`}
                className="block rounded-xl border border-stitch-border bg-stitch-surface p-4 hover:border-primary/50 transition-colors"
              >
                <p className="font-semibold">{doc.title ?? doc.documentType}</p>
                <p className="text-xs text-stitch-muted">{doc.documentType}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </CommunityShell>
  );
}

export default function DocumentsPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <DocumentsInner communityId={communityId} />
    </AuthGate>
  );
}
