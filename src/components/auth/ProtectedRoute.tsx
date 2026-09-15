import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../hooks/useOrganization';
import { SubscriptionRequired } from '../SubscriptionRequired';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading, hasActiveAccess } = useOrganization();
  const location = useLocation();

  const allowedWithoutSubscription = ['/pricing', '/checkout', '/success', '/subscription'];
  const isAllowedPath = allowedWithoutSubscription.some(path => location.pathname.startsWith(path));

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1113]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#C4FF0D]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!organization) {
    return <SubscriptionRequired />;
  }

  if (!isAllowedPath && !hasActiveAccess()) {
    return <SubscriptionRequired />;
  }

  return <>{children}</>;
}