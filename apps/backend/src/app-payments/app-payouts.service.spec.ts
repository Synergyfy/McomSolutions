import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { AppPayoutsService } from './app-payouts.service';

function buildHarness() {
  const payout = {
    id: 'po_1',
    appClientId: 'mcom-mall',
    amountMinor: 8719n,
    currency: 'GBP',
    status: 'pending',
    transferId: null,
    provider: null,
    providerRef: null,
    requestedBy: 'admin_1',
    approvedBy: null,
    failureReason: null,
  };

  const prisma: any = {
    appPayout: {
      findUnique: jest.fn().mockResolvedValue(payout),
      create: jest.fn().mockResolvedValue(payout),
      update: jest.fn(async ({ data }: any) => ({ ...payout, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: 0n } }),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    glAccount: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    $transaction: jest.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };

  const posting = { post: jest.fn().mockResolvedValue({ transferId: 'tr_payout', replayed: false }) };

  return { service: new AppPayoutsService(prisma, posting as any), prisma, posting, payout };
}

describe('AppPayoutsService', () => {
  it('creates a pending payout request', async () => {
    const { service, prisma } = buildHarness();
    prisma.appPayout.findUnique.mockResolvedValue(null);

    await service.request({
      appClientId: 'mcom-mall',
      amountMinor: 8719n,
      idempotencyKey: 'pay-1',
    });

    expect(prisma.appPayout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appClientId: 'mcom-mall',
        amountMinor: 8719n,
        status: 'pending',
        idempotencyKey: 'pay-1',
      }),
    });
  });

  it('returns the existing payout for a repeated idempotency key', async () => {
    const { service, prisma, payout } = buildHarness();
    const result = await service.request({
      appClientId: 'mcom-mall',
      amountMinor: 8719n,
      idempotencyKey: 'pay-1',
    });

    expect(result).toBe(payout);
    expect(prisma.appPayout.create).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount', async () => {
    const { service } = buildHarness();
    await expect(
      service.request({ appClientId: 'mcom-mall', amountMinor: 0n, idempotencyKey: 'pay-2' }),
    ).rejects.toThrow(/greater than zero/i);
  });

  it('approves by claiming the request, then debiting the payable and crediting the bank', async () => {
    const { service, prisma, posting } = buildHarness();

    await service.approve('po_1', 'admin_2', 'PO-1');

    expect(prisma.appPayout.updateMany).toHaveBeenCalledWith({
      where: { id: 'po_1', status: 'pending' },
      data: { status: 'approved', approvedBy: 'admin_2' },
    });

    expect(posting.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        intent: 'PAYOUT',
        platformId: 'mcom-mall',
        idempotencyKey: 'payout:po_1',
        nonNegative: ['payable:app:mcom-mall'],
        transactions: [
          {
            legs: [
              { account: 'payable:app:mcom-mall', direction: 'debit', amountMinor: 8719n },
              { account: 'bank:GBP', direction: 'credit', amountMinor: 8719n },
            ],
          },
        ],
      }),
    );

    expect(prisma.appPayout.update).toHaveBeenCalledWith({
      where: { id: 'po_1' },
      data: expect.objectContaining({ status: 'paid', transferId: 'tr_payout' }),
    });
  });

  it('reverts to pending when the payable cannot cover the payout', async () => {
    const { service, prisma, posting } = buildHarness();
    posting.post.mockRejectedValue(
      new UnprocessableEntityException({ error: 'INSUFFICIENT_FUNDS' }),
    );

    await expect(service.approve('po_1', 'admin_2')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    expect(prisma.appPayout.updateMany).toHaveBeenCalledWith({
      where: { id: 'po_1', status: 'approved' },
      data: { status: 'pending', failureReason: 'INSUFFICIENT_PAYABLE' },
    });
  });

  it('refuses to approve a payout that is not pending', async () => {
    const { service, prisma, payout } = buildHarness();
    prisma.appPayout.findUnique.mockResolvedValue({ ...payout, status: 'paid' });

    const result = await service.approve('po_1', 'admin_2');
    expect(result.status).toBe('paid');
    expect(prisma.appPayout.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a pending payout', async () => {
    const { service, prisma } = buildHarness();
    await service.reject('po_1', 'admin_2', 'bank mismatch');
    expect(prisma.appPayout.update).toHaveBeenCalledWith({
      where: { id: 'po_1' },
      data: { status: 'rejected', approvedBy: 'admin_2', failureReason: 'bank mismatch' },
    });
  });

  it('refuses to reject an already paid payout', async () => {
    const { service, prisma, payout } = buildHarness();
    prisma.appPayout.findUnique.mockResolvedValue({ ...payout, status: 'paid' });
    await expect(service.reject('po_1', 'admin_2')).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports available balance with pending payouts reserved', async () => {
    const { service, prisma } = buildHarness();
    prisma.glAccount.findMany.mockResolvedValue([
      { code: 'payable:app:mcom-mall', ownerRef: 'mcom-mall', balanceMinor: 10000n, currency: 'GBP' },
    ]);
    prisma.appPayout.groupBy.mockResolvedValue([
      { appClientId: 'mcom-mall', _sum: { amountMinor: 2500n } },
    ]);

    const result = await service.listPayables();

    expect(result.data[0]).toMatchObject({
      appClientId: 'mcom-mall',
      payableMinor: '10000',
      pendingPayoutMinor: '2500',
      availableMinor: '7500',
    });
  });
});
