// Community entity types
import type { ID, Timestamp } from '../common';

export interface Community {
  _id: ID;
  chatId: string;
  title: string;
  description?: string;
  photo?: string;
  icon?: string;
  tags?: string[];
  administratorsIds?: string[];
  isActive: boolean;
  settings?: CommunitySettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommunitySettings {
  hashtags?: string[];
  dimensions?: Record<string, any>;
  dimensionConfig?: Record<string, any>;
  currency?: string;
  welcomeMessage?: string;
  votingEnabled?: boolean;
  commentingEnabled?: boolean;
  moderationEnabled?: boolean;
}

export interface CommunityInfo {
  chat: {
    chatId: string;
    title: string;
    photo?: string;
    tags?: string[];
    administratorsIds?: string[];
  };
  icon?: string;
  settings?: CommunitySettings;
}

export interface CommunityCreate {
  chatId: string;
  title: string;
  description?: string;
  settings?: Partial<CommunitySettings>;
}

export interface CommunityUpdate {
  title?: string;
  description?: string;
  settings?: Partial<CommunitySettings>;
  isActive?: boolean;
}

