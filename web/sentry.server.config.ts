/**
 * Sentry Server Configuration
 * 
 * This file configures Sentry for the Next.js server-side bundle.
 * It runs on the Node.js server and tracks server-side errors and performance.
 */

import * as Sentry from '@sentry/nextjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const TRACES_SAMPLE_RATE = parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '1.0');
const PROFILE_SESSION_SAMPLE_RATE = parseFloat(process.env.NEXT_PUBLIC_SENTRY_PROFILE_SESSION_SAMPLE_RATE || '1.0');

// Only initialize Sentry if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: `@meriter/web@${packageJson.version}`,
    
    // Enable logging
    enableLogs: true,
    
    // Performance monitoring - tracing must be enabled for profiling to work
    tracesSampleRate: TRACES_SAMPLE_RATE,
    
    // Profiling configuration
    profileSessionSampleRate: PROFILE_SESSION_SAMPLE_RATE,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',
    
    // Capture unhandled promise rejections
    captureUnhandledRejections: true,
    
    // Integrations
    integrations: [
      // Send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
      // Node.js profiling integration
      nodeProfilingIntegration(),
    ],
    
    // Set platform tag to distinguish frontend from backend
    initialScope: {
      tags: {
        platform: 'frontend',
        runtime: 'server',
      },
    },
  });
}

