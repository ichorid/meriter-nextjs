'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';
import { useCommunity } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useUserQuota } from '@/hooks/api/useQuota';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { useToastStore } from '@/shared/stores/toast.store';
import { DocumentStructureProvider } from '@/features/documents/context/DocumentStructureContext';
import { DocumentCanvasFocusProvider } from '@/features/documents/context/DocumentCanvasFocusContext';
import {
  resolveCanManageCollaborativeDocument,
  resolveDocumentEditorAccess,
  resolveIsCommunityMember,
  resolveUserRoleInCommunity,
} from '@/features/documents/lib/document-editor-access';
import { DocumentSettingsDialog } from '@/features/documents/components/DocumentSettingsDialog';
import { DocumentCanvas } from '@/features/documents/components/DocumentCanvas';
import { DocumentCanvasHeader } from '@/features/documents/components/DocumentCanvasHeader';
import { DocumentUnifiedCanvas } from '@/features/documents/components/DocumentUnifiedCanvas';
import { DocumentGdocsUnifiedEditor } from '@/features/documents/components/DocumentGdocsUnifiedEditor';
import { DocumentProposalRail } from '@/features/documents/components/DocumentProposalRail';
import { DocumentMobileProposalsDock } from '@/features/documents/components/DocumentMobileProposalsDock';
import { DocumentCanvasMobileSheet } from '@/features/documents/components/DocumentCanvasMobileSheet';
import { DocumentBlockAdminDialogs } from '@/features/documents/components/DocumentBlockAdminDialogs';
import { DocumentTocSidebar } from '@/features/documents/components/DocumentTocSidebar';
import type { DocTranslate } from '@/features/documents/lib/document-canvas-shared';
import {
  documentLiveQueryOptions,
  useDocumentLiveSync,
} from '@/features/documents/hooks/useDocumentLiveSync';
import type { DocumentLiveEvent } from '@meriter/shared-types';

export interface CommunityDocumentDetailPageClientProps {
  communityId: string;
  documentId: string;
}

function readDeepLinkBlockId(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#block-')) return null;
  return hash.slice('#block-'.length) || null;
}

