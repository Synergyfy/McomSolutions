import { useQuery } from '@tanstack/react-query';
import { mcomPayAdminApi, type AppChargeFilters } from '../api/mcom-pay-admin.api';

export const mcomPayKeys = {
  all: ['mcom-pay-admin'] as const,
  charges: (params: AppChargeFilters) => ['mcom-pay-admin', 'charges', params] as const,
  charge: (id: string) => ['mcom-pay-admin', 'charge', id] as const,
  ledger: (id: string) => ['mcom-pay-admin', 'ledger', id] as const,
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
