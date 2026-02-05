'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, Edit, Settings, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { Separator } from '@/components/ui/shadcn/separator';
import { Button } from '@/components/ui/shadcn/button';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { routes } from '@/lib/constants/routes';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import type { User } from '@/types/api-v1';

interface ProfileHeroProps {
  user: User | null | undefined;
  stats?: {
    merits: number;
  };
  showEdit?: boolean;
  userRoles?: Array<{ id: string; role: string; communityId?: string; communityName?: string; communityTypeTag?: string }>;
  onEdit?: () => void;
}

function ProfileHeroComponent({ user, stats: _stats, showEdit = false, userRoles = [], onEdit }: ProfileHeroProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [rolesExpanded, setRolesExpanded] = useLocalStorage<boolean>('profile.rolesExpanded', true);
  const [aboutExpanded, setAboutExpanded] = useLocalStorage<boolean>('profile.aboutExpanded', true);
  const [contactsExpanded, setContactsExpanded] = useLocalStorage<boolean>('profile.contactsExpanded', true);

  // Filter team roles (only communities with typeTag === 'team')
  // Now we can use communityTypeTag directly from userRoles, no need to fetch communities
  // Note: If typeTag is undefined but user is lead, we treat it as a team (fallback for communities without typeTag set)
  const teamRoles = React.useMemo(() => {
    return userRoles.filter(role => {
      const isLeadOrParticipant = role.role === 'lead' || role.role === 'participant';
      if (!isLeadOrParticipant) {
        return false;
      }
      
      // Team if typeTag is 'team', or if typeTag is undefined (fallback for communities without typeTag set)
      // We show both lead and participant roles if typeTag is undefined, assuming they are in teams
      const isTeam = role.communityTypeTag === 'team' || role.communityTypeTag === undefined;
      return isTeam;
    });
  }, [userRoles]);

  // Separate into lead and participant roles
  const leadTeamRoles = React.useMemo(() => {
    return teamRoles.filter(r => r.role === 'lead');
  }, [teamRoles]);

  const participantTeamRoles = React.useMemo(() => {
    return teamRoles.filter(r => r.role === 'participant');
  }, [teamRoles]);

  // Check if user is only viewer (has viewer role but no lead/participant roles at all)
  const isOnlyViewer = React.useMemo(() => {
    if (user?.globalRole === 'superadmin') return false;
    const hasLeadOrParticipant = userRoles.some(r => r.role === 'lead' || r.role === 'participant');
    return !hasLeadOrParticipant && userRoles.some(r => r.role === 'viewer');
  }, [user?.globalRole, userRoles]);

  // Check if user has any lead/participant roles (in any communities, not just teams)
  const hasLeadOrParticipantRoles = React.useMemo(() => {
    return userRoles.some(r => r.role === 'lead' || r.role === 'participant');
  }, [userRoles]);

  // Get team members for each participant role to find leads
  const participantTeamIds = participantTeamRoles.map(r => r.communityId!).filter(Boolean);
  // We'll fetch members for the first participant team (to avoid too many requests)
  // For multiple teams, we'd need a different approach, but for now let's use the first one
  const firstParticipantTeamId = participantTeamIds[0];
  const { data: firstTeamMembersData } = useCommunityMembers(firstParticipantTeamId || '', {});

  // Create a map of communityId -> lead user for participant roles
  const teamLeadsMap = React.useMemo(() => {
    const map = new Map<string, { id: string; displayName: string }>();
    
    // For now, we only get the lead for the first participant team
    // In a full implementation, we'd need to fetch for all teams
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

  const hasTeamRoles = leadTeamRoles.length > 0 || participantTeamRoles.length > 0;
  
  // Show roles section if:
  // - user is superadmin, OR
  // - user is only viewer, OR
  // - user has lead/participant roles (even if teams are still loading)
  const showRolesSection = user?.globalRole === 'superadmin' || isOnlyViewer || hasLeadOrParticipantRoles;

  return (
    <div className="relative bg-base-100 overflow-hidden">
      {/* Cover Section */}
      <div className="relative h-24 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent">
        {/* Edit and Settings buttons */}
        {showEdit && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit ? onEdit() : router.push('/meriter/profile/edit')}
              className="rounded-xl active:scale-[0.98] bg-base-100/80 backdrop-blur-sm hover:bg-base-100 text-base-content/70 h-8 px-3"
            >
              <Edit size={14} className="mr-1.5" />
              <span className="text-xs">{tCommon('edit')}</span>
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
                  // Show collapsible block if user has lead/participant roles
                  // Even if teams are still loading, show the block (it will be empty or show roles as they load)
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
                              {leadTeamRoles.map((role, index) => (
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
        </div>
      </div>
    </div>
  );
}

export const ProfileHero = ProfileHeroComponent;
