import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../services/auth/hooks';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedCustomerRoute({ children }: Props) {
  const location = useLocation();
  // Explicit local UI preview. The DEV check ensures this switch can never
  // disable customer authentication in a production build.
  const customerPreview = import.meta.env.DEV
    && typeof window !== 'undefined'
    && localStorage.getItem('chs_customer_dashboard_preview') === 'true';
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const storedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('business_user') : null;
  let storedUserRole: string | null = null;
  if (storedUserRaw) {
    try {
      storedUserRole = JSON.parse(storedUserRaw)?.role ?? null;
    } catch {
      // ignore
    }
  }

  const { data: user, isLoading } = useCurrentUser(!!token && !customerPreview);
  const role = user?.role || storedUserRole;

  if (customerPreview) {
    return <>{children}</>;
  }

  if (!token) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (isLoading && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  // Block business users from customer area and redirect to business dashboard
  if (role === 'BUSINESS' || role === 'OWNER') {
    return <Navigate to="/dashboard" replace />;
  }

  if (role !== 'CUSTOMER') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
