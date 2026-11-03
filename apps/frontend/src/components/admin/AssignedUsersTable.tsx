import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronLeft, ChevronRight, Loader2, Search, Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAssignedBusinesses } from '../../services/admin/hooks';

type EntityType =
  | 'city'
  | 'borough'
  | 'highStreet'
  | 'localMall'
  | 'sector'
  | 'category'
  | 'subcategory';

interface AssignedUsersTableProps {
  entity: { type: EntityType; id: string } | null;
  title?: string;
  titleHint?: string;
  emptyMessage?: string;
  /** Location scopes include affiliates; catalog scopes are business-only. */
  allowRoleFilter?: boolean;
  pageSizeOptions?: number[];
}

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'All users' },
  { value: 'BUSINESS', label: 'Businesses' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'CONSULTANT', label: 'Consultants' },
  { value: 'ACCOUNT_MANAGER', label: 'Account managers' },
];

const ROLE_BADGE: Record<string, string> = {
  BUSINESS: 'bg-blue-50 text-blue-700 border-blue-100',
  AGENT: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  CONSULTANT: 'bg-purple-50 text-purple-700 border-purple-100',
  ACCOUNT_MANAGER: 'bg-amber-50 text-amber-700 border-amber-100',
};

const ROLE_LABEL: Record<string, string> = {
  BUSINESS: 'Business',
  AGENT: 'Agent',
  CONSULTANT: 'Consultant',
  ACCOUNT_MANAGER: 'Account manager',
};

export default function AssignedUsersTable({
  entity,
  title = 'Assigned Users',
  titleHint,
  emptyMessage = 'No users are assigned to this entity yet.',
  allowRoleFilter = true,
  pageSizeOptions = [10, 20, 50],
}: AssignedUsersTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSizeOptions[0] ?? 10);

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [entity?.type, entity?.id, role, limit]);

  const { data, isLoading, isFetching, isError } = useAssignedBusinesses(
    entity,
    {
      page,
      limit,
      search: search || undefined,
      role: role === 'ALL' ? undefined : role,
    },
  );

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const pageLabel = useMemo(() => {
    if (!total) return '0 results';
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    return `${start}–${end} of ${total}`;
  }, [page, limit, total]);

  if (!entity) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-gray-950">{title}</h3>
        <p className="mt-1 text-[11px] font-semibold text-gray-400">{titleHint || 'Select an entity to view its assigned users.'}</p>
        <div className="mt-4 flex h-24 items-center justify-center text-xs font-semibold text-gray-400">
          No entity selected.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-950">{title}</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
              {titleHint || `${pageLabel} assigned`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, email, postcode..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs font-semibold text-gray-900 outline-none transition-colors focus:border-brand-blue focus:bg-white sm:w-60"
              />
            </div>

            {allowRoleFilter && (
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-brand-blue"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}

            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-brand-blue"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-blue" /></div>
      ) : isError ? (
        <div className="flex h-40 items-center justify-center px-6 text-center text-xs font-semibold text-red-500">
          Could not load assigned users. Please try again.
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 text-center text-xs font-semibold text-gray-400">
          {search || role !== 'ALL' ? 'No users match your filters.' : emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Name</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Contact</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Postcode</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const userType = row.userType || 'BUSINESS';
                const isAffiliate = userType !== 'BUSINESS';
                return (
                  <tr key={`${userType}-${row.id}`} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', isAffiliate ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600')}>
                          {isAffiliate ? <Briefcase className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-gray-900">{row.businessName}</p>
                          <p className="truncate text-[10px] font-semibold text-gray-400">{row.category || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold', ROLE_BADGE[userType] || ROLE_BADGE.BUSINESS)}>
                        {ROLE_LABEL[userType] || userType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-700">
                        {[row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || '—'}
                      </p>
                      <p className="text-[10px] font-semibold text-gray-400">{row.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">{row.postcode || '—'}</td>
                    <td className="px-4 py-3 text-[10px] font-semibold text-gray-500">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {isFetching && !isLoading ? 'Updating…' : pageLabel}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-[10px] font-bold text-gray-500">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
