import { Test, TestingModule } from '@nestjs/testing';
import { RestCommunityifoController } from './communityinfo.controller';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { HashtagsService } from '../../../hashtags/hashtags.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { UsersService } from '../../../users/users.service';

describe('CommunityinfoController', () => {
  let controller: RestCommunityifoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestCommunityifoController],
      providers: [
        {
          provide: TgChatsService,
          useValue: { getInfo: jest.fn() },
        },
        {
          provide: HashtagsService,
          useValue: { model: { findOne: jest.fn() } },
        },
        {
          provide: TgBotsService,
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<RestCommunityifoController>(
      RestCommunityifoController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
