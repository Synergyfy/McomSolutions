import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAllBusinesses, useDeleteBusiness } from '../services/business/hooks';

export interface Business {
  id: string;
  name: string;
  membership: string;
  source: string;
  joined: string;
}

interface BusinessContextType {
  businesses: Business[];
  deleteBusiness: (id: string) => void;
  loading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { data: rawBusinesses, isLoading: loading } = useAllBusinesses();
  const deleteBusinessMutation = useDeleteBusiness();
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    if (rawBusinesses) {
      const mapped: Business[] = rawBusinesses.map((b: any) => ({
        id: b.id,
        name: b.businessName,
        membership: `${b.membershipLevel || 'Bronze'} ${b.membershipTier || 'Normal'}`,
        source: b.businessType || 'Onboarded',
        joined: new Date(b.createdAt).toISOString().split('T')[0],
      }));
      setBusinesses(mapped);
    } else {
      setBusinesses([]);
    }
  }, [rawBusinesses]);

  const deleteBusiness = async (id: string) => {
    try {
      await deleteBusinessMutation.mutateAsync(id);
    } catch (err) {
      console.error('Error deleting business:', err);
    }
  };

  return (
    <BusinessContext.Provider value={{ businesses, deleteBusiness, loading }}>
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