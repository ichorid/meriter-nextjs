/**
 * Sentry Edge Configuration
 * 
 * This file configures Sentry for the Next.js Edge runtime.
 * It runs on edge functions and middleware.
 */

import * as Sentry from '@sentry/nextjs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const TRACES_SAMPLE_RATE = parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '1.0');

// Only initialize Sentry if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: `@meriter/web@${packageJson.version}`,
    
    // Performance monitoring
    tracesSampleRate: TRACES_SAMPLE_RATE,
    
    // Capture unhandled promise rejections
    captureUnhandledRejections: true,
  });
}

