# UZZ Release and Authentication Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production image configurable at runtime and make email-only login secure, recoverable and resistant to distributed abuse.

**Architecture:** Deploy-specific web configuration crosses the Next server/client boundary through a typed provider. Authentication use cases depend on application ports; Mongo implements atomic rate counters and leased magic-link claims. Provider/configuration details remain in infrastructure.

**Tech Stack:** Next.js 15, React 19, NestJS, tRPC, MongoDB/Mongoose, Zod, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-uzz-post-review-remediation-design.md`

## Global Constraints

- Email magic-link remains the only site login.
- Never log raw tokens, magic-link URLs or full email addresses.
- One Docker image must work in dev and production using runtime environment values.
- Production rate limits must be shared across API instances.
- Domain/application layers must not import NestJS, Mongoose or Next.js.
- Every behavior change is implemented test-first.

---

### Task 1: Runtime web configuration and fail-safe deploy profile

**Files:**
- Create: `uzz-web/src/config/runtime-config.ts`
- Create: `uzz-web/src/config/runtime-config-context.tsx`
- Test: `uzz-web/src/config/__tests__/runtime-config.test.tsx`
- Modify: `uzz-web/src/app/layout.tsx`
- Modify: `uzz-web/src/lib/trpc/client.ts`
- Modify: `uzz-web/src/lib/use-uzz-community.ts`
- Modify: `uzz-web/src/config/index.ts`
- Modify: `uzz-web/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/build-and-push.yml`
- Modify: `scripts/vps/apply-telegram-profile.sh`
- Modify: `scripts/vps/profiles/prod.env`
- Test: `api/apps/meriter/test/uzz-deploy-profile.spec.ts`

**Interfaces:**
- Produces: `UzzRuntimeConfig`, `readUzzRuntimeConfig(env)`, `RuntimeConfigProvider`, `useRuntimeConfig()`.
- Consumes: server runtime variables `API_URL`, `UZZ_WEB_BASE_URL`, `DEFAULT_TELEGRAM_COMMUNITY_ID`.

- [ ] **Step 1: Write failing runtime-config tests**

```ts
it('reads deploy values at request time', () => {
  expect(readUzzRuntimeConfig({
    API_URL: 'https://api.example.test',
    UZZ_WEB_BASE_URL: 'https://uzz.example.test',
    DEFAULT_TELEGRAM_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
  })).toEqual({
    apiBaseUrl: 'https://api.example.test',
    appBaseUrl: 'https://uzz.example.test',
    defaultCommunityId: 'a1000001-0000-4000-8000-000000000001',
  });
});

it('rejects a production placeholder', () => {
  expect(() => readUzzRuntimeConfig({
    NODE_ENV: 'production',
    DEFAULT_TELEGRAM_COMMUNITY_ID: 'REPLACE_WITH_PROD_PILOT_COMMUNITY_ID',
  })).toThrow('DEFAULT_TELEGRAM_COMMUNITY_ID');
});
```

- [ ] **Step 2: Run tests and observe RED**

Run: `pnpm --dir uzz-web test:unit -- --run src/config/__tests__/runtime-config.test.tsx`

Expected: FAIL because runtime reader/provider do not exist.

- [ ] **Step 3: Implement the typed server-to-client boundary**

```ts
export type UzzRuntimeConfig = Readonly<{
  apiBaseUrl: string;
  appBaseUrl: string;
  defaultCommunityId: string;
}>;

