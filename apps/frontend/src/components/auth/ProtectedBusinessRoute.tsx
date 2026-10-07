import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../services/auth/hooks';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedBusinessRoute({ children }: Props) {
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const storedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('business_user') : null;
  let storedUserRole: string | null = null;
  if (storedUserRaw) {
    try {
      storedUserRole = JSON.parse(storedUserRaw)?.role ?? null;
    } catch {
      // ignore JSON parse error
    }
  }

  const { data: user, isLoading } = useCurrentUser(!!token);

  if (!token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (isLoading && !storedUserRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = user?.role || storedUserRole;

  // Block customer from business dashboard
  if (role === 'CUSTOMER') {
    return <Navigate to="/customer" replace />;
  }

  // Redirect affiliate roles to 247GBS affiliate portal
  if (role === 'AGENT' || role === 'CONSULTANT' || role === 'ACCOUNT_MANAGER') {
    const affiliateUrl = `${(import.meta.env.VITE_AFFILIATE_PORTAL_URL || 'https://247gbsaffiliates.centralhubsolution.com').replace(/\/$/, '')}/dashboard`;
    window.location.href = affiliateUrl;
    return null;
  }

  return <>{children}</>;
}
