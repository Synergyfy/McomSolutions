import React, { createContext, useContext, useState, useEffect } from 'react';
import { businessApi } from '../lib/api';

export interface Business {
  id: string;
  name: string;
  membership: string;
  revenue: string;
  source: string;
  joined: string;
}

interface BusinessContextType {
  businesses: Business[];
  addBusiness: (business: Omit<Business, 'id'>) => void;
  updateBusiness: (id: string, updates: Partial<Business>) => void;
  deleteBusiness: (id: string) => void;
  loading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const data = await businessApi.getAllBusinesses();
      
      // Map database schema columns to matches expected by AllBusinesses.tsx UI
      const mapped: Business[] = data.map((b: any) => ({
        id: b.id,
        name: b.businessName,
        membership: `${b.membershipLevel || 'Bronze'} ${b.membershipTier || 'Normal'}`,
        revenue: '£' + (b.proximityTier === 'high_street' ? '15k' : '2.5k'), // Mock estimate
        source: b.businessType || 'Onboarded',
        joined: new Date(b.createdAt).toISOString().split('T')[0],
      }));
      setBusinesses(mapped);
    } catch (err) {
      console.error('Error fetching businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const addBusiness = (business: Omit<Business, 'id'>) => {
    console.log('addBusiness stub:', business);
  };

  const updateBusiness = (id: string, updates: Partial<Business>) => {
    console.log('updateBusiness stub:', id, updates);
  };

  const deleteBusiness = async (id: string) => {
    try {
      await businessApi.deleteBusiness(id);
      setBusinesses(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Error deleting business:', err);
    }
  };

  return (
    <BusinessContext.Provider value={{ businesses, addBusiness, updateBusiness, deleteBusiness, loading }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinesses() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusinesses must be used within a BusinessProvider');
  }
  return context;
}
