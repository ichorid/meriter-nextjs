import {
  loadEntrepreneursDemoPack,
  validatePackBalances,
} from '../src/seed-data/parse-entrepreneurs-demo-pack';

describe('parseEntrepreneursDemoPack', () => {
  it('loads bundled pack and validates balance math', () => {
    const pack = loadEntrepreneursDemoPack();
    expect(pack.manifest.packId).toBe('entrepreneurs');
    expect(pack.community.id).toBe('demo_ent_community');
    expect(pack.users).toHaveLength(10);
    expect(pack.projects).toHaveLength(2);

    const topUpTotal = pack.timeline.communityWalletTopUps.reduce(
      (s, t) => s + t.amount,
      0,
    );
    expect(topUpTotal).toBe(447_480);

    const payoutTotal = pack.timeline.polls.reduce(
      (s, p) => s + p.payout.amount,
      0,
    );
    expect(payoutTotal).toBe(120_000);

    expect(() => validatePackBalances(pack)).not.toThrow();
  });

  it('merges media URL override from packJson', () => {
    const override = JSON.stringify({
      community: { avatarUrl: 'https://cdn.example/team.png' },
      users: [{ login: 'kravtsov_a', avatarUrl: 'https://cdn.example/kravtsov.png' }],
    });
    const pack = loadEntrepreneursDemoPack(override);
    expect(pack.community.avatarUrl).toBe('https://cdn.example/team.png');
    const lead = pack.users.find((u) => u.login === 'kravtsov_a');
    expect(lead?.avatarUrl).toBe('https://cdn.example/kravtsov.png');
  });

  it('rejects pack when top-ups are less than payouts', () => {
    const pack = loadEntrepreneursDemoPack();
    pack.timeline.communityWalletTopUps = [{ userKey: 'kravtsov_a', amount: 1000, dayOffset: -1 }];
    expect(() => validatePackBalances(pack)).toThrow(/top-ups/i);
  });
});
