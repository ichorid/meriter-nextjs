import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeriterService } from './meriter.service';
import * as path from 'path';
import * as fs from 'fs';

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

  @Get('version')
  getVersion(): { version: string } {
    try {
      // In production (Docker), package.json is in /app, in development it's in ../../../ from dist
      const packageJsonPath = process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), 'package.json')
        : path.join(__dirname, '../../../package.json');
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return { version: packageJson.version || 'unknown' };
    } catch (error) {
      return { version: 'unknown' };
    }
  }

  // Support /api/version path (when routed through Caddy)
  @Get('api/version')
  getVersionApi(): { version: string } {
    return this.getVersion();
  }
}
