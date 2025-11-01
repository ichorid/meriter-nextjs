import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeriterService } from './meriter.service';

@Controller()
export class MeriterController {
  constructor(
    private readonly meriterService: MeriterService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.meriterService.getHello();
  }

  @Get('health')
  health(): string {
    // Fail fast - validate BOT_USERNAME in production
    const nodeEnv = this.configService.get<string>('app.env');
    const isProduction = nodeEnv === 'production';
    
    if (isProduction) {
      const botUsername = process.env.BOT_USERNAME;
      if (!botUsername || botUsername.trim() === '') {
        throw new HttpException(
          'BOT_USERNAME is not configured',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
    
    return 'ok';
  }
}
