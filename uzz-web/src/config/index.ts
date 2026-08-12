export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL?.trim() || '',
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL?.trim() || '',
  },
  product: {
    trpcPath: '/trpc/uzz',
    header: 'uzz' as const,
  },
  defaultCommunityId: process.env.NEXT_PUBLIC_DEFAULT_COMMUNITY_ID?.trim() || '',
  development: {
    fakeDataMode:
      process.env.NEXT_PUBLIC_FAKE_DATA_MODE === 'true' ||
      (process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_FAKE_DATA_MODE !== 'false'),
  },
};
