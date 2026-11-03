import { useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Store,
  Plus,
  Search,
  Loader2,
  Trash2,
  X,
  Users,
  RefreshCw,
  ChevronRight,
  Wand2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAdminCities,
  useCreateCity,
  useDeleteCity,
  useRunLocationAggregation,
  useBackfillBusinessLocations,
} from '../../services/admin/hooks';
import AssignedUsersTable from './AssignedUsersTable';
import type { City } from '../../services/admin/types';

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  hint: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-black text-gray-950">{value}</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-500">{hint}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function CitiesPanel() {
  const { data: citiesRes, isLoading } = useAdminCities();
  const cities: City[] = citiesRes?.data ?? [];
  const createCity = useCreateCity();
  const deleteCity = useDeleteCity();
  const runAggregation = useRunLocationAggregation();
  const backfill = useBackfillBusinessLocations();

  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', region: '' });
  const [error, setError] = useState('');
  const [backfillMessage, setBackfillMessage] = useState('');

  const filtered = useMemo(
    () =>
      cities.filter(
        (city) =>
          city.name.toLowerCase().includes(search.toLowerCase()) ||
          (city.region || '').toLowerCase().includes(search.toLowerCase()),
      ),
    [cities, search],
  );

  const totalBusinesses = cities.reduce((sum, city) => sum + (city.businessCount ?? 0), 0);
  const totalAffiliates = cities.reduce((sum, city) => sum + (city.affiliateCount ?? 0), 0);
  const totalAssigned = totalBusinesses + totalAffiliates;
  const totalBoroughs = cities.reduce((sum, city) => sum + (city._count?.boroughs ?? 0), 0);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('City name is required.');
      return;
    }
    setError('');
    try {
      await createCity.mutateAsync({
        name: form.name.trim(),
        region: form.region.trim() || undefined,
      });
      setForm({ name: '', region: '' });
      setIsCreateOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create the city.');
    }
  };

  const handleDelete = async (city: City) => {
    if (!window.confirm(`Delete ${city.name}? Businesses stay assigned but lose this city link.`)) return;
    await deleteCity.mutateAsync(city.id);
    if (selectedCity?.id === city.id) setSelectedCity(null);
  };

  const handleBackfill = async () => {
    if (
      !window.confirm(
        'Backfill location assignments for existing businesses that already have a postcode? This may take a little while.',
      )
    ) {
      return;
    }
    setBackfillMessage('');
    try {
      const response = await backfill.mutateAsync({});
      const summary = response.data;
      setBackfillMessage(
        `Backfill complete: ${summary.assigned} assigned, ${summary.failed} failed, ${summary.skipped} skipped.`,
      );
    } catch (err: any) {
      setBackfillMessage(
        err?.response?.data?.message || 'Backfill failed. Check the backend logs and try again.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">City Management</h2>
          <p className="text-xs font-medium text-gray-500">
            Top of the geographic hierarchy — each city rolls up its boroughs, high streets and local malls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runAggregation.mutate()}
            disabled={runAggregation.isPending}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', runAggregation.isPending && 'animate-spin')} />
            Recalculate totals
          </button>
          <button
            onClick={handleBackfill}
            disabled={backfill.isPending}
            title="Assign existing postcode-only businesses to their city, borough, high street and local mall"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <Wand2 className={cn('h-4 w-4', backfill.isPending && 'animate-pulse')} />
            {backfill.isPending ? 'Backfilling…' : 'Backfill postcodes'}
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-100 transition-all hover:scale-[1.01] hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" /> Add City
          </button>
        </div>
      </div>

      {backfillMessage && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800">
          {backfillMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Cities" value={String(cities.length)} hint="geographic roots" icon={Building2} color="bg-blue-50 text-blue-600" />
        <StatCard title="Boroughs" value={String(totalBoroughs)} hint="across all cities" icon={MapPin} color="bg-orange-50 text-orange-600" />
        <StatCard title="Assigned Users" value={totalAssigned.toLocaleString()} hint={`${totalBusinesses} businesses · ${totalAffiliates} affiliates`} icon={Store} color="bg-emerald-50 text-emerald-600" />
        <StatCard title="Average per City" value={cities.length ? String(Math.round(totalAssigned / cities.length)) : '0'} hint="users per city" icon={Users} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-50 p-5">
            <h3 className="text-base font-bold text-gray-950">Cities</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cities..."
                className="w-48 rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs font-semibold text-gray-900 outline-none transition-all focus:border-brand-blue focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">City</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Boroughs</th>
                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Assigned Users</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-xs font-bold text-gray-400">
                      No cities yet. Add one or let postcode signups create them automatically.
                    </td>
                  </tr>
                ) : (
                  filtered.map((city) => (
                    <tr
                      key={city.id}
                      onClick={() => setSelectedCity(city)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-gray-50/60',
                        selectedCity?.id === city.id && 'bg-orange-50/50',
                      )}
                    >
                      <td className="px-5 py-3">
                        <p className="text-sm font-bold text-gray-900">{city.name}</p>
                        <p className="text-[11px] font-semibold text-gray-400">{city.region || city.country}</p>
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold text-gray-500">
                        {city._count?.boroughs ?? 0}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          title={`View all ${(city.businessCount ?? 0) + (city.affiliateCount ?? 0)} assigned users`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedCity(city);
                            requestAnimationFrame(() =>
                              document.getElementById('city-assigned-users')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                            );
                          }}
                          className="text-sm font-bold text-orange-600 underline decoration-orange-200 underline-offset-4 hover:text-orange-800"
                        >
                          {(city.businessCount ?? 0) + (city.affiliateCount ?? 0)}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(city);
                            }}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label={`Delete ${city.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="city-assigned-users">
          <AssignedUsersTable
            entity={selectedCity ? { type: 'city', id: selectedCity.id } : null}
            title="Assigned Users"
            titleHint={
              selectedCity
                ? `${selectedCity.name} · search, filter and page through every business and affiliate`
                : 'Select a city to inspect its assigned businesses and affiliates'
            }
            emptyMessage="No businesses or affiliates are assigned to this city yet."
          />
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-950">Add City</h3>
              <button onClick={() => setIsCreateOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">City name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Greater London"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Region (optional)</label>
                <input
                  value={form.region}
                  onChange={(event) => setForm({ ...form, region: event.target.value })}
                  placeholder="e.g. London"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createCity.isPending}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {createCity.isPending ? 'Creating…' : 'Create city'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
