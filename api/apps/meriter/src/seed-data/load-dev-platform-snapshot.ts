import { readFileSync, existsSync } from 'fs';
import { DECREE_809_TAGS } from '@meriter/shared-types';
import {
  GLOBAL_COMMUNITY_BOOTSTRAP,
  PRIORITY_HUB_BOOTSTRAP,
  PRIORITY_HUB_BOOTSTRAP_TYPE_TAGS,
  PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP,
  type PriorityHubBootstrapTag,
} from '../domain/common/constants/platform-bootstrap.constants';
import type { DevPlatformSnapshotV1 } from './dev-platform-snapshot.schema';
import { resolveMeriterSeedDataDir } from './resolve-seed-data-path';

const SNAPSHOT_FILENAME = 'dev-platform-snapshot.json';

function buildFallbackSnapshot(): DevPlatformSnapshotV1 {
  const hubs = {} as DevPlatformSnapshotV1['priorityHubs'];
  for (const tag of PRIORITY_HUB_BOOTSTRAP_TYPE_TAGS) {
    const b = PRIORITY_HUB_BOOTSTRAP[tag];
    hubs[tag] = {
      name: b.name,
      description: b.description,
      settings: { ...b.settings } as Record<string, unknown>,
    };
  }
  const md = hubs['marathon-of-good'];
  if (md) {
    md.settings = { ...md.settings, commentMode: 'all' };
  }
  return {
    version: 1,
    platformSettings: {
      welcomeMeritsGlobal: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal,
      availableFutureVisionTags: [
        ...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.availableFutureVisionTags,
      ],
      decree809Enabled: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Enabled,
      decree809Tags: [...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Tags],
      popularValueTagsThreshold:
        PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.popularValueTagsThreshold,
    },
    priorityHubs: hubs,
    globalCommunity: {
      name: GLOBAL_COMMUNITY_BOOTSTRAP.name,
      description: GLOBAL_COMMUNITY_BOOTSTRAP.description,
      settings: { ...GLOBAL_COMMUNITY_BOOTSTRAP.settings } as Record<string, unknown>,
    },
  };
}

/**
 * Loads dev platform snapshot from seed-data (replace JSON after exporting from dev).
 * Falls back to in-code bootstrap when the file is missing or invalid.
 */
export function loadDevPlatformSnapshot(): DevPlatformSnapshotV1 {
  const dir = resolveMeriterSeedDataDir();
  const path = `${dir}/${SNAPSHOT_FILENAME}`;
  if (!existsSync(path)) {
    return buildFallbackSnapshot();
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as DevPlatformSnapshotV1;
    if (parsed.version !== 1 || !parsed.platformSettings || !parsed.priorityHubs) {
      return buildFallbackSnapshot();
    }
    if (!parsed.platformSettings.decree809Tags?.length) {
      parsed.platformSettings.decree809Tags = [...DECREE_809_TAGS];
    }
    return parsed;
  } catch {
    return buildFallbackSnapshot();
  }
}

export function getPriorityHubSnapshotForTag(
  tag: PriorityHubBootstrapTag,
  snapshot: DevPlatformSnapshotV1,
): { name: string; description: string; settings: Record<string, unknown> } {
  const fromFile = snapshot.priorityHubs[tag];
  if (fromFile?.name && fromFile.settings) {
    return {
      name: fromFile.name,
      description: fromFile.description,
      settings: fromFile.settings,
    };
  }
  const b = PRIORITY_HUB_BOOTSTRAP[tag];
  return {
    name: b.name,
    description: b.description,
    settings: { ...b.settings } as Record<string, unknown>,
  };
}
