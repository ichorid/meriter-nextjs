import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestWalletController } from './wallet.controller';
import { WalletsService } from '../../../wallets/wallets.service';
import { UsersService } from '../../../users/users.service';

describe('WalletController', () => {
  let controller: RestWalletController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestWalletController],
      providers: [
        {
          provide: WalletsService,
          useValue: {
            getValue: jest.fn(),
            model: { find: jest.fn() },
          },
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

    controller = module.get<RestWalletController>(RestWalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
