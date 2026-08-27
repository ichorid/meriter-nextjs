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
  /** Who the earned merits belong to: beneficiary of a nomination post, else the author. */
  ownerId: string;
  title: string;
  score: number;
  postType: string | null;
  deleted: boolean;
}

export interface UzzUserLabel {
  name: string;
  /** Telegram login without the leading @, when known. */
  username: string | null;
}

export interface UzzPlatformPort {
  configuredCommunityId(): Promise<string>;
  setSelectedCommunityId(communityId: string): Promise<void>;
  listTelegramCommunities(): Promise<UzzPlatformCommunity[]>;
  getCommunity(communityId: string): Promise<UzzPlatformCommunity | null>;
  getPublication(publicationId: string): Promise<UzzPlatformPublication | null>;
  /** Deed publications whose merits belong to any of the users (as author or nomination beneficiary). */
  listDeedPublications(communityId: string, userIds: string[]): Promise<UzzPlatformPublication[]>;
  /** Non-deleted basic posts in the stand community at or above the emission threshold. */
  listEligibleDeedPublications(
    communityId: string,
    minScore: number,
    limit: number,
  ): Promise<UzzPlatformPublication[]>;
  getUserLabels(userIds: string[]): Promise<Map<string, UzzUserLabel>>;
}
