import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { getSubscriptionTier } from '../lib/subscriptionTiers';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  max_offers: number;
  max_seats: number;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useOrganization() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchOrganization();
    } else {
      setOrganization(null);
      setMembership(null);
      setLoading(false);
    }
  }, [user]);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();

      if (memberError) throw memberError;
      setMembership(memberData);

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', memberData.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData);
    } catch (err: any) {
      console.error('Error fetching organization:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isTrialExpired = (): boolean => {
    if (!organization?.trial_ends_at) return false;
    return new Date(organization.trial_ends_at) < new Date();
  };

  const isInGracePeriod = (): boolean => {
    if (!organization) return false;
    if (organization.subscription_status !== 'past_due') return false;

    const gracePeriodDays = 14;
    const statusUpdatedAt = new Date(organization.updated_at);
    const gracePeriodEnd = new Date(statusUpdatedAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

    return new Date() < gracePeriodEnd;
  };

  const getDaysLeftInTrial = (): number => {
    if (!organization?.trial_ends_at) return 0;
    const now = new Date();
    const trialEnd = new Date(organization.trial_ends_at);
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const hasActiveAccess = (): boolean => {
    if (!organization) return false;

    if (organization.subscription_status === 'active') return true;

    if (organization.subscription_status === 'trialing' && !isTrialExpired()) return true;

    if (organization.subscription_status === 'past_due' && isInGracePeriod()) return true;

    return false;
  };

  const needsSubscription = (): boolean => {
    if (!organization) return true;
    return !hasActiveAccess();
  };

  const hasFeature = (feature: string): boolean => {
    if (!organization) return false;
    if (!hasActiveAccess()) return false;
    const tier = getSubscriptionTier(organization.subscription_tier);
    return tier.features[feature as keyof typeof tier.features] === true;
  };

  const canCreateOffer = async (): Promise<{ allowed: boolean; message?: string }> => {
    if (!organization) {
      return { allowed: false, message: 'No organization found' };
    }

    if (!hasActiveAccess()) {
      if (isTrialExpired()) {
        return { allowed: false, message: 'Your trial has expired. Please subscribe to continue.' };
      }
      if (organization.subscription_status === 'past_due' && !isInGracePeriod()) {
        return { allowed: false, message: 'Payment failed. Please update your payment method.' };
      }
      return { allowed: false, message: 'Subscription inactive. Please update billing.' };
    }

    if (organization.max_offers === -1) {
      return { allowed: true };
    }

    const { count, error } = await supabase
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .neq('status', 'cancelled');

    if (error) {
      console.error('Error checking offer count:', error);
      return { allowed: false, message: 'Error checking offer limit' };
    }

    if ((count || 0) >= organization.max_offers) {
      return {
        allowed: false,
        message: `Offer limit reached. You have ${count}/${organization.max_offers} active offers. Upgrade to Pro for unlimited offers.`
      };
    }

    return { allowed: true };
  };

  const canAddSeat = (): boolean => {
    if (!organization) return false;
    return organization.max_seats > 1;
  };

  const isOwner = (): boolean => {
    return membership?.role === 'owner';
  };

  const isAdmin = (): boolean => {
    return membership?.role === 'owner' || membership?.role === 'admin';
  };

  const refreshOrganization = () => {
    if (user) {
      fetchOrganization();
    }
  };

  return {
    organization,
    membership,
    loading,
    error,
    hasFeature,
    canCreateOffer,
    canAddSeat,
    isOwner,
    isAdmin,
    refreshOrganization,
    hasActiveAccess,
    needsSubscription,
    isTrialExpired,
    isInGracePeriod,
    getDaysLeftInTrial
  };
}
