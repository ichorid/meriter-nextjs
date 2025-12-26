import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MeriterModule } from './meriter.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { TrpcService } from './trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
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
    } catch (error) {
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

  app.use(cookieParser());
  
  // Register tRPC middleware directly with Express to handle batch requests with commas
  // This bypasses NestJS routing which doesn't handle comma-separated paths well
  const trpcService = app.get(TrpcService);
  const trpcMiddleware = createExpressMiddleware({
    router: trpcService.getRouter(),
    createContext: ({ req, res }) => trpcService.createContext(req, res),
    onError({ error, path }) {
      logger.error(`tRPC error on '${path}':`, error);
    },
  });
  app.use('/trpc', trpcMiddleware);
  
  const port = configService.get<number>('app.port') ?? 8002;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
