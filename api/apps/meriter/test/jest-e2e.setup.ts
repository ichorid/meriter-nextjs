/**
 * Jest E2E setup for @meriter/api.
 *
 * This file runs BEFORE test files are evaluated (setupFiles), so it can set
 * required env vars before Nest modules (MeriterModule -> ConfigModule.forRoot)
 * are imported and validated.
 */

// Core required by config validation (see `apps/meriter/src/config/validation.schema.ts`)
process.env.NODE_ENV ||= 'test';
process.env.DOMAIN ||= 'localhost';
process.env.PORT ||= '3000';
process.env.JWT_SECRET ||= 'test-jwt-secret-key';

// These are overwritten per-suite by TestDatabaseHelper/TestSetupHelper, but must
// exist early to satisfy config schema validation at import time.
process.env.MONGO_URL ||= 'mongodb://localhost:27017/meriter_test';
process.env.MONGO_URL_SECONDARY ||= 'mongodb://localhost:27017/meriter_test_secondary';


