require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MeriterModule } from './meriter.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
// import { TransformInterceptor } from './common/interceptors/transform.interceptor';
declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(MeriterModule, {
    bodyParser: true,
    rawBody: true,
  });
  
  // CORS not needed - Caddy handles routing for both local dev and production
  
  // Add raw body logging middleware
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'POST' && req.path.includes('/api/rest/transaction')) {
      logger.log(`📥 Middleware - Method: ${req.method}, Path: ${req.path}`);
      logger.log(`📥 Content-Type: ${req.headers['content-type']}`);
      logger.log(`📥 Content-Length: ${req.headers['content-length']}`);
      logger.log(`📥 req.body:`, req.body);
      logger.log(`📥 req.body type:`, typeof req.body);
      logger.log(`📥 req.body keys:`, Object.keys(req.body || {}));
    }
    next();
  });
  
  const configService = app.get(ConfigService);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
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

  // Note: TransformInterceptor is available but not enabled by default
  // to avoid breaking existing API contracts. Enable if needed:
  // app.useGlobalInterceptors(new TransformInterceptor());

  app.use(cookieParser());
  
  const port = configService.get<number>('app.port');
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
