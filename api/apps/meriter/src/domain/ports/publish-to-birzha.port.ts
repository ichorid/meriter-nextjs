/**
 * Orchestration ports (BC-08): publish a Birzha (МД) post sourced from a project or an
 * eligible local community. Implemented in application (PublishProjectToBirzhaUseCase /
 * PublishCommunityToBirzhaUseCase), wired at the composition root (Zone 8 inversion).
 */
export const PUBLISH_PROJECT_TO_BIRZHA_PORT = Symbol(
  'PUBLISH_PROJECT_TO_BIRZHA_PORT',
);
export const PUBLISH_COMMUNITY_TO_BIRZHA_PORT = Symbol(
  'PUBLISH_COMMUNITY_TO_BIRZHA_PORT',
);

export type PublishToBirzhaBaseInput = {
  callerId: string;
  content: string;
  type: 'text' | 'image' | 'video';
  title: string;
  description?: string;
  images?: string[];
  valueTags?: string[];
  hashtags?: string[];
  beneficiaryId?: string;
  /** Default: deduct postCost from source CommunityWallet. */
  postCostFunding?: 'source_community_wallet' | 'caller_global_wallet';
  investingEnabled?: boolean;
  investorSharePercent?: number;
  ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
  stopLoss?: number;
  noAuthorWalletSpend?: boolean;
};

export type PublishProjectToBirzhaInput = PublishToBirzhaBaseInput & {
  projectId: string;
};

export type PublishCommunityToBirzhaInput = PublishToBirzhaBaseInput & {
  communityId: string;
};

export type PublishToBirzhaResult = { id: string };

/** Params shared by PublicationService.publishSourceEntityToBirzha and both Birzha publish use cases. */
export type PublishSourceEntityToBirzhaParams = PublishToBirzhaBaseInput & {
  sourceEntityId: string;
  sourceEntityType: 'project' | 'community';
};

export interface PublishProjectToBirzhaPort {
  execute(input: PublishProjectToBirzhaInput): Promise<PublishToBirzhaResult>;
}

export interface PublishCommunityToBirzhaPort {
  execute(input: PublishCommunityToBirzhaInput): Promise<PublishToBirzhaResult>;
}
