// Publication header component
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Trash2 } from 'lucide-react';
import { Avatar, Badge } from '@/components/atoms';
import { Badge as BrandBadge } from '@/components/ui/Badge';
import { BrandButton } from '@/components/ui/BrandButton';
import { dateVerbose } from '@shared/lib/date';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { useDeletePublication } from '@/hooks/api/usePublications';
import { useDeletePoll } from '@/hooks/api/usePolls';
import { DeleteConfirmationModal } from '@/components/organisms/DeleteConfirmationModal/DeleteConfirmationModal';
import { useToastStore } from '@/shared/stores/toast.store';
import { ResourcePermissions } from '@/types/api-v1';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('shared');
  
  const deletePublication = useDeletePublication();
  const deletePoll = useDeletePoll();
  const addToast = useToastStore((state) => state.addToast);

  const author = {
    name: publication.meta?.author?.name || 'Unknown',
    photoUrl: publication.meta?.author?.photoUrl,
    username: publication.meta?.author?.username,
    id: authorId,
  };

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
        await deletePublication.mutateAsync({ id: publicationId!, communityId });
      }
      setShowDeleteModal(false);
      addToast(isPoll ? 'Poll deleted successfully' : 'Post deleted successfully', 'success');
      // Navigate away after deletion
      if (communityId) {
        router.push(`/meriter/communities/${communityId}`);
        // Scroll to top after navigation completes
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      } else {
        router.push(routes.profile);
      }
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
          src={author.photoUrl} 
          alt={author.name} 
          size="md" 
          onClick={author.id ? handleAvatarClick : undefined}
        />
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
        {showEditButton && (
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            disabled={editButtonDisabled}
            className={`p-1.5 h-auto min-h-0 ${editButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={editButtonDisabled && publication.permissions?.editDisabledReason 
              ? t(publication.permissions.editDisabledReason) 
              : 'Edit'}
          >
            <Edit size={16} />
          </BrandButton>
        )}
        {showDeleteButton && (
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (!deleteButtonDisabled) {
                setShowDeleteModal(true);
              }
            }}
            disabled={deleteButtonDisabled}
            className={`p-1.5 h-auto min-h-0 text-error hover:text-error ${deleteButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={deleteButtonDisabled && publication.permissions?.deleteDisabledReason 
              ? t(publication.permissions.deleteDisabledReason) 
              : 'Delete'}
          >
            <Trash2 size={16} />
          </BrandButton>
        )}
        {(publication as any).postType === 'project' || (publication as any).isProject ? (
          <BrandBadge variant="warning" size="sm">
            PROJECT
          </BrandBadge>
        ) : null}
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
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemType={isPoll ? 'poll' : 'post'}
        isLoading={isPoll ? deletePoll.isPending : deletePublication.isPending}
      />
    </div>
  );
};
