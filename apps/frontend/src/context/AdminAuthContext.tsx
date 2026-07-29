import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminApi } from '../services/admin/index';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  admin: AdminUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

function loadAdmin(): AdminUser | null {
  try {
    const saved = localStorage.getItem('admin_user');
    const token = localStorage.getItem('auth_token');
    if (saved && token) {
      return JSON.parse(saved);
    }
  } catch {}
  return null;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(loadAdmin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!admin && !!localStorage.getItem('auth_token');

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.login({ email, password });
      setAdmin(res.admin);
      return true;
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Login failed';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAdmin(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_user');
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, admin, login, logout, loading, error }}>
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
