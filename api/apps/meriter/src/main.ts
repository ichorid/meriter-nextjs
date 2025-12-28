import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MeriterModule } from './meriter.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { TrpcService } from './trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as Sentry from '@sentry/node';
declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Initialize Sentry before creating NestJS app
  const sentryDsn = process.env.SENTRY_DSN;
  const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
  const sentryRelease = process.env.SENTRY_RELEASE;
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0');
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0');
  
  if (sentryDsn) {
    const sentryConfig: Sentry.NodeOptions = {
      dsn: sentryDsn,
      environment: sentryEnvironment,
      ...(sentryRelease ? { release: sentryRelease } : {}),
      tracesSampleRate,
      // Enable logging
      enableLogs: true,
      // Capture unhandled promise rejections
      captureUnhandledRejections: true,
      // Set platform tag to distinguish backend from frontend
      initialScope: {
        tags: {
          platform: 'backend',
        },
      },
    };
    
    // Build integrations array
    // Note: consoleLoggingIntegration is only available in @sentry/nextjs, not @sentry/node
    // For Node.js backend, console logs are typically handled via logger or can be manually captured
    const integrations: Sentry.Integration[] = [];
    
    // HTTP instrumentation is enabled by default in Sentry v8, but we can explicitly add it
    // to ensure Express routes are tracked
    try {
      // HTTP integration is automatically included, but we ensure it's enabled
      // Sentry v8 automatically instruments HTTP requests when tracesSampleRate > 0
    } catch {
      // Ignore
    }
    
    // Add profiling integration if available (optional dependency)
    try {
      const profilingModule = await import('@sentry/profiling-node');
      const profilingIntegration = profilingModule.nodeProfilingIntegration;
      sentryConfig.profilesSampleRate = profilesSampleRate;
      integrations.push(profilingIntegration());
    } catch {
      // Profiling package not installed, skip it
      logger.debug('Sentry profiling not available (optional)');
    }
    
    // Only set integrations if we have any
    if (integrations.length > 0) {
      sentryConfig.integrations = integrations;
    }
    
    Sentry.init(sentryConfig);
    logger.log(`✅ Sentry initialized for environment: ${sentryEnvironment}`);
  } else {
    logger.warn('⚠️  Sentry DSN not configured (optional)');
  }
  
  // Fail fast - validate required environment variables in production
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  
  // Log Google OAuth configuration status (for debugging)
  const googleClientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
  const googleRedirectUri = process.env.OAUTH_GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  
  if (googleClientId && googleClientSecret && googleRedirectUri) {
    logger.log('✅ Google OAuth configured');
    logger.debug(`Google OAuth callback URL: ${googleRedirectUri}`);
  } else {
    logger.warn('⚠️  Google OAuth not configured (optional)');
    logger.debug(`Google OAuth status: clientId=${!!googleClientId}, clientSecret=${!!googleClientSecret}, redirectUri=${!!googleRedirectUri}`);
  }
  
  // Log Telegram bot configuration status (optional)
  const botUsername = process.env.BOT_USERNAME;
  const botToken = process.env.BOT_TOKEN;
  
  if (botUsername && botToken) {
    logger.log('✅ Telegram bot configured');
    logger.debug(`Telegram bot username: ${botUsername}`);
  } else {
    logger.warn('⚠️  Telegram bot not configured (optional)');
    logger.debug(`Telegram bot status: username=${!!botUsername}, token=${!!botToken}`);
  }
  
  // Early validation before DI - use process.env
  // Full validation with ConfigService happens after app creation
  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      logger.error('❌ JWT_SECRET environment variable is required but not set');
      logger.error('Application cannot start without JWT_SECRET in production');
      process.exit(1);
    }
  }
  
  const app = await NestFactory.create(MeriterModule, {
    bodyParser: true,
    rawBody: true,
  });

  // ---------------------------------------------------------------------------
  // CRITICAL: Mount tRPC middleware on the raw Express instance *before*
  // Nest registers its routes and its default 404 handler.
  //
  // In production, the web app sends batched tRPC requests where the path contains
  // commas, e.g.:
  //   /trpc/config.getConfig,users.getMe?batch=1&input=...
  //
  // If Nest's router gets this request first, it returns a plain 404 (Cannot GET ...).
  // By attaching the middleware at the Express layer early, we ensure these requests
  // are always handled by tRPC.
  // ---------------------------------------------------------------------------
  try {
    const expressApp = app.getHttpAdapter().getInstance();
    
    // CRITICAL: Mount cookie parser BEFORE tRPC middleware
    // This ensures cookies are parsed and available in req.cookies for tRPC context
    expressApp.use(cookieParser());
    logger.log('✅ Cookie parser middleware mounted (before tRPC)');
    
    const trpcService = app.get(TrpcService);
    const trpcMiddleware = createExpressMiddleware({
      router: trpcService.getRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        logger.error(`tRPC error on '${path}':`, error);
      },
    });
    expressApp.use('/trpc', trpcMiddleware);
    logger.log('✅ tRPC middleware mounted at /trpc');
  } catch (error) {
    logger.error('❌ Failed to mount tRPC middleware at /trpc', error as any);
    throw error;
  }
  
  // CRITICAL: Trust proxy to read X-Forwarded-Proto header from Caddy
  // This is essential for CI/CD dev targets where web is static (same as production)
  // but requests come via HTTPS through Caddy reverse proxy
  // Without this, req.secure will always be false even when requests are HTTPS
  // Trust only the first proxy (Caddy) for better security (defense-in-depth)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  
  // Enable CORS for development (when not using Caddy)
  // In production, Caddy handles routing and CORS is not needed
  if (!isProduction) {
    app.enableCors({
      origin: ['http://localhost:8001', 'http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:8001', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    logger.log('CORS enabled for development');
  }
  
  const configService = app.get(ConfigService);

  // Validate critical configuration after app creation (using ConfigService)
  // Early checks above use process.env because they run before DI is available
  if (isProduction) {
    try {
      configService.getOrThrow('jwt.secret');
    } catch (_error) {
      logger.error('❌ JWT_SECRET environment variable is required but not set');
      logger.error('Application cannot start without JWT_SECRET in production');
      process.exit(1);
    }
  }

  // Global exception filter - using standardized API exception filter for all endpoints
  app.useGlobalFilters(new ApiExceptionFilter());

  // Global API response interceptor for standardized responses
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  // Global validation pipe
  // Note: ZodValidationPipe applied via @ZodValidation decorator takes precedence
  // for specific routes. The global ValidationPipe remains for backward compatibility
  // and routes without explicit Zod validation.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Note: Cookie parser is already mounted above (before tRPC middleware)
  // This second mount is for other routes, but it's redundant - keeping for backward compatibility
  app.use(cookieParser());
  logger.debug('Cookie parser also mounted globally (redundant but safe)');
  
  const port = configService.get<number>('app.port') ?? 8002;
  // Ensure Nest finishes initialization after our early Express middleware mounts.
  await app.init();
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
