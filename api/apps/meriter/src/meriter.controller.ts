import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeriterService } from './meriter.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppConfig } from './config/configuration';

@Controller()
export class MeriterController {
  constructor(
    private readonly meriterService: MeriterService,
    private readonly configService: ConfigService<AppConfig>,
  ) { }

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
    } catch (_error) {
      return { version: 'unknown' };
    }
  }

  // Support /api/version path (when routed through Caddy)
  @Get('api/version')
  getVersionApi(): { version: string } {
    return this.getVersion();
  }

  // Helper method to serve static files
  private serveStaticFile(
    filename: string,
    contentType: string,
    res: Response,
  ): void {
    try {
      const possiblePaths = [
        // Production: /app/public/
        path.join(process.cwd(), 'public', filename),
        // Development: from dist/apps/meriter
        path.join(__dirname, '../../../apps/meriter/public', filename),
        // Alternative: from api directory root
        path.join(process.cwd(), 'apps', 'meriter', 'public', filename),
      ];

      let filePath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          filePath = possiblePath;
          break;
        }
      }

      if (filePath) {
        const fileContent = fs.readFileSync(filePath);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.send(fileContent);
      } else {
        res.status(HttpStatus.NOT_FOUND).send();
      }
    } catch (_error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  // Serve favicon.ico
  @Get('favicon.ico')
  favicon(@Res() res: Response): void {
    this.serveStaticFile('favicon.ico', 'image/x-icon', res);
  }

  // Serve favicon-96x96.png
  @Get('favicon-96x96.png')
  faviconPng(@Res() res: Response): void {
    this.serveStaticFile('favicon-96x96.png', 'image/png', res);
  }

  // Serve favicon.svg
  @Get('favicon.svg')
  faviconSvg(@Res() res: Response): void {
    this.serveStaticFile('favicon.svg', 'image/svg+xml', res);
  }

  // Serve apple-touch-icon.png
  @Get('apple-touch-icon.png')
  appleTouchIcon(@Res() res: Response): void {
    this.serveStaticFile('apple-touch-icon.png', 'image/png', res);
  }

  // Serve site.webmanifest
  @Get('site.webmanifest')
  webManifest(@Res() res: Response): void {
    this.serveStaticFile('site.webmanifest', 'application/manifest+json', res);
  }
}
