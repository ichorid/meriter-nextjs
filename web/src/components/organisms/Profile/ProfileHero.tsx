'use client';

import React from 'react';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { Edit } from 'lucide-react';
import { BrandButton } from '@/components/ui/BrandButton';
import { Badge } from '@/components/atoms/Badge/Badge';
import { useTranslations } from 'next-intl';

import type { User } from '@/types/api-v1';

interface ProfileHeroProps {
  user: User | null | undefined;
  stats?: {
    projects: number;
    merits: number;
  };
  onEdit?: () => void;
  showEdit?: boolean;
  userRoles?: Array<{ role: string }>;
}

export function ProfileHero({ user, stats, onEdit, showEdit = false, userRoles = [] }: ProfileHeroProps) {
  const t = useTranslations('profile');
  
  // Determine role type for display (same logic as VerticalSidebar)
  const userRoleDisplay = React.useMemo(() => {
    // Check global superadmin role first
    if (user?.globalRole === 'superadmin') {
      return { role: 'superadmin', label: t('roleTypes.superadmin') || 'Superadmin', variant: 'error' as const };
    }
    
    // Check community roles (lead > participant > viewer)
    const hasLead = userRoles.some(r => r.role === 'lead');
    const hasParticipant = userRoles.some(r => r.role === 'participant');
    const hasViewer = userRoles.some(r => r.role === 'viewer');
    
    if (hasLead) {
      return { role: 'lead', label: 'Representative', variant: 'accent' as const };
    }
    if (hasParticipant) {
      return { role: 'participant', label: t('roleTypes.participant') || 'Participant', variant: 'info' as const };
    }
    if (hasViewer) {
      return { role: 'viewer', label: t('roleTypes.viewer') || 'Viewer', variant: 'secondary' as const };
    }
    
    return null;
  }, [user?.globalRole, userRoles, t]);

  if (!user) return null;

  const displayName = user.displayName || user.username || 'User';
  const avatarUrl = user.avatarUrl;
  const bio = user.profile?.bio;
  const location = user.profile?.location;
  const website = user.profile?.website;
  const values = user.profile?.values;
  const about = user.profile?.about;
  const educationalInstitution = user.profile?.educationalInstitution;
  const contacts = user.profile?.contacts;

  // Check if user is Representative (lead) or Member (participant) - show educationalInstitution
  const isRepresentativeOrMember = user.globalRole === 'superadmin' || 
    userRoles.some(r => r.role === 'lead' || r.role === 'participant');

  // Check if user is Representative (lead) or Organizer (superadmin) - show contacts
  const showContacts = user.globalRole === 'superadmin' || 
    userRoles.some(r => r.role === 'lead');

  return (
    <div className="relative bg-base-100 rounded-xl overflow-hidden border border-brand-secondary/10 shadow-sm">
      {/* Cover Image Section */}
      <div className="relative h-32 bg-gradient-to-r from-brand-primary/20 via-brand-primary/10 to-brand-secondary/10">
        {/* Optional: Add cover image here when available */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/30 to-transparent" />
        
        {/* Edit button overlay */}
        {showEdit && onEdit && (
          <div className="absolute top-4 right-4">
            <BrandButton
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="bg-base-100/90 backdrop-blur-sm hover:bg-base-100 text-brand-text-primary"
            >
              <Edit size={16} className="mr-2" />
              Edit
            </BrandButton>
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative px-4 pb-6 pt-2">
        {/* Avatar Section */}
        <div className="flex items-end justify-between -mt-16 mb-4">
          <div className="relative">
            <div className="relative">
              <BrandAvatar
                src={avatarUrl}
                fallback={displayName}
                size="xl"
                className="border-4 border-base-100 shadow-lg bg-base-100"
              />
              {/* Status Badge */}
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-4 border-white rounded-full" />
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="mt-4 space-y-2">
          <div>
            <h1 className="text-2xl font-bold text-brand-text-primary">
              {displayName}
            </h1>
            {user.username && (
              <p className="text-sm text-brand-text-secondary mt-1">
                @{user.username}
              </p>
            )}
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-sm text-brand-text-primary leading-relaxed">
              {bio}
            </p>
          )}

          {/* Values */}
          {values && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-brand-text-secondary mb-1">Values</p>
              <p className="text-sm text-brand-text-primary leading-relaxed">
                {values}
              </p>
            </div>
          )}

          {/* About */}
          {about && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-brand-text-secondary mb-1">About</p>
              <p className="text-sm text-brand-text-primary leading-relaxed">
                {about}
              </p>
            </div>
          )}

          {/* Educational Institution - only for Representative and Member */}
          {isRepresentativeOrMember && educationalInstitution && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-brand-text-secondary mb-1">Educational Institution</p>
              <p className="text-sm text-brand-text-primary">
                {educationalInstitution}
              </p>
            </div>
          )}

          {/* Location & Website */}
          <div className="flex flex-wrap gap-4 text-sm text-brand-text-secondary mt-2">
            {location?.city && location?.region && (
              <span>
                {location.city}, {location.region}
              </span>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary hover:underline"
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* Contacts - only for Representative and Organizer */}
          {showContacts && contacts && (contacts.email || contacts.messenger) && (
            <div className="mt-3 pt-3 border-t border-brand-secondary/10">
              <p className="text-xs font-semibold text-brand-text-secondary mb-2">Contacts</p>
              <div className="flex flex-wrap gap-4 text-sm text-brand-text-secondary">
                {contacts.email && (
                  <a
                    href={`mailto:${contacts.email}`}
                    className="text-brand-primary hover:underline"
                  >
                    {contacts.email}
                  </a>
                )}
                {contacts.messenger && (
                  <span>{contacts.messenger}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Type Indicator */}
        {userRoleDisplay && (
          <div className="mt-6 pt-6 border-t border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-text-secondary">{t('role') || 'Role'}:</span>
              <Badge variant={userRoleDisplay.variant} size="md">
                {userRoleDisplay.label}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

