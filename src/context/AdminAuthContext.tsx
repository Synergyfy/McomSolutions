import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AdminUser {
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Finance Admin' | 'Support Admin' | 'Membership Admin' | 'Platform Admin' | 'Developer';
  avatar: string;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  admin: AdminUser | null;
  login: (email: string, password: string, code: string) => boolean;
  logout: () => void;
}

const ADMIN_CREDENTIALS = {
  email: 'admin@mcomsolutions.co.uk',
  password: 'admin123',
};

const DEFAULT_ADMIN: AdminUser = {
  name: 'Adam Smith',
  email: 'admin@mcomsolutions.co.uk',
  role: 'Super Admin',
  avatar: 'AS',
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('admin_auth') === 'true';
  });
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('admin_auth', String(isAuthenticated));
    if (admin) {
      localStorage.setItem('admin_user', JSON.stringify(admin));
    } else {
      localStorage.removeItem('admin_user');
    }
  }, [isAuthenticated, admin]);

  const login = useCallback((_email: string, _password: string, _code: string) => {
    setAdmin(DEFAULT_ADMIN);
    setIsAuthenticated(true);
    return true;
  }, []);

  const logout = useCallback(() => {
    setAdmin(null);
    setIsAuthenticated(false);
    localStorage.removeItem('admin_auth');
    localStorage.removeItem('admin_user');
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
