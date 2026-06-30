export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL?.trim() || '',
  },
  product: {
    trpcPath: '/trpc/community',
    header: 'community' as const,
  },
  defaultCommunityId: process.env.NEXT_PUBLIC_DEFAULT_COMMUNITY_ID?.trim() || '',
};
