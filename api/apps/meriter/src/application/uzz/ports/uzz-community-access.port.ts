export const UZZ_COMMUNITY_ACCESS_PORT = Symbol('UZZ_COMMUNITY_ACCESS_PORT');

export interface UzzCommunityAccessPort {
  isAnyMember(communityId: string, userIds: string[]): Promise<boolean>;
}
