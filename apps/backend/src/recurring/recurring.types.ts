/** Parameters for creating a recurring membership mandate at checkout. */
export interface MembershipRecurringInput {
  businessId: string;
  userId?: string;
  email?: string;
  level: string;
  tier: string;
  planId: string;
  planName: string;
  /** Amount charged every interval (GBP). */
  amount: number;
  /** Real access term the plan grants, in days (90 / 180 / 365). */
  durationDays: number;
  billingCycle: string;
}

/** Parameters for creating a recurring platform-package mandate. */
export interface PlatformRecurringInput {
  businessId: string;
  userId?: string;
  email?: string;
  platform: string;
  externalPlanId: string;
  planName: string;
  amount: number;
  /** monthly | quarterly | annual */
  billingCycle: string;
  /** Optional explicit access term; derived from billingCycle when absent. */
  durationDays?: number;
  stripePriceId?: string;
  paypalPlanId?: string;
}

export interface StripeMandateResult {
  subscriptionId: string;
  paymentIntentId?: string;
  clientSecret?: string;
}

export interface PayPalMandateResult {
  subscriptionId: string;
  approvalUrl?: string;
}

export interface MandatePeriod {
  periodStart: Date;
  periodEnd: Date;
}

export interface ChargeEvidence {
  amount: number;
  providerInvoiceId?: string | null;
  providerPaymentId?: string | null;
}
