import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import { AgreementsService } from '@common/abstracts/agreements/agreements.service';
import { PublicationsService } from '../publications/publications.service';
import { UsersService } from '../users/users.service';
import { HashtagsService } from '../hashtags/hashtags.service';
import { UpdatesConductorsService } from '../updates-conductors/updates-conductors.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: WalletsService,
          useValue: { delta: jest.fn(), getValue: jest.fn() },
        },
        {
          provide: AgreementsService,
          useValue: {
            model: {
              aggregate: jest.fn().mockReturnThis(),
              sort: jest.fn(),
              findOne: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: PublicationsService,
          useValue: { model: { findOne: jest.fn() } },
        },
        {
          provide: UsersService,
          useValue: { model: { findOne: jest.fn() } },
        },
        {
          provide: HashtagsService,
          useValue: { model: { findOne: jest.fn() } },
        },
        {
          provide: UpdatesConductorsService,
          useValue: { pushUpdate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
