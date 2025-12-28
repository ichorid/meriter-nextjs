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
  
  // Replay can be enabled later if needed
  // integrations: [
  //   Sentry.replayIntegration({
  //     maskAllText: true,
  //     blockAllMedia: true,
  //   }),
  // ],
  
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

