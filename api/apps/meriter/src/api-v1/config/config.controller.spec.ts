import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { ConfigController } from './config.controller';

describe('ConfigController', () => {
  let configController: ConfigController;
  let configService: ConfigService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    configController = app.get<ConfigController>(ConfigController);
    configService = app.get<ConfigService>(ConfigService);
  });

  describe('getConfig', () => {
    it('should return bot username when BOT_USERNAME is set', () => {
      process.env.BOT_USERNAME = 'test_bot';
      const result = configController.getConfig();
      
      expect(result).toEqual({ botUsername: 'test_bot' });
      delete process.env.BOT_USERNAME;
    });

    it('should return null when BOT_USERNAME is not set', () => {
      const originalBotUsername = process.env.BOT_USERNAME;
      delete process.env.BOT_USERNAME;
      
      const result = configController.getConfig();
      expect(result).toEqual({ botUsername: null });
      
      if (originalBotUsername) {
        process.env.BOT_USERNAME = originalBotUsername;
      }
    });

    it('should return null when BOT_USERNAME is empty string', () => {
      const originalBotUsername = process.env.BOT_USERNAME;
      process.env.BOT_USERNAME = '';
      
      const result = configController.getConfig();
      expect(result).toEqual({ botUsername: null });
      
      if (originalBotUsername) {
        process.env.BOT_USERNAME = originalBotUsername;
      } else {
        delete process.env.BOT_USERNAME;
      }
    });

    it('should return null when BOT_USERNAME is only whitespace', () => {
      const originalBotUsername = process.env.BOT_USERNAME;
      process.env.BOT_USERNAME = '   ';
      
      const result = configController.getConfig();
      expect(result).toEqual({ botUsername: null });
      
      if (originalBotUsername) {
        process.env.BOT_USERNAME = originalBotUsername;
      } else {
        delete process.env.BOT_USERNAME;
      }
    });
  });
});

