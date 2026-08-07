import { useState, ReactNode } from 'react';
import {
  Plus, Search, Filter, MoreVertical, MapPin, Users, Building2, Activity,
  BarChart3, ShoppingBag, Clock, CheckCircle2, AlertCircle, X, Save, Eye,
  Edit3, Download, UserPlus, GitMerge, Archive, Globe, Store, Award,
  Target, Music, Gift, Shield, Home, Image, Palette, MessageCircle,
  Tag, Settings, ToggleLeft, ChevronLeft, ChevronRight, Sparkles, TrendingUp, Percent,
  Zap, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminLocalMalls } from '../../services/admin/hooks';
import { Loader2 } from 'lucide-react';

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface LocalMallData {
  id: string;
  name: string;
  postcodes: string[];
  borough: string;
  primaryHighStreet: string;
  additionalHighStreets: string[];
  businesses: number;
  customers: number;
  campaigns: number;
  events: number;
  status: 'Active' | 'Draft' | 'Disabled' | 'Archived';
  createdDate: string;
  description: string;
  longDescription: string;
  slug: string;
  logo: string;
  coverBanner: string;
  mobileBanner: string;
  primaryColour: string;
  secondaryColour: string;
  welcomeMessage: string;
  tagline: string;
  radiusCoverage: string;
  allowBusinessesOutsidePostcode: boolean;
  allowVirtualBusinesses: boolean;
  allowHomeBusinesses: boolean;
  requireVerification: boolean;
  requireAuditCompletion: boolean;
  requireMembershipApproval: boolean;
  leadConsultant: string;
  leadConsultantId: string;
  assignedAccountManagers: string[];
  assignedAccountManagerIds: string[];
  assignedAgents: string[];
  assignedAgentIds: string[];
  supportTeam: string[];
  enableAudit: boolean;
  enableRewards: boolean;
  enableLoyalty: boolean;
  enableQLinks: boolean;
  enableSpin: boolean;
  enableEvents: boolean;
  enableCampaigns: boolean;
  enablePushNotifications: boolean;
  enableMarketplace: boolean;
  allowGuestBrowsing: boolean;
  requireRegistrationForRewards: boolean;
  requireRegistrationForSpin: boolean;
  enableAutoLocationDetection: boolean;
  allowManualLocalMallSwitching: boolean;
  autoApproveBusinesses: boolean;
  manualApprovalRequired: boolean;
  requireDocumentVerification: boolean;
  requireGoogleBusinessMatch: boolean;
  requireAuditCompletionForBusiness: boolean;
  defaultMembershipPackage: string;
  featuredBusinesses: string[];
  featuredCategories: string[];
  featuredCampaigns: string[];
  featuredEvents: string[];
  featuredRewards: string[];
  featuredSpinCampaigns: string[];
  featuredHighStreets: string[];
  categoryPriorities: { name: string; action: 'show-first' | 'hide' | 'highlight' }[];
  allowBoroughCampaigns: boolean;
  allowHighStreetCampaigns: boolean;
  allowJointCampaigns: boolean;
  allowSeasonalCampaigns: boolean;
  campaignApprovalRequired: boolean;
  enableEventsModule: boolean;
  requireEventApproval: boolean;
  maxEventsPerBusiness: number;
  allowCommunityEvents: boolean;
  allowBusinessEvents: boolean;
  enableRewardsModule: boolean;
  enableLoyaltyModule: boolean;
  enableBonusCampaigns: boolean;
  enableDoublePointDays: boolean;
  enableSeasonalRewards: boolean;
  enableSpinModule: boolean;
  allowBusinessSponsoredSpins: boolean;
  allowBoroughSpins: boolean;
  allowSeasonalSpins: boolean;
  maxSpinsPerCustomer: number;
  enableRotator: boolean;
  enableLocalFeedDistribution: boolean;
  enableBoroughFeedDistribution: boolean;
  enableFeaturedPlacement: boolean;
}

