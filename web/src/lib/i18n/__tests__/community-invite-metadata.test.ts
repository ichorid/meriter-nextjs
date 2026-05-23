import { buildCommunityInviteMetadata, fetchCommunityInvitePreview } from '@/lib/i18n/community-invite-metadata';

describe('community-invite-metadata', () => {
  it('builds localized metadata when preview is unavailable', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch;

    const metadata = await buildCommunityInviteMetadata({
      token: 'short-token',
      canonicalPath: '/meriter/join/short-token',
    });

    expect(metadata.title).toBeTruthy();
    global.fetch = originalFetch;
  });

  it('fetchCommunityInvitePreview returns null on failed response', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch;

    await expect(fetchCommunityInvitePreview('missing')).resolves.toBeNull();
    global.fetch = originalFetch;
  });
});
