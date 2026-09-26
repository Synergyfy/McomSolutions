export interface FeatureKeyMeta {
  key: string;
  label: string;
  description: string;
  targetAudience: 'BUSINESS' | 'CUSTOMER' | 'BOTH';
  category: 'onboarding' | 'engagement' | 'commerce' | 'identity';
}

export const CENTRAL_FEATURE_KEYS: FeatureKeyMeta[] = [
  {
    key: 'business.logo_uploaded',
    label: 'Upload Business Logo',
    description: 'Triggered when a business uploads or updates their official logo',
    targetAudience: 'BUSINESS',
    category: 'identity',
  },
  {
    key: 'business.profile_completed',
    label: 'Complete Business Profile',
    description: 'Triggered when all primary business details (name, sector, phone, address) are filled',
    targetAudience: 'BUSINESS',
    category: 'onboarding',
  },
  {
    key: 'business.social_linked',
    label: 'Connect Social Media',
    description: 'Triggered when social media links (Instagram, Facebook, LinkedIn, etc.) are added',
    targetAudience: 'BUSINESS',
    category: 'engagement',
  },
  {
    key: 'business.opening_hours_set',
    label: 'Set Opening Hours',
    description: 'Triggered when the business sets their operating timetable',
    targetAudience: 'BUSINESS',
    category: 'onboarding',
  },
  {
    key: 'business.google_verified',
    label: 'Connect Google Business',
    description: 'Triggered when Google Business profile is linked and verified',
    targetAudience: 'BUSINESS',
    category: 'identity',
  },
  {
    key: 'business.membership_purchased',
    label: 'Activate Business Membership',
    description: 'Triggered when a business upgrades or purchases an ecosystem membership',
    targetAudience: 'BUSINESS',
    category: 'commerce',
  },
  {
    key: 'customer.profile_completed',
    label: 'Complete Customer Profile',
    description: 'Triggered when a customer completes their account information',
    targetAudience: 'CUSTOMER',
    category: 'onboarding',
  },
  {
    key: 'customer.membership_purchased',
    label: 'Activate Customer Membership',
    description: 'Triggered when a customer acquires an active membership package',
    targetAudience: 'CUSTOMER',
    category: 'commerce',
  },
];