const initialLocalMalls: LocalMallData[] = [
  {
    id: '1', name: 'Peckham LocalMall', postcodes: ['SE15', 'SE5', 'SE22'],
    borough: 'Southwark', primaryHighStreet: 'Rye Lane', additionalHighStreets: ['Peckham Road', 'Bellenden Road'],
    businesses: 245, customers: 12800, campaigns: 8, events: 12, status: 'Active',
    createdDate: '2024-09-15', description: 'Supporting local businesses in Peckham',
    longDescription: 'Peckham LocalMall is the digital town centre for the Peckham area, connecting residents with local businesses, events, and rewards.',
    slug: 'peckham-localmall', logo: '', coverBanner: '', mobileBanner: '',
    primaryColour: '#2563EB', secondaryColour: '#F59E0B',
    welcomeMessage: 'Welcome to Peckham LocalMall', tagline: 'Supporting Local Businesses Together',
    radiusCoverage: '2.5 miles', allowBusinessesOutsidePostcode: false, allowVirtualBusinesses: true,
    allowHomeBusinesses: true, requireVerification: true, requireAuditCompletion: false,
    requireMembershipApproval: true, leadConsultant: 'John Doe', leadConsultantId: 'con-1',
    assignedAccountManagers: ['Sarah Johnson', 'James Wilson'], assignedAccountManagerIds: ['am-1', 'am-2'],
    assignedAgents: ['Michael Brown', 'Paul Taylor'], assignedAgentIds: ['agent-1', 'agent-2'],
    supportTeam: ['Emma', 'David'],
    enableAudit: true, enableRewards: true, enableLoyalty: true, enableQLinks: true,
    enableSpin: true, enableEvents: true, enableCampaigns: true, enablePushNotifications: true,
    enableMarketplace: false, allowGuestBrowsing: true, requireRegistrationForRewards: true,
    requireRegistrationForSpin: true, enableAutoLocationDetection: true,
    allowManualLocalMallSwitching: true, autoApproveBusinesses: false,
    manualApprovalRequired: true, requireDocumentVerification: true,
    requireGoogleBusinessMatch: false, requireAuditCompletionForBusiness: true,
    defaultMembershipPackage: 'Standard',
    featuredBusinesses: ['The Coffee Shop', 'Peckham Pharmacy', 'Rye Lane Butcher'],
    featuredCategories: ['Food & Drink', 'Retail', 'Health'],
    featuredCampaigns: ['Summer Sale 2025', 'Local Heroes'],
    featuredEvents: ['Peckham Food Festival', 'Summer Market'],
    featuredRewards: ['Welcome Bonus', 'Referral Reward'],
    featuredSpinCampaigns: ['Spin & Win Summer'],
    featuredHighStreets: ['Rye Lane', 'Bellenden Road'],
    categoryPriorities: [
      { name: 'Food & Drink', action: 'show-first' },
      { name: 'Retail', action: 'show-first' },
      { name: 'Beauty', action: 'highlight' },
      { name: 'Health', action: 'highlight' },
      { name: 'Professional Services', action: 'show-first' },
      { name: 'Trades', action: 'hide' },
      { name: 'Entertainment', action: 'highlight' },
    ],
    allowBoroughCampaigns: true, allowHighStreetCampaigns: true, allowJointCampaigns: false,
    allowSeasonalCampaigns: true, campaignApprovalRequired: true,
    enableEventsModule: true, requireEventApproval: true, maxEventsPerBusiness: 5,
    allowCommunityEvents: true, allowBusinessEvents: true,
    enableRewardsModule: true, enableLoyaltyModule: true, enableBonusCampaigns: false,
    enableDoublePointDays: true, enableSeasonalRewards: true,
    enableSpinModule: true, allowBusinessSponsoredSpins: true, allowBoroughSpins: false,
    allowSeasonalSpins: true, maxSpinsPerCustomer: 3,
    enableRotator: true, enableLocalFeedDistribution: true, enableBoroughFeedDistribution: false,
    enableFeaturedPlacement: true,
  },
  {
    id: '2', name: 'Brixton LocalMall', postcodes: ['SW2', 'SW9', 'SE24'],
    borough: 'Lambeth', primaryHighStreet: 'Brixton Road', additionalHighStreets: ['Electric Avenue', 'Atlantic Road'],
    businesses: 312, customers: 18500, campaigns: 12, events: 20, status: 'Active',
    createdDate: '2024-06-01', description: 'Brixton vibrant local economy hub',
    longDescription: 'Brixton LocalMall brings together the diverse businesses of Brixton in one digital marketplace.',
    slug: 'brixton-localmall', logo: '', coverBanner: '', mobileBanner: '',
    primaryColour: '#7C3AED', secondaryColour: '#EC4899',
    welcomeMessage: 'Welcome to Brixton LocalMall', tagline: 'Celebrating Brixton Together',
    radiusCoverage: '3 miles', allowBusinessesOutsidePostcode: true, allowVirtualBusinesses: true,
    allowHomeBusinesses: true, requireVerification: true, requireAuditCompletion: true,
    requireMembershipApproval: true, leadConsultant: 'Jane Smith', leadConsultantId: 'con-4',
    assignedAccountManagers: ['Tom Davis', 'Lisa Brown'], assignedAccountManagerIds: ['am-3', 'am-4'],
    assignedAgents: ['Chris Evans', 'Diana Prince'], assignedAgentIds: ['agent-3', 'agent-4'],
    supportTeam: ['Oliver', 'Sophie'],
    enableAudit: true, enableRewards: true, enableLoyalty: true, enableQLinks: true,
    enableSpin: true, enableEvents: true, enableCampaigns: true, enablePushNotifications: true,
    enableMarketplace: true, allowGuestBrowsing: true, requireRegistrationForRewards: true,
    requireRegistrationForSpin: false, enableAutoLocationDetection: true,
    allowManualLocalMallSwitching: true, autoApproveBusinesses: false,
    manualApprovalRequired: true, requireDocumentVerification: true,
    requireGoogleBusinessMatch: true, requireAuditCompletionForBusiness: true,
    defaultMembershipPackage: 'Premium',
    featuredBusinesses: ['Brixton Market', 'Electric Cafe', 'Atlantic Fish Bar'],
    featuredCategories: ['Food & Drink', 'Retail', 'Entertainment'],
    featuredCampaigns: ['Brixton Summer', 'Market Days'],
    featuredEvents: ['Brixton Street Festival', 'Electric Avenue Market'],
    featuredRewards: ['Brixton Bonus', 'Loyalty Points'],
    featuredSpinCampaigns: ['Brixton Spin'],
    featuredHighStreets: ['Brixton Road', 'Electric Avenue'],
    categoryPriorities: [
      { name: 'Food & Drink', action: 'show-first' },
      { name: 'Retail', action: 'show-first' },
      { name: 'Entertainment', action: 'highlight' },
      { name: 'Beauty', action: 'highlight' },
      { name: 'Health', action: 'show-first' },
      { name: 'Trades', action: 'hide' },
      { name: 'Professional Services', action: 'hide' },
    ],
    allowBoroughCampaigns: true, allowHighStreetCampaigns: true, allowJointCampaigns: true,
    allowSeasonalCampaigns: true, campaignApprovalRequired: true,
    enableEventsModule: true, requireEventApproval: false, maxEventsPerBusiness: 10,
    allowCommunityEvents: true, allowBusinessEvents: true,
    enableRewardsModule: true, enableLoyaltyModule: true, enableBonusCampaigns: true,
    enableDoublePointDays: true, enableSeasonalRewards: true,
    enableSpinModule: true, allowBusinessSponsoredSpins: true, allowBoroughSpins: true,
    allowSeasonalSpins: true, maxSpinsPerCustomer: 5,
    enableRotator: true, enableLocalFeedDistribution: true, enableBoroughFeedDistribution: true,
    enableFeaturedPlacement: true,
  },
  {
    id: '3', name: 'Greenwich LocalMall', postcodes: ['SE10', 'SE3', 'SE18'],
    borough: 'Greenwich', primaryHighStreet: 'Greenwich High Road', additionalHighStreets: ['Royal Hill', 'Nelson Road'],
    businesses: 178, customers: 9200, campaigns: 5, events: 8, status: 'Draft',
    createdDate: '2025-01-20', description: 'Launching Greenwich digital town centre',
    longDescription: 'Greenwich LocalMall is currently in setup phase, preparing to connect Greenwich businesses with the local community.',
    slug: 'greenwich-localmall', logo: '', coverBanner: '', mobileBanner: '',
    primaryColour: '#059669', secondaryColour: '#F97316',
    welcomeMessage: 'Coming Soon: Greenwich LocalMall', tagline: 'Your Greenwich, Connected',
    radiusCoverage: '2 miles', allowBusinessesOutsidePostcode: false, allowVirtualBusinesses: false,
    allowHomeBusinesses: true, requireVerification: true, requireAuditCompletion: false,
    requireMembershipApproval: true, leadConsultant: 'Mike Johnson', leadConsultantId: 'con-5',
    assignedAccountManagers: ['Lucy Adams'], assignedAccountManagerIds: ['am-5'],
    assignedAgents: ['Tom Hardy'], assignedAgentIds: ['agent-5'], supportTeam: ['Anna'],
    enableAudit: false, enableRewards: false, enableLoyalty: false, enableQLinks: false,
    enableSpin: false, enableEvents: false, enableCampaigns: false, enablePushNotifications: false,
    enableMarketplace: false, allowGuestBrowsing: true, requireRegistrationForRewards: false,
    requireRegistrationForSpin: false, enableAutoLocationDetection: false,
    allowManualLocalMallSwitching: false, autoApproveBusinesses: false,
    manualApprovalRequired: true, requireDocumentVerification: false,
    requireGoogleBusinessMatch: false, requireAuditCompletionForBusiness: false,
    defaultMembershipPackage: 'Standard',
    featuredBusinesses: [], featuredCategories: [], featuredCampaigns: [],
    featuredEvents: [], featuredRewards: [], featuredSpinCampaigns: [],
    featuredHighStreets: [],
    categoryPriorities: [
      { name: 'Food & Drink', action: 'show-first' },
      { name: 'Retail', action: 'highlight' },
      { name: 'Beauty', action: 'show-first' },
      { name: 'Health', action: 'highlight' },
      { name: 'Entertainment', action: 'hide' },
      { name: 'Trades', action: 'hide' },
      { name: 'Professional Services', action: 'hide' },
    ],
    allowBoroughCampaigns: false, allowHighStreetCampaigns: false, allowJointCampaigns: false,
    allowSeasonalCampaigns: false, campaignApprovalRequired: true,
    enableEventsModule: false, requireEventApproval: true, maxEventsPerBusiness: 3,
    allowCommunityEvents: false, allowBusinessEvents: false,
    enableRewardsModule: false, enableLoyaltyModule: false, enableBonusCampaigns: false,
    enableDoublePointDays: false, enableSeasonalRewards: false,
    enableSpinModule: false, allowBusinessSponsoredSpins: false, allowBoroughSpins: false,
    allowSeasonalSpins: false, maxSpinsPerCustomer: 0,
    enableRotator: false, enableLocalFeedDistribution: false, enableBoroughFeedDistribution: false,
    enableFeaturedPlacement: false,
  },
  {
    id: '4', name: 'Stratford LocalMall', postcodes: ['E15', 'E20', 'E16'],
    borough: 'Newham', primaryHighStreet: 'The Broadway', additionalHighStreets: ['High Street', 'Romford Road'],
    businesses: 456, customers: 22300, campaigns: 15, events: 25, status: 'Active',
    createdDate: '2024-03-10', description: 'Stratford digital high street hub',
    longDescription: 'Stratford LocalMall serves one of London fastest growing areas, connecting the Olympic Park community with local commerce.',
    slug: 'stratford-localmall', logo: '', coverBanner: '', mobileBanner: '',
    primaryColour: '#DC2626', secondaryColour: '#2563EB',
    welcomeMessage: 'Welcome to Stratford LocalMall', tagline: 'Stratford Connected, Community Strong',
    radiusCoverage: '3.5 miles', allowBusinessesOutsidePostcode: true, allowVirtualBusinesses: true,
    allowHomeBusinesses: true, requireVerification: true, requireAuditCompletion: true,
    requireMembershipApproval: true, leadConsultant: 'Sarah Wilson', leadConsultantId: 'con-6',
    assignedAccountManagers: ['Mark Green', 'Emma White', 'Jake Black'], assignedAccountManagerIds: ['am-6', 'am-7', 'am-8'],
    assignedAgents: ['Nina Patel', 'Oscar Lee', 'Liam Scott'], assignedAgentIds: ['agent-6', 'agent-7', 'agent-8'],
    supportTeam: ['Hannah', 'Ben'],
    enableAudit: true, enableRewards: true, enableLoyalty: true, enableQLinks: true,
    enableSpin: true, enableEvents: true, enableCampaigns: true, enablePushNotifications: true,
    enableMarketplace: true, allowGuestBrowsing: true, requireRegistrationForRewards: true,
    requireRegistrationForSpin: true, enableAutoLocationDetection: true,
    allowManualLocalMallSwitching: true, autoApproveBusinesses: true,
    manualApprovalRequired: false, requireDocumentVerification: true,
    requireGoogleBusinessMatch: true, requireAuditCompletionForBusiness: true,
    defaultMembershipPackage: 'Premium',
    featuredBusinesses: ['Westfield Shops', 'Stratford Centre', 'Theatre Square'],
    featuredCategories: ['Food & Drink', 'Retail', 'Entertainment', 'Health'],
    featuredCampaigns: ['Stratford Summer', 'Olympic Park Events'],
    featuredEvents: ['Stratford Food Market', 'Summer in the Park'],
    featuredRewards: ['Stratford Rewards', 'Double Points Week'],
    featuredSpinCampaigns: ['Olympic Spin'],
    featuredHighStreets: ['The Broadway', 'High Street'],
    categoryPriorities: [
      { name: 'Food & Drink', action: 'show-first' },
      { name: 'Retail', action: 'show-first' },
      { name: 'Entertainment', action: 'highlight' },
      { name: 'Beauty', action: 'highlight' },
      { name: 'Health', action: 'show-first' },
      { name: 'Professional Services', action: 'hide' },
      { name: 'Trades', action: 'hide' },
    ],
    allowBoroughCampaigns: true, allowHighStreetCampaigns: true, allowJointCampaigns: true,
    allowSeasonalCampaigns: true, campaignApprovalRequired: false,
    enableEventsModule: true, requireEventApproval: false, maxEventsPerBusiness: 8,
    allowCommunityEvents: true, allowBusinessEvents: true,
    enableRewardsModule: true, enableLoyaltyModule: true, enableBonusCampaigns: true,
    enableDoublePointDays: true, enableSeasonalRewards: true,
    enableSpinModule: true, allowBusinessSponsoredSpins: true, allowBoroughSpins: true,
    allowSeasonalSpins: true, maxSpinsPerCustomer: 5,
    enableRotator: true, enableLocalFeedDistribution: true, enableBoroughFeedDistribution: true,
    enableFeaturedPlacement: true,
  },
];

