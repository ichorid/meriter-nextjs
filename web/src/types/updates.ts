export interface UpdateEvent {
  id: string;
  eventType: 'vote' | 'beneficiary';
  actor: {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
  };
  targetType: 'publication' | 'comment';
  targetId: string;
  publicationId: string;
  publicationSlug?: string;
  communityId: string;
  createdAt: string;
  amount?: number;
  direction?: 'up' | 'down';
}

