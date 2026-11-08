import { useNavigate } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Phone,
  Calendar,
  ShieldCheck,
  Building2,
  UserCircle,
  Gem,
  CreditCard,
  Wallet,
  ClipboardList,
  LifeBuoy,
  Star,
  MapPin,
  Briefcase,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Activity,
  BadgeCheck,
  KeyRound,
  Users,
  ChevronDown,
  ChevronUp,
  Gift,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAdminReferralDetail, useAdminUserFullProfile } from '../services/admin/hooks';
import type { AdminFullUserProfile, AdminBusinessProgrammeRecord, AdminAffiliateTaskRecord } from '../services/admin/types';

const ROLE_LABELS: Record<string, string> = {
  BUSINESS: 'Business',
  CUSTOMER: 'Customer',
  ADMIN: 'Admin',
  AGENT: 'Agent',
  CONSULTANT: 'Consultant',
  ACCOUNT_MANAGER: 'Account Manager',
  PARTNER: 'Partner',
};

const fmtDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const fmtDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { dateStyle: 'medium' });
};

const fmtMoney = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const humanize = (value?: string | null) => {
  if (!value) return '—';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const daysFromNow = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
};

function toneForStatus(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (['active', 'completed', 'paid', 'approved', 'verified', 'true'].includes(s)) return 'green';
  if (['pending', 'trial', 'in_progress', 'scheduled', 'incomplete', 'past_due'].includes(s)) return 'amber';
  if (['expired', 'failed', 'cancelled', 'canceled', 'suspended', 'revoked', 'invalid', 'rejected', 'deleted'].includes(s)) return 'red';
  return 'gray';
}

export default function AdminUserDetail({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { data: res, isLoading, isError, error } = useAdminUserFullProfile(userId);
  const profile = res?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900">User could not be loaded</h3>
        <p className="text-sm text-gray-500 mt-1">
          {(error as Error)?.message || 'The profile may have been removed or you may not have access.'}
        </p>
        <button
          onClick={() => navigate('/admin/users')}
          className="mt-5 px-4 py-2 bg-brand-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all"
        >
          Back to users
        </button>
      </div>
    );
  }

  return <UserProfileBody profile={profile} onBack={() => navigate('/admin/users')} />;
}

