/**
 * Sentry Client Configuration
 * 
 * This file configures Sentry for the Next.js client-side bundle.
 * It runs in the browser and tracks client-side errors and performance.
 */

import * as Sentry from '@sentry/nextjs';
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
    
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    // This enables trace headers for API requests to facilitate distributed tracing
    tracePropagationTargets: [
      'localhost',
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
      // Same-origin requests (API routes and tRPC)
      /^\/api\//,
      /^\/trpc/,
    ],
    
    // Profiling configuration
    // Set profileSessionSampleRate to 1.0 to profile during every session.
    // The decision, whether to profile or not, is made once per session (when the SDK is initialized).
    profileSessionSampleRate: PROFILE_SESSION_SAMPLE_RATE,
    
    // Capture unhandled promise rejections
    captureUnhandledRejections: true,
    
    // Integrations
    integrations: [
      // Browser tracing integration for distributed tracing
      Sentry.browserTracingIntegration(),
      // Browser profiling integration
      Sentry.browserProfilingIntegration(),
      // Send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
      // Replay can be enabled later if needed
      // Sentry.replayIntegration({
      //   maskAllText: true,
      //   blockAllMedia: true,
      // }),
    ],
    
    // Set platform tag to distinguish frontend from backend
    initialScope: {
      tags: {
        platform: 'frontend',
      },
    },
    
    // Filter out common errors that aren't actionable
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      'atomicFindClose',
      'fb_xd_fragment',
      'bmi_SafeAddOnload',
      'EBCallBackMessageReceived',
      'conduitPage',
      // Network errors that are often not actionable
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
      // Chunk load errors (handled by ErrorBoundary)
      'ChunkLoadError',
      'Loading chunk',
      'Failed to load chunk',
    ],
    
    // Filter out URLs that shouldn't be tracked
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
  });
}

