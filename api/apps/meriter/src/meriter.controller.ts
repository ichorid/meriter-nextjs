import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeriterService } from './meriter.service';
import { Response } from 'express';
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

  // Serve favicon
  @Get('favicon.ico')
  favicon(@Res() res: Response): void {
    try {
      // Try multiple possible paths for favicon
      const possiblePaths = [
        // Production: /app/public/favicon.ico
        path.join(process.cwd(), 'public', 'favicon.ico'),
        // Development: from dist/apps/meriter, go to source public directory
        path.join(__dirname, '../../../apps/meriter/public', 'favicon.ico'),
        // Alternative: from api directory root
        path.join(process.cwd(), 'apps', 'meriter', 'public', 'favicon.ico'),
      ];

      let faviconPath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          faviconPath = possiblePath;
          break;
        }
      }

      if (faviconPath) {
        const favicon = fs.readFileSync(faviconPath);
        res.setHeader('Content-Type', 'image/x-icon');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.send(favicon);
      } else {
        res.status(HttpStatus.NOT_FOUND).send();
      }
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
