import { LedgerAnalyticsService } from './ledger-analytics.service';

function buildHarness() {
  const prisma: any = {
    glDailyRollup: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(1),
    },
    glAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 'platform-account' }),
    },
    glTransfer: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };

  return { service: new LedgerAnalyticsService(prisma), prisma };
}

describe('LedgerAnalyticsService', () => {
  it('rebuilds rollups from first-step transfer values, counted once', async () => {
    const { service, prisma } = buildHarness();
    prisma.$queryRaw.mockResolvedValue([
      { date: '2026-11-19', platform_id: 'mcom-mall', intent: 'ORDER', currency: 'GBP', amount_minor: 45000n, n: 5 },
      { date: '2026-11-19', platform_id: 'mcom-central', intent: 'PURCHASE', currency: 'GBP', amount_minor: 2900n, n: 1 },
    ]);

    const result = await service.rebuildRange(
      new Date('2026-11-19T00:00:00Z'),
      new Date('2026-11-20T00:00:00Z'),
    );

    expect(result.rows).toBe(2);
    expect(prisma.glDailyRollup.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          date: '2026-11-19',
          platformId: 'mcom-mall',
          intent: 'ORDER',
          debitMinor: 45000n,
          txnCount: 5,
        }),
        expect.objectContaining({ platformId: 'mcom-central', intent: 'PURCHASE' }),
      ],
      skipDuplicates: true,
    });
    // The range is cleared before it is rebuilt.
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('merges rollup volume with platform flow into trend buckets', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.findMany.mockResolvedValue([
      { date: '2026-11-18', platformId: 'mcom-mall', intent: 'ORDER', debitMinor: 10000n, txnCount: 2 },
      { date: '2026-11-18', platformId: 'mcom-central', intent: 'PURCHASE', debitMinor: 5000n, txnCount: 1 },
      { date: '2026-11-19', platformId: 'mcom-mall', intent: 'ORDER', debitMinor: 7000n, txnCount: 1 },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { bucket: new Date('2026-11-18T00:00:00Z'), direction: 'credit', total: 12000n },
      { bucket: new Date('2026-11-18T00:00:00Z'), direction: 'debit', total: 2000n },
    ]);

    const result = await service.trend({
      from: '2026-11-18',
      to: '2026-11-19',
      groupBy: 'day',
    });

    expect(result.data).toEqual([
      {
        bucket: '2026-11-18',
        volumeMinor: '15000',
        transfers: 3,
        platformInflowMinor: '12000',
        platformOutflowMinor: '2000',
      },
      {
        bucket: '2026-11-19',
        volumeMinor: '7000',
        transfers: 1,
        platformInflowMinor: '0',
        platformOutflowMinor: '0',
      },
    ]);
    expect(result.meta.groupBy).toBe('day');
  });

  it('groups weekly buckets from a Monday', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.findMany.mockResolvedValue([
      { date: '2026-11-16', platformId: 'mcom-mall', intent: 'ORDER', debitMinor: 1000n, txnCount: 1 },
      { date: '2026-11-22', platformId: 'mcom-mall', intent: 'ORDER', debitMinor: 2000n, txnCount: 1 },
    ]);

    const result = await service.trend({ from: '2026-11-16', to: '2026-11-22', groupBy: 'week' });

    // 16 Nov 2026 is a Monday; 22 Nov is the Sunday of the same week.
    expect(result.data).toHaveLength(1);
    expect(result.data[0].bucket).toBe('2026-11-16');
    expect(result.data[0].volumeMinor).toBe('3000');
  });

  it('ranks platforms by volume and carries their platform flow', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.groupBy.mockResolvedValue([
      { platformId: 'mcom-mall', _sum: { debitMinor: 40000n, txnCount: 4 } },
      { platformId: 'mcom-central', _sum: { debitMinor: 9000n, txnCount: 2 } },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { platform_id: 'mcom-mall', direction: 'credit', total: 44000n },
      { platform_id: 'mcom-mall', direction: 'debit', total: 4000n },
      { platform_id: 'mcom-central', direction: 'credit', total: 9000n },
    ]);

    const result = await service.byPlatform('2026-11-01', '2026-11-30');

    expect(result.data[0]).toMatchObject({
      platformId: 'mcom-mall',
      volumeMinor: '40000',
      transfers: 4,
      platformInflowMinor: '44000',
      platformOutflowMinor: '4000',
    });
    expect(result.totals).toEqual({
      volumeMinor: '49000',
      platformInflowMinor: '53000',
      platformOutflowMinor: '4000',
    });
  });

  it('computes intent share of total volume', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.groupBy.mockResolvedValue([
      { intent: 'ORDER', _sum: { debitMinor: 7500n, txnCount: 3 } },
      { intent: 'PURCHASE', _sum: { debitMinor: 2500n, txnCount: 1 } },
    ]);

    const result = await service.byIntent('2026-11-01', '2026-11-30');

    expect(result.data[0]).toMatchObject({ intent: 'ORDER', volumeMinor: '7500', share: 75 });
    expect(result.data[1]).toMatchObject({ intent: 'PURCHASE', share: 25 });
    expect(result.meta.totalVolumeMinor).toBe('10000');
  });

  it('rebuilds a range that has transfers but no rollups, before reading', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.count.mockResolvedValue(0);
    prisma.glTransfer.count.mockResolvedValue(4);
    const rebuild = jest.spyOn(service as any, 'rebuildRange').mockResolvedValue({ days: 2, rows: 3 });

    await service.trend({ from: '2026-11-20', to: '2026-11-21', groupBy: 'day' });

    expect(rebuild).toHaveBeenCalled();
  });

  it('does not rebuild when rollups already exist', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.count.mockResolvedValue(5);
    const rebuild = jest.spyOn(service as any, 'rebuildRange').mockResolvedValue({ days: 2, rows: 3 });

    await service.byPlatform('2026-11-20', '2026-11-21');

    expect(rebuild).not.toHaveBeenCalled();
  });

  it('does not rebuild an empty range', async () => {
    const { service, prisma } = buildHarness();
    prisma.glDailyRollup.count.mockResolvedValue(0);
    prisma.glTransfer.count.mockResolvedValue(0);
    const rebuild = jest.spyOn(service as any, 'rebuildRange').mockResolvedValue({ days: 2, rows: 0 });

    await service.byIntent('2026-11-20', '2026-11-21');

    expect(rebuild).not.toHaveBeenCalled();
  });
});