export function readUzzRuntimeConfig(env: Record<string, string | undefined>): UzzRuntimeConfig {
  const defaultCommunityId = env.DEFAULT_TELEGRAM_COMMUNITY_ID?.trim() ?? '';
  if (env.NODE_ENV === 'production' && !UUID_RE.test(defaultCommunityId)) {
    throw new Error('DEFAULT_TELEGRAM_COMMUNITY_ID must be a UUID in production');
  }
  return Object.freeze({
    apiBaseUrl: env.API_URL?.trim() ?? '',
    appBaseUrl: env.UZZ_WEB_BASE_URL?.trim() ?? '',
    defaultCommunityId,
  });
}
```

`RootLayout` reads the values on the server and passes them to `RuntimeConfigProvider`. `getTrpcClient` and `useUzzCommunityId` consume the context; remove deploy-specific `NEXT_PUBLIC_*` reads.

- [ ] **Step 4: Add deploy preflight tests**

Test `apply-telegram-profile.sh` through a non-mutating `--check` mode. Assert that empty, placeholder, invalid UUID and non-HTTPS production URLs exit non-zero before the script writes an env file.

- [ ] **Step 5: Implement fail-safe deployment**

Add a validation function in the shell script and execute it before the first `sed`/write/restart operation. Remove the placeholder assignment from `prod.env`; document that production deployment supplies the real UUID through the protected environment file. Remove obsolete public build args from Docker and CI.

- [ ] **Step 6: Verify production-like build and runtime substitution**

Run:

```powershell
pnpm --dir uzz-web test:unit -- --run src/config/__tests__/runtime-config.test.tsx
pnpm --dir uzz-web build
pnpm --dir api exec jest apps/meriter/test/uzz-deploy-profile.spec.ts --runInBand
```

Expected: PASS; the same build resolves two different runtime community IDs in the test harness.

- [ ] **Step 7: Commit**

```bash
git add uzz-web/src/config uzz-web/src/app/layout.tsx uzz-web/src/lib uzz-web/Dockerfile docker-compose.yml .github/workflows/build-and-push.yml scripts/vps api/apps/meriter/test/uzz-deploy-profile.spec.ts
git commit -m "fix(uzz): load deploy configuration at runtime"
```

### Task 2: Fail-fast email delivery and secret-safe logging

**Files:**
- Modify: `api/apps/meriter/src/config/validation.schema.ts`
- Modify: `api/apps/meriter/src/infrastructure/auth/email-login-link.service.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Test: `api/apps/meriter/test/uzz-config-validation.spec.ts`
- Test: `api/apps/meriter/test/uzz-identity-security.spec.ts`

**Interfaces:**
- Produces: deterministic `EMAIL_DELIVERY_UNAVAILABLE` application error; safe structured auth logs; provider result `{ delivered: boolean; providerRequestId?: string }` instead of a bare boolean.
- Consumes: existing `AuthMagicLinkService.createToken()` and email provider adapter.

- [ ] **Step 1: Add configuration RED tests**

```ts
it.each([
  [{ EMAIL_ENABLED: 'false' }, 'EMAIL_ENABLED'],
  [{ EMAIL_ENABLED: 'true', EMAIL_API_KEY: '' }, 'EMAIL_API_KEY'],
  [{ EMAIL_ENABLED: 'true', EMAIL_FROM: 'not-an-email' }, 'EMAIL_FROM'],
])('rejects incomplete production UZZ email configuration', (patch, field) => {
  expect(() => validateSync(productionUzzEnv(patch))).toThrow(field);
});
```

- [ ] **Step 2: Add log-safety and delivery-failure RED tests**

Capture the Nest logger while the fake provider returns `false`. Assert:

```ts
expect(result).rejects.toMatchObject({ code: 'EMAIL_DELIVERY_UNAVAILABLE' });
expect(serializedLogs).not.toContain(rawToken);
expect(serializedLogs).not.toContain('/a/');
expect(serializedLogs).not.toContain('person@example.test');
```

