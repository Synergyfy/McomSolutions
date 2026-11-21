import { Injectable, NotFoundException } from '@nestjs/common';
import { GlEntryDirection, GlIntent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EventPayer {
  /** True when a Central Hub Solution user backs this payment. */
  identified: boolean;
  /** The CHS user id the app supplied, if any. Never the app's own customer id. */
  mcomUserId: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
  /** The app's own customer reference. Not a CHS identity — for support only. */
  appCustomerRef: string | null;
  method: string;
  provider: string | null;
}

export interface EventFilters {
  page?: number;
  limit?: number;
  /** Only events that touched the platform wallet. */
  platformAccountOnly?: boolean;
  platformId?: string;
  intent?: GlIntent;
  from?: string;
  to?: string;
  search?: string;
}

export interface TransferFilters {
  intent?: GlIntent;
  platformId?: string;
  reference?: string;
  accountCode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Read-only projections for the admin ledger surface.
 *
 * Nothing here writes. Every amount is returned as a string so a 64-bit pence
 * value can never lose precision on the way to the browser.
 */
@Injectable()
export class LedgerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const accounts = await this.prisma.glAccount.findMany({
      select: { type: true, code: true, balanceMinor: true, currency: true },
    });

    const sumBy = (predicate: (type: string) => boolean) =>
      accounts.filter((a) => predicate(a.type)).reduce((sum, a) => sum + a.balanceMinor, 0n);

    const platform = accounts.find((a) => a.code === 'platform:wallet:GBP');
    const since30 = new Date(Date.now() - 30 * 86400000);

    const [platformFlow, gmv, transferCountToday, failedSettlements] = await Promise.all([
      this.platformFlow(since30),
      this.gmvSince(since30),
      this.prisma.glTransfer.count({
        where: { createdAt: { gte: startOfUtcDay(new Date()) } },
      }),
      this.prisma.appCharge.count({
        where: { settlementState: { in: ['FAILED', 'PENDING'] }, status: 'paid' },
      }),
    ]);

    return {
      success: true as const,
      data: {
        platformWalletMinor: (platform?.balanceMinor ?? 0n).toString(),
        currency: platform?.currency ?? 'GBP',
        userFloatMinor: sumBy((t) => t === 'LIABILITY_USER_WALLET').toString(),
        owedToPartnersMinor: sumBy(
          (t) => t === 'LIABILITY_APP_PAYABLE' || t === 'LIABILITY_PAYABLE',
        ).toString(),
        assetsMinor: sumBy((t) => t.startsWith('ASSET_')).toString(),
        liabilitiesMinor: sumBy((t) => t.startsWith('LIABILITY_')).toString(),
        equityMinor: sumBy((t) => t === 'PLATFORM_WALLET' || t === 'EQUITY_OPENING').toString(),
        inflow30dMinor: platformFlow.inflowMinor.toString(),
        outflow30dMinor: platformFlow.outflowMinor.toString(),
        net30dMinor: (platformFlow.inflowMinor - platformFlow.outflowMinor).toString(),
        gmv30dMinor: gmv.toString(),
        transfersToday: transferCountToday,
        chargesAwaitingSettlement: failedSettlements,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async platformWallet() {
    const account = await this.prisma.glAccount.findUnique({
      where: { code: 'platform:wallet:GBP' },
    });
    if (!account) {
      return {
        success: true as const,
        data: { balanceMinor: '0', currency: 'GBP', status: 'MISSING' },
      };
    }

    const [inflow, outflow, pendingCommissions] = await Promise.all([
      this.prisma.glEntry.aggregate({
        where: { accountId: account.id, direction: 'credit' },
        _sum: { amountMinor: true },
      }),
      this.prisma.glEntry.aggregate({
        where: { accountId: account.id, direction: 'debit' },
        _sum: { amountMinor: true },
      }),
      this.prisma.referralCommission.count({
        where: { status: 'PENDING', failureReason: { not: null } },
      }),
    ]);

    return {
      success: true as const,
      data: {
        code: account.code,
        balanceMinor: account.balanceMinor.toString(),
        currency: account.currency,
        status: account.status,
        lifetimeInflowMinor: (inflow._sum.amountMinor ?? 0n).toString(),
        lifetimeOutflowMinor: (outflow._sum.amountMinor ?? 0n).toString(),
        pendingReferralPayouts: pendingCommissions,
      },
    };
  }

  async listAccounts(filters: { type?: string; scope?: string; search?: string }) {
    const where: Prisma.GlAccountWhereInput = {
      ...(filters.type ? { type: filters.type as any } : {}),
      ...(filters.scope ? { scope: filters.scope } : {}),
      ...(filters.search
        ? { code: { contains: filters.search, mode: 'insensitive' as const } }
        : {}),
    };

    const accounts = await this.prisma.glAccount.findMany({
      where,
      orderBy: { code: 'asc' },
      take: 500,
    });

    return {
      success: true as const,
      data: accounts.map((account) => ({
        code: account.code,
        type: account.type,
        scope: account.scope,
        ownerRef: account.ownerRef,
        currency: account.currency,
        balanceMinor: account.balanceMinor.toString(),
        status: account.status,
      })),
      total: accounts.length,
    };
  }

  async listTransfers(filters: TransferFilters) {
    const page = Math.max(1, Number(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 20)));

    const where: Prisma.GlTransferWhereInput = {
      ...(filters.intent ? { intent: filters.intent } : {}),
      ...(filters.platformId ? { platformId: filters.platformId } : {}),
      ...(filters.reference ? { reference: filters.reference } : {}),
      ...((filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
        },
      }),
      ...(filters.search
        ? {
            OR: [
              { id: { contains: filters.search, mode: 'insensitive' as const } },
              { reference: { contains: filters.search, mode: 'insensitive' as const } },
              { description: { contains: filters.search, mode: 'insensitive' as const } },
              { idempotencyKey: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(filters.accountCode
        ? {
            transactions: {
              some: {
                entries: { some: { account: { code: filters.accountCode } } },
              },
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.glTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          transactions: {
            include: {
              entries: {
                select: {
                  direction: true,
                  amountMinor: true,
                  account: { select: { code: true, type: true, ownerRef: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.glTransfer.count({ where }),
    ]);

    const labels = await this.labelsFor(
      rows.flatMap((row) =>
        row.transactions.flatMap((step) => step.entries.map((entry) => entry.account)),
      ),
    );

    return {
      success: true as const,
      data: rows.map((row) => this.toTransferSummary(row, labels)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * The full money trail for one event. Transfers that share a `reference` are
   * returned as siblings — this is how a delegation shows as one movement even
   * though it posts as two wallet operations.
   */
  async getTransfer(id: string) {
    const transfer = await this.prisma.glTransfer.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { postedAt: 'asc' },
          include: {
            entries: {
              orderBy: { direction: 'asc' },
              include: {
                account: {
                  select: { code: true, type: true, currency: true, ownerRef: true },
                },
              },
            },
          },
        },
      },
    });

    if (!transfer) throw new NotFoundException('Transfer not found.');

    const labels = await this.labelsFor(
      transfer.transactions.flatMap((step) => step.entries.map((entry) => entry.account)),
    );

    let siblings: Array<{ id: string; intent: GlIntent; createdAt: string; amountMinor: string }> = [];
    if (transfer.reference) {
      const rows = await this.prisma.glTransfer.findMany({
        where: { reference: transfer.reference, id: { not: transfer.id } },
        orderBy: { createdAt: 'asc' },
        include: {
          transactions: {
            select: { entries: { select: { direction: true, amountMinor: true } } },
          },
        },
      });
      siblings = rows.map((row) => ({
        id: row.id,
        intent: row.intent,
        createdAt: row.createdAt.toISOString(),
        amountMinor: this.creditTotal(row.transactions).toString(),
      }));
    }

    return {
      success: true as const,
      data: {
        id: transfer.id,
        intent: transfer.intent,
        platformId: transfer.platformId,
        reference: transfer.reference,
        description: transfer.description,
        initiatorType: transfer.initiatorType,
        initiatorId: transfer.initiatorId,
        idempotencyKey: transfer.idempotencyKey,
        reversalOfId: transfer.reversalOfId,
        metadata: transfer.metadata,
        createdAt: transfer.createdAt.toISOString(),
        amountMinor: this.creditTotal(transfer.transactions).toString(),
        transactions: transfer.transactions.map((transaction) => ({
          id: transaction.id,
          currency: transaction.currency,
          amountMinor: transaction.amountMinor.toString(),
          status: transaction.status,
          postedAt: transaction.postedAt.toISOString(),
          entries: transaction.entries.map((entry) => ({
            id: entry.id,
            account: entry.account.code,
            accountLabel: labels.get(entry.account.code) ?? entry.account.code,
            accountType: entry.account.type,
            direction: entry.direction as GlEntryDirection,
            amountMinor: entry.amountMinor.toString(),
            currency: entry.currency,
          })),
        })),
        siblings,
      },
    };
  }

  async accountEntries(code: string, page = 1, limit = 20) {
    const account = await this.prisma.glAccount.findUnique({ where: { code } });
    if (!account) throw new NotFoundException('Account not found.');

    const take = Math.min(100, Math.max(1, Number(limit)));
    const skip = (Math.max(1, Number(page)) - 1) * take;

    const [rows, total] = await Promise.all([
      this.prisma.glEntry.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          transaction: {
            include: {
              transfer: {
                select: {
                  id: true,
                  intent: true,
                  platformId: true,
                  reference: true,
                  description: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.glEntry.count({ where: { accountId: account.id } }),
    ]);

    return {
      success: true as const,
      data: rows.map((entry) => ({
        id: entry.id,
        direction: entry.direction,
        amountMinor: entry.amountMinor.toString(),
        currency: entry.currency,
        createdAt: entry.createdAt.toISOString(),
        transfer: {
          id: entry.transaction.transfer.id,
          intent: entry.transaction.transfer.intent,
          platformId: entry.transaction.transfer.platformId,
          reference: entry.transaction.transfer.reference,
          description: entry.transaction.transfer.description,
          createdAt: entry.transaction.transfer.createdAt.toISOString(),
        },
      })),
      account: {
        code: account.code,
        type: account.type,
        balanceMinor: account.balanceMinor.toString(),
        currency: account.currency,
      },
      total,
      page: Math.max(1, Number(page)),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  // ─── Parties (human labels) ───────────────────────────────────────────────

  /**
   * Turn account rows into human labels. A ledger full of UUIDs is technically
   * correct and operationally useless, so the read surface always resolves the
   * party behind an account when it can.
   */
  private async labelsFor(
    accounts: Array<{ code: string; type: string; ownerRef: string | null }>,
  ): Promise<Map<string, string>> {
    const unique = new Map<string, { type: string; ownerRef: string | null }>();
    for (const account of accounts) unique.set(account.code, account);

    const walletIds = [...unique.values()]
      .filter((a) => a.type === 'LIABILITY_USER_WALLET' && a.ownerRef)
      .map((a) => a.ownerRef as string);
    const appIds = [...unique.values()]
      .filter((a) => a.type === 'LIABILITY_APP_PAYABLE' && a.ownerRef)
      .map((a) => a.ownerRef as string);

    const [wallets, apps] = await Promise.all([
      walletIds.length
        ? this.prisma.wallet.findMany({
            where: { id: { in: walletIds } },
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  businessProfile: { select: { businessName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      appIds.length
        ? this.prisma.ssoClient.findMany({
            where: { clientId: { in: appIds } },
            select: { clientId: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const walletLabels = new Map<string, string>();
    for (const wallet of wallets) {
      const business = wallet.user?.businessProfile?.businessName;
      const person = [wallet.user?.firstName, wallet.user?.lastName].filter(Boolean).join(' ');
      // Business plus the person behind it: a bare trading name ("Test") tells an
      // admin nothing when they are trying to identify a movement.
      const label = business && person ? `${business} · ${person}` : business || person;
      walletLabels.set(wallet.id, label || 'MCOM user');
    }
    const appLabels = new Map(apps.map((app) => [app.clientId, app.name]));

    const labels = new Map<string, string>();
    for (const [code, account] of unique) {
      labels.set(code, this.labelForAccount({ code, ...account }, walletLabels, appLabels));
    }
    return labels;
  }

  private labelForAccount(
    account: { code: string; type: string; ownerRef: string | null },
    walletLabels: Map<string, string>,
    appLabels: Map<string, string>,
  ): string {
    switch (account.type) {
      case 'PLATFORM_WALLET':
        return 'Platform wallet';
      case 'LIABILITY_USER_WALLET':
        return (account.ownerRef && walletLabels.get(account.ownerRef)) || 'User wallet';
      case 'LIABILITY_APP_PAYABLE':
        return (account.ownerRef && appLabels.get(account.ownerRef)) || 'App payable';
      case 'LIABILITY_PAYABLE':
        return `External payee (${(account.ownerRef ?? '').split(':').pop() ?? '—'})`;
      case 'ASSET_GATEWAY_CLEARING':
        return `${account.ownerRef ? account.ownerRef[0].toUpperCase() + account.ownerRef.slice(1) : 'Gateway'} clearing`;
      case 'ASSET_BANK':
        return 'Bank';
      case 'SUSPENSE':
        return 'Suspense';
      case 'EQUITY_OPENING':
        return 'Opening balance';
      default:
        return account.code;
    }
  }

  /**
   * The ledger, one row per **business event**.
   *
   * An event may be posted as more than one journal transfer (a card sale funds
   * the platform, then allocates to the payee). Showing those as separate rows
   * implies two movements where there was one, so events are grouped by
   * `reference` and each account is netted across the group: what is left is
   * who paid and who was paid. The underlying transfers stay intact underneath.
   */
  async listEvents(filters: EventFilters = {}) {
    const page = Math.max(1, Number(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 20)));

    const platform = await this.prisma.glAccount.findUnique({
      where: { code: 'platform:wallet:GBP' },
      select: { id: true, code: true, balanceMinor: true, currency: true },
    });

    const where: Prisma.GlTransferWhereInput = {
      ...(filters.platformId ? { platformId: filters.platformId } : {}),
      ...(filters.intent ? { intent: filters.intent } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { reference: { contains: filters.search, mode: 'insensitive' as const } },
              { description: { contains: filters.search, mode: 'insensitive' as const } },
              { id: { contains: filters.search, mode: 'insensitive' as const } },
              { idempotencyKey: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(filters.platformAccountOnly && platform
        ? { transactions: { some: { entries: { some: { accountId: platform.id } } } } }
        : {}),
    };

    const scanLimit = 1000;
    const transfers = await this.prisma.glTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: scanLimit,
      include: {
        transactions: {
          orderBy: { postedAt: 'asc' },
          include: {
            entries: {
              include: { account: { select: { code: true, type: true, ownerRef: true } } },
            },
          },
        },
      },
    });

    const labels = await this.labelsFor(
      transfers.flatMap((transfer) =>
        transfer.transactions.flatMap((step) => step.entries.map((entry) => entry.account)),
      ),
    );

    type Party = { account: string; label: string; amount: bigint };
    type Group = {
      key: string;
      reference: string | null;
      intents: Set<GlIntent>;
      platformIds: Set<string>;
      transferIds: string[];
      createdAt: Date;
      primaryIntent: GlIntent;
      debits: Map<string, Party>;
      credits: Map<string, Party>;
      /** The platform wallet is the hub: both sides net to the platform's cut. */
      platform: Party | null;
    };

    const groups = new Map<string, Group>();
    for (const transfer of transfers) {
      // A partner reference is reusable, so it cannot identify a payment on its
      // own. Group by the charge when the entries carry one; refunds are a
      // separate event from the sale they reverse.
      const chargeId = transfer.transactions
        .flatMap((step) => step.entries)
        .map((entry) => entry.appChargeId)
        .find(Boolean) as string | undefined;
      const isRefund = transfer.intent === GlIntent.REFUND;
      const key = chargeId
        ? `charge:${chargeId}${isRefund ? ':refund' : ''}`
        : (transfer.reference ?? transfer.id);

      const group =
        groups.get(key) ??
        ({
          key,
          reference: transfer.reference ?? null,
          intents: new Set<GlIntent>(),
          platformIds: new Set<string>(),
          transferIds: [],
          createdAt: transfer.createdAt,
          primaryIntent: transfer.intent,
          debits: new Map(),
          credits: new Map(),
          platform: null,
        } as Group);

      group.intents.add(transfer.intent);
      if (transfer.platformId) group.platformIds.add(transfer.platformId);
      group.transferIds.push(transfer.id);
      if (transfer.createdAt >= group.createdAt) {
        group.createdAt = transfer.createdAt;
        group.primaryIntent = transfer.intent;
      }

      for (const step of transfer.transactions) {
        for (const entry of step.entries) {
          const code = entry.account.code;
          const label = labels.get(code) ?? code;

          if (entry.account.type === 'PLATFORM_WALLET') {
            group.platform = group.platform ?? { account: code, label, amount: 0n };
            group.platform.amount +=
              entry.direction === 'credit' ? entry.amountMinor : -entry.amountMinor;
            continue;
          }

          // Every other account is shown gross on its own side. Netting two
          // parties against each other would hide a real debit and credit (for
          // example when the same wallet both pays and receives).
          const bucket = entry.direction === 'debit' ? group.debits : group.credits;
          const current = bucket.get(code) ?? { account: code, label, amount: 0n };
          current.amount += entry.amountMinor;
          bucket.set(code, current);
        }
      }

      groups.set(key, group);
    }

    const ordered = [...groups.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const skip = (page - 1) * limit;

    const pageGroups = ordered.slice(skip, skip + limit);
    const chargeIds = pageGroups
      .map((group) => this.chargeIdFromKey(group.key))
      .filter(Boolean) as string[];
    const [byReference, byId] = await Promise.all([
      this.loadCharges(pageGroups.map((group) => group.reference).filter(Boolean) as string[]),
      chargeIds.length
        ? this.prisma.appCharge.findMany({
            where: { id: { in: chargeIds } },
            include: { _count: { select: { splits: true } } },
          })
        : Promise.resolve([] as any[]),
    ]);
    const byIdMap = new Map<string, any>(byId.map((charge) => [charge.id, charge]));
    const payers = await this.resolvePayers([...byIdMap.values(), ...byReference.values()]);

    return {
      success: true as const,
      data: pageGroups.map((group) => {
        const summary = this.summariseEvent(group);
        const chargeId = this.chargeIdFromKey(group.key);
        // A partner reference can be reused, so the charge id wins when we have
        // one; only legacy, unlinked transfers fall back to the reference.
        const charge = chargeId
          ? byIdMap.get(chargeId)
          : group.reference
            ? byReference.get(group.reference)
            : undefined;
        const payer = charge ? payers.get(charge.id) : undefined;
        this.applyPayerLabel(summary.debits, payer);

        return {
          ...summary,
          payer: payer ?? null,
          noPayee: charge ? charge._count.splits === 0 : null,
        };
      }),
      total: ordered.length,
      page,
      limit,
      totalPages: Math.ceil(ordered.length / limit),
      scanned: transfers.length,
      scanLimit,
      account: platform
        ? {
            code: platform.code,
            balanceMinor: platform.balanceMinor.toString(),
            currency: platform.currency,
          }
        : null,
    };
  }

  /** Every platform the ledger has seen, for filter dropdowns. */
  async platforms() {
    const [registered, seen] = await Promise.all([
      this.prisma.ssoClient.findMany({ select: { clientId: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.glTransfer.groupBy({
        by: ['platformId'],
        where: { platformId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const names = new Map(registered.map((client) => [client.clientId, client.name]));
    const ids = new Set<string>(['mcom-central']);
    for (const client of registered) ids.add(client.clientId);
    for (const row of seen) if (row.platformId) ids.add(row.platformId);

    return {
      success: true as const,
      data: [...ids]
        .filter((id) => id !== 'mcom-central')
        .map((id) => ({ platformId: id, name: names.get(id) ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** The platform wallet view, expressed through the same event model. */
  async platformActivity(page = 1, limit = 20) {
    return this.listEvents({ page, limit, platformAccountOnly: true });
  }

  /**
   * Everything recorded for one event, so an admin never has to guess:
   * parties with their accounts, the linked charge and splits, the wallet
   * receipts, and the raw balanced journal steps underneath.
   */
  async getEvent(key: string) {
    const chargeKey = /^charge:([^:]+)(:refund)?$/.exec(key);

    const where: Prisma.GlTransferWhereInput = chargeKey
      ? {
          transactions: { some: { entries: { some: { appChargeId: chargeKey[1] } } } },
          intent: chargeKey[2] ? GlIntent.REFUND : { not: GlIntent.REFUND },
        }
      : { OR: [{ reference: key }, { id: key }] };

    const transfers = await this.prisma.glTransfer.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        transactions: {
          orderBy: { postedAt: 'asc' },
          include: {
            entries: {
              include: { account: { select: { code: true, type: true, ownerRef: true } } },
            },
          },
        },
      },
    });

    if (transfers.length === 0) throw new NotFoundException('Ledger event not found.');

    const labels = await this.labelsFor(
      transfers.flatMap((transfer) =>
        transfer.transactions.flatMap((step) => step.entries.map((entry) => entry.account)),
      ),
    );

    const debits = new Map<string, { account: string; label: string; amount: bigint }>();
    const credits = new Map<string, { account: string; label: string; amount: bigint }>();
    let platform: { account: string; label: string; amount: bigint } | null = null;

    for (const transfer of transfers) {
      for (const step of transfer.transactions) {
        for (const entry of step.entries) {
          const code = entry.account.code;
          const label = labels.get(code) ?? code;

          if (entry.account.type === 'PLATFORM_WALLET') {
            platform = platform ?? { account: code, label, amount: 0n };
            platform.amount += entry.direction === 'credit' ? entry.amountMinor : -entry.amountMinor;
            continue;
          }

          const bucket = entry.direction === 'debit' ? debits : credits;
          const current = bucket.get(code) ?? { account: code, label, amount: 0n };
          current.amount += entry.amountMinor;
          bucket.set(code, current);
        }
      }
    }

    const parties = this.partiesFromGroup({ debits, credits, platform });
    const reference = transfers.find((transfer) => transfer.reference)?.reference ?? null;

    const keyChargeId = this.chargeIdFromKey(key);
    const charge = keyChargeId
      ? await this.prisma.appCharge.findUnique({ where: { id: keyChargeId }, include: { splits: true } })
      : reference
        ? await this.prisma.appCharge.findFirst({
            where: { reference },
            include: { splits: true },
          })
        : null;

    const walletTxnIds = transfers
      .flatMap((transfer) => transfer.transactions)
      .flatMap((step) => step.entries)
      .map((entry) => entry.walletTransactionId)
      .filter(Boolean) as string[];

    const walletTransactions = walletTxnIds.length
      ? await this.prisma.walletTransaction.findMany({
          where: { id: { in: walletTxnIds } },
          include: {
            wallet: {
              select: {
                id: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    businessProfile: { select: { businessName: true } },
                  },
                },
              },
            },
          },
        })
      : [];

    const payer = charge ? (await this.resolvePayers([charge])).get(charge.id) : undefined;
    this.applyPayerLabel(parties.debits, payer);

    return {
      success: true as const,
      data: {
        key,
        reference,
        payer: payer ?? null,
        noPayee: charge ? charge.splits.length === 0 : null,
        primaryIntent: transfers[transfers.length - 1].intent,
        intents: [...new Set(transfers.map((transfer) => transfer.intent))],
        platformIds: [...new Set(transfers.map((transfer) => transfer.platformId).filter(Boolean))],
        createdAt: transfers[transfers.length - 1].createdAt.toISOString(),
        descriptions: [...new Set(transfers.map((transfer) => transfer.description).filter(Boolean))],
        debits: parties.debits,
        credits: parties.credits,
        charge: charge
          ? {
            id: charge.id,
            appClientId: charge.appClientId,
            method: charge.method,
            status: charge.status,
            amountMinor: charge.amountMinor.toString(),
            feeMinor: charge.feeMinor.toString(),
            netMinor: charge.netMinor.toString(),
            refundedMinor: charge.refundedMinor.toString(),
            reference: charge.reference,
            mcomUserId: charge.mcomUserId,
            provider: charge.provider,
            providerRef: charge.providerRef,
            settlementState: charge.settlementState,
            paidAt: charge.paidAt?.toISOString() ?? null,
            createdAt: charge.createdAt.toISOString(),
            feeConfig: {
              feePercent: charge.feePercentApplied?.toString() ?? null,
              feeFixedMinor: charge.feeFixedMinorApplied?.toString() ?? null,
            },
            currentFeeConfig: await this.currentFeeConfig(charge.appClientId),
            splits: charge.splits.map((split) => ({
              id: split.id,
              payeeType: split.payeeType,
              payeeUserId: split.payeeUserId,
              payeeExternalId: split.payeeExternalId,
              amountMinor: split.amountMinor.toString(),
              feeMinor: split.feeMinor.toString(),
              netMinor: split.netMinor.toString(),
              status: split.status,
              walletTransactionId: split.walletTransactionId,
              failureReason: split.failureReason,
            })),
          }
          : null,
        transfers: transfers.map((transfer) => ({
          id: transfer.id,
          intent: transfer.intent,
          reference: transfer.reference,
          description: transfer.description,
          platformId: transfer.platformId,
          initiatorType: transfer.initiatorType,
          initiatorId: transfer.initiatorId,
          idempotencyKey: transfer.idempotencyKey,
          reversalOfId: transfer.reversalOfId,
          createdAt: transfer.createdAt.toISOString(),
          steps: transfer.transactions.map((step) => ({
            id: step.id,
            amountMinor: step.amountMinor.toString(),
            currency: step.currency,
            status: step.status,
            postedAt: step.postedAt.toISOString(),
            entries: step.entries.map((entry) => ({
              id: entry.id,
              account: entry.account.code,
              accountLabel: labels.get(entry.account.code) ?? entry.account.code,
              accountType: entry.account.type,
              direction: entry.direction,
              amountMinor: entry.amountMinor.toString(),
              currency: entry.currency,
              appChargeId: entry.appChargeId,
            })),
          })),
        })),
        walletTransactions: walletTransactions.map((txn) => ({
          id: txn.id,
          type: txn.type,
          amount: txn.amount.toString(),
          balanceBefore: txn.balanceBefore.toString(),
          balanceAfter: txn.balanceAfter.toString(),
          currency: txn.currency,
          category: txn.category,
          status: txn.status,
          walletId: txn.walletId,
          userId: txn.wallet?.userId ?? null,
          userName: this.walletHolderName(txn.wallet?.user),
          userEmail: txn.wallet?.user?.email ?? null,
        })),
      },
    };
  }

  private walletHolderName(user: any): string | null {
    if (!user) return null;
    const business = user.businessProfile?.businessName;
    const person = [user.firstName, user.lastName].filter(Boolean).join(' ');
    if (business && person) return `${business} · ${person}`;
    return business || person || null;
  }

  /**
   * Load the charges behind a page of events, plus the payer each one names.
   *
   * A card payment has no wallet to identify the payer, so the charge is the
   * only place the payer can be recorded. Partners that omit `mcomUserId` leave
   * us with their own customer id — which we show rather than pretend.
   */
  private async loadCharges(
    references: string[],
  ): Promise<Map<string, any>> {
    const refs = [...new Set(references.filter(Boolean))];
    if (refs.length === 0) return new Map();

    const charges = await this.prisma.appCharge.findMany({
      where: { reference: { in: refs } },
      include: { _count: { select: { splits: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const map = new Map<string, any>();
    for (const charge of charges) {
      if (charge.reference && !map.has(charge.reference)) map.set(charge.reference, charge);
    }
    return map;
  }

  /**
   * The app's fee config *today*. Only used to explain historical charges whose
   * applied rate was not snapshotted; the UI labels it as current, never as the
   * rate that was used.
   */
  private async currentFeeConfig(clientId: string): Promise<{ feePercent: string; feeFixedMinor: string; source: string }> {
    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
      select: { feePercent: true, feeFixedMinor: true },
    });

    const programme = async (key: string) => {
      const setting = await this.prisma.programmeSetting.findUnique({ where: { key } });
      return setting?.value ?? null;
    };

    const percent =
      client?.feePercent?.toString() ??
      (await programme('app_payment_fee_percent')) ??
      '0.029';
    const fixed =
      client?.feeFixedMinor?.toString() ??
      (await programme('app_payment_fee_fixed_minor')) ??
      '20';

    const source =
      client?.feePercent != null || client?.feeFixedMinor != null
        ? 'app'
        : (await programme('app_payment_fee_percent')) != null
          ? 'programme'
          : 'default';

    return { feePercent: percent, feeFixedMinor: fixed, source };
  }

  /** `charge:<id>` keys identify a payment; anything else is a legacy reference. */
  private chargeIdFromKey(key: string): string | null {
    const match = /^charge:([^:]+)/.exec(key);
    return match ? match[1] : null;
  }

  private payerCandidate(charge: any): string | null {
    const metadataUserId =
      charge?.metadata && typeof charge.metadata === 'object'
        ? (charge.metadata as Record<string, unknown>).userId
        : null;
    return (
      charge?.mcomUserId ??
      (typeof metadataUserId === 'string' ? metadataUserId : null) ??
      null
    );
  }

  private async resolvePayers(charges: any[]): Promise<Map<string, EventPayer>> {
    const candidates = [...new Set(charges.map((charge) => this.payerCandidate(charge)).filter(Boolean))] as string[];

    const users = candidates.length
      ? await this.prisma.user.findMany({
          where: { id: { in: candidates } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            businessProfile: { select: { businessName: true } },
          },
        })
      : [];
    const byId = new Map(users.map((user) => [user.id, user]));

    const payers = new Map<string, EventPayer>();
    for (const charge of charges) {
      if (!charge.id) continue;
      const candidate = this.payerCandidate(charge);
      const user = candidate ? byId.get(candidate) : undefined;
      const business = user?.businessProfile?.businessName;
      const person = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
      payers.set(charge.id, {
        identified: !!user,
        mcomUserId: charge.mcomUserId ?? null,
        userId: user?.id ?? (charge.mcomUserId ?? null),
        name: user ? (business && person ? `${business} · ${person}` : business || person) : null,
        email: user?.email ?? null,
        appCustomerRef: charge.externalCustomerId ?? null,
        method: charge.method,
        provider: charge.provider ?? charge.method,
      });
    }
    return payers;
  }

  /**
   * Replace "Stripe clearing" with who actually paid, when we know.
   * The gateway is the funding source, not a person.
   */
  private applyPayerLabel(
    debits: Array<{ account: string; label: string; amountMinor: string }>,
    payer: EventPayer | undefined,
  ): void {
    if (!payer) return;
    const gateway = debits.find((party) => party.account.startsWith('gateway:'));
    if (!gateway) return;

    const provider = gateway.account.split(':')[1] ?? payer.provider ?? 'card';
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

    // Only a Central Hub Solution user is a payer we can name. A platform's own
    // customer id is not a CHS identity — buyers can pay on a platform without
    // ever registering here — so an anonymous buyer is shown as a guest rather
    // than mislabelled with the app's internal id.
    if (payer.identified && payer.name) {
      gateway.label = `${payer.name} · paid by ${providerLabel}`;
    } else if (payer.mcomUserId) {
      gateway.label = `MCOM user ${payer.mcomUserId.slice(0, 8)}… · paid by ${providerLabel}`;
    } else {
      gateway.label = `Guest buyer (no MCOM account) · ${providerLabel}`;
    }
  }

  private summariseEvent(group: {
    key: string;
    reference: string | null;
    intents: Set<GlIntent>;
    platformIds: Set<string>;
    transferIds: string[];
    createdAt: Date;
    primaryIntent: GlIntent;
    debits: Map<string, { account: string; label: string; amount: bigint }>;
    credits: Map<string, { account: string; label: string; amount: bigint }>;
    platform: { account: string; label: string; amount: bigint } | null;
  }) {
    const parties = this.partiesFromGroup(group);
    return {
      key: group.key,
      reference: group.reference,
      primaryIntent: group.primaryIntent,
      intents: [...group.intents],
      platformIds: [...group.platformIds],
      createdAt: group.createdAt.toISOString(),
      debits: parties.debits,
      credits: parties.credits,
      totalDebitMinor: parties.totalDebitMinor,
      totalCreditMinor: parties.totalCreditMinor,
      transfers: group.transferIds.length,
      transferId: group.transferIds[0],
    };
  }

  private partiesFromGroup(group: {
    debits: Map<string, { account: string; label: string; amount: bigint }>;
    credits: Map<string, { account: string; label: string; amount: bigint }>;
    platform: { account: string; label: string; amount: bigint } | null;
  }) {
    const byAmountDesc = (a: { amount: bigint }, b: { amount: bigint }) =>
      a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1;

    const debitRows = [...group.debits.values()];
    const creditRows = [...group.credits.values()];

    // The platform is a pass-through: money in then out. Only its net belongs
    // to one side, which is the fee it kept.
    if (group.platform && group.platform.amount > 0n) {
      creditRows.push({ ...group.platform });
    } else if (group.platform && group.platform.amount < 0n) {
      debitRows.push({ ...group.platform, amount: -group.platform.amount });
    }

    const debits = debitRows
      .filter((row) => row.amount !== 0n)
      .sort(byAmountDesc)
      .map((row) => ({ account: row.account, label: row.label, amountMinor: row.amount.toString() }));

    const credits = creditRows
      .filter((row) => row.amount !== 0n)
      .sort(byAmountDesc)
      .map((row) => ({ account: row.account, label: row.label, amountMinor: row.amount.toString() }));

    return {
      debits,
      credits,
      totalDebitMinor: debits.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n).toString(),
      totalCreditMinor: credits.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n).toString(),
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────  // ─── Internals ────────────────────────────────────────────────────────────

  private toTransferSummary(row: any, labels: Map<string, string>) {
    const entries = row.transactions.flatMap((t: any) => t.entries);
    const credits = entries.filter((e: any) => e.direction === 'credit');
    const debits = entries.filter((e: any) => e.direction === 'debit');

    const firstStep = row.transactions[0]?.entries ?? [];
    const lastStep = row.transactions[row.transactions.length - 1]?.entries ?? [];
    const from = [...new Set(
      firstStep
        .filter((e: any) => e.direction === 'debit')
        .map((e: any) => labels.get(e.account.code) ?? e.account.code),
    )];
    const to = [...new Set(
      lastStep
        .filter((e: any) => e.direction === 'credit')
        .map((e: any) => labels.get(e.account.code) ?? e.account.code),
    )];

    return {
      id: row.id,
      intent: row.intent,
      platformId: row.platformId,
      reference: row.reference,
      description: row.description,
      initiatorType: row.initiatorType,
      createdAt: row.createdAt.toISOString(),
      amountMinor: credits.reduce((sum: bigint, e: any) => sum + e.amountMinor, 0n).toString(),
      steps: row.transactions.length,
      legs: entries.length,
      accounts: [...new Set(entries.map((e: any) => e.account.code))] as string[],
      debitAccounts: [...new Set(debits.map((e: any) => e.account.code))] as string[],
      from,
      to,
    };
  }

  private creditTotal(transactions: Array<{ entries: Array<{ direction: string; amountMinor: bigint }> }>): bigint {
    // A transfer's value is the debit (== credit) total of its first step; later
    // steps move the same money on. Summing every step would double count.
    const first = transactions[0];
    if (!first) return 0n;
    return first.entries
      .filter((entry) => entry.direction === 'debit')
      .reduce((sum, entry) => sum + entry.amountMinor, 0n);
  }

  private async platformFlow(since: Date): Promise<{ inflowMinor: bigint; outflowMinor: bigint }> {
    const account = await this.prisma.glAccount.findUnique({
      where: { code: 'platform:wallet:GBP' },
      select: { id: true },
    });
    if (!account) return { inflowMinor: 0n, outflowMinor: 0n };

    const [credits, debits] = await Promise.all([
      this.prisma.glEntry.aggregate({
        where: { accountId: account.id, direction: 'credit', createdAt: { gte: since } },
        _sum: { amountMinor: true },
      }),
      this.prisma.glEntry.aggregate({
        where: { accountId: account.id, direction: 'debit', createdAt: { gte: since } },
        _sum: { amountMinor: true },
      }),
    ]);

    return {
      inflowMinor: credits._sum.amountMinor ?? 0n,
      outflowMinor: debits._sum.amountMinor ?? 0n,
    };
  }

  private async gmvSince(since: Date): Promise<bigint> {
    // GMV = payer-side value of commercial events. Count the debit legs of the
    // first step only, so a gateway→platform→seller trail is counted once.
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint | null }>>`
      SELECT COALESCE(SUM(e.amount_minor), 0)::bigint AS total
      FROM gl_entries e
      JOIN gl_transactions t ON t.id = e.transaction_id
      JOIN gl_transfers tr ON tr.id = t.transfer_id
      WHERE tr.created_at >= ${since}
        AND tr.intent IN ('ORDER', 'BOOKING', 'PURCHASE', 'SUBSCRIPTION')
        AND e.direction = 'debit'
        AND t.id = (
          SELECT t2.id FROM gl_transactions t2
          WHERE t2.transfer_id = tr.id
          ORDER BY t2.posted_at ASC LIMIT 1
        )
        AND e.account_id IN (
          SELECT id FROM gl_accounts WHERE type IN ('LIABILITY_USER_WALLET', 'ASSET_GATEWAY_CLEARING')
        )
    `;

    return rows[0]?.total ?? 0n;
  }
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
