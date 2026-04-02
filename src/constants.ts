import { 
  ShieldCheck, 
  Users, 
  LayoutGrid, 
  ShoppingBag, 
  Gift, 
  Link2,
  LucideIcon 
} from 'lucide-react';

export type ProductType = 'GBS' | 'Mcom';

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  type: ProductType;
  icon: LucideIcon;
  color: string;
  features: string[];
  useCases: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'gbs-loyalty',
    name: '24/7 GBS Loyalty',
    tagline: 'Retain and reward your best customers.',
    description: 'A comprehensive loyalty management system designed for enterprise-scale customer engagement and retention strategies.',
    type: 'GBS',
    icon: Users,
    color: 'bg-blue-500',
    features: [
      'Tiered rewards programs',
      'Omnichannel points tracking',
      'Behavioral analytics',
      'Automated marketing triggers'
    ],
    useCases: [
      'Retail chains',
      'Hospitality groups',
      'E-commerce platforms'
    ]
  },
  {
    id: 'gbs-audit',
    name: '24/7 GBS Audit',
    tagline: 'Precision compliance and financial oversight.',
    description: 'Advanced auditing tools that provide real-time visibility into business operations, ensuring compliance and financial integrity.',
    type: 'GBS',
    icon: ShieldCheck,
    color: 'bg-indigo-600',
    features: [
      'Automated risk assessment',
      'Real-time transaction monitoring',
      'Compliance reporting',
      'Anomaly detection AI'
    ],
    useCases: [
      'Financial institutions',
      'Corporate compliance teams',
      'Internal audit departments'
    ]
  },
  {
    id: 'gbs-expo',
    name: '24/7 GBS Expo',
    tagline: 'Seamless event and exhibition management.',
    description: 'The ultimate platform for managing large-scale exhibitions, trade shows, and corporate events with ease.',
    type: 'GBS',
    icon: LayoutGrid,
    color: 'bg-cyan-500',
    features: [
      'Exhibitor portal',
      'Lead retrieval systems',
      'Interactive floor plans',
      'Attendee engagement tools'
    ],
    useCases: [
      'Event organizers',
      'Trade associations',
      'Convention centers'
    ]
  },
  {
    id: 'mcom-mall',
    name: 'Mcom Mall',
    tagline: 'The future of digital marketplaces.',
    description: 'A multi-vendor marketplace solution that connects brands with consumers in a unified, high-performance shopping environment.',
    type: 'Mcom',
    icon: ShoppingBag,
    color: 'bg-sky-500',
    features: [
      'Multi-vendor management',
      'Unified checkout system',
      'Advanced search & filtering',
      'Vendor analytics dashboard'
    ],
    useCases: [
      'Digital mall operators',
      'Niche marketplaces',
      'Brand aggregators'
    ]
  },
  {
    id: 'mcom-rewards',
    name: 'Mcom Rewards',
    tagline: 'Incentivize every interaction.',
    description: 'A flexible rewards engine that powers micro-incentives and gamified experiences across the Mcom ecosystem.',
    type: 'Mcom',
    icon: Gift,
    color: 'bg-blue-400',
    features: [
      'Gamification engine',
      'Instant reward fulfillment',
      'Social sharing incentives',
      'Cross-platform points'
    ],
    useCases: [
      'Mobile apps',
      'Consumer brands',
      'Community platforms'
    ]
  },
  {
    id: 'mcomq-link',
    name: 'McomQ Link',
    tagline: 'Connect your business to the world.',
    description: 'A powerful integration layer that bridges disparate systems and enables seamless data flow across business units.',
    type: 'Mcom',
    icon: Link2,
    color: 'bg-blue-700',
    features: [
      'API-first architecture',
      'Real-time data syncing',
      'Custom webhook support',
      'Secure data tunneling'
    ],
    useCases: [
      'System integrators',
      'Enterprise IT',
      'SaaS providers'
    ]
  }
];
