import {
  isPriorityHubWithoutObDocument,
  shouldBootstrapImageOfFutureDocument,
} from '../src/domain/common/constants/collaborative-documents.constants';

describe('collaborative-documents.constants', () => {
  it('treats MVP hub typeTags as without OB document', () => {
    expect(isPriorityHubWithoutObDocument('future-vision')).toBe(true);
    expect(isPriorityHubWithoutObDocument('marathon-of-good')).toBe(true);
    expect(isPriorityHubWithoutObDocument('team-projects')).toBe(true);
    expect(isPriorityHubWithoutObDocument('team')).toBe(false);
  });

  it('bootstraps imageOfFuture only for non-hub communities', () => {
    expect(shouldBootstrapImageOfFutureDocument('team')).toBe(true);
    expect(shouldBootstrapImageOfFutureDocument('future-vision')).toBe(false);
    expect(shouldBootstrapImageOfFutureDocument('marathon-of-good')).toBe(false);
    expect(shouldBootstrapImageOfFutureDocument('team-projects')).toBe(false);
    expect(shouldBootstrapImageOfFutureDocument('global')).toBe(false);
    expect(shouldBootstrapImageOfFutureDocument(undefined)).toBe(false);
  });
});
