'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityDocumentParams } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { useTelegramBackButton } from '@/lib/use-telegram-chrome';

type DocumentBlock = {
  id: string;
  officialContent?: string;
  blockType?: string;
};

type DocumentSection = {
  id?: string;
  title?: string;
  blocks?: DocumentBlock[];
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function DocumentDetailInner({
  communityId,
  documentId,
}: {
  communityId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [proposeBlockId, setProposeBlockId] = useState<string | null>(null);
  const [proposeContent, setProposeContent] = useState('');
  const utils = trpc.useUtils();

  const docQuery = trpc.documents.getById.useQuery({ id: documentId });
  const variantsQuery = trpc.documentVariants.listByDocument.useQuery({
    documentId,
  });

  const proposeMutation = trpc.documentVariants.propose.useMutation({
    onSuccess: async () => {
      setProposeBlockId(null);
      setProposeContent('');
      await utils.documentVariants.listByDocument.invalidate({ documentId });
    },
  });

  const doc = docQuery.data as {
    id: string;
    title?: string;
    documentType?: string;
    sections?: DocumentSection[];
  } | undefined;

  const threads = variantsQuery.data?.threads ?? [];

  const backButtonActive = useTelegramBackButton({
    visible: true,
    onClick: () => router.push(`/c/${communityId}/documents`),
  });

  return (
    <CommunityShell communityId={communityId} active="documents" tgActive="me">
      <div className="space-y-6">
        <div>
          {!backButtonActive && (
            <a
              href={`/c/${communityId}/documents`}
              className="text-sm text-primary hover:underline"
            >
              ← К списку документов
            </a>
          )}
          <h1 className="mt-2 text-xl font-extrabold tracking-tight">
            {doc?.title ?? doc?.documentType ?? 'Документ'}
          </h1>
        </div>

        {docQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {(doc?.sections ?? []).map((section, sIdx) => (
          <section key={section.id ?? sIdx} className="space-y-4">
            {section.title && (
              <h2 className="text-lg font-semibold">{section.title}</h2>
            )}
            {(section.blocks ?? []).map((block) => {
              const blockThreads = threads.filter((t) => t.blockId === block.id);
              const openVariants = blockThreads.flatMap((t) => t.variants);
              return (
                <div
                  key={block.id}
                  id={`block-${block.id}`}
                  className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3"
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {block.officialContent
                      ? stripHtml(block.officialContent)
                      : '—'}
                  </div>

                  {openVariants.length > 0 && (
                    <div className="space-y-2 border-t border-stitch-border pt-3">
                      <p className="text-xs font-semibold text-stitch-muted uppercase">
                        Предложения
                      </p>
                      {openVariants.map((variant) => (
                        <div
                          key={variant.id}
                          className="rounded-lg bg-stitch-canvas px-3 py-2 text-sm"
                        >
                          <p className="text-xs text-stitch-muted mb-1">
                            {(variant as { proposedByDisplayName?: string })
                              .proposedByDisplayName ?? 'Участник'}
                          </p>
                          <p>
                            {variant.content
                              ? stripHtml(variant.content)
                              : (variant as { proposedText?: string }).proposedText ??
                                '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {proposeBlockId === block.id ? (
                    <div className="space-y-2 border-t border-stitch-border pt-3">
                      <textarea
                        className="w-full min-h-[80px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
                        placeholder="Ваш вариант текста блока"
                        value={proposeContent}
                        onChange={(e) => setProposeContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            !proposeContent.trim() || proposeMutation.isPending
                          }
                          onClick={() =>
                            proposeMutation.mutate({
                              documentId,
                              blockId: block.id,
                              content: proposeContent.trim(),
                            })
                          }
                          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
                        >
                          Отправить предложение
                        </button>
                        <button
                          type="button"
                          className="text-sm text-stitch-muted"
                          onClick={() => {
                            setProposeBlockId(null);
                            setProposeContent('');
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => setProposeBlockId(block.id)}
                    >
                      Предложить правку
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        {proposeMutation.isError && (
          <p className="text-sm text-red-400">Не удалось отправить предложение.</p>
        )}
      </div>
    </CommunityShell>
  );
}

export default function DocumentDetailPage() {
  const { communityId, documentId } = useCommunityDocumentParams();
  return (
    <AuthGate>
      <DocumentDetailInner
        communityId={communityId}
        documentId={documentId}
      />
    </AuthGate>
  );
}
