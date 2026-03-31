// Publication header component
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, Trash2, ArrowRight, Eye, Send, Lock } from 'lucide-react';
import { Badge } from '@/components/atoms';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { dateVerbose } from '@shared/lib/date';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { useDeletePublication, usePermanentDeletePublication } from '@/hooks/api/usePublications';
import { useDeletePoll } from '@/hooks/api/usePolls';
import { DeleteConfirmationModal } from '@/components/organisms/DeleteConfirmationModal/DeleteConfirmationModal';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { ResourcePermissions } from '@/types/api-v1';
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { ForwardPopup } from './ForwardPopup';
import { ReviewForwardPopup } from './ReviewForwardPopup';
import { PublicationDetailsPopup } from '@/shared/components/publication-details-popup';
import { trpc } from '@/lib/trpc/client';
import { ClosePostDialog } from './ClosePostDialog';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  metrics?: {
    score?: number;
    commentCount?: number;
  };
  meta?: {
    commentTgEntities?: any[];
    comment?: string;
    author?: {
      id?: string;
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    publishedBy?: {
      id?: string;
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      name?: string;
      photoUrl?: string;
      username?: string;
    };
    origin?: {
      telegramChatName?: string;
    };
    hashtagName?: string;
  };
  permissions?: ResourcePermissions;
  deleted?: boolean;
  deletedAt?: string;
  authorKind?: 'user' | 'community';
  authoredCommunityId?: string;
  publishedByUserId?: string;
  editHistory?: Array<{
    editedBy: string;
    editedAt: string;
    editor?: {
      id: string;
      name?: string;
      photoUrl?: string;
    };
  }>;
  [key: string]: unknown;
}

interface PublicationHeaderProps {
  publication: Publication;
  showCommunityAvatar?: boolean;
  className?: string;
  authorId?: string;
  metrics?: {
    upvotes?: number;
    downvotes?: number;
    totalCasts?: number;
    commentCount?: number;
  };
  publicationId?: string;
  communityId?: string;
  isPoll?: boolean;
  /** When set with meta.beneficiary, beneficiary name links to profile */
  beneficiaryId?: string;
  /** Ticket post detail: toolbar only (type/author live in page hero). */
  ticketToolbarOnly?: boolean;
}

