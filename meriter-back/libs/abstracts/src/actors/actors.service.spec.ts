import { Test, TestingModule } from '@nestjs/testing';
import { ActorsService } from './actors.service';
import { DatabaseTestModule } from '@common/abstracts/helpers/database/database-test.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Actor,
  ActorSchema,
} from '@common/abstracts/actors/schema/actor.schema';

describe('ActorsService', () => {
  let service: ActorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        DatabaseTestModule,
        MongooseModule.forFeature(
          [{ name: Actor.name, schema: ActorSchema }],
          'local-test',
        ),
      ],

      providers: [ActorsService],
    }).compile();

    service = module.get<ActorsService>(ActorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upsert value', () => {
    service.upsert(
      'test',
      { 'meta.test': 1 },
      {
        meta: { test: 1 },
      },
    );
    expect(service).toBeDefined();
  });

  afterAll(async () => {
    await service.__testCleanup();
  });
});
