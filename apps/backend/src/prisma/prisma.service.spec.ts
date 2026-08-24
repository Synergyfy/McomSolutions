import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

/**
 * PrismaService integration test.
 *
 * Uses the mcom_mall_test database (set by jest-setup.ts via DATABASE_URL).
 * The seed guard in onModuleInit ensures no bcrypt work happens in NODE_ENV=test.
 * This gives us real signal that Prisma can connect and disconnect cleanly.
 */
describe('PrismaService', () => {
  let service: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    await service.onModuleInit();
  }, 10000);

  afterAll(async () => {
    await service.onModuleDestroy();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should connect to the test database and execute a raw query', async () => {
    // A simple raw query that every Postgres DB supports.
    const result = await service.$queryRaw<[{ result: number }]>`SELECT 1 AS result`;
    expect(result[0].result).toBe(1);
  });

  it('should have $connect and $disconnect methods', () => {
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });

  it('should have lifecycle hook methods', () => {
    expect(typeof service.onModuleInit).toBe('function');
    expect(typeof service.onModuleDestroy).toBe('function');
  });
});
