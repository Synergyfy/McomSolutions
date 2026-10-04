/**
 * Phase 4: frontend mirrors of backend DTOs (McomSolutions backend src/.../dto).
 * Shapes must stay in sync — backend validates with class-validator
 * (whitelist + forbidNonWhitelisted), so extra fields are rejected with 400.
 */

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

export interface MembershipInitiate {
  level: string;
  tier: string;
  billing: BillingCycle;
  /** Legacy trial flag — tolerated by the backend but ignored (trials discontinued). */
  isTrial?: boolean;
}

export interface StripeConfirm extends MembershipInitiate {
  paymentIntentId: string;
}

export interface PaypalInitiate extends MembershipInitiate {
  returnUrl: string;
  cancelUrl: string;
}

export interface PlatformConfirm {
  platform: string;
  externalPlanId: string;
  billingCycle: string;
  paymentIntentId?: string;
  setupIntentId?: string;
}

export interface PlatformPurchase {
  platform: string;
  externalPlanId: string;
  billingCycle: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreateSupportTicket {
  subject: string;
  message: string;
  priority?: 'Low' | 'Medium' | 'High';
}

export interface ClaimStart {
  placeId: string;
  returnUrl?: string;
}

export interface BusinessQuery {
  search?: string;
  page?: number;
  limit?: number;
}
