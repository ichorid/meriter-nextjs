require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { MeriterModule } from './meriter.module';
import * as cookieParser from 'cookie-parser';
declare const module: any;

// Load environment variables from .env file if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'afdasdfubqi4tb2i4bpadfs132'; // Fallback for development
}

async function bootstrap() {
  const app = await NestFactory.create(MeriterModule);
  app.use(cookieParser());
  const port = process.env.PORT || 8002;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
