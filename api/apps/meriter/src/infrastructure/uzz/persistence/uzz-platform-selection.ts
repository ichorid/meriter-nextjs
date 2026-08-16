export const UZZ_PLATFORM_COLLECTION = 'uzz_platform';
export const UZZ_PLATFORM_STAND_ID = 'stand';

type PlatformSelectionDoc = {
  selectedCommunityId?: unknown;
};

type PlatformDb = {
  collection(name: string): {
    findOne(filter: { id: string }): Promise<PlatformSelectionDoc | null>;
    updateOne(
      filter: { id: string },
      update: { $set: Record<string, unknown> },
      options: { upsert: true },
    ): Promise<unknown>;
  };
};

export function resolveConfiguredCommunityId(
  selected: string | null | undefined,
  envCommunityId: string,
): string {
  const override = selected?.trim() ?? '';
  return override || envCommunityId.trim();
}

export async function readSelectedCommunityId(db: PlatformDb): Promise<string | null> {
  const doc = await db.collection(UZZ_PLATFORM_COLLECTION).findOne({
    id: UZZ_PLATFORM_STAND_ID,
  });
  const value = typeof doc?.selectedCommunityId === 'string'
    ? doc.selectedCommunityId.trim()
    : '';
  return value || null;
}

export async function writeSelectedCommunityId(
  db: PlatformDb,
  communityId: string,
): Promise<void> {
  await db.collection(UZZ_PLATFORM_COLLECTION).updateOne(
    { id: UZZ_PLATFORM_STAND_ID },
    {
      $set: {
        id: UZZ_PLATFORM_STAND_ID,
        selectedCommunityId: communityId.trim(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}
