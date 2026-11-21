import { useQuery } from '@tanstack/react-query';
import {
  ledgerAdminApi,
  mcomPayAdminApi,
  type AppChargeFilters,
  type WalletActivityFilters,
} from '../api/mcom-pay-admin.api';

export const mcomPayKeys = {
  all: ['mcom-pay-admin'] as const,
  charges: (params: AppChargeFilters) => ['mcom-pay-admin', 'charges', params] as const,
  charge: (id: string) => ['mcom-pay-admin', 'charge', id] as const,
  ledger: (id: string) => ['mcom-pay-admin', 'ledger', id] as const,
  walletActivity: (params: WalletActivityFilters) =>
    ['mcom-pay-admin', 'wallet-activity', params] as const,
};

export const useAdminAppCharges = (params: AppChargeFilters) =>
  useQuery({
    queryKey: mcomPayKeys.charges(params),
    queryFn: () => mcomPayAdminApi.listCharges(params),
    placeholderData: (prev: any) => prev,
  });

export const useAdminAppCharge = (id: string) =>
  useQuery({
    queryKey: mcomPayKeys.charge(id),
    queryFn: () => mcomPayAdminApi.getCharge(id),
    enabled: !!id,
  });

export const useAdminAppChargeLedger = (id: string) =>
  useQuery({
    queryKey: mcomPayKeys.ledger(id),
    queryFn: () => mcomPayAdminApi.getLedger(id),
    enabled: !!id,
  });

export const useAdminWalletActivity = (params: WalletActivityFilters) =>
  useQuery({
    queryKey: mcomPayKeys.walletActivity(params),
    queryFn: () => mcomPayAdminApi.listWalletActivity(params),
    placeholderData: (prev: any) => prev,
  });

// ─── Central ledger (Phase 6) ───────────────────────────────────────────────

export const ledgerKeys = {
  all: ['mcom-pay-ledger'] as const,
  overview: () => [...ledgerKeys.all, 'overview'] as const,
  platform: () => [...ledgerKeys.all, 'platform'] as const,
  platformEntries: (page: number) => [...ledgerKeys.all, 'platform-entries', page] as const,
  platformActivity: (page: number) => [...ledgerKeys.all, 'platform-activity', page] as const,
  events: (params: Record<string, unknown>) => [...ledgerKeys.all, 'events', params] as const,
  platforms: () => [...ledgerKeys.all, 'platforms'] as const,
  event: (key: string) => [...ledgerKeys.all, 'event', key] as const,
  accounts: (params: Record<string, unknown>) => [...ledgerKeys.all, 'accounts', params] as const,
  accountEntries: (code: string, page: number) => [...ledgerKeys.all, 'account', code, page] as const,
  transfers: (params: Record<string, unknown>) => [...ledgerKeys.all, 'transfers', params] as const,
  transfer: (id: string) => [...ledgerKeys.all, 'transfer', id] as const,
  reconciliation: () => [...ledgerKeys.all, 'reconciliation'] as const,
  shadow: () => [...ledgerKeys.all, 'shadow'] as const,
  trend: (params: Record<string, unknown>) => [...ledgerKeys.all, 'trend', params] as const,
  byPlatform: (params: Record<string, unknown>) => [...ledgerKeys.all, 'by-platform', params] as const,
  byIntent: (params: Record<string, unknown>) => [...ledgerKeys.all, 'by-intent', params] as const,
};

export const useLedgerOverview = () =>
  useQuery({ queryKey: ledgerKeys.overview(), queryFn: () => ledgerAdminApi.getOverview(), refetchInterval: 60_000 });

export const usePlatformWallet = () =>
  useQuery({ queryKey: ledgerKeys.platform(), queryFn: () => ledgerAdminApi.getPlatformWallet() });

export const useLedgerPlatforms = () =>
  useQuery({ queryKey: ledgerKeys.platforms(), queryFn: () => ledgerAdminApi.getPlatforms() });

export const useLedgerEvents = (params: Record<string, unknown>) =>
  useQuery({
    queryKey: ledgerKeys.events(params),
    queryFn: () => ledgerAdminApi.getEvents(params as any),
    placeholderData: (prev: any) => prev,
  });

export const useLedgerEvent = (key: string | null) =>
  useQuery({
    queryKey: ledgerKeys.event(key ?? ''),
    queryFn: () => ledgerAdminApi.getEvent(key as string),
    enabled: !!key,
  });

export const usePlatformActivity = (page: number) =>
  useQuery({
    queryKey: ledgerKeys.platformActivity(page),
    queryFn: () => ledgerAdminApi.getPlatformActivity({ page, limit: 20 }),
    placeholderData: (prev: any) => prev,
  });

export const usePlatformWalletEntries = (page: number) =>
  useQuery({
    queryKey: ledgerKeys.platformEntries(page),
    queryFn: () => ledgerAdminApi.getPlatformWalletEntries({ page, limit: 20 }),
    placeholderData: (prev: any) => prev,
  });

export const useLedgerAccounts = (params: Record<string, unknown>) =>
  useQuery({ queryKey: ledgerKeys.accounts(params), queryFn: () => ledgerAdminApi.listAccounts(params as any) });

export const useAccountEntries = (code: string, page: number) =>
  useQuery({
    queryKey: ledgerKeys.accountEntries(code, page),
    queryFn: () => ledgerAdminApi.getAccountEntries(code, { page, limit: 20 }),
    enabled: !!code,
    placeholderData: (prev: any) => prev,
  });

export const useLedgerTransfers = (params: Record<string, unknown>) =>
  useQuery({
    queryKey: ledgerKeys.transfers(params),
    queryFn: () => ledgerAdminApi.listTransfers(params as any),
    placeholderData: (prev: any) => prev,
  });

export const useLedgerTransfer = (id: string | null) =>
  useQuery({
    queryKey: ledgerKeys.transfer(id ?? ''),
    queryFn: () => ledgerAdminApi.getTransfer(id as string),
    enabled: !!id,
  });

export const useLedgerReconciliation = () =>
  useQuery({ queryKey: ledgerKeys.reconciliation(), queryFn: () => ledgerAdminApi.getReconciliation() });

export const useLedgerShadow = () =>
  useQuery({ queryKey: ledgerKeys.shadow(), queryFn: () => ledgerAdminApi.getShadow() });

export const useLedgerTrend = (params: Record<string, unknown>) =>
  useQuery({ queryKey: ledgerKeys.trend(params), queryFn: () => ledgerAdminApi.getTrend(params as any) });

export const useLedgerByPlatform = (params: Record<string, unknown>) =>
  useQuery({ queryKey: ledgerKeys.byPlatform(params), queryFn: () => ledgerAdminApi.getByPlatform(params as any) });

export const useLedgerByIntent = (params: Record<string, unknown>) =>
  useQuery({ queryKey: ledgerKeys.byIntent(params), queryFn: () => ledgerAdminApi.getByIntent(params as any) });