export const PublicationHeader: React.FC<PublicationHeaderProps> = ({
  publication,
  showCommunityAvatar = false,
  className = '',
  authorId,
  metrics,
  publicationId,
  communityId,
  isPoll = false,
  beneficiaryId: beneficiaryIdProp,
  ticketToolbarOnly = false,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  const [showClosePostDialog, setShowClosePostDialog] = useState(false);
  const t = useTranslations('shared');
  const tPub = useTranslations('publications');
  const tProjects = useTranslations('projects');
  
  const deletePublication = useDeletePublication();
  const permanentDeletePublication = usePermanentDeletePublication();
  const deletePoll = useDeletePoll();
  const addToast = useToastStore((state) => state.addToast);
  
  // Check if publication is already deleted (on deleted posts page)
  const isAlreadyDeleted = publication.deleted === true;

  // Get community and user role for forward button
  const { data: community } = useCommunity(communityId || '');
  const authorKind = (publication as { authorKind?: 'user' | 'community' }).authorKind;
  const authoredCommunityId = (publication as { authoredCommunityId?: string })
    .authoredCommunityId;
  const isCommunityAuthor =
    authorKind === 'community' && Boolean(authoredCommunityId);
  const { data: authoredCommunity } = useCommunity(
    isCommunityAuthor && authoredCommunityId ? authoredCommunityId : '',
  );
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  const effectivePublicationId = publicationId || publication.id;
  const { data: publicationDetails } = trpc.publications.getById.useQuery(
    { id: effectivePublicationId },
    {
      enabled: showDetailsPopup && !!effectivePublicationId,
      staleTime: 0,
    },
  );
  const { data: publicationForDelete } = trpc.publications.getById.useQuery(
    { id: effectivePublicationId },
    {
      enabled: showDeleteModal && !!effectivePublicationId,
      staleTime: 0,
    },
  );
  const { data: publicationForClose } = trpc.publications.getById.useQuery(
    { id: effectivePublicationId },
    {
      enabled: showClosePostDialog && !!effectivePublicationId,
      staleTime: 0,
    },
  );
  const hasInvestments = (publicationForDelete?.investments?.length ?? 0) > 0;
  const investmentPool = publicationForDelete?.investmentPool ?? 0;
  const investorSharePercent = publicationForDelete?.investorSharePercent ?? 0;
  const currentScore = publicationForDelete?.metrics?.score ?? 0;
  
  // Check if user is a lead
  const isLead = useMemo(() => {
    if (!communityId || !user?.id) return false;
    if (user.globalRole === 'superadmin') return true;
    const role = userRoles.find((r) => r.communityId === communityId);
    return role?.role === 'lead';
  }, [communityId, user?.id, user?.globalRole, userRoles]);

  // Check if post is forwardable (admin/superadmin only, not poll, not already forwarded)
  const canForward = useMemo(() => {
    if (!communityId || !community) return false;
    // Only admins (leads) and superadmins can forward
    if (!isLead) return false;
    const postType = (publication as any).postType || 'basic';
    if (postType === 'poll') return false;
    const forwardStatus = (publication as any).forwardStatus;
    if (forwardStatus === 'forwarded') return false;
    return true;
  }, [communityId, community, publication, isLead]);

  // Check if post is pending forward approval
  const isPendingForward = useMemo(() => {
    return (publication as any).forwardStatus === 'pending';
  }, [publication]);

  const metaAuthor = publication.meta?.author;
  const metaPublishedBy = publication.meta?.publishedBy;

  const displayAuthor = useMemo(() => {
    if (isCommunityAuthor && authoredCommunityId) {
      return {
        kind: 'community' as const,
        id: authoredCommunityId,
        name:
          authoredCommunity?.name ??
          metaAuthor?.name ??
          'Community',
        photoUrl:
          authoredCommunity?.avatarUrl ?? metaAuthor?.photoUrl,
      };
    }
    return {
      kind: 'user' as const,
      id: authorId ?? '',
      name: metaAuthor?.name || 'Unknown',
      photoUrl: metaAuthor?.photoUrl,
      username: metaAuthor?.username,
    };
  }, [
    isCommunityAuthor,
    authoredCommunityId,
    authoredCommunity?.name,
    authoredCommunity?.avatarUrl,
    metaAuthor?.name,
    metaAuthor?.photoUrl,
    metaAuthor?.username,
    authorId,
  ]);

  const publisherSubline = useMemo(() => {
    if (!isCommunityAuthor) return null;
    if (metaPublishedBy?.id) {
      return {
        id: metaPublishedBy.id,
        username: metaPublishedBy.username,
        name: metaPublishedBy.name,
      };
    }
    if (authorId) {
      return {
        id: authorId,
        username: undefined as string | undefined,
        name: undefined as string | undefined,
      };
    }
    return null;
  }, [isCommunityAuthor, metaPublishedBy, authorId]);

  const beneficiary = publication.meta?.beneficiary
    ? {
        name: publication.meta.beneficiary.name,
        photoUrl: publication.meta.beneficiary.photoUrl,
        username: publication.meta.beneficiary.username,
        id:
          beneficiaryIdProp ??
          (publication.meta.beneficiary as { id?: string }).id,
      }
    : null;

  const beneficiaryLineHint = tPub('beneficiaryLineHint');

  // Use API permissions instead of calculating on frontend
  const canEdit = publication.permissions?.canEdit ?? false;
  const canDelete = publication.permissions?.canDelete ?? false;
  
  // Determine if edit/delete is enabled (not disabled by reason)
  // If canEdit/canDelete is true, it's enabled. If false, check if there's a disabled reason
  const canEditEnabled = canEdit && !publication.permissions?.editDisabledReason;
  const canDeleteEnabled = canDelete && !publication.permissions?.deleteDisabledReason;
  
  // Human publisher id (DB authorId is the lead user for community-authored posts)
  const isAuthor =
    Boolean(authorId && currentUserId && authorId === currentUserId);
  
  // Show edit button if user can edit, disable if canEdit but not canEditEnabled
  const showEditButton = canEdit && publicationId && communityId;
  const editButtonDisabled = !!(canEdit && !canEditEnabled);
  
  // Show delete button if user can delete, disable if canDelete but not canDeleteEnabled
  const showDeleteButton = canDelete && publicationId && communityId;
  const deleteButtonDisabled = !!(canDelete && !canDeleteEnabled);

  // D-9: Close post — author only, active posts only, not polls
  const publicationStatus = (publication as { status?: string }).status ?? 'active';
  const showClosePostButton =
    isAuthor &&
    publicationId &&
    !isPoll &&
    publicationStatus === 'active';

  const closeReasonLabel = useMemo(() => {
    const reason = (publication as { closeReason?: string }).closeReason;
    if (!reason) return '';
    const labels: Record<string, string> = {
      manual: 'By author',
      ttl: 'TTL expired',
      inactive: 'Inactive',
      negative_rating: 'Negative rating',
    };
    return labels[reason] ?? reason;
  }, [(publication as { closeReason?: string }).closeReason]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPoll) {
      router.push(`/meriter/communities/${communityId}/edit-poll/${publicationId}`);
    } else {
      router.push(`/meriter/communities/${communityId}/edit/${publicationId}`);
    }
  };
  
  const handleDelete = async () => {
    try {
      if (isPoll) {
        await deletePoll.mutateAsync({ id: publicationId! });
        addToast(t('pollDeleted', { defaultValue: 'Poll deleted' }), 'success');
      } else {
        // If publication is already deleted, use permanent delete
        if (isAlreadyDeleted) {
          await permanentDeletePublication.mutateAsync({ id: publicationId! });
          addToast(t('postPermanentlyDeleted'), 'success');
          // Stay on deleted posts page after permanent deletion
          // The publication will disappear from the list via cache invalidation
        } else {
          await deletePublication.mutateAsync({ id: publicationId!, communityId });
          addToast(t('postMovedToDeleted'), 'success');
          // Navigate away after soft deletion
          if (communityId) {
            router.push(`/meriter/communities/${communityId}`);
            // Scroll to top after navigation completes
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
          } else {
            router.push(routes.profile);
          }
        }
      }
      setShowDeleteModal(false);
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : undefined;
      addToast(
        raw?.trim() ? resolveApiErrorToastMessage(raw) : t('failedToDelete'),
        'error',
      );
    }
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayAuthor.id) return;
    if (displayAuthor.kind === 'community') {
      router.push(routes.community(displayAuthor.id));
      return;
    }
    router.push(routes.userProfile(displayAuthor.id));
  };

  const primaryProfileHref =
    displayAuthor.kind === 'community'
      ? routes.community(displayAuthor.id)
      : displayAuthor.id
        ? routes.userProfile(displayAuthor.id)
        : undefined;

  const isTicketPost = (publication as { postType?: string }).postType === 'ticket';
  const showTicketTypeBadge = isTicketPost && !ticketToolbarOnly;

  return (
    <div
      className={`flex gap-3 ${ticketToolbarOnly ? 'flex-col items-stretch' : 'items-start justify-between'} ${className}`}
    >
      {/* Author Info */}
      {!ticketToolbarOnly ? (
      <div className="flex items-center gap-3 min-w-0">
        <Avatar 
          className="w-12 h-12 cursor-pointer"
          onClick={displayAuthor.id ? handleAvatarClick : undefined}
        >
          <AvatarImage src={displayAuthor.photoUrl} alt={displayAuthor.name} />
          <AvatarFallback userId={displayAuthor.id} className="font-medium text-sm">
            {displayAuthor.name ? displayAuthor.name.charAt(0).toUpperCase() : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {beneficiary ? (
            <div
              className="flex items-center gap-2 flex-wrap cursor-help"
              title={beneficiaryLineHint}
            >
              {primaryProfileHref ? (
                <Link
                  href={primaryProfileHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-sm text-base-content truncate max-w-[11rem] hover:underline shrink min-w-0"
                >
                  {displayAuthor.name}
                </Link>
              ) : (
                <span className="font-medium text-sm text-base-content truncate max-w-[11rem] min-w-0">
                  {displayAuthor.name}
                </span>
              )}
              <span className="text-xs text-base-content/30 shrink-0" aria-hidden>
                →
              </span>
              {beneficiary.id ? (
                <Link
                  href={routes.userProfile(beneficiary.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-sm text-base-content/70 truncate max-w-[11rem] hover:underline shrink min-w-0"
                >
                  {beneficiary.name}
                </Link>
              ) : (
                <span className="font-medium text-sm text-base-content/70 truncate max-w-[11rem] min-w-0">
                  {beneficiary.name}
                </span>
              )}
            </div>
          ) : primaryProfileHref ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={primaryProfileHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-sm text-base-content truncate hover:underline"
              >
                {displayAuthor.name}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-base-content truncate">
                {displayAuthor.name}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {isCommunityAuthor && publisherSubline?.id ? (
              <Link
                href={routes.userProfile(publisherSubline.id)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-base-content/40 hover:underline shrink-0"
              >
                {publisherSubline.username
                  ? `@${publisherSubline.username}`
                  : (publisherSubline.name ?? publisherSubline.id)}
              </Link>
            ) : displayAuthor.kind === 'user' && displayAuthor.username ? (
              <span className="text-xs text-base-content/40">
                @{displayAuthor.username}
              </span>
            ) : null}
            <span className="text-xs text-base-content/30">·</span>
            <span className="text-xs text-base-content/40">
              {dateVerbose(new Date(publication.createdAt))}
            </span>
          </div>
        </div>
      </div>
      ) : null}
      
      {/* Tags & Badges & Action Buttons */}
      <div
        className={`flex items-center gap-1.5 flex-shrink-0 ${ticketToolbarOnly ? 'w-full flex-wrap justify-end' : ''}`}
      >
        {showEditButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            disabled={editButtonDisabled}
            className={`rounded-xl active:scale-[0.98] p-1.5 h-auto min-h-0 ${editButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={editButtonDisabled && publication.permissions?.editDisabledReason 
              ? t(publication.permissions.editDisabledReason) 
              : t('headerTooltips.edit')}
          >
            <Edit size={16} />
          </Button>
        )}
        {showDeleteButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (!deleteButtonDisabled) {
                setShowDeleteModal(true);
              }
            }}
            disabled={deleteButtonDisabled}
            className={`rounded-xl active:scale-[0.98] p-1.5 h-auto min-h-0 text-error hover:text-error ${deleteButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={deleteButtonDisabled && publication.permissions?.deleteDisabledReason 
              ? t(publication.permissions.deleteDisabledReason) 
              : isAlreadyDeleted 
                ? t('headerTooltips.deletePermanent') 
                : t('headerTooltips.delete')}
          >
            <Trash2 size={16} />
          </Button>
        )}
        {showClosePostButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowClosePostDialog(true);
            }}
            className="rounded-xl active:scale-[0.98] p-1.5 h-auto min-h-0"
            title={t('headerTooltips.closePost')}
          >
            <Lock size={16} />
          </Button>
        )}
        {canForward && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (isLead && isPendingForward) {
                setShowReviewPopup(true);
              } else {
                setShowForwardPopup(true);
              }
            }}
            className="rounded-xl active:scale-[0.98] p-1.5 h-auto min-h-0"
            title={isLead && isPendingForward ? t('headerTooltips.reviewForward') : t('headerTooltips.forwardPost')}
          >
            {isLead && isPendingForward ? <Eye size={16} /> : <Send size={16} />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setShowDetailsPopup(true);
          }}
          className="rounded-xl active:scale-[0.98] p-1.5 h-auto min-h-0 opacity-60 hover:opacity-100"
          title={t('headerTooltips.viewDetails')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
        {publicationStatus === 'closed' && closeReasonLabel ? (
          <Badge variant="secondary" size="sm">
            Closed · {closeReasonLabel}
          </Badge>
        ) : null}
        {showTicketTypeBadge ? (
          <Badge variant="warning" size="sm">
            {tProjects('postTypeBadgeTicket')}
          </Badge>
        ) : (publication as any).postType === 'project' ||
          ((publication as any).isProject && (publication as any).postType !== 'ticket') ? (
          <Badge variant="warning" size="sm">
            {tProjects('postTypeBadgeProject')}
          </Badge>
        ) : null}
        {(publication as any).forwardStatus === 'pending' && (
          <Badge variant="info" size="sm">
            PENDING FORWARD
          </Badge>
        )}
        {(publication as any).forwardStatus === 'forwarded' && (publication as any).forwardTargetCommunityId && (
          <Badge variant="success" size="sm">
            FORWARDED
          </Badge>
        )}
        {publication.meta?.hashtagName && (
          <Badge variant="primary" size="sm">
            #{publication.meta?.hashtagName}
          </Badge>
        )}
        {showCommunityAvatar && publication.meta?.origin?.telegramChatName && (
          <Badge variant="info" size="sm">
            {publication.meta?.origin?.telegramChatName}
          </Badge>
        )}
      </div>
      
      {/* Forward Popup */}
      {showForwardPopup && publicationId && communityId && (
        <ForwardPopup
          publicationId={publicationId}
          communityId={communityId}
          isLead={isLead}
          onClose={() => setShowForwardPopup(false)}
        />
      )}

      {/* Review Forward Popup */}
      {showReviewPopup && publicationId && (publication as any).forwardProposedBy && (publication as any).forwardTargetCommunityId && (
        <ReviewForwardPopup
          publicationId={publicationId}
          proposedBy={(publication as any).forwardProposedBy}
          targetCommunityId={(publication as any).forwardTargetCommunityId}
          onClose={() => setShowReviewPopup(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemType={isPoll ? 'poll' : 'post'}
        isLoading={isPoll ? deletePoll.isPending : (isAlreadyDeleted ? permanentDeletePublication.isPending : deletePublication.isPending)}
        title={
          isAlreadyDeleted ? t('deleteConfirmation.permanentTitle', { defaultValue: 'Permanently Delete Post' }) :
          hasInvestments ? t('deleteConfirmation.investmentTitle', { defaultValue: 'Delete post with investments' }) : undefined
        }
        message={
          isAlreadyDeleted ? t('deleteConfirmation.permanentMessage', { defaultValue: 'This will permanently delete this post and cannot be undone. Are you sure?' }) :
          hasInvestments
            ? t('deleteConfirmation.investmentMessage', {
                defaultValue: 'Unspent investment pool ({pool} merits) will be returned to investors. Remaining rating ({rating} merits) will be distributed: {percent}% to investors, rest to you. Are you sure you want to delete?',
                pool: investmentPool,
                rating: currentScore,
                percent: investorSharePercent,
              })
            : undefined
        }
      />

      {/* D-9: Close post dialog */}
      {showClosePostDialog && publicationId && publicationForClose && (
        <ClosePostDialog
          open={showClosePostDialog}
          onOpenChange={setShowClosePostDialog}
          publicationId={publicationId}
          currentScore={publicationForClose.metrics?.score ?? 0}
          hasInvestments={(publicationForClose.investments?.length ?? 0) > 0}
          investmentPool={publicationForClose.investmentPool ?? 0}
          investorSharePercent={publicationForClose.investorSharePercent ?? 0}
          investments={(publicationForClose.investments ?? []).map((inv: { investorId: string; amount: number }) => ({
            investorId: inv.investorId,
            amount: inv.amount,
          }))}
          distributeAllByContractOnClose={community?.settings?.distributeAllByContractOnClose ?? true}
        />
      )}

      {/* Publication Details Popup */}
      <PublicationDetailsPopup
        isOpen={showDetailsPopup}
        onClose={() => setShowDetailsPopup(false)}
        authorName={
          publicationDetails?.meta?.author?.name ?? displayAuthor.name
        }
        authorId={
          (publicationDetails?.meta?.author as { id?: string } | undefined)?.id ??
          displayAuthor.id
        }
        authorAvatar={
          publicationDetails?.meta?.author?.photoUrl ?? displayAuthor.photoUrl
        }
        communityName={community?.name}
        communityId={communityId}
        communityAvatar={community?.avatarUrl}
        beneficiaryName={publicationDetails?.meta?.beneficiary?.name ?? beneficiary?.name}
        beneficiaryId={publicationDetails?.beneficiaryId}
        beneficiaryAvatar={publicationDetails?.meta?.beneficiary?.photoUrl ?? beneficiary?.photoUrl}
        createdAt={publicationDetails?.createdAt ?? publication.createdAt}
        editHistory={publicationDetails?.editHistory ?? (publication as any).editHistory}
      />
    </div>
  );
};
