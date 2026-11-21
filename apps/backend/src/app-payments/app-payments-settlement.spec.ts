import { AppPaymentsService } from './app-payments.service';

function buildHarness(charge: any) {
  const prisma: any = {
    appCharge: {
      findUnique: jest.fn().mockResolvedValue(charge),
      update: jest.fn().mockResolvedValue(charge),
    },
    appChargeSplit: {
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };

  const wallet = {
    creditWallet: jest.fn().mockResolvedValue({ transactionId: 'wt_seller' }),
  };

  const glPosting = {
    post: jest.fn().mockResolvedValue({ transferId: 'tr_external', replayed: false }),
  };

  const service = new AppPaymentsService(
    prisma,
    { get: jest.fn() } as any,
    wallet as any,
    {} as any,
    {} as any,
    glPosting as any,
  );

  return { service, prisma, wallet, glPosting };
}

const baseCharge = {
  id: 'ch_1',
  appClientId: 'mcom-mall',
  amountMinor: 9000n,
  feeMinor: 281n,
  netMinor: 8719n,
  currency: 'GBP',
  method: 'wallet',
  status: 'paid',
  intent: 'ORDER',
  reference: 'order_1',
  description: 'Order 1',
  settlementState: 'PENDING',
  splits: [],
};

describe('AppPaymentsService.settleCharge', () => {
  it("credits a seller's wallet from the platform for an mcom_user split", async () => {
    const { service, wallet, prisma } = buildHarness({
      ...baseCharge,
      splits: [
        {
          id: 'sp_1',
          payeeType: 'mcom_user',
          payeeUserId: 'seller_1',
          payeeExternalId: null,
          amountMinor: 9000n,
          feeMinor: 281n,
          netMinor: 8719n,
          status: 'pending',
        },
      ],
    });

    await service.settleCharge('ch_1');

    expect(wallet.creditWallet).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'mcom-central' }),
      expect.objectContaining({ userId: 'seller_1', amount: 87.19 }),
      'appcharge:ch_1:split:sp_1',
      undefined,
      expect.objectContaining({ intent: 'ORDER', counterparty: 'platform:wallet:GBP' }),
    );

    expect(prisma.appChargeSplit.update).toHaveBeenCalledWith({
      where: { id: 'sp_1' },
      data: expect.objectContaining({ status: 'credited', walletTransactionId: 'wt_seller' }),
    });

    expect(prisma.appCharge.update).toHaveBeenCalledWith({
      where: { id: 'ch_1' },
      data: expect.objectContaining({ settlementState: 'SETTLED' }),
    });
  });

  it('parks an external payee on its own payable account', async () => {
    const { service, glPosting, wallet } = buildHarness({
      ...baseCharge,
      splits: [
        {
          id: 'sp_2',
          payeeType: 'external',
          payeeUserId: null,
          payeeExternalId: 'ledger_778',
          amountMinor: 9000n,
          feeMinor: 281n,
          netMinor: 8719n,
          status: 'pending',
        },
      ],
    });

    await service.settleCharge('ch_1');

    expect(wallet.creditWallet).not.toHaveBeenCalled();
    expect(glPosting.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        intent: 'ORDER',
        idempotencyKey: 'appcharge:ch_1:split:sp_2',
        transactions: [
          {
            legs: [
              { account: 'platform:wallet:GBP', direction: 'debit', amountMinor: 8719n },
              { account: 'payable:payee:mcom-mall:ledger_778', direction: 'credit', amountMinor: 8719n },
            ],
          },
        ],
      }),
    );
  });

  it('falls back to the app payable when no splits were supplied (legacy)', async () => {
    const { service, glPosting, prisma } = buildHarness({ ...baseCharge, splits: [] });

    await service.settleCharge('ch_1');

    expect(glPosting.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'appcharge:ch_1:settle',
        transactions: [
          {
            legs: [
              { account: 'platform:wallet:GBP', direction: 'debit', amountMinor: 8719n },
              { account: 'payable:app:mcom-mall', direction: 'credit', amountMinor: 8719n },
            ],
          },
        ],
      }),
    );
    // Legacy charge records the transfer on the charge row.
    expect(prisma.appCharge.update).toHaveBeenCalledWith({
      where: { id: 'ch_1' },
      data: { transferId: 'tr_external' },
    });
  });

  it('marks a split failed without aborting the other payees', async () => {
    const { service, wallet, prisma } = buildHarness({
      ...baseCharge,
      splits: [
        {
          id: 'sp_ok',
          payeeType: 'mcom_user',
          payeeUserId: 'seller_ok',
          amountMinor: 6000n,
          feeMinor: 187n,
          netMinor: 5813n,
          status: 'pending',
        },
        {
          id: 'sp_bad',
          payeeType: 'mcom_user',
          payeeUserId: 'seller_bad',
          amountMinor: 3000n,
          feeMinor: 94n,
          netMinor: 2906n,
          status: 'pending',
        },
      ],
    });

    wallet.creditWallet
      .mockResolvedValueOnce({ transactionId: 'wt_ok' })
      .mockRejectedValueOnce(Object.assign(new Error('wallet frozen'), {}));
    prisma.appChargeSplit.count.mockImplementation(async ({ where }: any) =>
      where?.status === 'failed' ? 1 : 1,
    );

    await service.settleCharge('ch_1');

    expect(prisma.appChargeSplit.update).toHaveBeenCalledWith({
      where: { id: 'sp_bad' },
      data: expect.objectContaining({ status: 'failed', failureReason: 'wallet frozen' }),
    });
    expect(prisma.appCharge.update).toHaveBeenCalledWith({
      where: { id: 'ch_1' },
      data: expect.objectContaining({ settlementState: 'FAILED' }),
    });
  });

  it('does nothing when the charge is not paid or already settled', async () => {
    const { service, wallet } = buildHarness({ ...baseCharge, status: 'pending', splits: [] });
    await service.settleCharge('ch_1');
    expect(wallet.creditWallet).not.toHaveBeenCalled();

    const settled = buildHarness({ ...baseCharge, settlementState: 'SETTLED', splits: [] });
    await settled.service.settleCharge('ch_1');
    expect(settled.wallet.creditWallet).not.toHaveBeenCalled();
  });
});
