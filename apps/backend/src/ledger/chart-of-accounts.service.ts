import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GlAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseAccountCode } from './account-code';

/**
 * Resolves ledger accounts by code, creating any that do not exist yet.
 *
 * Account identity is derived from the code (see `parseAccountCode`), so this
 * service never needs a registry table and can never create an account of the
 * wrong type for a given code.
 */
@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure every code exists and return them keyed by code.
   *
   * Callers pass the transaction they are already in, so account creation is
   * atomic with the posting that needs it.
   */
  async ensureAccounts(
    tx: Prisma.TransactionClient,
    codes: string[],
  ): Promise<Map<string, GlAccount>> {
    const unique = [...new Set(codes)];
    const accounts = new Map<string, GlAccount>();

    if (unique.length === 0) return accounts;

    const existing = await tx.glAccount.findMany({ where: { code: { in: unique } } });
    for (const account of existing) accounts.set(account.code, account);

    for (const code of unique) {
      if (accounts.has(code)) continue;
      const spec = parseAccountCode(code);

      try {
        const created = await tx.glAccount.create({
          data: {
            code,
            type: spec.type,
            scope: spec.scope,
            ownerRef: spec.ownerRef,
            currency: spec.currency,
          },
        });
        accounts.set(code, created);
      } catch (err) {
        // Concurrent postings for the same new account: adopt the winner.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const row = await tx.glAccount.findUnique({ where: { code } });
          if (row) {
            accounts.set(code, row);
            continue;
          }
          throw new InternalServerErrorException(
            `Ledger account "${code}" disappeared while being created.`,
          );
        }
        throw err;
      }
    }

    return accounts;
  }

  /** Platform wallet account — created by the ledger migration, but self-healing. */
  async ensurePlatformWallet(tx?: Prisma.TransactionClient): Promise<GlAccount> {
    const run = async (client: Prisma.TransactionClient) => {
      const accounts = await this.ensureAccounts(client, ['platform:wallet:GBP']);
      return accounts.get('platform:wallet:GBP')!;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  /** Read-only lookup for reporting surfaces. Returns null when absent. */
  findAccount(code: string) {
    return this.prisma.glAccount.findUnique({ where: { code } });
  }
}
