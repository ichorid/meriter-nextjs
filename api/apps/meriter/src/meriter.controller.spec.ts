import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { _HttpException } from '@nestjs/common';
import { MeriterController } from './meriter.controller';
import { MeriterService } from './meriter.service';

describe('MeriterController', () => {
  let meriterController: MeriterController;
  let configService: ConfigService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MeriterController],
      providers: [
        MeriterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.env') {
                return process.env.NODE_ENV || 'development';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    meriterController = app.get<MeriterController>(MeriterController);
    configService = app.get<ConfigService>(ConfigService);
  });

  describe('root', () => {
    it('should return "Hello World!!!!"', () => {
      expect(meriterController.getHello()).toBe('Hello World!!!!');
    });
  });

  describe('health', () => {
    it('should return "ok" in development', () => {
      jest.spyOn(configService, 'get').mockReturnValue('development');
      expect(meriterController.health()).toBe('ok');
    });

    it('should return "ok" in production when BOT_USERNAME is set', () => {
      jest.spyOn(configService, 'get').mockReturnValue('production');
      process.env.BOT_USERNAME = 'test_bot';
      expect(meriterController.health()).toBe('ok');
      delete process.env.BOT_USERNAME;
    });

    it('should return "ok" in production when BOT_USERNAME is not set (optional)', () => {
      jest.spyOn(configService, 'get').mockReturnValue('production');
      const originalBotUsername = process.env.BOT_USERNAME;
      delete process.env.BOT_USERNAME;
      
      expect(meriterController.health()).toBe('ok');
      
      if (originalBotUsername) {
        process.env.BOT_USERNAME = originalBotUsername;
      }
    });
  });
});