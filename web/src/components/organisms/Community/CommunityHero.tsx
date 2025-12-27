'use client';

import React, { useState, useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User, Pencil } from 'lucide-react';
import { Users, FileText, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { AvatarUploader } from '@/components/ui/AvatarUploader';
import { IconPicker } from '@/shared/components/iconpicker';
import { useUpdateCommunity } from '@/hooks/api/useCommunities';
import { useToastStore } from '@/shared/stores/toast.store';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';

interface CommunityHeroProps {
  community: {
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    settings?: {
      iconUrl?: string;
    };
  };
  stats?: {
    publications: number;
    members?: number;
    activity?: number;
  };
}

export function CommunityHero({ community, stats }: CommunityHeroProps) {
  const { name, description, avatarUrl } = community;
  const t = useTranslations('pages.communitySettings');
  const tCommon = useTranslations('common');
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isIconDialogOpen, setIsIconDialogOpen] = useState(false);
  const { mutateAsync: updateCommunity } = useUpdateCommunity();
  const addToast = useToastStore((state) => state.addToast);
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  // Check if user can edit (superadmin or lead)
  const canEdit = useMemo(() => {
    if (user?.globalRole === 'superadmin') return true;
    const role = userRoles.find(r => r.communityId === community.id);
    return role?.role === 'lead';
  }, [user?.globalRole, userRoles, community.id]);

  const handleAvatarUpload = async (url: string) => {
    try {
      await updateCommunity({
        id: community.id,
        data: {
          avatarUrl: url,
        },
      });
      addToast(t('saved') || 'Avatar updated', 'success');
      setIsAvatarDialogOpen(false);
    } catch (error) {
      console.error('Failed to update community avatar:', error);
      addToast(t('error') || 'Failed to update avatar', 'error');
    }
  };

  const handleIconChange = (iconUrl: string) => {
    // IconPicker calls setIcon immediately when emoji is clicked
    // We need to save it to the backend
    updateCommunity({
      id: community.id,
      data: {
        settings: {
          ...community.settings,
          iconUrl: iconUrl,
        },
      },
    })
      .then(() => {
        addToast(t('saved') || 'Icon updated', 'success');
        setIsIconDialogOpen(false);
      })
      .catch((error) => {
        console.error('Failed to update community icon:', error);
        addToast(t('error') || 'Failed to update icon', 'error');
      });
  };

  return (
    <div className="relative bg-base-100 rounded-2xl overflow-hidden border border-base-content/5">
      {/* Cover Section - reduced height */}
      <div className="relative h-20 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent" />

      {/* Community Content */}
      <div className="relative px-5 pb-5">
        {/* Avatar Section - positioned to overlap cover */}
        <div className="-mt-8 mb-3">
          <div className="relative inline-block">
            <Avatar className="w-14 h-14 text-base border-4 border-base-100 shadow-md bg-base-200">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={name} />
              )}
              <AvatarFallback communityId={community.id} className="font-medium uppercase">
                {name ? name.slice(0, 2).toUpperCase() : <User size={24} />}
              </AvatarFallback>
            </Avatar>
            {/* Edit icon overlay */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsAvatarDialogOpen(true)}
                className="absolute top-0 right-0 p-1.5 rounded-full bg-primary text-primary-content shadow-lg hover:bg-primary/90 transition-colors z-10"
                title={t('changeAvatar') || 'Change avatar'}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Community Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-base-content break-words">
              {name}
            </h1>
            {community.settings?.iconUrl && (
              <div className="relative inline-block">
                <img 
                  src={community.settings.iconUrl} 
                  alt="" 
                  className="w-5 h-5" 
                />
                {/* Edit icon overlay */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsIconDialogOpen(true)}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-primary text-primary-content shadow-lg hover:bg-primary/90 transition-colors z-10"
                    title={t('selectIcon') || 'Change icon'}
                  >
                    <Pencil size={10} />
                  </button>
                )}
              </div>
            )}
            {!community.settings?.iconUrl && canEdit && (
              <button
                type="button"
                onClick={() => setIsIconDialogOpen(true)}
                className="p-1 rounded-full bg-base-200 hover:bg-base-300 transition-colors"
                title={t('selectIcon') || 'Add icon'}
              >
                <Pencil size={12} className="text-base-content/60" />
              </button>
            )}
          </div>
          {description && (
            <p className="text-sm text-base-content/60 leading-relaxed break-words">
              {description}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="mt-5 pt-4 border-t border-base-content/5">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <FileText size={16} className="text-base-content/40 mx-auto mb-1" />
                <div className="text-lg font-semibold text-base-content">
                  {stats.publications}
                </div>
                <div className="text-xs text-base-content/50">
                  Publications
                </div>
              </div>
              {stats.members !== undefined && (
                <a
                  href={`/meriter/communities/${community.id}/members`}
                  className="text-center hover:bg-base-content/5 rounded-lg p-2 -m-2 transition-colors"
                >
                  <Users size={16} className="text-base-content/40 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-base-content">
                    {stats.members}
                  </div>
                  <div className="text-xs text-base-content/50">
                    Members
                  </div>
                </a>
              )}
              {stats.activity !== undefined ? (
                <div className="text-center">
                  <TrendingUp size={16} className="text-base-content/40 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-base-content">
                    {stats.activity}
                  </div>
                  <div className="text-xs text-base-content/50">
                    Activity
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <TrendingUp size={16} className="text-base-content/40 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-base-content/30">
                    —
                  </div>
                  <div className="text-xs text-base-content/50">
                    Activity
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Avatar Edit Dialog */}
      <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('changeAvatar') || 'Change avatar'}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <AvatarUploader
              value={avatarUrl}
              onUpload={handleAvatarUpload}
              size={120}
              labels={{
                upload: t('changeAvatar') || 'Change avatar',
                cropTitle: t('cropAvatar') || 'Crop avatar',
                cancel: tCommon('cancel') || 'Cancel',
                save: t('save') || 'Save',
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Icon Edit Dialog */}
      <Dialog open={isIconDialogOpen} onOpenChange={setIsIconDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('currencyIcon') || 'Currency Icon'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <IconPicker
              icon={community.settings?.iconUrl || ''}
              cta={t('selectIcon') || 'Select Icon'}
              setIcon={handleIconChange}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

