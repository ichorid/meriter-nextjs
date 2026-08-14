export const config = {
  product: {
    trpcPath: '/trpc/uzz',
    header: 'uzz' as const,
  },
  // Deploy community ID is injected at request time via RuntimeConfigProvider.
  defaultCommunityId: '',
  development: {
    fakeDataMode:
      process.env.NEXT_PUBLIC_FAKE_DATA_MODE === 'true' ||
      (process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_FAKE_DATA_MODE !== 'false'),
  },
};