// ─── 247GBS Affiliates Mock Users ────────────────────────────────────────────

interface AffiliateUser {
  id: string;
  name: string;
  role: 'consultant' | 'account_manager' | 'agent';
  email: string;
}

const MOCK_AFFILIATE_USERS: AffiliateUser[] = [
  { id: 'con-1', name: 'John Doe', role: 'consultant', email: 'john@247gbs.com' },
  { id: 'con-2', name: 'Mary Smith', role: 'consultant', email: 'mary@247gbs.com' },
  { id: 'con-3', name: 'David Jones', role: 'consultant', email: 'david@247gbs.com' },
  { id: 'con-4', name: 'Jane Smith', role: 'consultant', email: 'jane@247gbs.com' },
  { id: 'con-5', name: 'Mike Johnson', role: 'consultant', email: 'mike@247gbs.com' },
  { id: 'con-6', name: 'Sarah Wilson', role: 'consultant', email: 'sarah@247gbs.com' },
  { id: 'am-1', name: 'Sarah Johnson', role: 'account_manager', email: 'sarah.j@247gbs.com' },
  { id: 'am-2', name: 'James Wilson', role: 'account_manager', email: 'james@247gbs.com' },
  { id: 'am-3', name: 'Tom Davis', role: 'account_manager', email: 'tom@247gbs.com' },
  { id: 'am-4', name: 'Lisa Brown', role: 'account_manager', email: 'lisa@247gbs.com' },
  { id: 'am-5', name: 'Lucy Adams', role: 'account_manager', email: 'lucy@247gbs.com' },
  { id: 'am-6', name: 'Mark Green', role: 'account_manager', email: 'mark@247gbs.com' },
  { id: 'am-7', name: 'Emma White', role: 'account_manager', email: 'emma@247gbs.com' },
  { id: 'am-8', name: 'Jake Black', role: 'account_manager', email: 'jake@247gbs.com' },
  { id: 'agent-1', name: 'Michael Brown', role: 'agent', email: 'michael@247gbs.com' },
  { id: 'agent-2', name: 'Paul Taylor', role: 'agent', email: 'paul@247gbs.com' },
  { id: 'agent-3', name: 'Chris Evans', role: 'agent', email: 'chris@247gbs.com' },
  { id: 'agent-4', name: 'Diana Prince', role: 'agent', email: 'diana@247gbs.com' },
  { id: 'agent-5', name: 'Tom Hardy', role: 'agent', email: 'tom.h@247gbs.com' },
  { id: 'agent-6', name: 'Nina Patel', role: 'agent', email: 'nina@247gbs.com' },
  { id: 'agent-7', name: 'Oscar Lee', role: 'agent', email: 'oscar@247gbs.com' },
  { id: 'agent-8', name: 'Liam Scott', role: 'agent', email: 'liam@247gbs.com' },
];

function getAffiliateName(id: string): string {
  return MOCK_AFFILIATE_USERS.find(u => u.id === id)?.name || id;
}

function getAffiliateNames(ids: string[]): string[] {
  return ids.map(id => getAffiliateName(id));
}

function getAffiliatesByRole(role: AffiliateUser['role']): AffiliateUser[] {
  return MOCK_AFFILIATE_USERS.filter(u => u.role === role);
}

// ─── Multi-Select Dropdown Component ──────────────────────────────────────

