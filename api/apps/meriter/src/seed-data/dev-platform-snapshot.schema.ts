import type { PriorityHubBootstrapTag } from '../domain/common/constants/platform-bootstrap.constants';

/**
 * JSON under seed-data/dev-platform-snapshot.json — replace with a dump from dev when hub/platform settings differ.
 */
export interface DevPlatformSnapshotV1 {
  version: 1;
  platformSettings: {
    welcomeMeritsGlobal: number;
    availableFutureVisionTags: string[];
    decree809Enabled: boolean;
    decree809Tags: string[];
    popularValueTagsThreshold: number;
  };
  priorityHubs: Record<
    PriorityHubBootstrapTag,
    { name: string; description: string; settings: Record<string, unknown> }
  >;
  globalCommunity: {
    name: string;
    description: string;
    settings: Record<string, unknown>;
  };
}
