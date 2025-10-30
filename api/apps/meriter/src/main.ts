require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MeriterModule } from './meriter.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(MeriterModule, {
    bodyParser: true,
    rawBody: true,
  });
  
  // CORS not needed - Caddy handles routing for both local dev and production
  
  const configService = app.get(ConfigService);

  // Global exception filter - using standardized API exception filter for all endpoints
  app.useGlobalFilters(new ApiExceptionFilter());

  // Global API response interceptor for standardized responses
  app.useGlobalInterceptors(new ApiResponseInterceptor());

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
