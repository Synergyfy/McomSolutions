import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../../services/auth/hooks';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedCustomerRoute({ children }: Props) {
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

  const { data: user } = useCurrentUser(!!token);
  const role = user?.role || storedUserRole;

  // Block business users from customer area and redirect to business dashboard
  if (role === 'BUSINESS' || role === 'OWNER') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
