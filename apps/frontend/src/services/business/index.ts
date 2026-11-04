import { apiClient, setSharedAuthCookies } from '../api';
import { clearStoredReferralCode, withReferralCode } from '../../lib/referral';
import type { CreateSupportTicket } from '../../types/contracts';

export interface MyCouponRedemption {
  id: string;
  redeemedAt: string | null;
  discountAmount: number;
  finalAmount: number;
  planName: string | null;
}

export interface MyCoupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  appliesToAllMemberships: boolean;
  membershipPlans: string[];
  appliesToAllAccess: boolean;
  accessPlans: string[];
  validFrom: string;
  expiresAt: string | null;
  source: 'ADMIN' | 'TASK_REWARD';
  isPersonal: boolean;
  couponStatus: 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';
  usageStatus: 'available' | 'partially_used' | 'used' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';
  used: boolean;
  usedCount: number;
  maxUsesPerUser: number | null;
  canUse: boolean;
  lastUsedAt: string | null;
  totalSaved: number;
  redemptions: MyCouponRedemption[];
}

export const businessApi = {
  searchAddress: async (postcode: string) => {
    const res = await apiClient.get(`/business/search-address?postcode=${encodeURIComponent(postcode)}`);
    return res.data;
  },

  checkLocation: async (postcode: string) => {
    const res = await apiClient.post('/localmall/onboarding/check-location', { postcode });
    return res.data;
  },

  searchGoogleBusinesses: async (
    queryText: string,
    radius: number = 5,
    lat?: number | null,
    lng?: number | null,
  ) => {
    const params = new URLSearchParams({
      queryText,
      radius: String(radius),
    });
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      params.append('lat', String(lat));
      params.append('lng', String(lng));
    }
    const res = await apiClient.get(`/google/google-business?${params.toString()}`);
    return res.data;
  },

  getGooglePlaceDetails: async (placeId: string) => {
    const res = await apiClient.get(`/google/google-business/${placeId}`);
    return res.data;
  },

  startClaim: async (placeId: string, returnUrl: string) => {
    const res = await apiClient.post('/claim/start', { placeId, returnUrl });
    return res.data;
  },

  mapGoogleCategory: async (googleCategoryId: string) => {
    const res = await apiClient.get(`/google-business/map-category?googleCategoryId=${encodeURIComponent(googleCategoryId)}`);
    return res.data;
  },

  completeGoogleOnboarding: async (data: any) => {
    const res = await apiClient.post('/google-business/complete-onboarding', data);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('business_user', JSON.stringify(res.data.user));
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken ?? null, res.data.user);
    }
    return res.data;
  },

  getProfile: async () => {
    const res = await apiClient.get('/business/profile');
    return res.data;
  },

  getMyCoupons: async (): Promise<{ success: boolean; data: MyCoupon[] }> => {
    const res = await apiClient.get('/coupons/my');
    return res.data;
  },

  updateProfile: async (updates: any) => {
    const res = await apiClient.put('/business/profile', updates);
    return res.data;
  },

  generateApiKey: async () => {
    const res = await apiClient.post('/business/api-key');
    return res.data;
  },

  getAllBusinesses: async (searchQuery?: string) => {
    const url = searchQuery ? `/business?search=${encodeURIComponent(searchQuery)}` : '/business';
    const res = await apiClient.get(url);
    return res.data;
  },

  getBusinessById: async (id: string) => {
    const res = await apiClient.get(`/business/${id}`);
    return res.data;
  },

  deleteBusiness: async (id: string) => {
    const res = await apiClient.delete(`/business/${id}`);
    return res.data;
  },

  register: async (data: any) => {
    const res = await apiClient.post('/auth/register', withReferralCode(data));
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      if (res.data?.user) {
        localStorage.setItem('business_user', JSON.stringify(res.data.user));
      }
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken ?? null, res.data.user);
      clearStoredReferralCode();
    }
    return res.data;
  },

  login: async (data: any) => {
    const res = await apiClient.post('/auth/login', data);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      if (res.data?.user) {
        localStorage.setItem('business_user', JSON.stringify(res.data.user));
      }
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken ?? null, res.data.user);
    }
    return res.data;
  },

  sendOtp: async (email: string) => {
    const res = await apiClient.post('/auth/send-otp', { email });
    return res.data;
  },

  verifyOtp: async (email: string, code: string) => {
    const res = await apiClient.post('/auth/verify-otp', { email, code });
    return res.data;
  },

  getMyTasks: async () => {
    const res = await apiClient.get('/programme/my-tasks');
    return res.data;
  },

  startMyTask: async (assignmentId: string) => {
    const res = await apiClient.patch(`/programme/my-tasks/${assignmentId}/start`);
    return res.data;
  },

  completeMyTask: async (assignmentId: string, submissionData?: any) => {
    const res = await apiClient.post(`/programme/my-tasks/${assignmentId}/complete`, { submissionData });
    return res.data;
  },

  // 90-Day Programme
  getMyProgramme: async () => {
    const res = await apiClient.get('/programme/my-programme');
    return res.data;
  },

  completeMission: async (missionId: string) => {
    const res = await apiClient.put(`/programme/my-programme/missions/${missionId}/complete`);
    return res.data;
  },

  getProgrammePhases: async () => {
    const res = await apiClient.get('/programme/phases');
    return res.data;
  },

  uploadFile: async (file: File) => {
    const data = new FormData();
    data.append('file', file);
    const res = await apiClient.post('/business/upload', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  getEcosystemApps: async () => {
    const res = await apiClient.get('/apps');
    return res.data;
  },

  getSupportTickets: async () => {
    const res = await apiClient.get('/business/support-tickets');
    return res.data;
  },

  createSupportTicket: async (data: CreateSupportTicket) => {
    const res = await apiClient.post('/business/support-tickets', data);
    return res.data;
  },

  // ─── Account manager + delegated tasks ──────────────────────────────
  getAccountManager: async () => {
    const res = await apiClient.get('/business/affiliate/account-manager');
    return res.data;
  },

  reassignAccountManager: async () => {
    const res = await apiClient.post('/business/affiliate/account-manager/reassign');
    return res.data;
  },

  getPlatformAccess: async () => {
    const res = await apiClient.get('/business/affiliate/platform-access');
    return res.data;
  },

  getNearbyAffiliates: async (params?: {
    role?: string;
    page?: number;
    limit?: number;
    postcode?: string;
    skill?: string;
  }) => {
    const res = await apiClient.get('/business/affiliate/affiliates', { params });
    return res.data;
  },

  getAffiliateTasks: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    source?: string;
    platform?: string;
    search?: string;
  }) => {
    const res = await apiClient.get('/business/affiliate/tasks', { params });
    return res.data;
  },

  getAffiliateTask: async (id: string) => {
    const res = await apiClient.get(`/business/affiliate/tasks/${id}`);
    return res.data;
  },

  createAffiliateTask: async (data: {
    title: string;
    description: string;
    platforms?: string[];
    taskDefinitionId?: string;
    assignmentId?: string;
    assigneeUserId?: string;
    dueAt?: string;
  }) => {
    const res = await apiClient.post('/business/affiliate/tasks', data);
    return res.data;
  },

  cancelAffiliateTask: async (id: string) => {
    const res = await apiClient.post(`/business/affiliate/tasks/${id}/cancel`);
    return res.data;
  },

  rateAffiliate: async (userId: string, data: { rating: number; comment?: string }) => {
    const res = await apiClient.post(`/business/affiliate/affiliates/${userId}/rating`, data);
    return res.data;
  },

  reportAffiliate: async (userId: string, data: { reason: string; description: string }) => {
    const res = await apiClient.post(`/business/affiliate/affiliates/${userId}/report`, data);
    return res.data;
  },
};

