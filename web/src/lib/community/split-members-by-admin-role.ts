export interface CommunityMemberLike {
    role?: 'lead' | 'participant' | 'superadmin';
    globalRole?: string;
}

export function isMemberListedAsAdmin(member: CommunityMemberLike): boolean {
    if (member.role === 'lead' || member.role === 'superadmin') return true;
    if (member.globalRole === 'superadmin') return true;
    return false;
}

export function splitMembersByAdminRole<T extends CommunityMemberLike>(members: T[]): {
    admins: T[];
    participants: T[];
} {
    const admins = members.filter(isMemberListedAsAdmin);
    const participants = members.filter((m) => !isMemberListedAsAdmin(m));
    return { admins, participants };
}
