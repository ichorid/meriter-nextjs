import { Test, TestingModule } from '@nestjs/testing';
import { PublicationsinfController } from './publicationsinf.controller';
import { PublicationsService } from '../../../publications/publications.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { UsersService } from '../../../users/users.service';

describe('PublicationsinfController', () => {
  let controller: PublicationsinfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PublicationsService,
          useValue: {
            getPublicationsOfAuthorTgId: jest.fn(),
            getPublicationsInTgChat: jest.fn(),
            getPublicationsInHashtagSlug: jest.fn(),
            model: { findOne: jest.fn() },
          },
        },
        {
          provide: TgBotsService,
          useValue: {
            updateCredentialsForChatId: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
      ],
      controllers: [PublicationsinfController],
    }).compile();

    controller = module.get<PublicationsinfController>(
      PublicationsinfController,
    );
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();
    //const p = await controller.publicationsinf('/c/-400774319', 0, 10);
  });
});
