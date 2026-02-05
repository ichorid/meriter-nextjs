'use client';

import React, { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { routes } from '@/lib/constants/routes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import Link from 'next/link';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, ChevronDown, ChevronUp, Mail, Users, UserCog } from 'lucide-react';
import { Separator } from '@/components/ui/shadcn/separator';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Button } from '@/components/ui/shadcn/button';
import { useAuth } from '@/contexts/AuthContext';
import { useInvitableCommunities } from '@/hooks/api/useTeams';
import { InviteToTeamDialog } from '@/components/organisms/Profile/InviteToTeamDialog';
import { AssignLeadDialog } from '@/components/organisms/Profile/AssignLeadDialog';
import { MeritsAndQuotaSection } from './MeritsAndQuotaSection';

export function UserProfilePageClient({ userId }: { userId: string }) {
  const router = useRouter();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');

  const { data: user, isLoading, error, isFetched } = useUserProfile(userId);
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(userId);

  const [aboutExpanded, setAboutExpanded] = useLocalStorage<boolean>(`userProfile.${userId}.aboutExpanded`, true);
  const [contactsExpanded, setContactsExpanded] = useLocalStorage<boolean>(`userProfile.${userId}.contactsExpanded`, true);
  const [rolesExpanded, setRolesExpanded] = useLocalStorage<boolean>(`userProfile.${userId}.rolesExpanded`, true);
  const [meritsExpanded, setMeritsExpanded] = useLocalStorage<boolean>(`userProfile.${userId}.meritsExpanded`, true);

  // Handle 404 - redirect to not-found if user doesn't exist
  useEffect(() => {
    if (isFetched && !isLoading) {
      const isNotFound =
        error &&
        ((error as any)?.data?.code === 'NOT_FOUND' ||
          (error as any)?.message?.includes('not found'));

      if (isNotFound) {
        router.replace('/meriter/not-found');
      }
    }
  }, [isFetched, isLoading, error, router]);

  // Filter team roles
  const teamRoles = React.useMemo(() => {
    return userRoles.filter(role => {
      const isLeadOrParticipant = role.role === 'lead' || role.role === 'participant';
      if (!isLeadOrParticipant) {
        return false;
      }
      const isTeam = role.communityTypeTag === 'team' || role.communityTypeTag === undefined;
      return isTeam;
    });
  }, [userRoles]);

  const leadTeamRoles = React.useMemo(() => {
    return teamRoles.filter(r => r.role === 'lead');
  }, [teamRoles]);

  const participantTeamRoles = React.useMemo(() => {
    return teamRoles.filter(r => r.role === 'participant');
  }, [teamRoles]);

  const isOnlyViewer = React.useMemo(() => {
    const hasLeadOrParticipant = userRoles.some(r => r.role === 'lead' || r.role === 'participant');
    return !hasLeadOrParticipant && userRoles.some(r => r.role === 'viewer');
  }, [userRoles]);

  const hasLeadOrParticipantRoles = React.useMemo(() => {
    return userRoles.some(r => r.role === 'lead' || r.role === 'participant');
  }, [userRoles]);

  const participantTeamIds = participantTeamRoles.map(r => r.communityId!).filter(Boolean);
  const firstParticipantTeamId = participantTeamIds[0];
  const { data: firstTeamMembersData } = useCommunityMembers(firstParticipantTeamId || '', {});

  const teamLeadsMap = React.useMemo(() => {
    const map = new Map<string, { id: string; displayName: string }>();
    if (firstParticipantTeamId && firstTeamMembersData?.data) {
      const members = Array.isArray(firstTeamMembersData.data) ? firstTeamMembersData.data : [];
      const lead = members.find((member: any) => member.role === 'lead');
      if (lead) {
        map.set(firstParticipantTeamId, {
          id: lead.id,
          displayName: lead.displayName || lead.username || tCommon('user'),
        });
      }
    }
    return map;
  }, [firstParticipantTeamId, firstTeamMembersData, tCommon]);

  const hasTeamRoles = leadTeamRoles.length > 0 || participantTeamRoles.length > 0;
  const showRolesSection = isOnlyViewer || hasLeadOrParticipantRoles;

  // Get unique community IDs from user roles
  const communityIds = useMemo(() => {
    return Array.from(new Set(userRoles.map(role => role.communityId)));
  }, [userRoles]);

  if (isLoading) {
    return (
      <AdaptiveLayout
        stickyHeader={<SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} showScrollToTop={true} />}
      >
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AdaptiveLayout>
    );
  }

  if (error || !user) {
    return (
      <AdaptiveLayout
        stickyHeader={<SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} showScrollToTop={true} />}
      >
        <div className="text-center py-12 text-base-content/60">
          <UserIcon className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
          <p className="font-medium">{tCommon('userNotFound')}</p>
          <p className="text-sm mt-1">{tCommon('userNotFoundDescription')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  const profile = user.profile || {};
  const contacts = profile.contacts || {};
  const bio = profile.bio;
  const about = profile.about;
  const location = profile.location;
  const website = profile.website;
  const educationalInstitution = profile.educationalInstitution;

  const displayName = user.displayName || user.username || tCommon('user');
  const avatarUrl = user.avatarUrl;

  const isRepresentativeOrMember = user.globalRole === 'superadmin' ||
    userRoles.some(r => r.role === 'lead' || r.role === 'participant');

  const showContacts = user.globalRole === 'superadmin' ||
    userRoles.some(r => r.role === 'lead');

  return (
    <AdaptiveLayout
      stickyHeader={<SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} />}
    >
      <div className="relative bg-base-100 overflow-hidden">
        {/* Cover Section */}
        <div className="relative h-24 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent" />

        {/* Profile Content */}
        <div className="relative pb-5">
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

          {/* Action Buttons (only for other users) */}
          {!isOwnProfile && (hasTeamsToInvite || isSuperadmin) && (
            <div className="mb-4 flex gap-2">
              {hasTeamsToInvite && (
                <Button
                  variant="outline"
                  onClick={() => setShowInviteDialog(true)}
                  className="rounded-xl flex-1"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Пригласить в команду
                </Button>
              )}
              {isSuperadmin && (
                <Button
                  variant="outline"
                  onClick={() => setShowAssignLeadDialog(true)}
                  className="rounded-xl flex-1"
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  Назначить лидом
                </Button>
              )}
            </div>
          )}

          {/* Info Sections */}
          <div className="space-y-0">
            {/* Bio */}
            {bio && (
              <p className="text-sm text-base-content/80 leading-relaxed pb-4">
                {bio}
              </p>
            )}

            {/* About */}
            {about && (
              <>
                {bio && <Separator className="bg-base-300 my-0" />}
                <div className="bg-base-100 py-4 space-y-3">
                  <button
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
                  >
                    <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                      {t('about')}
                    </p>
                    {aboutExpanded ? (
                      <ChevronUp className="w-4 h-4 text-base-content/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-base-content/40" />
                    )}
                  </button>
                  {aboutExpanded && (
                    <div className="animate-in fade-in duration-200 space-y-3">
                      <p className="text-sm text-base-content/70 leading-relaxed">
                        {about}
                      </p>
                      
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
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Educational Institution */}
            {isRepresentativeOrMember && educationalInstitution && (
              <>
                {(about || bio) && <Separator className="bg-base-300 my-0" />}
                <div className="bg-base-100 py-4">
                  <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-1">
                    {t('educationalInstitution')}
                  </p>
                  <p className="text-sm text-base-content/70">
                    {educationalInstitution}
                  </p>
                </div>
              </>
            )}

            {/* Contacts */}
            {showContacts && contacts && (contacts.email || contacts.messenger) && (
              <>
                {(about || bio || (isRepresentativeOrMember && educationalInstitution)) && <Separator className="bg-base-300 my-0" />}
                <div className="bg-base-100 py-4 space-y-3">
                  <button
                    onClick={() => setContactsExpanded(!contactsExpanded)}
                    className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
                  >
                    <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                      {t('contacts')}
                    </p>
                    {contactsExpanded ? (
                      <ChevronUp className="w-4 h-4 text-base-content/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-base-content/40" />
                    )}
                  </button>
                  {contactsExpanded && (
                    <div className="animate-in fade-in duration-200 space-y-4">
                      {/* Email */}
                      {contacts.email && (
                        <a
                          href={`mailto:${contacts.email}`}
                          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors underline decoration-primary/30 hover:decoration-primary/60"
                        >
                          <Mail className="w-4 h-4" />
                          {contacts.email}
                        </a>
                      )}
                      
                      {/* Additional Contacts */}
                      {contacts.messenger && (
                        <div>
                          <p className="text-xs text-base-content/50 mb-1.5">
                            {t('otherContacts')}
                          </p>
                          <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-line">
                            {contacts.messenger}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Role Display */}
            {showRolesSection && (
              <>
                {(about || bio || (isRepresentativeOrMember && educationalInstitution) || (showContacts && contacts && (contacts.email || contacts.messenger))) && <Separator className="bg-base-300 my-0" />}
                <div className="bg-base-100 py-4">
                  {user?.globalRole === 'superadmin' ? (
                    <div>
                      <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-1">
                        {t('role')}
                      </p>
                      <p className="text-sm text-base-content">
                        {tCommon('superadmin')}
                      </p>
                    </div>
                  ) : isOnlyViewer ? (
                    <div>
                      <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-1">
                        {t('role')}
                      </p>
                      <p className="text-sm text-base-content">
                        {tCommon('viewer')}
                      </p>
                    </div>
                  ) : hasLeadOrParticipantRoles ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setRolesExpanded(!rolesExpanded)}
                        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
                      >
                        <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                          {t('roles')}
                        </p>
                        {rolesExpanded ? (
                          <ChevronUp className="w-4 h-4 text-base-content/40" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-base-content/40" />
                        )}
                      </button>
                      {rolesExpanded && (
                        <div className="animate-in fade-in duration-200 space-y-3">
                          {hasTeamRoles ? (
                            <>
                              {/* Lead roles */}
                              {leadTeamRoles.length > 0 && (
                                <div className="space-y-2">
                                  {leadTeamRoles.map((role) => (
                                    <div
                                      key={role.id}
                                      className="rounded-xl border border-base-300 bg-base-100/50 p-3 transition-colors hover:bg-base-200/50"
                                    >
                                      <p className="text-sm font-medium text-base-content">
                                        {t('leadLabel')}
                                      </p>
                                      <p className="text-xs text-base-content/60 mt-0.5">
                                        {tCommon('team')}: "{role.communityName || role.communityId || ''}"
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Separator between lead and participant roles */}
                              {leadTeamRoles.length > 0 && participantTeamRoles.length > 0 && (
                                <Separator className="bg-base-300" />
                              )}
                              
                              {/* Participant roles */}
                              {participantTeamRoles.length > 0 && (
                                <div className="space-y-2">
                                  {participantTeamRoles.map((role) => {
                                    const teamLead = role.communityId ? teamLeadsMap.get(role.communityId) : null;
                                    return (
                                      <div
                                        key={role.id}
                                        className="rounded-xl border border-base-300 bg-base-100/50 p-3 transition-colors hover:bg-base-200/50"
                                      >
                                        <p className="text-sm font-medium text-base-content">
                                          {tCommon('participant')}
                                        </p>
                                        <p className="text-xs text-base-content/60 mt-0.5">
                                          {tCommon('team')}: "{role.communityName || role.communityId || ''}"
                                        </p>
                                        {teamLead && (
                                          <p className="text-xs text-base-content/60 mt-1.5">
                                            <Link 
                                              href={routes.userProfile(teamLead.id)}
                                              className="hover:text-base-content transition-colors underline"
                                            >
                                              {t('contactTeamRepresentative')}
                                            </Link>
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-base-content/50">No team roles to display</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}

            {/* Merits & Quota Section */}
            {!rolesLoading && communityIds.length > 0 && (
              <>
                {(about || bio || (isRepresentativeOrMember && educationalInstitution) || (showContacts && contacts && (contacts.email || contacts.messenger)) || showRolesSection) && <Separator className="bg-base-300 my-0" />}
                <MeritsAndQuotaSection 
                  userId={userId} 
                  communityIds={communityIds} 
                  userRoles={userRoles}
                  expanded={meritsExpanded}
                  onToggleExpanded={() => setMeritsExpanded(!meritsExpanded)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invite to Team Dialog */}
      {!isOwnProfile && hasTeamsToInvite && (
        <InviteToTeamDialog
          open={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          targetUserId={userId}
          communities={invitableCommunities}
        />
      )}

      {/* Assign Lead Dialog */}
      {!isOwnProfile && isSuperadmin && (
        <AssignLeadDialog
          open={showAssignLeadDialog}
          onClose={() => setShowAssignLeadDialog(false)}
          targetUserId={userId}
        />
      )}
    </AdaptiveLayout>
  );
}
