import React, { createContext, useContext, useState, useEffect } from 'react';
import { Building2, Zap, Star, Trophy } from 'lucide-react';

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
  updatePlan: (id: Membership, updates: Partial<PricingPlan>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: 'Bronze',
    name: 'Bronze',
    description: 'Perfect for local brands and new startups.',
    whoItIsFor: 'New businesses',
    iconName: 'Building2',
    color: 'border-amber-600/20 text-amber-600 bg-amber-50',
    price: { Normal: 10, Pro: 25, 'Pro+': 50 },
    features: ['Basic business listing', 'Community access', 'Essential insights'],
    tierFeatures: {
        'Normal': ['Base Visibility', 'Local Listings'],
        'Pro': ['Enhanced Visibility', 'Extended Listings'],
        'Pro+': ['Priority Visibility', 'Featured Placement']
    }
  },
  {
    id: 'Silver',
    name: 'Silver',
    description: 'Advanced tools for growing teams.',
    whoItIsFor: 'Growing businesses',
    iconName: 'Zap',
    color: 'border-slate-400/20 text-slate-500 bg-slate-50',
    price: { Normal: 75, Pro: 150, 'Pro+': 250 },
    features: ['Marketing tools', 'Campaign participation', 'Quarterly reviews', 'Everything in Bronze'],
    tierFeatures: {
        'Normal': ['Standard Ads', 'Campaign Basic'],
        'Pro': ['Premium Ads', 'Campaign Priority'],
        'Pro+': ['Aggressive Ads', 'Exclusive Early Access']
    }
  },
  {
    id: 'Gold',
    name: 'Gold',
    description: 'Scale your operations with priority access.',
    whoItIsFor: 'Scaling businesses',
    iconName: 'Star',
    color: 'border-yellow-500/30 text-yellow-600 bg-yellow-50',
    price: { Normal: 350, Pro: 600, 'Pro+': 900 },
    features: ['Full campaign access', 'Multi-location support', 'Advanced AI insights', 'Everything in Silver'],
    tierFeatures: {
        'Normal': ['Direct API', 'Dashboard Basic'],
        'Pro': ['Custom API', 'Dashboard Pro'],
        'Pro+': ['Enterprise API', 'Full AI Suite']
    }
  },
  {
    id: 'Platinum',
    name: 'Platinum',
    description: 'Tailored solutions for market leaders.',
    whoItIsFor: 'Established businesses',
    iconName: 'Trophy',
    color: 'border-blue-600/20 text-blue-700 bg-blue-50',
    price: { Normal: 1200, Pro: 2500, 'Pro+': 4500 },
    features: ['Priority visibility', 'Dedicated support', 'Executive reporting', 'Everything in Gold'],
    tierFeatures: {
        'Normal': ['Dedicated AM', 'Monthly Strategy'],
        'Pro': ['Global AM', 'Bi-weekly Strategy'],
        'Pro+': ['VP Support', 'Weekly Audits']
    }
  }
];

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<PricingPlan[]>(() => {
    const saved = localStorage.getItem('gbs_pricing_plans');
    if (!saved) return DEFAULT_PLANS;
    
    // Structure migration: Ensure new keys exist even if user has old data
    const parsedSaved = JSON.parse(saved);
    return DEFAULT_PLANS.map(defaultPlan => {
      const savedPlan = parsedSaved.find((p: any) => p.id === defaultPlan.id);
      return savedPlan ? { ...defaultPlan, ...savedPlan } : defaultPlan;
    });
  });

  useEffect(() => {
    localStorage.setItem('gbs_pricing_plans', JSON.stringify(plans));
  }, [plans]);

  const updatePlan = (id: Membership, updates: Partial<PricingPlan>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const resetToDefaults = () => {
    setPlans(DEFAULT_PLANS);
    localStorage.removeItem('gbs_pricing_plans');
  };

  return (
    <PricingContext.Provider value={{ plans, updatePlan, resetToDefaults }}>
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
  Trophy
};
