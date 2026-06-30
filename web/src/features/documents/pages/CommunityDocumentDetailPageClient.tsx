'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useUserQuota } from '@/hooks/api/useQuota';
import { getWalletBalance } from '@/lib/utils/wallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { useToastStore } from '@/shared/stores/toast.store';
import { DocumentStructureProvider } from '@/features/documents/context/DocumentStructureContext';
import { DocumentCanvasFocusProvider } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentSettingsDialog } from '@/features/documents/components/DocumentSettingsDialog';
import { DocumentCanvas } from '@/features/documents/components/DocumentCanvas';
import { DocumentCanvasHeader } from '@/features/documents/components/DocumentCanvasHeader';
import { DocumentCanvasBody } from '@/features/documents/components/DocumentCanvasBody';
import { DocumentCanvasRail } from '@/features/documents/components/DocumentCanvasRail';
import { DocumentCanvasFocusHint } from '@/features/documents/components/DocumentCanvasFocusHint';
import { DocumentCanvasMobileSheet } from '@/features/documents/components/DocumentCanvasMobileSheet';
import { DocumentBlockAdminDialogs } from '@/features/documents/components/DocumentBlockAdminDialogs';
import type { DocTranslate } from '@/features/documents/lib/document-canvas-shared';

export interface CommunityDocumentDetailPageClientProps {
  communityId: string;
  documentId: string;
}

export function CommunityDocumentDetailPageClient({
  communityId,
  documentId,
}: CommunityDocumentDetailPageClientProps) {
  const router = useRouter();
  const t = useTranslations('pages.documents');
  const addToast = useToastStore((s) => s.addToast);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id ?? '');
  const { data: community } = useCommunity(communityId);
  const { data: wallets = [] } = useWallets();
  const { data: quotaData } = useUserQuota(communityId);

  const docQuery = trpc.documents.getById.useQuery(
    { id: documentId },
    { enabled: Boolean(documentId && user?.id) },
  );

  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const walletBalance = getWalletBalance(wallets, communityId);
  const globalWalletBalance = getWalletBalance(wallets, GLOBAL_COMMUNITY_ID);

  const userRoleInCommunity =
    user?.globalRole === 'superadmin'
      ? 'superadmin'
      : (userRoles.find((r) => r.communityId === communityId)?.role ?? null);

  const canManageDocument =
    user?.globalRole === 'superadmin' ||
    (docQuery.data?.createdBy != null && docQuery.data.createdBy === user?.id) ||
    userRoleInCommunity === 'lead';

  const pageHeader = (
    <SimpleStickyHeader
      title={docQuery.data?.title ?? t('listTitle')}
      showBack
      onBack={() => router.push(routes.communityDocuments(communityId))}
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
    docMode: doc.mode,
    variantCost: doc.variantCost ?? 1,
    votingDurationHours: doc.votingDurationHours ?? 48,
    docAllowDownvotes: doc.allowDownvotes ?? true,
    canManageDocument,
    community: community ?? null,
    quotaRemaining,
    walletBalance,
    globalWalletBalance,
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
    >
      <div className="relative mx-auto w-full max-w-3xl p-4">
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
              <DocumentCanvas>
                <DocumentCanvasFocusHint />
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

                <DocumentCanvasBody
                  sections={doc.sections}
                  documentId={doc.id}
                  docMode={doc.mode}
                  variantCost={doc.variantCost ?? 1}
                  votingDurationHours={doc.votingDurationHours ?? 48}
                  docAllowDownvotes={doc.allowDownvotes ?? true}
                  canManageDocument={canManageDocument}
                  community={community ?? null}
                  quotaRemaining={quotaRemaining}
                  walletBalance={walletBalance}
                  globalWalletBalance={globalWalletBalance}
                  userId={user.id}
                  addToast={addToast}
                  t={t as DocTranslate}
                />
              </DocumentCanvas>

              <DocumentCanvasRail />
              <DocumentCanvasMobileSheet />
              <DocumentBlockAdminDialogs />
            </>
          </DocumentCanvasFocusProvider>
        </DocumentStructureProvider>
      </div>
    </AdaptiveLayout>
  );
}
