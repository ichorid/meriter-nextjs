export interface PollDocument {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  options: string[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
