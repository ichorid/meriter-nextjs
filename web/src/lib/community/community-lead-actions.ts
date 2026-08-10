import type { CommunityMemberLike } from '@/lib/community/split-members-by-admin-role';
import { communityAllowsLeadManagement } from '@/lib/community/community-lead-management';

export function isPlatformSuperadminUser(
    user: { globalRole?: string } | null | undefined,
): boolean {
    return user?.globalRole === 'superadmin';
}

/** Community lead management UI: platform superadmin bypasses hub typeTag restrictions. */
export function canActorManageCommunityLeads(input: {
    user: { globalRole?: string } | null | undefined;
    isCommunityAdmin: boolean;
    communityTypeTag?: string;
}): boolean {
    if (isPlatformSuperadminUser(input.user)) {
        return true;
    }
    return input.isCommunityAdmin && communityAllowsLeadManagement(input.communityTypeTag);
}

/** Member can be promoted to community lead (not already lead). */
export function canPromoteMemberToCommunityLead(member: CommunityMemberLike): boolean {
    if (member.role === 'lead') {
        return false;
    }
    if (member.role === 'participant' || member.role === undefined) {
        return true;
    }
    if (member.role === 'superadmin' || member.globalRole === 'superadmin') {
        return true;
    }
    return false;
}
