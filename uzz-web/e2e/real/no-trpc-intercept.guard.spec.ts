import { test } from '@playwright/test';
import { assertNoTrpcInterception } from './fixtures';

test('real suite does not intercept UZZ tRPC', () => {
  assertNoTrpcInterception();
});
