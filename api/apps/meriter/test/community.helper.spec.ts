import { isPriorityCommunity } from '../src/domain/common/helpers/community.helper';

describe('isPriorityCommunity', () => {
  describe('priority typeTags', () => {
    it.each([
      ['marathon-of-good'],
      ['future-vision'],
      ['team-projects'],
      ['support'],
    ] as const)('returns true for typeTag "%s"', (typeTag) => {
      expect(isPriorityCommunity({ typeTag })).toBe(true);
    });
  });

  describe('isPriority flag', () => {
    it('returns true when isPriority is true (with any typeTag)', () => {
      expect(isPriorityCommunity({ typeTag: 'custom', isPriority: true })).toBe(true);
      expect(isPriorityCommunity({ typeTag: undefined, isPriority: true })).toBe(true);
    });

    it('returns false when isPriority is false', () => {
      expect(isPriorityCommunity({ typeTag: 'custom', isPriority: false })).toBe(false);
    });

    it('returns false when isPriority is undefined', () => {
      expect(isPriorityCommunity({ typeTag: 'custom' })).toBe(false);
    });
  });

  describe('non-priority communities', () => {
    it.each([
      ['team'],
      ['custom'],
      ['political'],
      ['housing'],
      ['volunteer'],
      ['corporate'],
    ] as const)('returns false for typeTag "%s"', (typeTag) => {
      expect(isPriorityCommunity({ typeTag })).toBe(false);
    });
  });

  describe('null and undefined', () => {
    it('returns false for null', () => {
      expect(isPriorityCommunity(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isPriorityCommunity(undefined)).toBe(false);
    });
  });

  describe('empty object', () => {
    it('returns false for empty object', () => {
      expect(isPriorityCommunity({})).toBe(false);
    });
  });
});
