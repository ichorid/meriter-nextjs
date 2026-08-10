/**
 * inv-21 — Canonical scheduled-job paths (BC-14 platform automation).
 *
 * Phase 2 shell: Nest `@Cron` decorators live on infrastructure entrypoints; domain
 * services retain business logic and interim `@Cron` until `CronInfrastructureModule`
 * replaces per-job modules in `meriter.module.ts`.
 */
export const INV_21_CRON_PATHS = {
  quotaReset: {
    schedule: '0 0 * * *',
    entrypoint: 'infrastructure/cron/quota-reset.cron.ts',
    domainLogic: 'domain/services/quota-reset.service.ts',
    method: 'resetAllCommunitiesQuotaAtMidnight',
    legacyModule: 'domain/services/quota-reset.module.ts',
  },
  postClosing: {
    ttlAutoClose: {
      schedule: '0 * * * *',
      entrypoint: 'infrastructure/cron/post-closing.cron.ts',
      domainLogic: 'domain/services/post-closing-cron.service.ts',
      method: 'closeExpiredTtlPosts',
      invariant: 'D-5',
    },
    ttlWarning: {
      schedule: '0 * * * *',
      entrypoint: 'infrastructure/cron/post-closing.cron.ts',
      domainLogic: 'domain/services/post-closing-cron.service.ts',
      method: 'sendTtlWarningNotifications',
      invariant: 'D-6',
    },
    inactivityClose: {
      schedule: '0 0 * * *',
      entrypoint: 'infrastructure/cron/post-closing.cron.ts',
      domainLogic: 'domain/services/post-closing-cron.service.ts',
      method: 'closeInactivePostsAndSendWarnings',
      invariant: 'D-7',
    },
    legacyModule: 'domain/services/post-closing-cron.module.ts',
  },
  documentWave: {
    schedule: '*/5 * * * *',
    entrypoint: 'infrastructure/cron/document-wave.cron.ts',
    domainLogic: 'domain/services/document-wave-cron.service.ts',
    method: 'sweepExpiredWaves',
    legacyModule: 'domain/services/document-wave-cron.module.ts',
  },
} as const;
