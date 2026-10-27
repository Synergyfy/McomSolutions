import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Search,
  Tag,
  Ticket,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useAdminAccessPlans,
  useAdminCoupon,
  useAdminPlans,
  useCouponUserLookup,
  useCreateCoupon,
  useUpdateCoupon,
} from '../services/admin/hooks';
import type { AdminCouponInput, CouponUserLookup } from '../services/admin/types';
import {
  defaultCouponForm,
  generateCouponCode,
  hasCouponFormErrors,
  toDateTimeLocal,
  validateCouponForm,
  type CouponFormErrors,
  type CouponFormValues,
} from '../lib/couponValidation';

const inputClass =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-sm font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[46px]';
const labelClass = 'block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5';
const hintClass = 'text-[11px] text-gray-400 mt-1';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-[11px] text-red-600 flex items-start gap-1">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      {message}
    </p>
  );
}

interface ScopeOption {
  id: string;
  name: string;
}

function ScopeMultiSelect({
  label,
  allLabel,
  placeholder,
  emptyMessage,
  options,
  loading,
  allSelected,
  selectedIds,
  onSelectAll,
  onToggleOption,
  error,
}: {
  label: string;
  allLabel: string;
  placeholder: string;
  emptyMessage: string;
  options: ScopeOption[];
  loading: boolean;
  allSelected: boolean;
  selectedIds: string[];
  onSelectAll: () => void;
  onToggleOption: (id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedNames = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.name);
  const hasSelection = allSelected || selectedNames.length > 0;
  const summary = allSelected
    ? allLabel
    : selectedNames.length > 0
      ? selectedNames.join(', ')
      : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(inputClass, 'flex items-center justify-between gap-2 text-left')}
      >
        <span
          className={cn(
            'truncate',
            hasSelection ? 'text-gray-900' : 'text-gray-400 font-normal',
          )}
        >
          {summary}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto"
        >
          <button
            type="button"
            role="option"
            aria-selected={allSelected}
            onClick={onSelectAll}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 border-b border-gray-100 text-left"
          >
            <span
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                allSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 bg-white',
              )}
            >
              {allSelected && <Check className="w-3 h-3" />}
            </span>
            <span className="text-xs font-bold text-gray-900">{allLabel}</span>
          </button>

          {loading ? (
            <div className="px-3.5 py-2.5 text-xs text-gray-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
            </div>
          ) : options.length === 0 ? (
            <div className="px-3.5 py-2.5 text-xs text-gray-400">{emptyMessage}</div>
          ) : (
            options.map((option) => {
              const checked = !allSelected && selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => onToggleOption(option.id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 text-left"
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 bg-white',
                    )}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">{option.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      <FieldError message={error} />
    </div>
  );
}

export default function AdminCouponEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const segments = location.pathname.split('/');
  const isNew = segments[3] === 'new';
  const couponId = !isNew ? segments[3] : null;

  const { data: couponRes, isLoading: couponLoading } = useAdminCoupon(couponId);
  const { data: plansRes, isLoading: plansLoading } = useAdminPlans();
  const { data: accessPlansRes, isLoading: accessPlansLoading } = useAdminAccessPlans();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();

  const [form, setForm] = useState<CouponFormValues>(defaultCouponForm);
  const membershipScopeEnabled = form.membershipScopeEnabled ?? false;
  const accessScopeEnabled = form.accessScopeEnabled ?? false;
  const membershipPlanIds = form.membershipPlanIds ?? [];
  const accessPlanIds = form.accessPlanIds ?? [];
  const appliesToAllAccess = form.appliesToAllAccess ?? false;
  const [errors, setErrors] = useState<CouponFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [selectedUser, setSelectedUser] = useState<CouponUserLookup | null>(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setUserSearchDebounced(userSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const plans = useMemo(
    () => (plansRes?.data ?? []).filter((plan: any) => !plan.archived),
    [plansRes],
  );
  const accessPlans = useMemo(
    () => (accessPlansRes?.data ?? []).filter((plan: any) => !plan.archived),
    [accessPlansRes],
  );
  const coupon = couponRes?.data;

  const { data: userLookupRes, isLoading: userLookupLoading } = useCouponUserLookup(userSearchDebounced);

  useEffect(() => {
    if (isNew || !coupon || initializedRef.current) return;
    initializedRef.current = true;
    setForm({
      code: coupon.code,
      description: coupon.description ?? '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      membershipScopeEnabled:
        coupon.appliesToAllMemberships || (coupon.membershipPlanIds ?? []).length > 0,
      appliesToAllMemberships: coupon.appliesToAllMemberships,
      membershipPlanIds: coupon.membershipPlanIds ?? [],
      accessScopeEnabled:
        (coupon.appliesToAllAccess ?? false) || (coupon.accessPlanIds ?? []).length > 0,
      appliesToAllAccess: coupon.appliesToAllAccess ?? false,
      accessPlanIds: coupon.accessPlanIds ?? [],
      maxUses: coupon.maxUses === null ? '' : String(coupon.maxUses),
      maxUsesPerUser: coupon.maxUsesPerUser === null ? '' : String(coupon.maxUsesPerUser),
      validFrom: toDateTimeLocal(coupon.validFrom),
      expiresAt: toDateTimeLocal(coupon.expiresAt),
      isActive: coupon.isActive,
      lockedToUserId: coupon.lockedToUserId ?? '',
    });
    if (coupon.lockedToUser) {
      setSelectedUser({
        id: coupon.lockedToUser.id,
        email: coupon.lockedToUser.email,
        name:
          [coupon.lockedToUser.firstName, coupon.lockedToUser.lastName]
            .filter(Boolean)
            .join(' ') || coupon.lockedToUser.email,
        role: '',
        businessName: coupon.lockedToUser.businessProfile?.businessName ?? null,
      });
    }
  }, [coupon, isNew]);

  const update = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (
      errors.scope &&
      (key === 'membershipScopeEnabled' ||
        key === 'appliesToAllMemberships' ||
        key === 'membershipPlanIds' ||
        key === 'accessScopeEnabled' ||
        key === 'appliesToAllAccess' ||
        key === 'accessPlanIds')
    ) {
      setErrors((prev) => ({ ...prev, scope: undefined }));
    }
    if (submitError) setSubmitError(null);
  };

  const togglePlan = (planId: string) => {
    const next = membershipPlanIds.includes(planId)
      ? membershipPlanIds.filter((id) => id !== planId)
      : [...membershipPlanIds, planId];
    update('membershipPlanIds', next);
  };

  const toggleAccessPlan = (planId: string) => {
    const next = accessPlanIds.includes(planId)
      ? accessPlanIds.filter((id) => id !== planId)
      : [...accessPlanIds, planId];
    update('accessPlanIds', next);
  };

  const toggleMembershipScope = (enabled: boolean) => {
    update('membershipScopeEnabled', enabled);
    if (enabled && membershipPlanIds.length === 0) {
      update('appliesToAllMemberships', true);
    }
  };

  const toggleAccessScope = (enabled: boolean) => {
    update('accessScopeEnabled', enabled);
    if (enabled && accessPlanIds.length === 0) {
      update('appliesToAllAccess', true);
    }
  };

  const selectAllMemberships = () => {
    update('appliesToAllMemberships', true);
    update('membershipPlanIds', []);
  };

  const selectAllAccessPasses = () => {
    update('appliesToAllAccess', true);
    update('accessPlanIds', []);
  };

  const toggleMembershipOption = (planId: string) => {
    if (form.appliesToAllMemberships) {
      update('appliesToAllMemberships', false);
      update('membershipPlanIds', [planId]);
      return;
    }
    togglePlan(planId);
  };

  const toggleAccessOption = (planId: string) => {
    if (appliesToAllAccess) {
      update('appliesToAllAccess', false);
      update('accessPlanIds', [planId]);
      return;
    }
    toggleAccessPlan(planId);
  };

  const selectUser = (user: CouponUserLookup) => {
    setSelectedUser(user);
    update('lockedToUserId', user.id);
    setUserPickerOpen(false);
    setUserSearch('');
  };

  const clearUser = () => {
    setSelectedUser(null);
    update('lockedToUserId', '');
    setUserSearch('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateCouponForm(form);
    setErrors(nextErrors);
    if (hasCouponFormErrors(nextErrors)) {
      setSubmitError('Please fix the highlighted fields before saving.');
      return;
    }
    if (coupon?.source === 'TASK_REWARD') {
      setSubmitError('Task reward coupons are managed from their task.');
      return;
    }

    const payload: AdminCouponInput = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      appliesToAllMemberships: membershipScopeEnabled && form.appliesToAllMemberships,
      membershipPlanIds:
        membershipScopeEnabled && !form.appliesToAllMemberships ? membershipPlanIds : [],
      appliesToAllAccess: accessScopeEnabled && appliesToAllAccess,
      accessPlanIds: accessScopeEnabled && !appliesToAllAccess ? accessPlanIds : [],
      maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
      maxUsesPerUser: form.maxUsesPerUser.trim() ? Number(form.maxUsesPerUser) : null,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isActive: form.isActive,
      lockedToUserId: form.lockedToUserId || null,
    };

    try {
      if (isNew) {
        await createCoupon.mutateAsync(payload);
      } else if (couponId) {
        await updateCoupon.mutateAsync({ id: couponId, data: payload });
      }
      navigate('/admin/coupons');
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not save the coupon. Please try again.',
      );
    }
  };

  if (!isNew && couponLoading) {
    return (
      <div className="py-20 flex items-center justify-center text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading coupon...
      </div>
    );
  }

  if (!isNew && !coupon) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
        <Ticket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-black text-gray-900">Coupon not found</h2>
        <p className="text-sm text-gray-500 mt-1">It may have been removed.</p>
        <button
          type="button"
          onClick={() => navigate('/admin/coupons')}
          className="mt-5 px-4 py-2.5 rounded-xl bg-brand-blue text-white text-xs font-bold"
        >
          Back to coupons
        </button>
      </div>
    );
  }

  if (!isNew && coupon?.source === 'TASK_REWARD') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-xl mx-auto">
        <Lock className="w-10 h-10 text-violet-400 mx-auto mb-3" />
        <h2 className="text-lg font-black text-gray-900">Task reward coupon</h2>
        <p className="text-sm text-gray-500 mt-1">
          This coupon was issued by a programme task. Edit the task to change future reward rules.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/coupons')}
          className="mt-5 px-4 py-2.5 rounded-xl bg-brand-blue text-white text-xs font-bold"
        >
          Back to coupons
        </button>
      </div>
    );
  }

  const saving = createCoupon.isPending || updateCoupon.isPending;
  const lookupUsers = userLookupRes?.data ?? [];

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/coupons')}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to coupons
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/coupons')}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-brand-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 shadow-glow"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create coupon' : 'Save changes'}
          </button>
        </div>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {errors.scope && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errors.scope}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Coupon code</h2>
            <p className="text-xs text-gray-500">The code customers enter at membership checkout.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Code *</label>
            <div className="flex gap-2">
              <input
                value={form.code}
                onChange={(event) => update('code', event.target.value.toUpperCase())}
                maxLength={40}
                placeholder="MCOM-20OFF"
                disabled={!isNew && (coupon?.timesRedeemed ?? 0) > 0}
                className={cn(inputClass, 'font-mono tracking-wide uppercase')}
              />
              <button
                type="button"
                onClick={() => update('code', generateCouponCode())}
                disabled={!isNew && (coupon?.timesRedeemed ?? 0) > 0}
                className="px-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                title="Generate a code"
              >
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
            <FieldError message={errors.code} />
            {!isNew && (coupon?.timesRedeemed ?? 0) > 0 && (
              <p className={hintClass}>The code is locked after its first redemption.</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              maxLength={250}
              placeholder="e.g. Gold membership autumn offer"
              className={inputClass}
            />
            <FieldError message={errors.description} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Discount</h2>
            <p className="text-xs text-gray-500">Percentage or fixed amount off the payment due today.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Discount type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['PERCENTAGE', 'FIXED'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update('discountType', type)}
                  className={cn(
                    'px-3 py-2.5 rounded-xl border text-xs font-bold transition-all',
                    form.discountType === type
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100',
                  )}
                >
                  {type === 'PERCENTAGE' ? 'Percentage (%)' : 'Fixed amount (£)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {form.discountType === 'PERCENTAGE' ? 'Percentage off *' : 'Amount off (GBP) *'}
            </label>
            <div className="relative">
              <input
                type="number"
                min={form.discountType === 'PERCENTAGE' ? 1 : 0.01}
                max={form.discountType === 'PERCENTAGE' ? 99 : 100000}
                step="0.01"
                value={form.discountValue}
                onChange={(event) => update('discountValue', event.target.value)}
                className={inputClass}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                {form.discountType === 'PERCENTAGE' ? '%' : '£'}
              </span>
            </div>
            <FieldError message={errors.discountValue} />
            <p className={hintClass}>
              {form.discountType === 'PERCENTAGE'
                ? 'Must leave at least £0.50 to pay.'
                : 'The amount is capped at the payment due today.'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Membership scope</h2>
            <p className="text-xs text-gray-500">Choose which memberships the coupon can be used on.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-bold text-gray-800">Applies to memberships</p>
            <p className="text-xs text-gray-500">
              {membershipScopeEnabled
                ? 'Pick all memberships or specific ones from the dropdown.'
                : 'Off — the coupon cannot be used on any membership.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={membershipScopeEnabled}
              onChange={(event) => toggleMembershipScope(event.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {membershipScopeEnabled && (
          <div className="mt-4">
            <ScopeMultiSelect
              label="Membership selection"
              allLabel="All memberships"
              placeholder="Select memberships"
              emptyMessage="No active membership plans found."
              options={plans as ScopeOption[]}
              loading={plansLoading}
              allSelected={form.appliesToAllMemberships}
              selectedIds={membershipPlanIds}
              onSelectAll={selectAllMemberships}
              onToggleOption={toggleMembershipOption}
              error={errors.membershipPlanIds}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Access pass scope</h2>
            <p className="text-xs text-gray-500">Choose which access passes the coupon can be used on.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-bold text-gray-800">Applies to access passes</p>
            <p className="text-xs text-gray-500">
              {accessScopeEnabled
                ? 'Pick all access passes or specific ones from the dropdown.'
                : 'Off — the coupon cannot be used on any access pass.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={accessScopeEnabled}
              onChange={(event) => toggleAccessScope(event.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {accessScopeEnabled && (
          <div className="mt-4">
            <ScopeMultiSelect
              label="Access pass selection"
              allLabel="All access passes"
              placeholder="Select access passes"
              emptyMessage="No active access passes found."
              options={accessPlans as ScopeOption[]}
              loading={accessPlansLoading}
              allSelected={appliesToAllAccess}
              selectedIds={accessPlanIds}
              onSelectAll={selectAllAccessPasses}
              onToggleOption={toggleAccessOption}
              error={errors.accessPlanIds}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Validity and usage</h2>
            <p className="text-xs text-gray-500">Control how often and how long the code can be used.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Valid from</label>
            <input
              type="datetime-local"
              value={form.validFrom}
              onChange={(event) => update('validFrom', event.target.value)}
              className={inputClass}
            />
            <FieldError message={errors.validFrom} />
          </div>
          <div>
            <label className={labelClass}>Expires at</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              min={form.validFrom || undefined}
              onChange={(event) => update('expiresAt', event.target.value)}
              className={inputClass}
            />
            <FieldError message={errors.expiresAt} />
            <p className={hintClass}>Leave blank for no expiry.</p>
          </div>
          <div>
            <label className={labelClass}>Maximum uses</label>
            <input
              type="number"
              min={1}
              step="1"
              value={form.maxUses}
              onChange={(event) => update('maxUses', event.target.value)}
              placeholder="Unlimited"
              className={inputClass}
            />
            <FieldError message={errors.maxUses} />
            <p className={hintClass}>Total completed redemptions allowed.</p>
          </div>
          <div>
            <label className={labelClass}>Maximum per user</label>
            <input
              type="number"
              min={1}
              step="1"
              value={form.maxUsesPerUser}
              onChange={(event) => update('maxUsesPerUser', event.target.value)}
              placeholder="Unlimited"
              className={inputClass}
            />
            <FieldError message={errors.maxUsesPerUser} />
            <p className={hintClass}>Set 1 to make it a one-per-person code.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">Access control</h2>
            <p className="text-xs text-gray-500">Optionally lock the code to one person.</p>
          </div>
        </div>

        {selectedUser ? (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{selectedUser.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {selectedUser.email}
                {selectedUser.businessName ? ` · ${selectedUser.businessName}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={clearUser}
              className="p-2 rounded-lg text-amber-700 hover:bg-amber-100"
              title="Remove lock"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setUserPickerOpen(true);
                }}
                onFocus={() => setUserPickerOpen(true)}
                placeholder="Search by email, name or business (optional)"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
            {userPickerOpen && userSearch.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                {userLookupLoading ? (
                  <div className="p-3 text-xs text-gray-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                  </div>
                ) : lookupUsers.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400">No matching users.</div>
                ) : (
                  lookupUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="text-xs font-bold text-gray-900">{user.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {user.email}
                        {user.businessName ? ` · ${user.businessName}` : ''}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            <p className={hintClass}>Leave blank to let anyone use the code.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-gray-900">Coupon status</p>
            <p className="text-xs text-gray-500">Inactive coupons cannot be redeemed.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update('isActive', event.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/coupons')}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-brand-blue text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 shadow-glow"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isNew ? 'Create coupon' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