function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
}: {
  label: string;
  options: AffiliateUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const available = options.filter(o => !selectedIds.includes(o.id));

  return (
    <div className="space-y-1.5 relative">
      <label className="block text-xs font-bold text-gray-600">{label}</label>
      <div className="relative z-30 flex flex-wrap gap-1.5 min-h-[2.75rem] p-2 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-brand-blue/20 focus-within:border-brand-blue cursor-pointer" onClick={() => setOpen(!open)}>
        {selectedIds.length === 0 ? (
          <span className="text-xs text-gray-400 px-1 py-1">{placeholder}</span>
        ) : (
          selectedIds.map(id => {
            const user = options.find(o => o.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-blue/10 text-brand-blue rounded-lg text-[10px] font-bold">
                {user?.name || id}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onChange(selectedIds.filter(x => x !== id)); }}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
        <div className="flex-1" />
        <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform self-center", open && "rotate-180")} />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
            {available.length === 0 ? (
              <p className="p-3 text-xs text-gray-400 text-center">All selected</p>
            ) : (
              available.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { onChange([...selectedIds, user.id]); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">{user.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{user.name}</p>
                    <p className="text-[9px] text-gray-400">{user.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StatCard({ title, value, trend, icon: Icon, color = 'blue' }: { title: string; value: string; trend: string; icon: any; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    purple: 'text-purple-600 bg-purple-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
    cyan: 'text-cyan-600 bg-cyan-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    orange: 'text-orange-600 bg-orange-50',
  };
  const c = colorMap[color] || colorMap.blue;
  const isPositive = trend.startsWith('+');
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl", c)}><Icon className="w-5 h-5" /></div>
        <span className={cn("text-xs font-bold px-2 py-1 rounded-full", isPositive ? "text-emerald-600 bg-emerald-50" : trend === '0' ? "text-gray-400 bg-gray-100" : "text-red-600 bg-red-50")}>{trend}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-xs font-semibold text-gray-500">{title}</div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Draft: 'bg-gray-50 text-gray-600 border-gray-200',
    Disabled: 'bg-red-50 text-red-700 border-red-200',
    Archived: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border", map[status] || map.Draft)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", status === 'Active' ? 'bg-emerald-500' : status === 'Draft' ? 'bg-gray-400' : status === 'Disabled' ? 'bg-red-500' : 'bg-amber-500')} />
      {status}
    </span>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={cn("relative w-9 h-5 rounded-full transition-colors", enabled ? 'bg-brand-blue' : 'bg-gray-300')}>
      <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", enabled && 'translate-x-4')} />
    </button>
  );
}

function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-visible">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function LocalMallsPanel() {
  const [view, setView] = useState<'list' | 'create' | 'detail' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localMalls, setLocalMalls] = useState<LocalMallData[]>(initialLocalMalls);
  const [searchQuery, setSearchQuery] = useState('');
  const [boroughFilter, setBoroughFilter] = useState('All');
  const [postcodeFilter, setPostcodeFilter] = useState('');
  const [highStreetFilter, setHighStreetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [consultantFilter, setConsultantFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [activeActionsMenu, setActiveActionsMenu] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'businesses' | 'customers' | 'campaigns' | 'events' | 'rewards' | 'spin' | 'team' | 'analytics'>('overview');
  const [formData, setFormData] = useState<Partial<LocalMallData>>({});
  const [selectedLocalMalls, setSelectedLocalMalls] = useState<string[]>([]);

  const selectedMall = localMalls.find(m => m.id === selectedId) || null;

  // ─── Filter Logic ──────────────────────────────────────────────────────

  const allBoroughs = [...new Set(localMalls.map(m => m.borough))];
  const allPostcodes = [...new Set(localMalls.flatMap(m => m.postcodes))];
  const allHighStreets = [...new Set(localMalls.map(m => m.primaryHighStreet).concat(...localMalls.flatMap(m => m.additionalHighStreets)))];
  const allConsultants = [...new Set(localMalls.map(m => m.leadConsultant).filter(Boolean))];
  const allManagers = [...new Set(localMalls.flatMap(m => m.assignedAccountManagers))];

  const filteredMalls = localMalls.filter(m => {
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase()) && !m.borough.toLowerCase().includes(searchQuery.toLowerCase()) && !m.postcodes.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    if (boroughFilter !== 'All' && m.borough !== boroughFilter) return false;
    if (postcodeFilter && !m.postcodes.some(p => p.toLowerCase().includes(postcodeFilter.toLowerCase()))) return false;
    if (highStreetFilter && m.primaryHighStreet !== highStreetFilter && !m.additionalHighStreets.includes(highStreetFilter)) return false;
    if (statusFilter !== 'All' && m.status !== statusFilter) return false;
    if (consultantFilter !== 'All' && m.leadConsultant !== consultantFilter) return false;
    if (managerFilter !== 'All' && !m.assignedAccountManagers.includes(managerFilter)) return false;
    return true;
  });

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleCreate = () => {
    setFormData({
      name: '', description: '', longDescription: '', slug: '', status: 'Draft',
      postcodes: [], borough: '', primaryHighStreet: '', additionalHighStreets: [],
      businesses: 0, customers: 0, campaigns: 0, events: 0,
      primaryColour: '#2563EB', secondaryColour: '#F59E0B',
      welcomeMessage: '', tagline: '', radiusCoverage: '',
      allowBusinessesOutsidePostcode: false, allowVirtualBusinesses: false,
      allowHomeBusinesses: false, requireVerification: true, requireAuditCompletion: false,
      requireMembershipApproval: true, leadConsultant: '', leadConsultantId: '',
      assignedAccountManagers: [], assignedAccountManagerIds: [],
      assignedAgents: [], assignedAgentIds: [], supportTeam: [],
      enableAudit: false, enableRewards: false, enableLoyalty: false, enableQLinks: false,
      enableSpin: false, enableEvents: false, enableCampaigns: false, enablePushNotifications: false,
      enableMarketplace: false,
      allowGuestBrowsing: true, requireRegistrationForRewards: true, requireRegistrationForSpin: true,
      enableAutoLocationDetection: true, allowManualLocalMallSwitching: true,
      autoApproveBusinesses: false, manualApprovalRequired: true, requireDocumentVerification: false,
      requireGoogleBusinessMatch: false, requireAuditCompletionForBusiness: false,
      defaultMembershipPackage: 'Standard',
      featuredBusinesses: [], featuredCategories: [], featuredCampaigns: [], featuredEvents: [],
      featuredRewards: [], featuredSpinCampaigns: [], featuredHighStreets: [],
      categoryPriorities: [
        { name: 'Food & Drink', action: 'show-first' },
        { name: 'Retail', action: 'show-first' },
        { name: 'Beauty', action: 'highlight' },
        { name: 'Health', action: 'highlight' },
        { name: 'Professional Services', action: 'show-first' },
        { name: 'Trades', action: 'hide' },
        { name: 'Entertainment', action: 'highlight' },
      ],
      allowBoroughCampaigns: false, allowHighStreetCampaigns: false, allowJointCampaigns: false,
      allowSeasonalCampaigns: false, campaignApprovalRequired: true,
      enableEventsModule: false, requireEventApproval: true, maxEventsPerBusiness: 5,
      allowCommunityEvents: true, allowBusinessEvents: true,
      enableRewardsModule: false, enableLoyaltyModule: false, enableBonusCampaigns: false,
      enableDoublePointDays: false, enableSeasonalRewards: false,
      enableSpinModule: false, allowBusinessSponsoredSpins: false, allowBoroughSpins: false,
      allowSeasonalSpins: false, maxSpinsPerCustomer: 3,
      enableRotator: false, enableLocalFeedDistribution: false, enableBoroughFeedDistribution: false,
      enableFeaturedPlacement: false,
    });
    setView('create');
  };

  const handleEdit = (mall: LocalMallData) => {
    setFormData({ ...mall });
    setView('edit');
  };

  const handleSave = () => {
    if (view === 'create') {
      const newMall: LocalMallData = {
        ...formData as LocalMallData,
        id: String(Date.now()),
        createdDate: new Date().toISOString().split('T')[0],
      };
      setLocalMalls(prev => [...prev, newMall]);
    } else if (view === 'edit' && selectedId) {
      setLocalMalls(prev => prev.map(m => m.id === selectedId ? { ...m, ...formData as LocalMallData } : m));
    }
    setView('list');
    setSelectedId(null);
  };

  const handleArchive = (id: string) => {
    setLocalMalls(prev => prev.map(m => m.id === id ? { ...m, status: 'Archived' as const } : m));
    setActiveActionsMenu(null);
  };

  const handleSelectMall = (id: string) => {
    setSelectedId(id);
    setDetailTab('overview');
    setView('detail');
  };

  // ─── RENDER: LIST VIEW ─────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">LocalMalls</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{filteredMalls.length} local digital economies</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-brand-dark transition-colors text-xs font-bold shadow-sm">
              <Plus className="w-4 h-4" /> Create LocalMall
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold shadow-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold shadow-sm">
              <UserPlus className="w-4 h-4" /> Assign Manager
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold shadow-sm">
              <GitMerge className="w-4 h-4" /> Merge
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold shadow-sm">
              <Archive className="w-4 h-4" /> Archive
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total LocalMalls" value={String(localMalls.length)} trend={`+${localMalls.filter(m => m.status === 'Active').length}`} icon={ShoppingBag} color="blue" />
          <StatCard title="Total Businesses" value={String(localMalls.reduce((a, m) => a + m.businesses, 0))} trend="+12.4%" icon={Store} color="green" />
          <StatCard title="Total Customers" value={String(localMalls.reduce((a, m) => a + m.customers, 0))} trend="+8.1%" icon={Users} color="purple" />
          <StatCard title="Active Campaigns" value={String(localMalls.reduce((a, m) => a + m.campaigns, 0))} trend="+15.3%" icon={Target} color="amber" />
          <StatCard title="Upcoming Events" value={String(localMalls.reduce((a, m) => a + m.events, 0))} trend="+22%" icon={Music} color="rose" />
          <StatCard title="Active Status" value={String(localMalls.filter(m => m.status === 'Active').length)} trend={String(localMalls.filter(m => m.status === 'Draft').length) + ' draft'} icon={CheckCircle2} color="cyan" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filters</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
            <select value={boroughFilter} onChange={e => setBoroughFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
              <option value="All">All Boroughs</option>
              {allBoroughs.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Disabled">Disabled</option>
              <option value="Archived">Archived</option>
            </select>
            <select value={consultantFilter} onChange={e => setConsultantFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
              <option value="All">All Consultants</option>
              {allConsultants.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={managerFilter} onChange={e => setManagerFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
              <option value="All">All Managers</option>
              {allManagers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="text" placeholder="Postcode..." value={postcodeFilter} onChange={e => setPostcodeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <input type="checkbox" onChange={e => setSelectedLocalMalls(e.target.checked ? filteredMalls.map(m => m.id) : [])} checked={selectedLocalMalls.length === filteredMalls.length && filteredMalls.length > 0} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">LocalMall Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Postcode Coverage</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Borough</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Primary High Street</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Businesses</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customers</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Campaigns</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Events</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Created Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMalls.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center"><div className="text-gray-400 text-sm font-medium">No LocalMalls found matching your filters.</div></td></tr>
                ) : (
                  filteredMalls.map((mall) => (
                    <tr key={mall.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedLocalMalls.includes(mall.id)} onChange={() => setSelectedLocalMalls(prev => prev.includes(mall.id) ? prev.filter(id => id !== mall.id) : [...prev, mall.id])} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleSelectMall(mall.id)} className="text-xs font-bold text-brand-blue hover:text-brand-dark transition-colors">{mall.name}</button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {mall.postcodes.map(p => <span key={p} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{p}</span>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700">{mall.borough}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700">{mall.primaryHighStreet}</td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900 text-center">{mall.businesses}</td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900 text-center">{(mall.customers / 1000).toFixed(1)}k</td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900 text-center">{mall.campaigns}</td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900 text-center">{mall.events}</td>
                      <td className="px-4 py-3"><Badge status={mall.status} /></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{mall.createdDate}</td>
                      <td className="px-4 py-3 relative">
                        <button onClick={() => setActiveActionsMenu(activeActionsMenu === mall.id ? null : mall.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {activeActionsMenu === mall.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActiveActionsMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-200 p-1 z-20">
                              <button onClick={() => { handleSelectMall(mall.id); setActiveActionsMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /> View</button>
                              <button onClick={() => { handleEdit(mall); setActiveActionsMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"><BarChart3 className="w-3.5 h-3.5" /> Analytics</button>
                              <button onClick={() => handleArchive(mall.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Archive className="w-3.5 h-3.5" /> Archive</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <span className="text-[10px] font-bold text-gray-500">{filteredMalls.length} of {localMalls.length} LocalMalls</span>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-50 transition-colors">Previous</button>
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-50 transition-colors">Next</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: CREATE / EDIT VIEW ────────────────────────────────────────

  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    const update = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

    const toggleArrayItem = (field: string, item: string) => {
      const arr: string[] = (formData as any)[field] || [];
      update(field, arr.includes(item) ? arr.filter((i: string) => i !== item) : [...arr, item]);
    };

    const toggleBool = (field: string) => update(field, !(formData as any)[field]);

    return (
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('list'); setSelectedId(null); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit LocalMall' : 'Create LocalMall'}</h2>
              <p className="text-xs text-gray-500 font-medium">{isEdit ? 'Modify the local digital economy configuration' : 'Set up a new local digital town centre'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setView('list'); setSelectedId(null); }} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold">Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-brand-dark transition-colors text-xs font-bold shadow-sm"><Save className="w-4 h-4" /> {isEdit ? 'Update LocalMall' : 'Create LocalMall'}</button>
          </div>
        </div>

        {/* SECTION A — Basic Information */}
        <CollapsibleSection title="SECTION A — Basic Information">
          <p className="text-xs text-gray-500 font-medium mb-4">Core identity and status settings for this LocalMall.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">LocalMall Name</label>
              <p className="text-[10px] text-gray-400 mb-1.5">The public display name shown to customers and businesses in the app and web portal.</p>
              <input type="text" value={(formData.name as string) || ''} onChange={e => update('name', e.target.value)} placeholder="e.g. Peckham LocalMall" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Slug</label>
              <p className="text-[10px] text-gray-400 mb-1.5">URL-friendly identifier used in the web address (auto-generated from name if left blank).</p>
              <input type="text" value={(formData.slug as string) || ''} onChange={e => update('slug', e.target.value)} placeholder="e.g. peckham-localmall" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Short Description</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Brief tagline shown in search results, listings, and map pins. Keep under 120 characters.</p>
              <input type="text" value={(formData.description as string) || ''} onChange={e => update('description', e.target.value)} placeholder="Brief description of this LocalMall" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Long Description</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Full description shown on the LocalMall detail page. Supports plain text.</p>
              <textarea value={(formData.longDescription as string) || ''} onChange={e => update('longDescription', e.target.value)} rows={3} placeholder="Full description of the local digital economy" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Status</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Controls visibility. Draft is hidden from users, Active is live, Disabled pauses access.</p>
              <select value={(formData.status as string) || 'Draft'} onChange={e => update('status', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION B — Branding */}
        <CollapsibleSection title="SECTION B — Branding">
          <p className="text-xs text-gray-500 font-medium mb-4">Visual identity and appearance settings for the LocalMall.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Logo</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Square image displayed in the app header and web portal. Recommended 512×512px.</p>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-blue/50 transition-colors">
                <Image className="w-8 h-8 text-gray-300" />
                <span className="text-xs font-medium text-gray-400">Upload logo image</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Cover Banner</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Wide banner shown on the homepage desktop view. Recommended 1200×400px.</p>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-blue/50 transition-colors">
                <Image className="w-8 h-8 text-gray-300" />
                <span className="text-xs font-medium text-gray-400">Upload cover banner</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Mobile Banner</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Optimized banner for mobile app display. Recommended 750×300px.</p>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-blue/50 transition-colors">
                <Image className="w-8 h-8 text-gray-300" />
                <span className="text-xs font-medium text-gray-400">Upload mobile banner</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Primary Colour</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Main brand colour used for buttons, headers, and key UI elements.</p>
              <div className="flex items-center gap-3">
                <input type="color" value={(formData.primaryColour as string) || '#2563EB'} onChange={e => update('primaryColour', e.target.value)} className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer" />
                <input type="text" value={(formData.primaryColour as string) || ''} onChange={e => update('primaryColour', e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Secondary Colour</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Accent colour used for highlights, badges, and secondary actions.</p>
              <div className="flex items-center gap-3">
                <input type="color" value={(formData.secondaryColour as string) || '#F59E0B'} onChange={e => update('secondaryColour', e.target.value)} className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer" />
                <input type="text" value={(formData.secondaryColour as string) || ''} onChange={e => update('secondaryColour', e.target.value)} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Welcome Message</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Headline greeting shown to users on their first visit to the LocalMall.</p>
              <input type="text" value={(formData.welcomeMessage as string) || ''} onChange={e => update('welcomeMessage', e.target.value)} placeholder="e.g. Welcome to Peckham LocalMall" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Tagline</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Short slogan displayed below the welcome message on the homepage.</p>
              <input type="text" value={(formData.tagline as string) || ''} onChange={e => update('tagline', e.target.value)} placeholder="e.g. Supporting Local Businesses Together" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION C — Location Configuration */}
        <CollapsibleSection title="SECTION C — Location Configuration" defaultOpen>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 font-medium">This is the most important section. Define the geographic territory for this LocalMall.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Primary Postcode</label>
                <p className="text-[10px] text-gray-400 mb-1.5">The main postcode district this LocalMall serves. Used for map radius and search matching.</p>
                <input type="text" value={((formData.postcodes as string[]) || [])[0] || ''} onChange={e => { const arr = [...((formData.postcodes as string[]) || [])]; arr[0] = e.target.value; update('postcodes', arr); }} placeholder="e.g. SE15" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Additional Postcodes Covered</label>
                <p className="text-[10px] text-gray-400 mb-1.5">Other postcode districts within the territory. Comma-separated (e.g. SE5, SE22).</p>
                <input type="text" value={((formData.postcodes as string[]) || []).slice(1).join(', ')} onChange={e => { const primary = ((formData.postcodes as string[]) || [])[0] || ''; const rest = e.target.value.split(',').map(s => s.trim()).filter(Boolean); update('postcodes', [primary, ...rest]); }} placeholder="e.g. SE5, SE22" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Primary High Street</label>
                <p className="text-[10px] text-gray-400 mb-1.5">The main high street this LocalMall focuses on. Displayed prominently in the directory.</p>
                <input type="text" value={(formData.primaryHighStreet as string) || ''} onChange={e => update('primaryHighStreet', e.target.value)} placeholder="e.g. Rye Lane" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Additional High Streets</label>
                <p className="text-[10px] text-gray-400 mb-1.5">Other streets within the territory. Comma-separated. Shown in browse and filter views.</p>
                <input type="text" value={((formData.additionalHighStreets as string[]) || []).join(', ')} onChange={e => update('additionalHighStreets', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="e.g. Peckham Road, Bellenden Road" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Borough</label>
                <p className="text-[10px] text-gray-400 mb-1.5">The London borough this LocalMall is situated in. Used for borough-level filtering.</p>
                <input type="text" value={(formData.borough as string) || ''} onChange={e => update('borough', e.target.value)} placeholder="e.g. Southwark" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Radius Coverage (optional)</label>
                <p className="text-[10px] text-gray-400 mb-1.5">Maximum distance from centre covered by the LocalMall. Used for geolocation matching.</p>
                <input type="text" value={(formData.radiusCoverage as string) || ''} onChange={e => update('radiusCoverage', e.target.value)} placeholder="e.g. 2.5 miles" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION D — Business Eligibility Rules */}
        <CollapsibleSection title="SECTION D — Business Eligibility Rules">
          <p className="text-xs text-gray-500 font-medium mb-4">Control which businesses can join and what checks they must pass.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'allowBusinessesOutsidePostcode', label: 'Allow businesses outside postcode?', desc: 'Let businesses join even if their address falls outside the defined postcodes.' },
              { key: 'allowVirtualBusinesses', label: 'Allow virtual businesses?', desc: 'Let online-only businesses register without a physical storefront.' },
              { key: 'allowHomeBusinesses', label: 'Allow home businesses?', desc: 'Let home-based businesses join the LocalMall directory.' },
              { key: 'requireVerification', label: 'Require verification?', desc: 'Businesses must verify identity before their listing goes live.' },
              { key: 'requireAuditCompletion', label: 'Require audit completion?', desc: 'Businesses must complete the onboarding audit before being listed.' },
              { key: 'requireMembershipApproval', label: 'Require membership approval?', desc: 'Admin must manually approve each business application before activation.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION E — Team Assignment */}
        <CollapsibleSection title="SECTION E — Team Assignment (247GBS Affiliates)">
          <p className="text-xs text-gray-500 font-medium mb-4">Assign roles from 247GBS Affiliates to grant territory access for this LocalMall.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Lead Consultant</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Senior consultant responsible for overall strategy and business onboarding in this territory.</p>
              <select
                value={(formData.leadConsultantId as string) || ''}
                onChange={e => {
                  const id = e.target.value;
                  const user = MOCK_AFFILIATE_USERS.find(u => u.id === id);
                  update('leadConsultantId', id);
                  update('leadConsultant', user ? user.name : '');
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              >
                <option value="">Select a Lead Consultant...</option>
                {getAffiliatesByRole('consultant').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <MultiSelectDropdown
                label="Assigned Account Managers"
                options={getAffiliatesByRole('account_manager')}
                selectedIds={(formData.assignedAccountManagerIds as string[]) || []}
                onChange={ids => {
                  update('assignedAccountManagerIds', ids);
                  update('assignedAccountManagers', getAffiliateNames(ids));
                }}
                placeholder="Select account managers..."
              />
              <p className="text-[10px] text-gray-400 mt-1.5">Managers who oversee business relationships and performance in this territory.</p>
            </div>
            <div>
              <MultiSelectDropdown
                label="Assigned Agents"
                options={getAffiliatesByRole('agent')}
                selectedIds={(formData.assignedAgentIds as string[]) || []}
                onChange={ids => {
                  update('assignedAgentIds', ids);
                  update('assignedAgents', getAffiliateNames(ids));
                }}
                placeholder="Select agents..."
              />
              <p className="text-[10px] text-gray-400 mt-1.5">Field agents who visit businesses, collect data, and manage local operations.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Support Team</label>
              <p className="text-[10px] text-gray-400 mb-1.5">Internal support staff for customer and technical queries. Comma-separated names.</p>
              <input type="text" value={((formData.supportTeam as string[]) || []).join(', ')} onChange={e => update('supportTeam', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="Names separated by commas" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION F — Feature Configuration */}
        <CollapsibleSection title="SECTION F — Feature Configuration">
          <p className="text-xs text-gray-500 font-medium mb-4">Enable or disable ecosystem modules. This allows some LocalMalls to launch gradually.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'enableAudit', label: 'Enable Audit', desc: 'Turn on the business audit and compliance module for onboarding.' },
              { key: 'enableRewards', label: 'Enable Rewards', desc: 'Let businesses offer cashback and reward schemes to customers.' },
              { key: 'enableLoyalty', label: 'Enable Loyalty', desc: 'Enable the digital loyalty card system for repeat purchases.' },
              { key: 'enableQLinks', label: 'Enable QLinks', desc: 'Turn on quick-link tracking for campaign attribution and analytics.' },
              { key: 'enableSpin', label: 'Enable Spin', desc: 'Activate the gamified spin-the-wheel feature for customer engagement.' },
              { key: 'enableEvents', label: 'Enable Events', desc: 'Allow event creation, promotion, and RSVP management.' },
              { key: 'enableCampaigns', label: 'Enable Campaigns', desc: 'Let businesses run marketing campaigns with targeting and scheduling.' },
              { key: 'enablePushNotifications', label: 'Enable Push Notifications', desc: 'Send real-time alerts and promotions to registered customers.' },
              { key: 'enableMarketplace', label: 'Enable Marketplace', desc: 'Turn on the multi-vendor marketplace module for product listings.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION G — Customer Settings */}
        <CollapsibleSection title="SECTION G — Customer Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Control how customers interact with the LocalMall and what actions require sign-up.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'allowGuestBrowsing', label: 'Allow Guest Browsing', desc: 'Let unregistered users browse businesses, campaigns, and events without signing up.' },
              { key: 'requireRegistrationForRewards', label: 'Require Registration For Rewards', desc: 'Users must create an account before claiming any rewards or cashback.' },
              { key: 'requireRegistrationForSpin', label: 'Require Registration For Spin', desc: 'Users must sign up before using the spin-the-wheel gamification feature.' },
              { key: 'enableAutoLocationDetection', label: 'Enable Auto Location Detection', desc: 'Automatically detect and suggest the nearest LocalMall via device GPS.' },
              { key: 'allowManualLocalMallSwitching', label: 'Allow Manual LocalMall Switching', desc: 'Let users switch between different LocalMalls if they live near multiple territories.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION H — Business Settings */}
        <CollapsibleSection title="SECTION H — Business Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Approval workflows and onboarding requirements for new businesses.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'autoApproveBusinesses', label: 'Auto Approve Businesses', desc: 'Automatically approve new business registrations without manual review.' },
              { key: 'manualApprovalRequired', label: 'Manual Approval Required', desc: 'Admin must review and approve each business before it goes live.' },
              { key: 'requireDocumentVerification', label: 'Require Document Verification', desc: 'Businesses must upload proof of identity and address during onboarding.' },
              { key: 'requireGoogleBusinessMatch', label: 'Require Google Business Match', desc: 'Validate the business against Google Business Profile for authenticity.' },
              { key: 'requireAuditCompletionForBusiness', label: 'Require Audit Completion', desc: 'Businesses must complete the full onboarding audit before listing.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Default Membership Package</span>
                <select value={(formData.defaultMembershipPackage as string) || 'Standard'} onChange={e => update('defaultMembershipPackage', e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">The membership tier assigned to new businesses on registration.</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION I — Homepage Configuration */}
        <CollapsibleSection title="SECTION I — Homepage Configuration">
          <p className="text-xs text-gray-500 font-medium mb-4">Controls what customers see on the LocalMall homepage. Reorder by priority (drag-and-drop not available in this view — edit fields below).</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'featuredBusinesses', label: 'Featured Businesses', placeholder: 'e.g. The Coffee Shop, Peckham Pharmacy', desc: 'Comma-separated business names to highlight on the homepage grid.' },
              { key: 'featuredCategories', label: 'Featured Categories', placeholder: 'e.g. Food & Drink, Retail', desc: 'Categories shown prominently in the navigation and browse section.' },
              { key: 'featuredCampaigns', label: 'Featured Campaigns', placeholder: 'e.g. Summer Sale 2025', desc: 'Campaigns displayed at the top of the homepage in the carousel.' },
              { key: 'featuredEvents', label: 'Featured Events', placeholder: 'e.g. Peckham Food Festival', desc: 'Events highlighted on the events tab and homepage banner.' },
              { key: 'featuredRewards', label: 'Featured Rewards', placeholder: 'e.g. Welcome Bonus', desc: 'Rewards promoted on the rewards page and push notifications.' },
              { key: 'featuredSpinCampaigns', label: 'Featured Spin Campaigns', placeholder: 'e.g. Spin & Win Summer', desc: 'Spin campaigns shown on the gamification page.' },
              { key: 'featuredHighStreets', label: 'Featured High Streets', placeholder: 'e.g. Rye Lane', desc: 'High streets promoted in the browse and map sections.' },
            ].map(({ key, label, placeholder, desc }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">{label}</label>
                <p className="text-[10px] text-gray-400 mb-1.5">{desc}</p>
                <input type="text" value={((formData as any)[key] as string[] || []).join(', ')} onChange={e => update(key, e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder={placeholder} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION J — Category Priorities */}
        <CollapsibleSection title="SECTION J — Category Priorities">
          <p className="text-xs text-gray-500 font-medium mb-4">Control how each business category appears to customers. Admin can choose: Show first (pinned to top), Highlight (visual emphasis), or Hide (removed from browse).</p>
          <div className="space-y-2">
            {((formData.categoryPriorities as { name: string; action: string }[]) || []).map((cat, idx) => (
              <div key={cat.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-xs font-semibold text-gray-700 w-40">{cat.name}</span>
                <select value={cat.action} onChange={e => { const arr = [...((formData.categoryPriorities as any[]) || [])]; arr[idx] = { ...arr[idx], action: e.target.value }; update('categoryPriorities', arr); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
                  <option value="show-first">Show first</option>
                  <option value="hide">Hide</option>
                  <option value="highlight">Highlight</option>
                </select>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION K — Campaign Settings */}
        <CollapsibleSection title="SECTION K — Campaign Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Define what types of campaigns businesses can run and the approval workflow.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'allowBoroughCampaigns', label: 'Allow Borough Campaigns', desc: 'Let campaigns run across the entire borough, not just a single high street.' },
              { key: 'allowHighStreetCampaigns', label: 'Allow High Street Campaigns', desc: 'Let campaigns target specific high streets within the territory.' },
              { key: 'allowJointCampaigns', label: 'Allow Joint Campaigns', desc: 'Allow multiple businesses to co-sponsor a shared campaign.' },
              { key: 'allowSeasonalCampaigns', label: 'Allow Seasonal Campaigns', desc: 'Enable time-limited seasonal promotions (e.g. Christmas, Summer Sale).' },
              { key: 'campaignApprovalRequired', label: 'Campaign Approval Required', desc: 'Admin must approve each campaign before it goes live to customers.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION L — Event Settings */}
        <CollapsibleSection title="SECTION L — Event Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Control event creation, approval, and participation rules.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'enableEventsModule', label: 'Enable Events', desc: 'Turn on the events module so businesses and groups can create events.' },
              { key: 'requireEventApproval', label: 'Require Event Approval', desc: 'Admin must approve each event before it is published to customers.' },
              { key: 'allowCommunityEvents', label: 'Allow Community Events', desc: 'Let community groups and non-profits host local events.' },
              { key: 'allowBusinessEvents', label: 'Allow Business Events', desc: 'Let registered businesses create and promote their own events.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Maximum Events Per Business</span>
                <input type="number" value={(formData.maxEventsPerBusiness as number) || 0} onChange={e => update('maxEventsPerBusiness', parseInt(e.target.value) || 0)} className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">How many events each business can run simultaneously.</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION M — Reward Settings */}
        <CollapsibleSection title="SECTION M — Reward Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Configure how customers earn and redeem rewards across this LocalMall.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'enableRewardsModule', label: 'Enable Rewards', desc: 'Turn on the rewards and cashback module for customer purchases.' },
              { key: 'enableLoyaltyModule', label: 'Enable Loyalty', desc: 'Activate the digital loyalty card system for repeat business.' },
              { key: 'enableBonusCampaigns', label: 'Enable Bonus Campaigns', desc: 'Allow special bonus reward campaigns for extra customer incentives.' },
              { key: 'enableDoublePointDays', label: 'Enable Double Point Days', desc: 'Let businesses run limited-time double-point promotions.' },
              { key: 'enableSeasonalRewards', label: 'Enable Seasonal Rewards', desc: 'Enable seasonal reward schemes tied to holidays and events.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION N — Spin Settings */}
        <CollapsibleSection title="SECTION N — Spin Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Configure the spin-the-wheel gamification feature for customer engagement.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'enableSpinModule', label: 'Enable Spin', desc: 'Turn on the spin-the-wheel feature for this LocalMall.' },
              { key: 'allowBusinessSponsoredSpins', label: 'Allow Business Sponsored Spins', desc: 'Let businesses sponsor their own spin prizes and promotions.' },
              { key: 'allowBoroughSpins', label: 'Allow Borough Spins', desc: 'Enable borough-wide spin campaigns across multiple LocalMalls.' },
              { key: 'allowSeasonalSpins', label: 'Allow Seasonal Spins', desc: 'Enable seasonal spin campaigns tied to holidays and events.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Maximum Spins Per Customer</span>
                <input type="number" value={(formData.maxSpinsPerCustomer as number) || 0} onChange={e => update('maxSpinsPerCustomer', parseInt(e.target.value) || 0)} className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">How many spins each customer gets per day/week.</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION O — QLink Settings */}
        <CollapsibleSection title="SECTION O — QLink Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">Configure content distribution and feed settings for QLinks.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'enableRotator', label: 'Enable Rotator', desc: 'Cycle featured content automatically in the homepage rotator banner.' },
              { key: 'enableLocalFeedDistribution', label: 'Enable Local Feed Distribution', desc: 'Push content to the local feed within this territory.' },
              { key: 'enableBoroughFeedDistribution', label: 'Enable Borough Feed Distribution', desc: 'Push content to the wider borough feed for broader reach.' },
              { key: 'enableFeaturedPlacement', label: 'Enable Featured Placement', desc: 'Allow businesses to pay for featured/promoted content placement.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{label}</span>
                  <Toggle enabled={(formData as any)[key] || false} onChange={() => toggleBool(key)} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* SECTION P — Analytics Settings */}
        <CollapsibleSection title="SECTION P — Analytics Settings">
          <p className="text-xs text-gray-500 font-medium mb-4">The following metrics will be tracked automatically once the LocalMall is active. No configuration required — data is collected in real-time.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { metric: 'Businesses Joined', desc: 'Total businesses registered in this LocalMall.' },
              { metric: 'Customers Registered', desc: 'Total customers who signed up.' },
              { metric: 'Campaign Participation', desc: 'Customer interactions with active campaigns.' },
              { metric: 'Spin Engagement', desc: 'Number of spin-the-wheel sessions played.' },
              { metric: 'Reward Usage', desc: 'Rewards claimed and redeemed by customers.' },
              { metric: 'Store Visits', desc: 'Physical store visits tracked via check-ins.' },
              { metric: 'Offer Redemptions', desc: 'Number of offers and vouchers redeemed.' },
            ].map(({ metric, desc }) => (
              <div key={metric} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-gray-700">{metric}</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    );
  }

  // ─── RENDER: DETAIL VIEW ────────────────────────────────────────────────

  if (view === 'detail' && selectedMall) {
    const mall = selectedMall;
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <button onClick={() => { setView('list'); setSelectedId(null); }} className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors">LocalMalls</button>
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <span className="text-xs font-bold text-gray-900">{mall.name}</span>
        </div>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-glow">
                {mall.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{mall.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500"><MapPin className="w-3 h-3" /> {mall.borough}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500"><Store className="w-3 h-3" /> {mall.primaryHighStreet}</span>
                  <Badge status={mall.status} />
                </div>
                <p className="text-xs text-gray-500 mt-2">{mall.description}</p>
              </div>
            </div>
            <button onClick={() => handleEdit(mall)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold"><Edit3 className="w-4 h-4" /> Edit</button>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard title="Businesses" value={String(mall.businesses)} trend="+12" icon={Store} color="blue" />
          <StatCard title="Customers" value={(mall.customers / 1000).toFixed(1) + 'k'} trend="+8.1%" icon={Users} color="green" />
          <StatCard title="Campaigns" value={String(mall.campaigns)} trend="+3" icon={Target} color="purple" />
          <StatCard title="Events" value={String(mall.events)} trend="+5" icon={Music} color="amber" />
          <StatCard title="Rewards Issued" value="1,847" trend="+22%" icon={Gift} color="rose" />
          <StatCard title="Spin Sessions" value="6,230" trend="+15%" icon={Sparkles} color="cyan" />
          <StatCard title="Traffic" value="28.4k" trend="+18%" icon={Activity} color="indigo" />
          <StatCard title="Revenue" value="£42.5k" trend="+24%" icon={TrendingUp} color="green" />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 overflow-x-auto">
            <div className="flex">
              {[
                { key: 'overview' as const, label: 'Overview', icon: Eye },
                { key: 'businesses' as const, label: 'Businesses', icon: Store },
                { key: 'customers' as const, label: 'Customers', icon: Users },
                { key: 'campaigns' as const, label: 'Campaigns', icon: Target },
                { key: 'events' as const, label: 'Events', icon: Music },
                { key: 'rewards' as const, label: 'Rewards', icon: Gift },
                { key: 'spin' as const, label: 'Spin', icon: Sparkles },
                { key: 'team' as const, label: 'Team', icon: Users },
                { key: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
              ].map(tab => (
                <button key={tab.key} onClick={() => setDetailTab(tab.key)} className={cn("flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap", detailTab === tab.key ? "text-brand-blue border-brand-blue" : "text-gray-500 border-transparent hover:text-gray-700")}>
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Location Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><span className="text-xs font-semibold text-gray-600">Borough</span><span className="text-xs font-bold text-gray-900">{mall.borough}</span></div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><span className="text-xs font-semibold text-gray-600">Primary Postcode</span><span className="text-xs font-bold text-gray-900">{mall.postcodes[0]}</span></div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><span className="text-xs font-semibold text-gray-600">Postcodes Covered</span><span className="text-xs font-bold text-gray-900">{mall.postcodes.join(', ')}</span></div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><span className="text-xs font-semibold text-gray-600">Primary High Street</span><span className="text-xs font-bold text-gray-900">{mall.primaryHighStreet}</span></div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><span className="text-xs font-semibold text-gray-600">Radius Coverage</span><span className="text-xs font-bold text-gray-900">{mall.radiusCoverage || 'N/A'}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Stats</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Businesses', value: String(mall.businesses), icon: Building2 },
                      { label: 'Total Customers', value: (mall.customers / 1000).toFixed(1) + 'k', icon: Users },
                      { label: 'Active Campaigns', value: String(mall.campaigns), icon: Target },
                      { label: 'Upcoming Events', value: String(mall.events), icon: Music },
                    ].map(s => (
                      <div key={s.label} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2"><s.icon className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-bold text-gray-500 uppercase">{s.label}</span></div>
                        <div className="text-xl font-bold text-gray-900">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {detailTab === 'businesses' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mall.businesses} Businesses</h4>
                  <button className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold">View All</button>
                </div>
                <div className="space-y-2">
                  {mall.featuredBusinesses.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-blue/10 rounded-lg flex items-center justify-center"><Store className="w-4 h-4 text-brand-blue" /></div>
                        <span className="text-xs font-semibold text-gray-700">{b}</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailTab === 'customers' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mall.customers.toLocaleString()} Registered Customers</h4>
                  <button className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold">View All</button>
                </div>
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-700">Customer engagement metrics available in Analytics tab</p>
                </div>
              </div>
            )}
            {detailTab === 'campaigns' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mall.campaigns} Active Campaigns</h4>
                  <button className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold">Create Campaign</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mall.featuredCampaigns.map((c, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-brand-blue" /><span className="text-sm font-bold text-gray-900">{c}</span></div>
                      <div className="flex items-center gap-4 text-[10px] font-medium text-gray-500">
                        <span>Participation: {Math.floor(Math.random() * 500 + 100)}</span>
                        <span className={cn("px-2 py-0.5 rounded-full font-bold", Math.random() > 0.5 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50")}>Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailTab === 'events' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mall.events} Upcoming Events</h4>
                  <button className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold">Create Event</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mall.featuredEvents.map((e, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-2"><Music className="w-4 h-4 text-brand-blue" /><span className="text-sm font-bold text-gray-900">{e}</span></div>
                      <div className="text-[10px] font-medium text-gray-500">Date: {new Date(2025, 5 + i, 15).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailTab === 'rewards' && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Reward Statistics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">1,847</div><div className="text-xs font-medium text-gray-500">Rewards Issued</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">68%</div><div className="text-xs font-medium text-gray-500">Redemption Rate</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">£12.4k</div><div className="text-xs font-medium text-gray-500">Value Redeemed</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">4.2</div><div className="text-xs font-medium text-gray-500">Avg. Per Customer</div></div>
                </div>
                <div className="space-y-2">
                  {mall.featuredRewards.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3"><Gift className="w-4 h-4 text-brand-blue" /><span className="text-xs font-semibold text-gray-700">{r}</span></div>
                      <span className="text-[10px] font-medium text-gray-500">{Math.floor(Math.random() * 500 + 50)} claims</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailTab === 'spin' && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Gamification Statistics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">6,230</div><div className="text-xs font-medium text-gray-500">Spin Sessions</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">3.2</div><div className="text-xs font-medium text-gray-500">Avg. Spins/User</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">42%</div><div className="text-xs font-medium text-gray-500">Win Rate</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl text-center"><div className="text-2xl font-bold text-gray-900">£8.2k</div><div className="text-xs font-medium text-gray-500">Prizes Awarded</div></div>
                </div>
              </div>
            )}
            {detailTab === 'team' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lead Consultant</h4>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 font-bold text-sm">{mall.leadConsultant?.charAt(0) || '?'}</div>
                    <div><div className="text-sm font-bold text-gray-900">{mall.leadConsultant || 'Unassigned'}</div><div className="text-[10px] font-medium text-gray-500">Lead Consultant</div></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Account Managers</h4>
                  <div className="space-y-2">
                    {mall.assignedAccountManagers.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-sm">{m.charAt(0)}</div>
                        <div><div className="text-sm font-bold text-gray-900">{m}</div><div className="text-[10px] font-medium text-gray-500">Account Manager</div></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Agents</h4>
                  <div className="space-y-2">
                    {mall.assignedAgents.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 font-bold text-sm">{a.charAt(0)}</div>
                        <div><div className="text-sm font-bold text-gray-900">{a}</div><div className="text-[10px] font-medium text-gray-500">Agent</div></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Support Team</h4>
                  <div className="space-y-2">
                    {mall.supportTeam.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold text-sm">{s.charAt(0)}</div>
                        <div><div className="text-sm font-bold text-gray-900">{s}</div><div className="text-[10px] font-medium text-gray-500">Support</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {detailTab === 'analytics' && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Analytics & KPIs</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Businesses Joined', value: String(mall.businesses), trend: '+12', icon: Store },
                    { label: 'Customers Registered', value: (mall.customers / 1000).toFixed(1) + 'k', trend: '+8.1%', icon: Users },
                    { label: 'Campaign Participation', value: '2,847', trend: '+15.3%', icon: Target },
                    { label: 'Spin Engagement', value: '6,230', trend: '+22%', icon: Sparkles },
                    { label: 'Reward Usage', value: '1,847', trend: '+18%', icon: Gift },
                    { label: 'Store Visits', value: '14.2k', trend: '+12.4%', icon: Store },
                    { label: 'Offer Redemptions', value: '3,561', trend: '+25%', icon: Percent },
                  ].map(m => (
                    <div key={m.label} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2"><m.icon className="w-4 h-4 text-brand-blue" /><span className="text-[10px] font-bold text-gray-500 uppercase">{m.label}</span></div>
                      <div className="text-lg font-bold text-gray-900">{m.value}</div>
                      <div className="text-[10px] font-bold text-emerald-600">{m.trend}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* What Business Sees Widget */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">What Businesses See — Dashboard Widget</h4>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-4 h-4 text-brand-blue" /><span className="text-xs font-bold text-gray-500 uppercase">Your LocalMall</span></div>
            <div className="text-lg font-bold text-gray-900 mb-2">{mall.name}</div>
            <div className="flex items-center gap-4 mb-4">
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500"><MapPin className="w-3 h-3" /> {mall.borough} Borough</span>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500"><Store className="w-3 h-3" /> {mall.primaryHighStreet}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-[10px] font-bold">View Local Activity</button>
              <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold">Join Campaign</button>
              <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold">Join Event</button>
              <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold">Promote Business</button>
            </div>
          </div>
        </div>

        {/* What Customer Sees Widget */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">What Customers See — Homepage</h4>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="text-lg font-bold text-gray-900 mb-4">{mall.welcomeMessage || `Welcome to ${mall.name}`}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Businesses Near You', "Today's Offers", 'Local Events', 'Spin Opportunities', 'Rewards Near You', 'Trending Businesses'].map(section => (
                <div key={section} className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                  <div className="text-[10px] font-bold text-gray-900">{section}</div>
                  <div className="text-[10px] font-medium text-gray-400 mt-0.5">Dynamic content</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
