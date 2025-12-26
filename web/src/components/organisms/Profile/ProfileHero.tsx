'use client';

import React, { useState, memo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, Edit, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/atoms/Badge/Badge';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { AvatarUploader } from '@/components/ui/AvatarUploader';
import { useUpdateUser } from '@/hooks/api/useProfile';
import { useToastStore } from '@/shared/stores/toast.store';

import type { User } from '@/types/api-v1';

interface ProfileHeroProps {
  user: User | null | undefined;
  stats?: {
    merits: number;
  };
  onEdit?: () => void;
  showEdit?: boolean;
  userRoles?: Array<{ role: string }>;
}

function ProfileHeroComponent({ user, stats: _stats, onEdit, showEdit = false, userRoles = [] }: ProfileHeroProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const { mutateAsync: updateUser } = useUpdateUser();
  const addToast = useToastStore((state) => state.addToast);
  
  // Determine role type for display (same logic as VerticalSidebar)
  const userRoleDisplay = React.useMemo(() => {
    // Check global superadmin role first
    if (user?.globalRole === 'superadmin') {
      return { role: 'superadmin', label: tCommon('superadmin'), variant: 'error' as const };
    }
    
    // Check community roles (lead > participant > viewer)
    const hasLead = userRoles.some(r => r.role === 'lead');
    const hasParticipant = userRoles.some(r => r.role === 'participant');
    const hasViewer = userRoles.some(r => r.role === 'viewer');
    
    if (hasLead) {
      return { role: 'lead', label: tCommon('lead'), variant: 'accent' as const };
    }
    if (hasParticipant) {
      return { role: 'participant', label: tCommon('participant'), variant: 'info' as const };
    }
    if (hasViewer) {
      return { role: 'viewer', label: tCommon('viewer'), variant: 'secondary' as const };
    }
    
    return null;
  }, [user?.globalRole, userRoles, tCommon]);

  if (!user) return null;

  const displayName = user.displayName || user.username || tCommon('user');
  const avatarUrl = user.avatarUrl;
  const bio = user.profile?.bio;
  const location = user.profile?.location;
  const website = user.profile?.website;
  const about = user.profile?.about;
  const educationalInstitution = user.profile?.educationalInstitution;
  const contacts = user.profile?.contacts;

  // Check if user is Representative (lead) or Member (participant) - show educationalInstitution
  const isRepresentativeOrMember = user.globalRole === 'superadmin' || 
    userRoles.some(r => r.role === 'lead' || r.role === 'participant');

  // Check if user is Representative (lead) or Organizer (superadmin) - show contacts
  const showContacts = user.globalRole === 'superadmin' || 
    userRoles.some(r => r.role === 'lead');

  const handleAvatarUpload = async (url: string) => {
    try {
      await updateUser({
        avatarUrl: url,
      });
      addToast(t('saved') || 'Avatar updated', 'success');
      setIsAvatarDialogOpen(false);
    } catch (error) {
      console.error('Failed to update avatar:', error);
      addToast(t('error') || 'Failed to update avatar', 'error');
    }
  };

  return (
    <div className="relative bg-base-100 rounded-2xl overflow-hidden border border-base-content/5">
      {/* Cover Section */}
      <div className="relative h-24 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent">
        {/* Edit button */}
        {showEdit && onEdit && (
          <div className="absolute top-3 right-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="rounded-xl active:scale-[0.98] bg-base-100/80 backdrop-blur-sm hover:bg-base-100 text-base-content/70 h-8 px-3"
            >
              <Edit size={14} className="mr-1.5" />
              <span className="text-xs">Edit</span>
            </Button>
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative px-5 pb-5">
        {/* Avatar */}
        <div className="-mt-10 mb-4">
          <div className="relative inline-block">
            <Avatar className="w-20 h-20 text-xl border-4 border-base-100 shadow-md bg-base-200">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={displayName} />
              )}
              <AvatarFallback className="bg-secondary/10 text-secondary-foreground font-medium uppercase">
                {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon size={32} />}
              </AvatarFallback>
            </Avatar>
            {/* Edit icon overlay */}
            {showEdit && (
              <button
                type="button"
                onClick={() => setIsAvatarDialogOpen(true)}
                className="absolute top-0 right-0 p-1.5 rounded-full bg-primary text-primary-content shadow-lg hover:bg-primary/90 transition-colors z-10"
                title={t('changeAvatar') || 'Change avatar'}
              >
                <Pencil size={14} />
              </button>
            )}
            {/* Online indicator */}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-base-100 rounded-full" />
          </div>
        </div>

        {/* Name & Username */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-base-content">
            {displayName}
          </h1>
          {user.username && (
            <p className="text-sm text-base-content/50 mt-0.5">
              @{user.username}
            </p>
          )}
        </div>

        {/* Info Sections */}
        <div className="space-y-4">
          {/* Bio */}
          {bio && (
            <p className="text-sm text-base-content/80 leading-relaxed">
              {bio}
            </p>
          )}

          {/* About */}
          {about && (
            <div>
              <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-1">
                About
              </p>
              <p className="text-sm text-base-content/70 leading-relaxed">
                {about}
              </p>
            </div>
          )}

          {/* Educational Institution */}
          {isRepresentativeOrMember && educationalInstitution && (
            <div>
              <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-1">
                Education
              </p>
              <p className="text-sm text-base-content/70">
                {educationalInstitution}
              </p>
            </div>
          )}

          {/* Location & Website */}
          {(location?.city || website) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/50">
              {location?.city && location?.region && (
                <span className="flex items-center gap-1">
                  <span className="text-base-content/30">📍</span>
                  {location.city}, {location.region}
                </span>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base-content/60 hover:text-base-content transition-colors"
                >
                  {website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {/* Contacts */}
          {showContacts && contacts && (contacts.email || contacts.messenger) && (
            <div className="pt-4 border-t border-base-content/5">
              <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-2">
                Contacts
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                {contacts.email && (
                  <a
                    href={`mailto:${contacts.email}`}
                    className="text-base-content/60 hover:text-base-content transition-colors"
                  >
                    {contacts.email}
                  </a>
                )}
                {contacts.messenger && (
                  <span className="text-base-content/50">{contacts.messenger}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Badge */}
        {userRoleDisplay && (
          <div className="mt-5 pt-4 border-t border-base-content/5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-base-content/40">{t('role')}</span>
              <Badge variant={userRoleDisplay.variant} size="sm">
                {userRoleDisplay.label}
              </Badge>
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
    </div>
  );
}

// Memoize ProfileHero to prevent unnecessary re-renders
export const ProfileHero = memo(ProfileHeroComponent);

