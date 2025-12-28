'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, Edit, Settings } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/atoms/Badge/Badge';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import type { User } from '@/types/api-v1';

interface ProfileHeroProps {
  user: User | null | undefined;
  stats?: {
    merits: number;
  };
  showEdit?: boolean;
  userRoles?: Array<{ role: string }>;
}

function ProfileHeroComponent({ user, stats: _stats, showEdit = false, userRoles = [] }: ProfileHeroProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  
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

  return (
    <div className="relative bg-base-100 rounded-2xl overflow-hidden border border-base-content/5">
      {/* Cover Section */}
      <div className="relative h-24 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent">
        {/* Edit and Settings buttons */}
        {showEdit && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/meriter/profile/edit')}
              className="rounded-xl active:scale-[0.98] bg-base-100/80 backdrop-blur-sm hover:bg-base-100 text-base-content/70 h-8 px-3"
            >
              <Edit size={14} className="mr-1.5" />
              <span className="text-xs">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/meriter/settings')}
              aria-label={tCommon('settings')}
              className="rounded-xl active:scale-[0.98] bg-base-100/80 backdrop-blur-sm hover:bg-base-100 text-base-content/70 h-8 w-8 p-0"
            >
              <Settings size={18} />
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
              <AvatarFallback userId={user.id} className="font-medium uppercase">
                {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon size={32} />}
              </AvatarFallback>
            </Avatar>
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
    </div>
  );
}

export const ProfileHero = ProfileHeroComponent;

