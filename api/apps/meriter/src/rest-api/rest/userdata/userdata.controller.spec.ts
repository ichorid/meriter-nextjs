import { Test, TestingModule } from '@nestjs/testing';
import { RestUserdataController } from './userdata.controller';
import { UsersService } from '../../../users/users.service';

describe('UserdataController', () => {
  let controller: RestUserdataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestUserdataController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfileByTelegramId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RestUserdataController>(RestUserdataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
