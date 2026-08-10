import { resolvePublicationVoteBlockReason } from './telegram-publication-vote-block';

describe('resolvePublicationVoteBlockReason', () => {
  const author = 'author-1';
  const beneficiary = 'beneficiary-1';
  const voter = 'voter-1';

  it('blocks author on own post', () => {
    expect(resolvePublicationVoteBlockReason(author, author, author)).toBe('author');
    expect(resolvePublicationVoteBlockReason(author, undefined, author)).toBe('author');
  });

  it('allows author to vote on nomination post', () => {
    expect(resolvePublicationVoteBlockReason(author, beneficiary, author)).toBeNull();
  });

  it('blocks beneficiary on nomination post', () => {
    expect(resolvePublicationVoteBlockReason(author, beneficiary, beneficiary)).toBe('beneficiary');
  });

  it('allows third party on nomination post', () => {
    expect(resolvePublicationVoteBlockReason(author, beneficiary, voter)).toBeNull();
  });
});
