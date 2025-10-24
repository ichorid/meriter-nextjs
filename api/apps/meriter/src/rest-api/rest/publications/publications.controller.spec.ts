import { Test, TestingModule } from '@nestjs/testing';
import { RestPublicationsController } from './publications.controller';
import { PublicationsService } from '../../../publications/publications.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { UsersService } from '../../../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('RestPublicationsController', () => {
  let controller: RestPublicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestPublicationsController],
      providers: [
        {
          provide: PublicationsService,
          useValue: { 
            model: { findOne: jest.fn(), find: jest.fn() },
            getPublicationsOfAuthorTgId: jest.fn(),
            getPublicationsInTgChat: jest.fn(),
            getPublicationsInHashtagSlug: jest.fn(),
          },
        },
        {
          provide: TgBotsService,
          useValue: { updateUserChatMembership: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<RestPublicationsController>(RestPublicationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
