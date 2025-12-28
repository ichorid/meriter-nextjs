// Publication header component
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, ArrowRight, Eye } from 'lucide-react';
import { Badge, FavoriteStar } from '@/components/atoms';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { dateVerbose } from '@shared/lib/date';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { useDeletePublication, usePermanentDeletePublication } from '@/hooks/api/usePublications';
import { useDeletePoll } from '@/hooks/api/usePolls';
import { DeleteConfirmationModal } from '@/components/organisms/DeleteConfirmationModal/DeleteConfirmationModal';
import { useToastStore } from '@/shared/stores/toast.store';
import { ResourcePermissions } from '@/types/api-v1';
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { ForwardPopup } from './ForwardPopup';
import { ReviewForwardPopup } from './ReviewForwardPopup';
import { PublicationDetailsPopup } from '@/shared/components/publication-details-popup';
import { trpc } from '@/lib/trpc/client';

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
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  const t = useTranslations('shared');
  
  const deletePublication = useDeletePublication();
  const permanentDeletePublication = usePermanentDeletePublication();
  const deletePoll = useDeletePoll();
  const addToast = useToastStore((state) => state.addToast);
  
  // Check if publication is already deleted (on deleted posts page)
  const isAlreadyDeleted = publication.deleted === true;

  // Get community and user role for forward button
  const { data: community } = useCommunity(communityId || '');
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  const effectivePublicationId = publicationId || publication.id;
  const { data: publicationDetails } = trpc.publications.getById.useQuery(
    { id: effectivePublicationId },
    {
      enabled: showDetailsPopup && !!effectivePublicationId,
      staleTime: 0,
    },
  );
  
  // Check if user is a lead
  const isLead = useMemo(() => {
    if (!communityId || !user?.id) return false;
    if (user.globalRole === 'superadmin') return true;
    const role = userRoles.find((r) => r.communityId === communityId);
    return role?.role === 'lead';
  }, [communityId, user?.id, user?.globalRole, userRoles]);

  // Check if post is forwardable (team group, not poll, not already forwarded)
  const canForward = useMemo(() => {
    if (!communityId || !community) return false;
    if (community.typeTag !== 'team') return false;
    const postType = (publication as any).postType || 'basic';
    if (postType === 'poll') return false;
    const forwardStatus = (publication as any).forwardStatus;
    if (forwardStatus === 'forwarded') return false;
    return true;
  }, [communityId, community, publication]);

  // Check if post is pending forward approval
  const isPendingForward = useMemo(() => {
    return (publication as any).forwardStatus === 'pending';
  }, [publication]);

  const author = useMemo(() => ({
    name: publication.meta?.author?.name || 'Unknown',
    photoUrl: publication.meta?.author?.photoUrl,
    username: publication.meta?.author?.username,
    id: authorId,
  }), [publication.meta?.author?.name, publication.meta?.author?.photoUrl, publication.meta?.author?.username, authorId]);

  const beneficiary = publication.meta?.beneficiary ? {
    name: publication.meta.beneficiary.name,
    photoUrl: publication.meta.beneficiary.photoUrl,
    username: publication.meta.beneficiary.username,
  } : null;

  // Use API permissions instead of calculating on frontend
  const canEdit = publication.permissions?.canEdit ?? false;
  const canDelete = publication.permissions?.canDelete ?? false;
  
  // Determine if edit/delete is enabled (not disabled by reason)
  // If canEdit/canDelete is true, it's enabled. If false, check if there's a disabled reason
  const canEditEnabled = canEdit && !publication.permissions?.editDisabledReason;
  const canDeleteEnabled = canDelete && !publication.permissions?.deleteDisabledReason;
  
  // Check if current user is the author (for navigation purposes)
  const isAuthor = author.id && currentUserId && author.id === currentUserId;
  
  // Show edit button if user can edit, disable if canEdit but not canEditEnabled
  const showEditButton = canEdit && publicationId && communityId;
  const editButtonDisabled = !!(canEdit && !canEditEnabled);
  
  // Show delete button if user can delete, disable if canDelete but not canDeleteEnabled
  const showDeleteButton = canDelete && publicationId && communityId;
  const deleteButtonDisabled = !!(canDelete && !canDeleteEnabled);

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
        await deletePoll.mutateAsync(publicationId!);
      } else {
        // If publication is already deleted, use permanent delete
        if (isAlreadyDeleted) {
          await permanentDeletePublication.mutateAsync({ id: publicationId! });
          addToast('Post permanently deleted', 'success');
          // Stay on deleted posts page after permanent deletion
          // The publication will disappear from the list via cache invalidation
        } else {
          await deletePublication.mutateAsync({ id: publicationId!, communityId });
          addToast('Post moved to deleted', 'success');
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
    } catch (error: any) {
      addToast(error?.message || 'Failed to delete', 'error');
    }
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (author.id) {
      router.push(routes.userProfile(author.id));
    }
  };

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      {/* Author Info */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar 
          className="w-12 h-12 cursor-pointer"
          onClick={author.id ? handleAvatarClick : undefined}
        >
          <AvatarImage src={author.photoUrl} alt={author.name} />
          <AvatarFallback userId={author.id} className="font-medium text-sm">
            {author.name ? author.name.charAt(0).toUpperCase() : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-base-content truncate">{author.name}</span>
            {beneficiary && (
              <>
                <span className="text-xs text-base-content/30">→</span>
                <span className="font-medium text-sm text-base-content/70 truncate">{beneficiary.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {author.username && (
              <span className="text-xs text-base-content/40">@{author.username}</span>
            )}
            <span className="text-xs text-base-content/30">·</span>
            <span className="text-xs text-base-content/40">
              {dateVerbose(new Date(publication.createdAt))}
            </span>
          </div>
        </div>
      </div>
      
      {/* Tags & Badges & Action Buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Favorites */}
        {(publicationId || publication.id) && (
          <FavoriteStar
            targetType={
              isPoll
                ? 'poll'
                : (publication as any).postType === 'project' || (publication as any).isProject
                  ? 'project'
                  : 'publication'
            }
            targetId={(publicationId || publication.id) as string}
          />
        )}
        {showEditButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            disabled={editButtonDisabled}
            className={`rounded-xl active:scale-[0.98] p-1.5 h-auto min-h-0 ${editButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={editButtonDisabled && publication.permissions?.editDisabledReason 
              ? t(publication.permissions.editDisabledReason) 
              : 'Edit'}
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
                ? 'Permanently Delete' 
                : 'Delete'}
          >
            <Trash2 size={16} />
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
            title={isLead && isPendingForward ? 'Review forward proposal' : 'Forward post'}
          >
            {isLead && isPendingForward ? <Eye size={16} /> : <ArrowRight size={16} />}
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
          title="View details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
        {(publication as any).postType === 'project' || (publication as any).isProject ? (
          <Badge variant="warning" size="sm">
            PROJECT
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
        title={isAlreadyDeleted ? 'Permanently Delete Post' : undefined}
        message={isAlreadyDeleted ? 'This will permanently delete this post and cannot be undone. Are you sure?' : undefined}
      />

      {/* Publication Details Popup */}
      <PublicationDetailsPopup
        isOpen={showDetailsPopup}
        onClose={() => setShowDetailsPopup(false)}
        authorName={publicationDetails?.meta?.author?.name ?? author.name}
        authorId={publicationDetails?.authorId ?? author.id}
        authorAvatar={publicationDetails?.meta?.author?.photoUrl ?? author.photoUrl}
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