// ─── Account manager / delegated task types ────────────────────────────
export interface AccountManagerInfo {
  userId: string;
  profileId: string;
  name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  assignedAt: string | null;
  reputationScore: number;
  experienceScore: number;
  completedTasksCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  matchedLevel: string | null;
  proximityScore: number | null;
}

export interface PlatformAccessItem {
  key: string;
  name: string;
  platformSlug: string | null;
  clientId: string | null;
}

export interface NearbyAffiliate {
  userId: string;
  profileId: string;
  name: string;
  email: string;
  role: 'AGENT' | 'ACCOUNT_MANAGER' | 'CONSULTANT';
  specialisation: string | null;
  skills: string[];
  languages: string[];
  postcode: string | null;
  reputationScore: number;
  experienceScore: number;
  completedTasksCount: number;
  assignedBusinesses: number;
  proximity: {
    matchedLevel: string;
    score: number;
    breakdown: Record<string, number | string>;
  };
  distance: {
    km: number | null;
    miles: number | null;
    label: string;
    source: 'postcode' | 'estimated' | 'unavailable';
    reason?:
      | 'BUSINESS_POSTCODE_MISSING'
      | 'AFFILIATE_POSTCODE_MISSING'
      | 'GEOCODE_FAILED'
      | null;
  };
}

export interface AffiliateTaskAttachment {
  id: string;
  url: string;
  fileName: string | null;
  mimeType: string | null;
  kind: string;
  createdAt: string;
}

export interface AffiliateTaskReview {
  id: string;
  round: number;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  notes: string | null;
  reviewedAt: string;
  acknowledgedAt: string | null;
}

export interface AffiliateTaskRecord {
  id: string;
  businessId: string;
  source: 'PROGRAMME' | 'MANUAL';
  taskDefinitionId: string | null;
  title: string;
  description: string;
  platforms: string[];
  status:
    | 'PENDING_ASSIGNMENT'
    | 'ASSIGNED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'REVISION_REQUESTED'
    | 'COMPLETED'
    | 'DECLINED'
    | 'CANCELLED';
  assigneeId: string | null;
  assignee?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  } | null;
  business?: { id: string; businessName: string; email: string; userId?: string };
  taskDefinition?: { id: string; title: string } | null;
  dueAt: string | null;
  submissionData: Record<string, unknown> | null;
  revisionCount: number;
  completedAt: string | null;
  lastSyncError: string | null;
  attachments?: AffiliateTaskAttachment[];
  reviews?: AffiliateTaskReview[];
  createdAt: string;
  updatedAt: string;
}