export function CommunityDocumentDetailPageClient({
  communityId,
  documentId,
}: CommunityDocumentDetailPageClientProps) {
  const router = useRouter();
  const [deepLinkBlockId] = useState<string | null>(readDeepLinkBlockId);
  const t = useTranslations('pages.documents');
  const addToast = useToastStore((s) => s.addToast);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [officialUpdateBanner, setOfficialUpdateBanner] = useState(false);
  const utils = trpc.useUtils();
  const { user, isLoading: authLoading } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id ?? '');
  const { data: community } = useCommunity(communityId);
  const { data: quotaData } = useUserQuota(communityId);
  const { data: votingWalletBalance = 0 } = useWalletBalance(communityId);
  const { data: globalWalletBalance = 0 } = useWalletBalance(GLOBAL_COMMUNITY_ID);

  const liveQueryOptions = documentLiveQueryOptions();

  const docQuery = trpc.documents.getById.useQuery(
    { id: documentId },
    {
      enabled: Boolean(documentId && user?.id),
      ...liveQueryOptions,
    },
  );

  const handleRemoteDocumentActivity = useCallback(
    (event: DocumentLiveEvent) => {
      if (event.type === 'variant.proposed') {
        addToast(t('gdocs.liveVariantProposed'), 'info');
        return;
      }
      if (event.type === 'vote.cast') {
        addToast(t('gdocs.liveVoteCast'), 'info');
        return;
      }
      if (event.type === 'document.updated' || event.type === 'variant.applied') {
        setOfficialUpdateBanner(true);
        return;
      }
      if (event.type === 'wave.closed') {
        addToast(t('gdocs.liveWaveClosed'), 'info');
        return;
      }
      if (event.type === 'block.locks_changed') {
        addToast(t('gdocs.liveLocksChanged'), 'info');
      }
    },
    [addToast, t],
  );

  const refreshOfficialDocument = useCallback(async () => {
    await utils.documents.getById.invalidate({ id: documentId });
    setOfficialUpdateBanner(false);
  }, [documentId, utils.documents.getById]);

  useDocumentLiveSync({
    documentId,
    enabled: Boolean(documentId && user?.id && docQuery.data),
    userId: user?.id,
    onRemoteActivity: handleRemoteDocumentActivity,
  });

  useEffect(() => {
    if (!docQuery.data?.sections) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (!hash.startsWith('#block-')) return;
    const blockId = hash.slice('#block-'.length);
    if (!blockId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`block-${blockId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [docQuery.data?.sections, docQuery.dataUpdatedAt]);

  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const walletBalance = typeof votingWalletBalance === 'number' ? votingWalletBalance : 0;
  const resolvedGlobalWalletBalance =
    typeof globalWalletBalance === 'number' ? globalWalletBalance : 0;

  const userRoleInCommunity = resolveUserRoleInCommunity({
    user,
    communityId,
    userRoles,
  });

  const canManageDocument = resolveCanManageCollaborativeDocument({
    user,
    community,
    docCreatedBy: docQuery.data?.createdBy,
    userRoleInCommunity,
  });

  const isCommunityMember = resolveIsCommunityMember({
    user,
    userRoleInCommunity,
  });

  const documentCreators =
    (community?.settings as { documentCreators?: 'admins' | 'members' } | undefined)
      ?.documentCreators ?? 'members';

  const { canUseGdocsEditor, canProposeDocumentVariants } = resolveDocumentEditorAccess({
    userId: user?.id,
    canManageDocument,
    isCommunityMember,
    documentCreators,
  });

  const pageHeader = (
    <SimpleStickyHeader
      title={docQuery.data?.title ?? t('listTitle')}
      showBack
      onBack={() => router.push(routes.community(communityId))}
      asStickyHeader
      showScrollToTop
    />
  );

  if (authLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <p className="p-4 text-sm text-base-content/70">{t('loginToParticipate')}</p>
      </AdaptiveLayout>
    );
  }

  if (docQuery.isLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (docQuery.error || !docQuery.data) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user.id}
        stickyHeader={pageHeader}
      >
        <p className="p-4 text-sm text-error">{t('detailError')}</p>
      </AdaptiveLayout>
    );
  }

  const doc = docQuery.data;

  if (doc.communityId !== communityId) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user.id}
        stickyHeader={pageHeader}
      >
        <p className="p-4 text-sm text-error">{t('wrongCommunity')}</p>
      </AdaptiveLayout>
    );
  }

  const focusProps = {
    documentId: doc.id,
    sections: doc.sections,
    initialFocusedBlockId: deepLinkBlockId,
    docMode: doc.mode,
    variantCost: doc.variantCost ?? 1,
    votingDurationHours: doc.votingDurationHours ?? 48,
    docAllowDownvotes: doc.allowDownvotes ?? true,
    canManageDocument,
    canProposeDocumentVariants,
    community: community ?? null,
    quotaRemaining,
    walletBalance,
    globalWalletBalance: resolvedGlobalWalletBalance,
    userId: user.id,
    addToast,
    t: t as DocTranslate,
  };

  return (
    <AdaptiveLayout
      className="feed"
      communityId={communityId}
      myId={user.id}
      stickyHeader={pageHeader}
      leftSidebarOverride={
        <DocumentTocSidebar
          communityId={communityId}
          documentId={doc.id}
          documentTitle={doc.title ?? t('listTitle')}
          sections={doc.sections}
        />
      }
    >
      <div className="relative w-full" data-document-page>
        {canManageDocument ? (
          <DocumentSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            document={{
              id: doc.id,
              type: doc.type,
              title: doc.title,
              mode: doc.mode,
              votingDurationHours: doc.votingDurationHours ?? 48,
              variantCost: doc.variantCost ?? 1,
              allowDownvotes: doc.allowDownvotes ?? true,
            }}
            onSaved={() => addToast(t('settings.saved'), 'success')}
            onError={(message) => addToast(message, 'error')}
          />
        ) : null}

        <DocumentStructureProvider
          documentId={doc.id}
          documentUpdatedAt={doc.updatedAt}
          sections={doc.sections}
          canManageDocument={canManageDocument}
          showStructureToolbar={false}
          addToast={addToast}
        >
          <DocumentCanvasFocusProvider {...focusProps}>
            <>
              {officialUpdateBanner ? (
                <div
                  role="status"
                  className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-base-content"
                >
                  <span>{t('gdocs.officialUpdateBanner')}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 rounded-lg text-xs"
                      onClick={() => void refreshOfficialDocument()}
                    >
                      <RefreshCw size={14} />
                      {t('gdocs.officialUpdateRefresh')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg p-0"
                      aria-label={t('gdocs.officialUpdateDismiss')}
                      onClick={() => setOfficialUpdateBanner(false)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="grid w-full grid-cols-1 gap-4 pb-20 max-lg:pb-24 lg:grid-cols-[minmax(0,1fr)_min(280px,32%)] lg:items-start lg:pb-0">
                <DocumentCanvas fullWidth>
                  <DocumentCanvasHeader
                    title={doc.title}
                    docType={doc.type}
                    mode={doc.mode}
                    votingDurationHours={doc.votingDurationHours ?? 48}
                    variantCost={doc.variantCost ?? 1}
                    updatedAt={doc.updatedAt}
                    canManageDocument={canManageDocument}
                    onOpenSettings={() => setSettingsOpen(true)}
                  />

                  {canUseGdocsEditor || canProposeDocumentVariants ? (
                    <DocumentGdocsUnifiedEditor
                      documentId={doc.id}
                      sections={doc.sections}
                      updatedAt={doc.updatedAt}
                      canManageDocument={canManageDocument}
                    />
                  ) : (
                    <DocumentUnifiedCanvas
                      sections={doc.sections}
                      documentId={doc.id}
                      readOnly
                    />
                  )}
                </DocumentCanvas>

                <DocumentProposalRail
                  sections={doc.sections}
                  className="hidden lg:flex lg:min-h-0 lg:w-full lg:max-w-[320px] lg:justify-self-end"
                />
              </div>

              <DocumentMobileProposalsDock sections={doc.sections} />
              <DocumentCanvasMobileSheet />
              <DocumentBlockAdminDialogs />
            </>
          </DocumentCanvasFocusProvider>
        </DocumentStructureProvider>
      </div>
    </AdaptiveLayout>
  );
}
