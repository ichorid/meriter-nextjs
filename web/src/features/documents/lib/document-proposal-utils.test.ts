import {
  countActiveProposalVariants,
  filterActiveProposalVariants,
  isPendingOfficialManualPick,
} from './document-proposal-utils';

describe('document-proposal-utils', () => {
  it('counts only open and closed-winner as active', () => {
    const variants = [
      { status: 'open' },
      { status: 'closed-winner' },
      { status: 'applied' },
      { status: 'closed-not-winner' },
    ];
    expect(countActiveProposalVariants(variants)).toBe(2);
    expect(filterActiveProposalVariants(variants)).toHaveLength(2);
  });

  it('detects pending official manual pick', () => {
    expect(
      isPendingOfficialManualPick('manual', false, [{ status: 'closed-not-winner' }]),
    ).toBe(true);
    expect(
      isPendingOfficialManualPick('manual', false, [{ status: 'closed-winner' }]),
    ).toBe(false);
    expect(
      isPendingOfficialManualPick('manual', false, [{ status: 'applied' }]),
    ).toBe(false);
  });
});