function UserProfileBody({ profile, onBack }: { profile: AdminFullUserProfile; onBack: () => void }) {
  const navigate = useNavigate();
  const { account, businessProfile, customerProfile, agentProfile, consultantProfile, accountManagerProfile } = profile;
  const role = account.role;
  const roleProfile = businessProfile || customerProfile || agentProfile || consultantProfile || accountManagerProfile;
  const status = businessProfile?.membershipStatus || customerProfile?.status || agentProfile?.status || consultantProfile?.status || accountManagerProfile?.status;
  const initial = (account.name || account.email || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-brand-blue transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to all users
      </button>

      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand-blue/10 via-blue-50 to-emerald-50" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-brand-blue text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-200 shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 truncate">{account.name}</h1>
                <Pill tone="blue">{ROLE_LABELS[role] || humanize(role)}</Pill>
                {status && <Pill tone={toneForStatus(status)}>{humanize(status)}</Pill>}
                {account.deletedAt && <Pill tone="red">Deleted</Pill>}
              </div>
              <p className="text-sm text-gray-500 font-medium mt-1">{account.email}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
                <QuickFact icon={Calendar} label="Account created" value={fmtDateTime(account.createdAt)} />
                <QuickFact icon={Clock} label="Last updated" value={fmtDateTime(account.updatedAt)} />
                <QuickFact icon={Phone} label="Phone" value={(roleProfile as any)?.phone || '—'} />
                <QuickFact icon={ShieldCheck} label="User ID" value={account.id} mono />
              </div>
            </div>
            <div className="lg:text-right shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registration source</p>
              <p className="text-sm font-bold text-gray-800">{humanize(account.registrationSource)}</p>
              {account.referralCode && (
                <p className="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Referral code <span className="text-gray-700">{account.referralCode}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Section title="Account details" icon={UserCircle} subtitle="Identity, contact and registration information">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
              <Field label="Full name" value={account.fullName || account.name} />
              <Field label="Email address" value={account.email} />
              <Field label="Role" value={ROLE_LABELS[role] || humanize(role)} />
              <Field label="Job title" value={account.jobTitle} />
              <Field label="Registration source" value={humanize(account.registrationSource)} />
              <Field label="Referral code" value={account.referralCode} mono />
              <Field
                label="Referred by"
                value={account.referredBy ? account.referredBy.email : '—'}
              />
              <Field label="Account ID" value={account.id} mono />
              <Field label="Created at" value={fmtDateTime(account.createdAt)} />
              <Field label="Last updated" value={fmtDateTime(account.updatedAt)} />
              <Field label="Deleted at" value={fmtDateTime(account.deletedAt)} />
              <Field label="Admin role" value={account.adminRole} />
            </div>
          </Section>

          <Section title="Security & preferences" icon={ShieldCheck} subtitle="Authentication and notification settings">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ToggleFact label="Two-factor auth" enabled={account.twoFactorEnabled} />
              <ToggleFact label="Email notifications" enabled={account.emailNotifications} />
              <ToggleFact label="SMS notifications" enabled={account.smsNotifications} />
              <Field label="Token version" value={String(account.tokenVersion ?? 0)} mono />
            </div>
          </Section>

          {businessProfile && <BusinessProfileSection profile={businessProfile} />}
          {customerProfile && <CustomerProfileSection profile={customerProfile} />}
          {agentProfile && <AgentProfileSection profile={agentProfile} kind="agent" />}
          {consultantProfile && <AgentProfileSection profile={consultantProfile} kind="consultant" />}
          {accountManagerProfile && <AgentProfileSection profile={accountManagerProfile} kind="account-manager" />}

          <MembershipSection profile={profile} />
          <SubscriptionsSection profile={profile} />
          <FinancialSection profile={profile} />
          <ProgrammeSection profile={profile} />
          <AffiliateSection profile={profile} />
          <ReferralHistorySection userId={account.id} />
          <SupportSection profile={profile} />
        </div>

        <div className="space-y-6">
          <Section title="At a glance" icon={BadgeCheck} subtitle="Key account metrics">
            <div className="space-y-3">
              <StatRow label="Membership" value={profile.membership.level && profile.membership.tier ? `${profile.membership.level} ${profile.membership.tier}` : profile.membership.status || '—'} />
              <StatRow label="Revenue" value={fmtMoney(profile.financials.totalRevenue)} />
              <StatRow label="Programme tasks" value={`${profile.programme.taskSummary.completed}/${profile.programme.taskSummary.total}`} />
              <StatRow label="Task progress" value={`${profile.programme.taskSummary.progress}%`} />
              <StatRow label="Outstanding tasks" value={String(profile.programme.taskSummary.outstanding)} />
              <StatRow label="Affiliate reputation" value={String(profile.affiliate.reputationScore)} />
              <StatRow label="Wallet balance" value={profile.financials.wallet ? `${profile.financials.wallet.balance} ${profile.financials.wallet.currency}` : '—'} />
              <StatRow label="Open tickets" value={String(profile.support.tickets.filter((t) => t.status === 'Open').length)} />
            </div>
          </Section>

          <Section title="Programme progress" icon={Activity} subtitle="Task completion across the journey">
            <ProgressRing value={profile.programme.taskSummary.progress} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <MiniStat label="Completed" value={profile.programme.taskSummary.completed} tone="green" />
              <MiniStat label="In progress" value={profile.programme.taskSummary.inProgress} tone="blue" />
              <MiniStat label="Pending" value={profile.programme.taskSummary.pending} tone="amber" />
              <MiniStat label="Expired" value={profile.programme.taskSummary.expired} tone="red" />
            </div>
          </Section>

          <Section title="Quick links" icon={ExternalLink} subtitle="Jump to related admin areas">
            <div className="space-y-2">
              <QuickLink label="Subscription management" onClick={() => navigate('/admin/subscriptions')} />
              <QuickLink label="Programme progress" onClick={() => navigate('/admin/programme-progress')} />
              <QuickLink label="Affiliate tasks" onClick={() => navigate('/admin/affiliate-tasks')} />
              <QuickLink label="Payments & billing" onClick={() => navigate('/admin/payments')} />
            </div>
          </Section>

          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">
            Generated {fmtDateTime(profile.meta.generatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Role profile sections ───────────────────────────────────────────────────

function BusinessProfileSection({ profile }: { profile: NonNullable<AdminFullUserProfile['businessProfile']> }) {
  return (
    <>
      <Section title="Business profile" icon={Building2} subtitle="Complete registered business information">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Business name" value={profile.businessName} />
          <Field label="Business type" value={humanize(profile.businessType)} />
          <Field label="Country" value={profile.country} />
          <Field label="Business email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="Website" value={profile.website} link />
          <Field label="Industry" value={profile.industry} />
          <Field label="Category" value={profile.category} />
          <Field label="Sub-category" value={profile.subCategory} />
          <Field label="Address" value={profile.address} />
          <Field label="Postcode" value={profile.postcode} />
          <Field label="Google verified" value={profile.isOnGoogle ? 'Yes' : 'No'} />
          <Field label="Google place ID" value={profile.googlePlaceId} mono />
          <Field label="Opening hours" value={profile.openingHours} />
          <Field label="Social media" value={profile.socialMedia} link />
          <Field label="Proximity tier" value={humanize(profile.proximityTier)} />
          <Field label="Local mall name" value={profile.localMallName} />
          <Field label="API key" value={profile.apiKey} mono />
          <Field label="Stripe customer" value={profile.stripeCustomerId} mono />
          <Field label="PayPal payer" value={profile.paypalPayerId} mono />
          <Field label="Created at" value={fmtDateTime(profile.createdAt)} />
          <Field label="Last updated" value={fmtDateTime(profile.updatedAt)} />
        </div>
        {profile.description && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <Field label="Description" value={profile.description} multiline />
          </div>
        )}
      </Section>

      <Section title="Membership" icon={Gem} subtitle="Current membership tier and verification state">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Level" value={profile.membershipLevel} />
          <Field label="Tier" value={profile.membershipTier} />
          <Field label="Status" value={humanize(profile.membershipStatus)} />
          <Field label="Plan name" value={profile.membershipPlanName} />
          <Field label="Membership expires" value={fmtDateTime(profile.membershipExpiresAt)} />
          <Field label="Recurring linkage" value={profile.membershipRecurringId} mono />
          <Field label="Trial access days" value={String(profile.trialAccessDays)} />
          <Field label="Trial expires" value={fmtDateTime(profile.trialAccessExpiresAt)} />
          <Field label="Verification fee paid" value={profile.hasPaidVerificationFee ? 'Yes' : 'No'} />
          <Field label="Verification paid at" value={fmtDateTime(profile.verificationFeePaidAt)} />
        </div>
      </Section>

      <Section title="Location & ecosystem" icon={MapPin} subtitle="Geographic and sector assignment">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="City" value={profile.city?.name || '—'} />
          <Field label="Borough" value={profile.borough?.name || '—'} />
          <Field label="High street" value={profile.highStreet?.name || '—'} />
          <Field label="Local mall" value={profile.localMall?.name || profile.localMallName || '—'} />
          <Field label="Sector" value={profile.sector?.name || '—'} />
          <Field label="Category" value={profile.categoryRef?.name || profile.category || '—'} />
          <Field label="Sub-category" value={profile.subCategoryRef?.name || profile.subCategory || '—'} />
          <Field label="Location assigned" value={fmtDateTime(profile.locationAssignedAt)} />
        </div>
        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <Field
            label="Account manager"
            value={profile.accountManager ? `${profile.accountManager.firstName || ''} ${profile.accountManager.lastName || ''}`.trim() || profile.accountManager.email : '—'}
          />
          <Field label="AM assigned" value={fmtDateTime(profile.accountManagerAssignedAt)} />
          <Field label="Acquired by affiliate" value={profile.acquiredByAffiliateName} />
          <Field label="Acquisition source" value={humanize(profile.acquisitionSource)} />
          <Field label="Acquisition status" value={humanize(profile.acquisitionStatus)} />
          <Field label="Attributed at" value={fmtDateTime(profile.acquisitionAttributedAt)} />
        </div>
      </Section>
    </>
  );
}

function CustomerProfileSection({ profile }: { profile: NonNullable<AdminFullUserProfile['customerProfile']> }) {
  return (
    <Section title="Customer profile" icon={UserCircle} subtitle="Loyalty and platform usage">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        <Field label="Phone" value={profile.phone} />
        <Field label="Postcode" value={profile.postcode} />
        <Field label="Loyalty points" value={profile.loyaltyPoints.toLocaleString('en-GB')} />
        <Field label="Membership status" value={humanize(profile.membershipStatus)} />
        <Field label="Status" value={humanize(profile.status)} />
        <Field label="Created at" value={fmtDateTime(profile.createdAt)} />
      </div>
      <div className="mt-5 pt-5 border-t border-gray-100">
        <Field label="Platform usage" value={profile.platformUsage.length ? profile.platformUsage.join(', ') : '—'} />
      </div>
    </Section>
  );
}

function AgentProfileSection({
  profile,
  kind,
}: {
  profile: NonNullable<
    AdminFullUserProfile['agentProfile'] | AdminFullUserProfile['consultantProfile'] | AdminFullUserProfile['accountManagerProfile']
  >;
  kind: 'agent' | 'consultant' | 'account-manager';
}) {
  const title = kind === 'agent' ? 'Agent profile' : kind === 'consultant' ? 'Consultant profile' : 'Account manager profile';
  return (
    <>
      <Section title={title} icon={Briefcase} subtitle="Operational profile, location and performance">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Phone" value={profile.phone} />
          <Field label="Postcode" value={profile.postcode} />
          <Field label="Status" value={humanize(profile.status)} />
          <Field label="Availability" value={humanize(profile.availabilityStatus)} />
          <Field label="Available from" value={fmtDateTime(profile.availableFrom)} />
          <Field label="City" value={profile.city?.name || '—'} />
          <Field label="Borough" value={profile.borough?.name || '—'} />
          <Field label="High street" value={profile.highStreet?.name || '—'} />
          <Field label="Local mall" value={profile.localMall?.name || '—'} />
          <Field label="Location assigned" value={fmtDateTime(profile.locationAssignedAt)} />
          <Field label="Reputation score" value={String(profile.reputationScore)} />
          <Field label="Experience score" value={String(profile.experienceScore)} />
          <Field label="Completed tasks" value={String(profile.completedTasksCount)} />
          <Field label="Failed tasks" value={String(profile.failedTasksCount)} />
          {kind === 'consultant' && (
            <Field label="Specialisation" value={(profile as NonNullable<AdminFullUserProfile['consultantProfile']>).specialisation} />
          )}
          {kind === 'account-manager' && (
            <Field label="Assigned businesses" value={String((profile as NonNullable<AdminFullUserProfile['accountManagerProfile']>).assignedBusinesses)} />
          )}
          <Field label="Created at" value={fmtDateTime(profile.createdAt)} />
        </div>
      </Section>
      {kind === 'agent' && profile.permissions?.length > 0 && (
        <Section title="Permissions" icon={KeyRound} subtitle="Granted agent capabilities">
          <div className="flex flex-wrap gap-2">
            {profile.permissions.map((permission) => (
              <Pill key={permission} tone="blue">{permission}</Pill>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Commercial sections ─────────────────────────────────────────────────────

function MembershipSection({ profile }: { profile: AdminFullUserProfile }) {
  const { membership } = profile;
  if (!membership.level && !membership.status) return null;
  return (
    <Section title="Membership summary" icon={Gem} subtitle="Active plan and verification">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <MiniStat label="Level" value={membership.level || '—'} tone="blue" />
        <MiniStat label="Tier" value={membership.tier || '—'} tone="blue" />
        <MiniStat label="Status" value={humanize(membership.status)} tone={toneForStatus(membership.status)} />
        <MiniStat label="Expires" value={fmtDate(membership.expiresAt)} tone="gray" />
      </div>
      {membership.planName && (
        <p className="mt-4 text-sm font-bold text-gray-700">Plan: {membership.planName}</p>
      )}
    </Section>
  );
}

function SubscriptionsSection({ profile }: { profile: AdminFullUserProfile }) {
  const { membership } = profile;
  const hasAny =
    membership.ecosystemSubscriptions.length > 0 ||
    membership.recurringSubscriptions.length > 0 ||
    membership.installmentSubscriptions.length > 0 ||
    membership.platformPackages.length > 0 ||
    membership.accessPurchases.length > 0 ||
    membership.whitelabelGrants.length > 0;
  if (!hasAny) return null;

  return (
    <Section title="Subscriptions & platform access" icon={CreditCard} subtitle="Everything this user is subscribed to">
      {membership.ecosystemSubscriptions.length > 0 && (
        <SubBlock title={`Ecosystem subscriptions (${membership.ecosystemSubscriptions.length})`}>
          <Table
            headers={['Item', 'Type', 'Status', 'Amount', 'Period']}
            rows={membership.ecosystemSubscriptions.map((s) => [
              s.itemName || s.planName || '—',
              s.type || '—',
              <Pill tone={toneForStatus(s.status)}>{humanize(s.status)}</Pill>,
              `${fmtMoney(s.amount)}${s.billingCycle ? ` / ${s.billingCycle}` : ''}`,
              `${fmtDate(s.startDate)} → ${fmtDate(s.endDate)}`,
            ])}
          />
        </SubBlock>
      )}

      {membership.recurringSubscriptions.length > 0 && (
        <SubBlock title={`Recurring mandates (${membership.recurringSubscriptions.length})`}>
          <div className="space-y-3">
            {membership.recurringSubscriptions.map((sub) => (
              <div key={sub.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {sub.membershipPlanName || sub.planName || sub.platform || 'Subscription'}
                    </p>
                    <p className="text-[11px] text-gray-400 font-bold">
                      {humanize(sub.scope)} · {humanize(sub.provider)} · {humanize(sub.billingCycle)}
                    </p>
                  </div>
                  <Pill tone={toneForStatus(sub.status)}>{humanize(sub.status)}</Pill>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <Field label="Amount" value={fmtMoney(sub.amount)} />
                  <Field label="Next charge" value={fmtDate(sub.nextChargeAt)} />
                  <Field label="Period end" value={fmtDate(sub.currentPeriodEnd)} />
                  <Field label="Auto renew" value={sub.autoRenew ? 'Yes' : 'No'} />
                </div>
                {sub.charges && sub.charges.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Charges</p>
                    <Table
                      headers={['Amount', 'Status', 'Paid at', 'Attempt', 'Period']}
                      rows={sub.charges.map((charge: any) => [
                        fmtMoney(charge.amount),
                        <Pill tone={toneForStatus(charge.status)}>{humanize(charge.status)}</Pill>,
                        fmtDateTime(charge.paidAt),
                        String(charge.attempt ?? '—'),
                        `${fmtDate(charge.periodStart)} → ${fmtDate(charge.periodEnd)}`,
                      ])}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SubBlock>
      )}

      {membership.installmentSubscriptions.length > 0 && (
        <SubBlock title={`Membership installment plans (${membership.installmentSubscriptions.length})`}>
          <div className="space-y-3">
            {membership.installmentSubscriptions.map((inst: any) => (
              <div key={inst.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">
                    {inst.installmentsPaid}/{inst.installmentsTotal} installments paid
                  </p>
                  <Pill tone={toneForStatus(inst.status)}>{humanize(inst.status)}</Pill>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <Field label="Plan" value={inst.paymentOption?.planName || inst.paymentOption?.name || '—'} />
                  <Field label="Next due" value={fmtDate(inst.nextDueAt)} />
                  <Field label="Period end" value={fmtDate(inst.currentPeriodEnd)} />
                  <Field label="Created" value={fmtDate(inst.createdAt)} />
                </div>
              </div>
            ))}
          </div>
        </SubBlock>
      )}

      {membership.platformPackages.length > 0 && (
        <SubBlock title={`Platform packages (${membership.platformPackages.length})`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {membership.platformPackages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{pkg.platform}</p>
                  <Pill tone={toneForStatus(pkg.status)}>{humanize(pkg.status)}</Pill>
                </div>
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">{pkg.planName || pkg.packageName}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Field label="Amount" value={fmtMoney(pkg.amount)} />
                  <Field label="Billing" value={humanize(pkg.billingCycle)} />
                  <Field label="Expires" value={fmtDate(pkg.expiresAt)} />
                  <Field label="Auto renew" value={pkg.autoRenew ? 'Yes' : 'No'} />
                </div>
              </div>
            ))}
          </div>
        </SubBlock>
      )}

      {membership.accessPurchases.length > 0 && (
        <SubBlock title={`Access passes (${membership.accessPurchases.length})`}>
          <Table
            headers={['Plan', 'Status', 'Amount', 'Duration', 'Valid period']}
            rows={membership.accessPurchases.map((a) => [
              a.accessPlanName,
              <Pill tone={toneForStatus(a.status)}>{humanize(a.status)}</Pill>,
              fmtMoney(a.amount),
              `${a.durationDays} days`,
              `${fmtDate(a.startsAt)} → ${fmtDate(a.expiresAt)}`,
            ])}
          />
        </SubBlock>
      )}

      {membership.whitelabelGrants.length > 0 && (
        <SubBlock title={`White-label grants (${membership.whitelabelGrants.length})`}>
          <div className="flex flex-wrap gap-2">
            {membership.whitelabelGrants.map((grant) => (
              <span key={grant.id} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                {grant.client?.name || grant.clientId}
                {grant.source && grant.source !== 'ADMIN' && (
                  <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                    {grant.source === 'ACCESS_PASS' ? 'Access pass' : 'Membership'}
                  </span>
                )}
                {grant.expiresAt && (
                  <span className="text-[10px] font-semibold text-emerald-600">
                    until {fmtDate(grant.expiresAt)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </SubBlock>
      )}
    </Section>
  );
}

function FinancialSection({ profile }: { profile: AdminFullUserProfile }) {
  const { financials } = profile;
  return (
    <Section title="Payments & wallet" icon={Wallet} subtitle="Revenue, transactions and wallet activity">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <MiniStat label="Total revenue" value={fmtMoney(financials.totalRevenue)} tone="green" />
        <MiniStat label="Transactions" value={String(financials.transactions.length)} tone="blue" />
        <MiniStat label="Coupon redemptions" value={String(financials.couponRedemptions.length)} tone="amber" />
        <MiniStat
          label="Wallet balance"
          value={financials.wallet ? `${financials.wallet.balance} ${financials.wallet.currency}` : '—'}
          tone="gray"
        />
      </div>

      {financials.transactions.length > 0 && (
        <SubBlock title="Billing transactions">
          <Table
            headers={['Description', 'Status', 'Amount', 'Provider', 'Reference', 'Date']}
            rows={financials.transactions.map((txn) => [
              txn.description,
              <Pill tone={toneForStatus(txn.status)}>{humanize(txn.status)}</Pill>,
              fmtMoney(txn.amount),
              humanize(txn.provider),
              txn.providerPaymentId || '—',
              fmtDateTime(txn.createdAt),
            ])}
          />
        </SubBlock>
      )}

      {financials.wallet && (
        <SubBlock title={`Wallet · ${financials.wallet.balance} ${financials.wallet.currency}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Field label="Status" value={humanize(financials.wallet.status)} />
            <Field label="Daily debit limit" value={financials.wallet.dailyDebitLimit ?? '—'} />
            <Field label="Monthly debit limit" value={financials.wallet.monthlyDebitLimit ?? '—'} />
            <Field label="Last transaction" value={fmtDateTime(financials.wallet.lastTransactionAt)} />
          </div>
          {financials.wallet.transactions.length > 0 ? (
            <Table
              headers={['Type', 'Category', 'Amount', 'Balance after', 'Description', 'Date']}
              rows={financials.wallet.transactions.map((txn) => [
                humanize(txn.type),
                humanize(txn.category),
                String(txn.amount),
                String(txn.balanceAfter),
                txn.description || txn.platformName || '—',
                fmtDateTime(txn.createdAt),
              ])}
            />
          ) : (
            <Empty text="No wallet transactions yet" />
          )}
        </SubBlock>
      )}

      {financials.couponRedemptions.length > 0 && (
        <SubBlock title="Coupon redemptions">
          <Table
            headers={['Coupon', 'Product', 'Status', 'Discount', 'Final amount', 'Redeemed']}
            rows={financials.couponRedemptions.map((r) => [
              r.couponCode,
              r.planName || r.accessPlanName || humanize(r.productType),
              <Pill tone={toneForStatus(r.status)}>{humanize(r.status)}</Pill>,
              fmtMoney(r.discountAmount),
              fmtMoney(r.finalAmount),
              fmtDateTime(r.redeemedAt),
            ])}
          />
        </SubBlock>
      )}
    </Section>
  );
}

function ProgrammeSection({ profile }: { profile: AdminFullUserProfile }) {
  const { programme } = profile;
  if (programme.programmes.length === 0 && programme.taskAssignments.length === 0) return null;

  return (
    <Section title="Programme & task journey" icon={ClipboardList} subtitle="Enrolments, missions and assigned tasks">
      {programme.programmes.length > 0 && (
        <SubBlock title={`Business programmes (${programme.programmes.length})`}>
          <div className="space-y-3">
            {programme.programmes.map((p) => (
              <ProgrammeCard key={p.id} programme={p} />
            ))}
          </div>
        </SubBlock>
      )}

      {programme.taskAssignments.length > 0 && (
        <SubBlock title={`Assigned tasks (${programme.taskAssignments.length})`}>
          <Table
            headers={['Task', 'Status', 'Assigned', 'Deadline', 'Reward', 'Completed']}
            rows={programme.taskAssignments.map((task) => [
              <div>
                <p className="font-bold text-gray-800">{task.task?.title || '—'}</p>
                <p className="text-[10px] text-gray-400 font-bold">{task.task?.platform || task.task?.featureKey || '—'}</p>
              </div>,
              <Pill tone={toneForStatus(task.effectiveStatus)}>{humanize(task.effectiveStatus)}</Pill>,
              fmtDate(task.assignedAt),
              `${fmtDate(task.deadlineAt)} (${task.daysRemaining}d)`,
              task.rewardCoupon ? `Coupon ${task.rewardCoupon.code}` : `${task.rewardPoints} pts`,
              fmtDateTime(task.completedAt),
            ])}
          />
        </SubBlock>
      )}
    </Section>
  );
}

function ProgrammeCard({ programme }: { key?: string; programme: AdminBusinessProgrammeRecord }) {
  const tasks = programme.taskStatuses || [];
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const notStarted = tasks.filter((t) => t.status === 'not_started').length;
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{programme.businessName}</p>
          <p className="text-[11px] text-gray-400 font-bold">
            {programme.sector} · Started {fmtDate(programme.startedAt)} · Day {programme.currentDay}
          </p>
        </div>
        <Pill tone={toneForStatus(programme.status)}>{humanize(programme.status)}</Pill>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <Field label="Phase" value={programme.phase?.name || '—'} />
        <Field label="Missions completed" value={String(programme.completedMissions.length)} />
        <Field label="Extended by" value={`${programme.extendedBy} days`} />
        <Field label="Agent" value={programme.agentName || '—'} />
        <Field label="Account manager" value={programme.accountManagerName || '—'} />
        <Field label="Consultant" value={programme.consultantName || '—'} />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Pill tone="green">{completed} completed</Pill>
        <Pill tone="blue">{inProgress} in progress</Pill>
        <Pill tone="amber">{notStarted} not started</Pill>
      </div>
      {tasks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Table
            headers={['Mission ID', 'Status', 'Updated']}
            rows={tasks.map((t) => [t.missionId, <Pill tone={toneForStatus(t.status)}>{humanize(t.status)}</Pill>, fmtDateTime(t.updatedAt)])}
          />
        </div>
      )}
    </div>
  );
}

function AffiliateSection({ profile }: { profile: AdminFullUserProfile }) {
  const { affiliate, account } = profile;
  const role = String(account.role || '').toUpperCase();
  const isAffiliate = ['AGENT', 'CONSULTANT', 'ACCOUNT_MANAGER'].includes(role);
  const isBusinessViewer = ['BUSINESS', 'CUSTOMER'].includes(role);
  if (!isAffiliate && !isBusinessViewer) return null;

  const hasAffiliateActivity =
    affiliate.tasks.length > 0 ||
    affiliate.reputationEvents.length > 0 ||
    affiliate.ratingsReceived.length > 0 ||
    affiliate.reports.length > 0;
  if (isAffiliate && !hasAffiliateActivity) return null;

  const completedTasks = affiliate.tasks.filter((t) => String(t.status).toUpperCase() === 'COMPLETED');
  const openTasks = affiliate.tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(String(t.status).toUpperCase()));
  const totalSpent = affiliate.tasks.reduce((sum, t) => sum + Number(t.spentGbp ?? t.businessChargeAmount ?? 0), 0);

  const assigneeLabel = (task: AdminAffiliateTaskRecord) => {
    if (!task.assignee) return 'Unassigned';
    return (
      [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') ||
      task.assignee.email ||
      'Unassigned'
    );
  };

  const reputationCell = (task: AdminAffiliateTaskRecord) => {
    const delta = Number(task.reputationDelta ?? 0);
    return (
      <span className={cn('font-bold', delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-gray-400')}>
        {delta > 0 ? '+' : ''}
        {delta}
      </span>
    );
  };

  return (
    <Section
      title={isAffiliate ? 'Affiliate activity' : 'Delegated tasks'}
      icon={Star}
      subtitle={
        isAffiliate
          ? 'Reputation, delegated work, earnings and reviews'
          : 'Work this account delegated to affiliates and the amount spent'
      }
    >
      {isAffiliate ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <MiniStat label="Reputation" value={String(affiliate.reputationScore)} tone={affiliate.reputationScore >= 0 ? 'green' : 'red'} />
          <MiniStat label="Tasks" value={String(affiliate.tasks.length)} tone="blue" />
          <MiniStat label="Ratings" value={String(affiliate.ratingsReceived.length)} tone="amber" />
          <MiniStat label="Reports" value={String(affiliate.reports.length)} tone="gray" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <MiniStat label="Tasks delegated" value={String(affiliate.tasks.length)} tone="blue" />
          <MiniStat label="Completed" value={String(completedTasks.length)} tone="green" />
          <MiniStat label="Open" value={String(openTasks.length)} tone="amber" />
          <MiniStat label="Total spent" value={fmtMoney(totalSpent)} tone="gray" />
        </div>
      )}

      {affiliate.tasks.length > 0 ? (
        <SubBlock title={isAffiliate ? 'Affiliate tasks' : 'Delegated affiliate tasks'}>
          {isAffiliate ? (
            <Table
              headers={['Task', 'Business', 'Status', 'Category', 'Assigned', 'Due', 'Reputation', 'Earned']}
              rows={affiliate.tasks.map((t) => [
                <div>
                  <p className="font-bold text-gray-800">{t.title}</p>
                  <p className="text-[10px] text-gray-400">{t.id.slice(0, 10)}</p>
                </div>,
                t.business?.businessName || '—',
                <Pill tone={toneForStatus(t.status)}>{humanize(t.status)}</Pill>,
                humanize(t.category),
                fmtDate(t.assignedAt || t.createdAt),
                fmtDate(t.dueAt),
                reputationCell(t),
                <div>
                  <p className="font-bold text-emerald-700">{fmtMoney(t.earnedGbp ?? t.compensationAmount)}</p>
                  {t.earnedCredits != null && (
                    <p className="text-[10px] text-gray-400">
                      {Number(t.earnedCredits).toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}{' '}
                      MCOM
                    </p>
                  )}
                </div>,
              ])}
            />
          ) : (
            <Table
              headers={['Task', 'Affiliate', 'Status', 'Category', 'Assigned', 'Due', 'Spent']}
              rows={affiliate.tasks.map((t) => [
                <div>
                  <p className="font-bold text-gray-800">{t.title}</p>
                  <p className="text-[10px] text-gray-400">{t.id.slice(0, 10)}</p>
                </div>,
                <div>
                  <p className="font-semibold text-gray-700">{assigneeLabel(t)}</p>
                  {t.assignee?.email && <p className="text-[10px] text-gray-400">{t.assignee.email}</p>}
                </div>,
                <Pill tone={toneForStatus(t.status)}>{humanize(t.status)}</Pill>,
                humanize(t.category),
                fmtDate(t.assignedAt || t.createdAt),
                fmtDate(t.dueAt),
                fmtMoney(t.spentGbp ?? t.businessChargeAmount),
              ])}
            />
          )}
        </SubBlock>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-500">
          {isAffiliate ? 'No affiliate tasks have been assigned yet.' : 'This account has not delegated any affiliate tasks yet.'}
        </p>
      )}

      {isAffiliate && affiliate.reputationEvents.length > 0 && (
        <SubBlock title="Reputation events">
          <Table
            headers={['Reason', 'Delta', 'Source', 'Date']}
            rows={affiliate.reputationEvents.map((e) => [
              e.reason,
              <span className={cn('font-bold', e.delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>{e.delta > 0 ? '+' : ''}{e.delta}</span>,
              humanize(e.sourceType),
              fmtDateTime(e.createdAt),
            ])}
          />
        </SubBlock>
      )}

      {isAffiliate && affiliate.ratingsReceived.length > 0 && (
        <SubBlock title="Ratings received">
          <Table
            headers={['Business', 'Rating', 'Comment', 'Status', 'Date']}
            rows={affiliate.ratingsReceived.map((r) => [
              r.business?.businessName || '—',
              `${r.rating} / 5`,
              r.comment || '—',
              <Pill tone={toneForStatus(r.status)}>{humanize(r.status)}</Pill>,
              fmtDate(r.createdAt),
            ])}
          />
        </SubBlock>
      )}

      {isAffiliate && affiliate.reports.length > 0 && (
        <SubBlock title="Reports">
          <Table
            headers={['Business', 'Reason', 'Status', 'Notes', 'Date']}
            rows={affiliate.reports.map((r) => [
              r.business?.businessName || '—',
              r.reason,
              <Pill tone={toneForStatus(r.status)}>{humanize(r.status)}</Pill>,
              r.adminNotes || r.description || '—',
              fmtDate(r.createdAt),
            ])}
          />
        </SubBlock>
      )}
    </Section>
  );
}

function ReferralHistorySection({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: res, isLoading, isError } = useAdminReferralDetail(userId);
  const detail = res?.data;
  const summary = detail?.summary;
  const referredUsers = detail?.referredUsers ?? [];
  const rule = detail?.config;

  return (
    <Section
      title="Referral history"
      subtitle="People this user referred and commission earned from each"
      icon={Users}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading referral history…
        </div>
      ) : isError ? (
        <p className="text-xs text-red-600">Referral history could not be loaded.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total referrals</p>
              <p className="mt-1 text-xl font-black text-gray-900">{summary?.totalReferrals ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Earning referrals</p>
              <p className="mt-1 text-xl font-black text-gray-900">{summary?.creditedReferrals ?? 0}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">MCOM earned</p>
              <p className="mt-1 text-xl font-black text-emerald-700">
                {Number(summary?.totalEarnedCredits ?? 0).toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">GBP commission</p>
              <p className="mt-1 text-xl font-black text-orange-700">
                {fmtMoney(summary?.totalEarnedGbp ?? 0)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium text-gray-500">
              {rule
                ? `Rule v${rule.version} · ${rule.commissionFrequency === 'RECURRING' ? 'recurring' : 'one-time'} · ${
                    rule.rewardType === 'PERCENTAGE'
                      ? `${rule.percentage ?? 0}%`
                      : fmtMoney(rule.fixedAmountGbp ?? 0)
                  } · ${summary?.creditedCommissionCount ?? 0} commission${
                    (summary?.creditedCommissionCount ?? 0) === 1 ? '' : 's'
                  }`
                : 'No referral rule was active when this user referred others.'}
            </p>
            {referredUsers.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                <Gift className="w-3.5 h-3.5" />
                {expanded ? 'Hide referred people' : 'View referred people'}
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {referredUsers.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-500">
              This user has not referred anyone yet.
            </p>
          ) : expanded ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Referred person</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Joined</th>
                    <th className="px-4 py-3 font-bold">Qualifying purchases</th>
                    <th className="px-4 py-3 text-right font-bold">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {referredUsers.map((referred) => (
                    <tr key={referred.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900">{referred.displayName}</p>
                        <p className="text-[11px] text-gray-400">{referred.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{humanize(referred.role)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(referred.joinedAt)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {referred.creditedCount} credited / {referred.evaluationCount} evaluated
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-black text-emerald-700">
                          {Number(referred.earnedCredits).toLocaleString('en-GB', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}{' '}
                          MCOM
                        </p>
                        <p className="text-[10px] text-gray-400">{fmtMoney(referred.earnedGbp)} commission</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-gray-400">
              Click “View referred people” to see each account and what it earned.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

function SupportSection({ profile }: { profile: AdminFullUserProfile }) {
  const { support } = profile;
  if (support.tickets.length === 0 && support.notifications.length === 0) return null;

  return (
    <Section title="Support & notifications" icon={LifeBuoy} subtitle="Tickets raised and messages delivered">
      {support.tickets.length > 0 && (
        <SubBlock title={`Support tickets (${support.tickets.length})`}>
          <Table
            headers={['Subject', 'Status', 'Priority', 'From', 'Assigned', 'Created']}
            rows={support.tickets.map((t) => [
              <div>
                <p className="font-bold text-gray-800">{t.subject}</p>
                <p className="text-[10px] text-gray-400 font-bold line-clamp-1">{t.message}</p>
              </div>,
              <Pill tone={toneForStatus(t.status)}>{humanize(t.status)}</Pill>,
              humanize(t.priority),
              t.fromName,
              t.assignedTo || '—',
              fmtDateTime(t.createdAt),
            ])}
          />
        </SubBlock>
      )}

      {support.notifications.length > 0 && (
        <SubBlock title={`Notifications (${support.notifications.length})`}>
          <div className="space-y-2">
            {support.notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                <div className={cn('mt-0.5 w-2 h-2 rounded-full shrink-0', n.read ? 'bg-gray-300' : 'bg-brand-blue')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{n.title}</p>
                    <Pill tone="gray">{humanize(n.type)}</Pill>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                </div>
                <span className="text-[10px] text-gray-400 font-bold shrink-0">{fmtDateTime(n.createdAt)}</span>
              </div>
            ))}
          </div>
        </SubBlock>
      )}
    </Section>
  );
}

// ─── UI primitives ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-gray-50 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function SubBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  link,
  multiline,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  link?: boolean;
  multiline?: boolean;
}) {
  const display = value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      {link && typeof display === 'string' && display !== '—' ? (
        <a
          href={display.startsWith('http') ? display : `https://${display}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-brand-blue hover:underline break-all inline-flex items-center gap-1"
        >
          {display} <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      ) : (
        <p className={cn('text-sm font-bold text-gray-800 break-words', mono && 'font-mono text-xs', multiline && 'whitespace-pre-wrap font-medium')}>
          {display}
        </p>
      )}
    </div>
  );
}

function QuickFact({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={cn('text-xs font-bold text-gray-800 truncate', mono && 'font-mono')} title={value}>{value}</p>
      </div>
    </div>
  );
}

function ToggleFact({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest', enabled ? 'text-emerald-600' : 'text-gray-400')}>
        <span className={cn('w-2 h-2 rounded-full', enabled ? 'bg-emerald-500' : 'bg-gray-300')} />
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  );
}

function Pill({ tone = 'gray', children }: { key?: string; tone?: string; children: ReactNode }) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border', tones[tone] || tones.gray)}>
      {children}
    </span>
  );
}

function MiniStat({ label, value, tone = 'gray' }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-gray-50 text-gray-700',
  };
  return (
    <div className={cn('rounded-xl px-3 py-3', tones[tone] || tones.gray)}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-sm font-black mt-1 break-words">{value}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <span className="text-xs font-black text-gray-900 text-right">{value}</span>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="#2563eb"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 97.4} 97.4`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-gray-900">{clamped}%</span>
      </div>
      <p className="text-xs text-gray-500 font-medium">
        Overall task journey completion across all assignments and programme missions.
      </p>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <Empty text="No records" />;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left min-w-[560px]">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2.5 text-xs text-gray-700 font-medium align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs font-bold text-gray-400">{text}</div>;
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5 text-xs font-bold text-gray-600 hover:border-brand-blue/30 hover:text-brand-blue hover:bg-blue-50/40 transition-all"
    >
      {label}
      <ExternalLink className="w-3.5 h-3.5" />
    </button>
  );
}