- [ ] **Step 3: Run the focused tests and observe RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-config-validation.spec.ts apps/meriter/test/uzz-identity-security.spec.ts --runInBand`

Expected: FAIL on permissive configuration, successful response and raw link logging.

- [ ] **Step 4: Implement fail-fast validation and safe failure**

When `NODE_ENV=production` and `UZZ_WEB_BASE_URL` is non-empty, require email enabled, HTTPS URL, non-empty API key and valid sender. Change the provider adapter result from `boolean` to `{ delivered, providerRequestId }`. In the service, normalize email before any lookup, throw on provider failure, and log only:

```ts
this.logger.warn({
  event: 'uzz_magic_link_delivery_failed',
  subjectHash: this.tokenHasher.hash(normalizedEmail),
  providerRequestId,
});
```

Do not include `linkUrl`, token or email in any log branch.

- [ ] **Step 5: Run GREEN and scan logging statements**

Run:

```powershell
pnpm --dir api exec jest apps/meriter/test/uzz-config-validation.spec.ts apps/meriter/test/uzz-identity-security.spec.ts --runInBand
rg -n "linkUrl|rawToken|target" api/apps/meriter/src/infrastructure/auth
```

Expected: tests PASS; scan shows no sensitive value in logger arguments.

- [ ] **Step 6: Commit**

```bash
git add api/apps/meriter/src/config/validation.schema.ts api/apps/meriter/src/infrastructure/auth/email-login-link.service.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test/uzz-config-validation.spec.ts api/apps/meriter/test/uzz-identity-security.spec.ts
git commit -m "fix(uzz): fail safely when login email cannot be delivered"
```

### Task 3: Mongo-backed distributed rate limiting

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/ports/uzz-identity.port.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-rate-limit.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/security/mongoose-uzz-rate-limiter.ts`
- Modify: `api/apps/meriter/src/domain/domain.module.ts`
- Modify: `api/apps/meriter/src/infrastructure/auth/email-login-link.service.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/redeem-uzz-magic-link.use-case.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Modify: `Caddyfile`
- Test: `api/apps/meriter/test/uzz-rate-limiter.spec.ts`
- Test: `api/apps/meriter/test/uzz-identity-security.spec.ts`

**Interfaces:**
- Produces: `UzzRateLimiterPort.consume(input): Promise<RateLimitDecision>`.
- Consumes: normalized email hash, token hash, and trusted client IP from tRPC context.

- [ ] **Step 1: Replace the synchronous port contract in tests**

```ts
export interface UzzRateLimiterPort {
  consume(input: {
    scope: string;
    subjectHash: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
}
```

Add concurrent tests where two limiter instances share Mongo and 30 parallel calls yield exactly the configured number of allowed decisions.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-rate-limiter.spec.ts --runInBand`

Expected: FAIL because only the in-memory implementation exists.

- [ ] **Step 3: Implement atomic fixed-window counters**

Use `findOneAndUpdate` with `$inc`, `$setOnInsert`, unique `(scope, subjectHash, windowStart)` and TTL on `expiresAt`. Catch duplicate-key races and retry the same atomic update once. Never persist raw email/IP/token.

- [ ] **Step 4: Apply all five limits at the boundary**

The router extracts only the trusted proxy address. Email send consumes cooldown, email-hour and IP-hour limits before creating a token. Redeem consumes IP-window and token-hash-window limits before claim. Return one generic rate-limit error with `retryAfterSeconds`.

- [ ] **Step 5: Make proxy trust explicit**

Configure Caddy to overwrite, not append user-supplied forwarding headers. Add a test or config assertion showing an incoming spoofed header cannot become the limiter subject.

- [ ] **Step 6: Run GREEN and cardinality test**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-rate-limiter.spec.ts apps/meriter/test/uzz-identity-security.spec.ts --runInBand`

Expected: PASS for multi-instance concurrency, TTL cleanup and 20,000 unique subjects without process-memory growth.

- [ ] **Step 7: Commit**

```bash
git add api/apps/meriter/src/application/uzz/ports/uzz-identity.port.ts api/apps/meriter/src/infrastructure/uzz api/apps/meriter/src/infrastructure/auth/email-login-link.service.ts api/apps/meriter/src/application/uzz/use-cases/redeem-uzz-magic-link.use-case.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/src/domain/domain.module.ts api/apps/meriter/test Caddyfile
git commit -m "fix(uzz): enforce distributed magic-link rate limits"
```

### Task 4: Recoverable leased magic-link redemption

**Files:**
- Modify: `api/apps/meriter/src/domain/models/auth/auth-magic-link.schema.ts`
- Modify: `api/apps/meriter/src/application/uzz/ports/uzz-identity.port.ts`
- Modify: `api/apps/meriter/src/infrastructure/auth/magic-link-auth.service.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/redeem-uzz-magic-link.use-case.ts`
- Test: `api/apps/meriter/test/uzz-identity-security.spec.ts`

**Interfaces:**
- Produces: `claim`, `finalize`, `release` magic-link port methods and `UzzMagicLinkClaim`.
- Consumes: idempotent `UzzEmailIdentityGateway` and `UzzUnitOfWork`.

- [ ] **Step 1: Write failure-injection and concurrency RED tests**

Cover:

```ts
it('releases a claim after retryable identity failure');
it('releases a claim after UZZ transaction rollback');
it('allows only one concurrent live claim');
it('reclaims an abandoned claim after lease expiry');
it('finalized links can never be reclaimed');
```

The first attempt throws after claim; the second attempt with the same token succeeds and resolves the same canonical user.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-identity-security.spec.ts --runInBand`

Expected: FAIL because `redeem()` immediately writes `usedAt`.

- [ ] **Step 3: Add claim persistence fields and atomic updates**

Add nullable `claimId`, `claimedAt`, `claimExpiresAt`. Claim matches unused tokens with no live claim. Finalize matches `claimId` and writes `usedAt`; release clears only the matching claim.

- [ ] **Step 4: Orchestrate claim lifecycle in the use case**

```ts
const claimId = randomUUID();
const claim = await magicLinks.claim(token, claimId, now, 120_000);
if (!claim) throw new UzzUnauthorizedError('MAGIC_LINK_INVALID');
try {
  const result = await authenticateAndPersistIdentity(claim);
  if (!await magicLinks.finalize(claimId, clock.now())) throw new UzzConflictError('MAGIC_LINK_CLAIM_LOST');
  return result;
} catch (error) {
  if (isRetryableAuthenticationFailure(error)) await magicLinks.release(claimId);
  throw error;
}
```

Permanent validation failures finalize the token; retryable infrastructure failures release it.

- [ ] **Step 5: Run GREEN**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-identity-security.spec.ts --runInBand`

Expected: all replay, expiry, failure and concurrency cases PASS.

- [ ] **Step 6: Commit**

```bash
git add api/apps/meriter/src/domain/models/auth/auth-magic-link.schema.ts api/apps/meriter/src/application/uzz/ports/uzz-identity.port.ts api/apps/meriter/src/infrastructure/auth/magic-link-auth.service.ts api/apps/meriter/src/application/uzz/use-cases/redeem-uzz-magic-link.use-case.ts api/apps/meriter/test/uzz-identity-security.spec.ts
git commit -m "fix(uzz): make magic-link redemption recoverable"
```

### Task 5: Strict post-login navigation validation

**Files:**
- Modify: `uzz-web/src/lib/utils.ts`
- Modify: `uzz-web/src/app/login/page.tsx`
- Test: `uzz-web/src/lib/__tests__/utils.test.ts`
- Test: `uzz-web/src/app/login/login-page.test.tsx`

**Interfaces:**
- Produces: `safeAppPath(value, fallback)` accepting only canonical same-origin paths.

- [ ] **Step 1: Add adversarial RED cases**

```ts
it.each([
  ['//evil.test', '/'],
  ['/\\evil.test', '/'],
  ['/%5c%5cevil.test', '/'],
  ['https://evil.test', '/'],
  ['javascript:alert(1)', '/'],
  ['/deals?requested=1', '/deals?requested=1'],
])('normalizes %s', (input, expected) => expect(safeAppPath(input, '/')).toBe(expected));
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run src/lib/__tests__/utils.test.ts`

- [ ] **Step 3: Implement canonical URL validation**

Resolve against a fixed same-origin base, reject any different origin, username/password, backslash before/after decoding, control character or non-leading-slash result. Return only `pathname + search + hash`.

- [ ] **Step 4: Verify login navigation uses only the returned path**

Run: `pnpm --dir uzz-web test:unit -- --run src/lib/__tests__/utils.test.ts src/app/login/login-page.test.tsx`

Expected: PASS; invalid `next` values route to `/` without throwing.

- [ ] **Step 5: Run the complete plan gate and commit**

Run:

```powershell
pnpm --dir api exec jest "apps/meriter/test/uzz-.*\.spec\.ts$" --runInBand --forceExit
pnpm --dir uzz-web test:unit -- --run
pnpm --dir uzz-web lint
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web build
```

Expected: all commands exit 0.

```bash
git add uzz-web/src/lib/utils.ts uzz-web/src/lib/__tests__/utils.test.ts uzz-web/src/app/login
git commit -m "fix(uzz-web): constrain post-login navigation"
```
