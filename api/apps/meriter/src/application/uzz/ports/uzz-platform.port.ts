export const UZZ_PLATFORM_PORT = Symbol('UZZ_PLATFORM_PORT');

export interface UzzPlatformCommunity {
  id: string;
  name: string;
  telegramChatId: string | null;
}

export interface UzzPlatformPublication {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  score: number;
  postType: string | null;
  deleted: boolean;
}

export interface UzzPlatformPort {
  configuredCommunityId(): Promise<string>;
  setSelectedCommunityId(communityId: string): Promise<void>;
  listUserCommunities(userId: string): Promise<UzzPlatformCommunity[]>;
  getCommunity(communityId: string): Promise<UzzPlatformCommunity | null>;
  getPublication(publicationId: string): Promise<UzzPlatformPublication | null>;
  listDeedPublications(communityId: string, authorIds: string[]): Promise<UzzPlatformPublication[]>;
  getDisplayNames(userIds: string[]): Promise<Map<string, string>>;
}
