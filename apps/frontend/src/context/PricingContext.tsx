import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Building2, Zap, Star, Trophy } from 'lucide-react';
import { usePlans } from '../services/pricing/hooks';

export type SubTier = 'Normal' | 'Pro' | 'Pro+';
export type Membership = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | string;

export interface IncludedAppPlan {
  platform: string;
  clientId?: string;
  planId: string;
  planName: string;
  standalonePrice?: number;
  quotas?: Record<string, any>;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  whoItIsFor: string;
  badge?: string;
  iconName: 'Building2' | 'Zap' | 'Star' | 'Trophy' | string;
  color: string;
  price: number;
  monthlyPrice: number;
  quarterlyPrice: number;
  annualPrice: number;
  features: string[];
  includedApps?: IncludedAppPlan[];
}

interface PricingContextType {
  plans: PricingPlan[];
  loading: boolean;
  updatePlan: (id: string, updates: Partial<PricingPlan>) => void;
  resetToDefaults: () => void;
}

// Presentational metadata only — descriptions, prices, and features are sourced
// from the backend (`GET /pricing/plans`, DB-backed).
const PLAN_METADATA: Record<string, Partial<PricingPlan>> = {
  Bronze: {
    whoItIsFor: 'New businesses',
    iconName: 'Building2',
    color: 'border-amber-600/20 text-amber-600 bg-amber-50',
  },
  Silver: {
    whoItIsFor: 'Growing businesses',
    iconName: 'Zap',
    color: 'border-slate-400/20 text-slate-500 bg-slate-50',
  },
  Gold: {
    whoItIsFor: 'Scaling businesses',
    iconName: 'Star',
    color: 'border-yellow-500/30 text-yellow-600 bg-yellow-50',
  },
  Platinum: {
    whoItIsFor: 'Established businesses',
    iconName: 'Trophy',
    color: 'border-blue-600/20 text-blue-700 bg-blue-50',
  },
};

const PricingContext = createContext<PricingContextType | undefined>(undefined);

const mapApiPlan = (p: any): PricingPlan => {
  const name = p.name || p.id;
  const meta = PLAN_METADATA[name] || {};
  const monthly = p.monthlyPrice != null
    ? Number(p.monthlyPrice)
    : (typeof p.price === 'number' ? p.price : (p.price?.Normal ?? 0));
  const quarterly = p.quarterlyPrice != null
    ? Number(p.quarterlyPrice)
    : Math.floor(monthly * 0.9) * 3;
  const annual = p.annualPrice != null
    ? Number(p.annualPrice)
    : Math.floor(monthly * 0.8) * 12;

  return {
    id: p.id || name,
    name: name,
    description: p.description || '',
    whoItIsFor: p.whoItIsFor || meta.whoItIsFor || 'Businesses',
    badge: p.badge || undefined,
    iconName: (meta.iconName as PricingPlan['iconName']) || 'Building2',
    color: p.color || meta.color || 'border-gray-300 text-gray-600 bg-gray-50',
    price: monthly,
    monthlyPrice: monthly,
    quarterlyPrice: quarterly,
    annualPrice: annual,
    features: Array.isArray(p.features) ? p.features : [],
    includedApps: Array.isArray(p.includedApps) ? p.includedApps : [],
  };
};

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const { data: apiPlans, isLoading } = usePlans();

  // Editable copy seeded from the API — the editor mutates this and Save
  // persists the changes via the admin plans API.
  const [plans, setPlans] = useState<PricingPlan[]>([]);

  useEffect(() => {
    if (Array.isArray(apiPlans)) {
      setPlans(apiPlans.map(mapApiPlan));
    }
  }, [apiPlans]);

  const updatePlan = (id: string, updates: Partial<PricingPlan>) => {
    setPlans((prev) => prev.map((p) => (p.id === id || p.name === id ? { ...p, ...updates } : p)));
  };

  const resetToDefaults = () => {
    if (Array.isArray(apiPlans)) setPlans(apiPlans.map(mapApiPlan));
  };

  return (
    <PricingContext.Provider value={{ plans, loading: isLoading, updatePlan, resetToDefaults }}>
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const context = useContext(PricingContext);
  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
}

export const ICON_MAP = {
  Building2,
  Zap,
  Star,
  Trophy,
};