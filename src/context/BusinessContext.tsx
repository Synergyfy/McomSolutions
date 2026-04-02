import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Business {
  id: number;
  name: string;
  membership: string;
  revenue: string;
  source: string;
  joined: string;
}

interface BusinessContextType {
  businesses: Business[];
  addBusiness: (business: Omit<Business, 'id'>) => void;
  updateBusiness: (id: number, updates: Partial<Business>) => void;
  deleteBusiness: (id: number) => void;
}

const DEFAULT_BUSINESSES: Business[] = [
  { id: 1, name: "Global Retailers Ltd", membership: "Gold Pro+", revenue: "£124k", source: "GBS Loyalty", joined: "2026-03-12" },
  { id: 2, name: "Eco Market", membership: "Silver Normal", revenue: "£12k", source: "Mcom Mall", joined: "2026-03-15" },
  { id: 3, name: "Fashion Hub", membership: "Gold Pro", revenue: "£45k", source: "Mcom Rewards", joined: "2026-03-18" },
  { id: 4, name: "Tech Solutions", membership: "Platinum Normal", revenue: "£890k", source: "GBS Audit", joined: "2026-03-20" },
  { id: 5, name: "Local Deli", membership: "Bronze Normal", revenue: "£2.5k", source: "GBS Loyalty", joined: "2026-03-22" },
  { id: 6, name: "Urban Outfitters", membership: "Gold Pro+", revenue: "£320k", source: "McomQ Link", joined: "2026-03-24" },
];

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>(() => {
    const saved = localStorage.getItem('gbs_businesses');
    return saved ? JSON.parse(saved) : DEFAULT_BUSINESSES;
  });

  useEffect(() => {
    localStorage.setItem('gbs_businesses', JSON.stringify(businesses));
  }, [businesses]);

  const addBusiness = (business: Omit<Business, 'id'>) => {
    const newBusiness = { ...business, id: Date.now() };
    setBusinesses(prev => [newBusiness, ...prev]);
  };

  const updateBusiness = (id: number, updates: Partial<Business>) => {
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBusiness = (id: number) => {
    setBusinesses(prev => prev.filter(b => b.id !== id));
  };

  return (
    <BusinessContext.Provider value={{ businesses, addBusiness, updateBusiness, deleteBusiness }}>
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
