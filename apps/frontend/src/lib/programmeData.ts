import { Building2, Globe, Gift, Dices, Users, FileSearch, Shield } from 'lucide-react';

export interface ProgrammePhase {
  id: string;
  name: string;
  dayStart: number;
  dayEnd: number;
  description: string;
  icon: any;
  color: string;
  missions: ProgrammeMission[];
}

export type SubmissionType = 'internal_platform' | 'external_link' | 'image_upload' | 'text_input' | 'digit_input';

export interface ProgrammeMission {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  reward: string;
  submissionType?: SubmissionType;
  platformType?: 'internal' | 'external';
  system?: string;
  systemUrl?: string;
  instructions?: string;
  ctaLabel?: string;
}

export const PROGRAMME_PHASES: ProgrammePhase[] = [
  {
    id: 'foundation',
    name: 'Business Foundation',
    dayStart: 1,
    dayEnd: 7,
    description: 'Verify identity, upload assets, confirm details, activate referral profile.',
    icon: Shield,
    color: 'orange',
    missions: [
      { id: 'verify-identity', title: 'Business Verification & Profile Foundation', description: 'Verify business identity and contact details.', estimatedMinutes: 15, reward: '+50 points', submissionType: 'internal_platform' },
      { id: 'upload-logo', title: 'Upload Logo & Brand Assets', description: 'Upload your logo and brand assets (or request assistance).', estimatedMinutes: 10, reward: '+30 points', submissionType: 'internal_platform' },
      { id: 'confirm-sector', title: 'Confirm Sector & Opening Hours', description: 'Confirm your sector/category and opening hours.', estimatedMinutes: 5, reward: '+20 points', submissionType: 'internal_platform' },
      { id: 'activate-referral', title: 'Activate Referral Profile', description: 'Activate your 247GBS Affiliates referral profile (automatic).', estimatedMinutes: 2, reward: '+25 points', submissionType: 'internal_platform' },
      { id: 'generate-qr', title: 'Generate QR & Smart Links', description: 'Generate your MCOM QLinks for customer engagement.', estimatedMinutes: 5, reward: '+25 points', submissionType: 'internal_platform' },
    ],
  },
  {
    id: 'digital-presence',
    name: 'Digital Presence',
    dayStart: 8,
    dayEnd: 21,
    description: 'Create storefront, add products, publish offers.',
    icon: Globe,
    color: 'sky',
    missions: [
      { id: 'create-storefront', title: 'Create Storefront', description: 'Create your storefront and business description.', estimatedMinutes: 20, reward: '+100 points', submissionType: 'internal_platform', system: 'MCOM Mall' },
      { id: 'add-products', title: 'Add Products & Services', description: 'Add products/services, photos, categories, pricing.', estimatedMinutes: 30, reward: '+150 points', submissionType: 'internal_platform', system: 'MCOM Mall' },
      { id: 'publish-offers', title: 'Publish Initial Offers', description: 'Publish initial offers/promotions.', estimatedMinutes: 15, reward: '+75 points', submissionType: 'internal_platform', system: 'MCOM Mall' },
    ],
  },
  {
    id: 'customer-retention',
    name: 'Customer Retention',
    dayStart: 22,
    dayEnd: 35,
    description: 'Create rewards programme, configure welcome offer, connect QR links.',
    icon: Gift,
    color: 'amber',
    missions: [
      { id: 'create-rewards', title: 'Create Rewards Programme', description: 'Create your points/rewards programme.', estimatedMinutes: 20, reward: '+100 points', submissionType: 'internal_platform', system: 'MCOM Rewards' },
      { id: 'configure-welcome', title: 'Configure Welcome Offer', description: 'Configure welcome offer and customer benefits.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: 'MCOM Rewards' },
      { id: 'connect-qr-rewards', title: 'Connect QR Links to Rewards', description: 'Connect your QR links to rewards journeys.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: 'MCOM Rewards' },
    ],
  },
  {
    id: 'engagement-capture',
    name: 'Engagement & Capture',
    dayStart: 36,
    dayEnd: 49,
    description: 'Create Spin campaign, configure Hotspot, test customer journeys.',
    icon: Dices,
    color: 'rose',
    missions: [
      { id: 'create-spin', title: 'Create Spin Campaign', description: 'Create your MCOM Spin campaign.', estimatedMinutes: 15, reward: '+75 points', submissionType: 'internal_platform', system: 'MCOM Spin' },
      { id: 'configure-hotspot', title: 'Configure Hotspot/Wi-Fi', description: 'Configure Hotspot/Wi-Fi customer capture if applicable.', estimatedMinutes: 15, reward: '+50 points', submissionType: 'internal_platform', system: 'MCOM Hotspot' },
      { id: 'test-journeys', title: 'Test Customer Journeys', description: 'Test customer journeys and data capture.', estimatedMinutes: 10, reward: '+25 points', submissionType: 'internal_platform' },
    ],
  },
  {
    id: 'network-visibility',
    name: 'Network & Visibility',
    dayStart: 50,
    dayEnd: 63,
    description: 'Invite businesses, join community activities, prepare Expo profile.',
    icon: Users,
    color: 'violet',
    missions: [
      { id: 'invite-businesses', title: 'Invite Other Businesses', description: 'Invite other businesses via referral tools.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: '247GBS Affiliates' },
      { id: 'join-community', title: 'Join Community Activities', description: 'Join borough/community activities and leaderboard challenges.', estimatedMinutes: 15, reward: '+75 points', submissionType: 'internal_platform', system: '247GBS Expo' },
      { id: 'prepare-expo', title: 'Prepare Expo Profile', description: 'Prepare your Expo/networking profile if eligible.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: '247GBS Expo' },
    ],
  },
  {
    id: 'audit-readiness',
    name: 'Audit Readiness & Audit',
    dayStart: 64,
    dayEnd: 90,
    description: 'Complete all assets, invite accountant, complete sector audit, receive recommendations.',
    icon: FileSearch,
    color: 'emerald',
    missions: [
      { id: 'ensure-complete', title: 'Ensure Profile & Assets Complete', description: 'Ensure profile, storefront, rewards, and assets are complete.', estimatedMinutes: 20, reward: '+100 points', submissionType: 'internal_platform' },
      { id: 'invite-accountant', title: 'Invite Accountant', description: 'Invite accountant if needed for financial sections.', estimatedMinutes: 5, reward: '+25 points', submissionType: 'internal_platform' },
      { id: 'complete-audit', title: 'Complete Business Audit', description: 'Complete the sector-specific audit.', estimatedMinutes: 30, reward: '+200 points', submissionType: 'internal_platform', system: '247GBS Audit' },
      { id: 'review-submit', title: 'Review & Submit', description: 'Review, submit, and receive your Executive Summary and Recommendations.', estimatedMinutes: 15, reward: '+100 points', submissionType: 'internal_platform', system: '247GBS Audit' },
    ],
  },
];

export function getPhaseForDay(day: number): ProgrammePhase | null {
  return PROGRAMME_PHASES.find(p => day >= p.dayStart && day <= p.dayEnd) || null;
}

export function getProgressForDay(day: number): number {
  if (day <= 1) return 0;
  if (day >= 90) return 100;
  return Math.round((day / 90) * 100);
}

export function getTotalMissions(): number {
  return PROGRAMME_PHASES.reduce((sum, p) => sum + p.missions.length, 0);
}

// ─── Business Task Status Tracking ───────────────

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

export function getTaskStatuses(): Record<string, TaskStatus> {
  try {
    const saved = localStorage.getItem('businessTaskStatuses');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

export function setTaskStatus(taskId: string, status: TaskStatus): void {
  const statuses = getTaskStatuses();
  statuses[taskId] = status;
  localStorage.setItem('businessTaskStatuses', JSON.stringify(statuses));
}

export function getTaskStatus(taskId: string): TaskStatus {
  return getTaskStatuses()[taskId] || 'not_started';
}

export function resetAllTaskStatuses(): void {
  localStorage.removeItem('businessTaskStatuses');
}
