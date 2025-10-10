import { NestFactory } from '@nestjs/core';
import { MeriterModule } from './meriter.module';
import * as cookieParser from 'cookie-parser';
declare const module: any;

// Load environment variables from .env file if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'afdasdfubqi4tb2i4bpadfs132'; // Fallback for development
}
if (!process.env.MONGO_CONNECTION_NAME) {
  process.env.MONGO_CONNECTION_NAME = 'MONGO_URL_PROD_REMOTE_2';
}

async function bootstrap() {
  const app = await NestFactory.create(MeriterModule);
  app.use(cookieParser());
  await app.listen(8002);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
