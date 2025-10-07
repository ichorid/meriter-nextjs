import { Test, TestingModule } from '@nestjs/testing';
import { RestGetmeController } from './getme.controller';
import { UsersService } from '../../../users/users.service';

describe('RestGetmeController', () => {
  let controller: RestGetmeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestGetmeController],
      providers: [
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<RestGetmeController>(RestGetmeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
