import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Building2, Zap, Star, Trophy } from 'lucide-react';
import { usePlans } from '../services/pricing/hooks';

export type SubTier = 'Normal' | 'Pro' | 'Pro+';
export type Membership = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface PricingPlan {
  id: Membership;
  name: Membership;
  description: string;
  whoItIsFor: string;
  iconName: 'Building2' | 'Zap' | 'Star' | 'Trophy';
  color: string;
  price: Record<SubTier, number>;
  features: string[];
  tierFeatures: Record<SubTier, string[]>;
}

interface PricingContextType {
  plans: PricingPlan[];
  loading: boolean;
  updatePlan: (id: Membership, updates: Partial<PricingPlan>) => void;
  resetToDefaults: () => void;
}

// Presentational metadata only — descriptions, prices, and features are sourced
// from the backend (`GET /pricing/plans`, DB-backed).
const PLAN_METADATA: Record<string, Partial<PricingPlan>> = {
  Bronze: {
    whoItIsFor: 'New businesses',
    iconName: 'Building2',
    color: 'border-amber-600/20 text-amber-600 bg-amber-50',
    tierFeatures: {
      Normal: ['Base Visibility', 'Local Listings'],
      Pro: ['Enhanced Visibility', 'Extended Listings'],
      'Pro+': ['Priority Visibility', 'Featured Placement'],
    },
  },
  Silver: {
    whoItIsFor: 'Growing businesses',
    iconName: 'Zap',
    color: 'border-slate-400/20 text-slate-500 bg-slate-50',
    tierFeatures: {
      Normal: ['Standard Ads', 'Campaign Basic'],
      Pro: ['Premium Ads', 'Campaign Priority'],
      'Pro+': ['Aggressive Ads', 'Exclusive Early Access'],
    },
  },
  Gold: {
    whoItIsFor: 'Scaling businesses',
    iconName: 'Star',
    color: 'border-yellow-500/30 text-yellow-600 bg-yellow-50',
    tierFeatures: {
      Normal: ['Direct API', 'Dashboard Basic'],
      Pro: ['Custom API', 'Dashboard Pro'],
      'Pro+': ['Enterprise API', 'Full AI Suite'],
    },
  },
  Platinum: {
    whoItIsFor: 'Established businesses',
    iconName: 'Trophy',
    color: 'border-blue-600/20 text-blue-700 bg-blue-50',
    tierFeatures: {
      Normal: ['Dedicated AM', 'Monthly Strategy'],
      Pro: ['Global AM', 'Bi-weekly Strategy'],
      'Pro+': ['VP Support', 'Weekly Audits'],
    },
  },
};

const PricingContext = createContext<PricingContextType | undefined>(undefined);

const mapApiPlan = (p: any): PricingPlan => {
  const key = p.name || p.id;
  const meta = PLAN_METADATA[key] || {};
  return {
    id: key,
    name: key,
    description: p.description || '',
    whoItIsFor: meta.whoItIsFor || 'Businesses',
    iconName: (meta.iconName as PricingPlan['iconName']) || 'Building2',
    color: meta.color || 'border-gray-300 text-gray-600 bg-gray-50',
    price: {
      Normal: p.price?.Normal ?? 0,
      Pro: p.price?.Pro ?? 0,
      'Pro+': p.price?.['Pro+'] ?? 0,
    },
    features: Array.isArray(p.features) ? p.features : [],
    tierFeatures: meta.tierFeatures || { Normal: [], Pro: [], 'Pro+': [] },
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

  const updatePlan = (id: Membership, updates: Partial<PricingPlan>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
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