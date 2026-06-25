'use client';

import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function DocumentsInner({ communityId }: { communityId: string }) {
  const docsQuery = trpc.documents.listByCommunity.useQuery({ communityId });

  return (
    <Shell communityId={communityId} active="documents">
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold tracking-tight">Документы</h1>
        {docsQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}
        <ul className="space-y-3">
          {(docsQuery.data ?? []).map((doc) => (
            <li
              key={doc.id}
              className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
            >
              <p className="font-semibold">{doc.title ?? doc.documentType}</p>
              <p className="text-xs text-stitch-muted">{doc.documentType}</p>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

export default function DocumentsPage({
  params,
}: {
  params: { communityId: string };
}) {
  return (
    <AuthGate>
      <DocumentsInner communityId={params.communityId} />
    </AuthGate>
  );
}
