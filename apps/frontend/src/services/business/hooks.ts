import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { businessApi } from './index';
import { apiClient } from '../api';
import type { CreateSupportTicket } from '../../types/contracts';

export const useProfile = (enabled = true) => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => businessApi.getProfile(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled,
  });
};

/**
 * Public programme access policy. Used by the product directory to work out
 * whether a business is still inside its free trial window.
 */
export const useProgrammeAccessPolicy = (enabled = true) => {
  return useQuery({
    queryKey: ['programme-access-policy'],
    queryFn: async () => {
      const res = await apiClient.get('/programme/settings');
      return res.data?.data ?? res.data ?? {};
    },
    staleTime: 1000 * 60 * 5,
    enabled,
    retry: false,
  });
};

export const useMyCoupons = () => {
  return useQuery({
    queryKey: ['my-coupons'],
    queryFn: () => businessApi.getMyCoupons(),
    staleTime: 0,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: any) => businessApi.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useGenerateApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => businessApi.generateApiKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useSearchAddress = () => {
  return useMutation({
    mutationFn: (postcode: string) => businessApi.searchAddress(postcode),
  });
};

export const useCheckLocation = () => {
  return useMutation({
    mutationFn: (postcode: string) => businessApi.checkLocation(postcode),
  });
};

export const useSearchGoogleBusinesses = () => {
  return useMutation({
    mutationFn: ({ queryText, radius }: { queryText: string; radius?: number }) =>
      businessApi.searchGoogleBusinesses(queryText, radius),
  });
};

export const useGooglePlaceDetails = () => {
  return useMutation({
    mutationFn: (placeId: string) => businessApi.getGooglePlaceDetails(placeId),
  });
};

export const useStartClaim = () => {
  return useMutation({
    mutationFn: ({ placeId, returnUrl }: { placeId: string; returnUrl: string }) =>
      businessApi.startClaim(placeId, returnUrl),
  });
};

export const useMapGoogleCategory = () => {
  return useMutation({
    mutationFn: (googleCategoryId: string) => businessApi.mapGoogleCategory(googleCategoryId),
  });
};

export const useCompleteGoogleOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => businessApi.completeGoogleOnboarding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useAllBusinesses = (searchQuery?: string, enabled = true) => {
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('auth_token'));
  return useQuery({
    queryKey: ['businesses', searchQuery],
    queryFn: () => businessApi.getAllBusinesses(searchQuery),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: Boolean(enabled && hasToken),
    retry: false,
  });
};

export const useBusinessById = (id: string) => {
  return useQuery({
    queryKey: ['business', id],
    queryFn: () => businessApi.getBusinessById(id),
    enabled: !!id,
  });
};

export const useDeleteBusiness = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.deleteBusiness(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
};

export const useMyTasks = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => businessApi.getMyTasks(),
    enabled: !!token,
    staleTime: 1000 * 30, // 30 seconds
    // Delegated programme tasks are completed by the affiliate/admin review
    // chain. Poll so the business dashboard reflects that completion promptly.
    refetchInterval: 1000 * 10,
    refetchOnWindowFocus: true,
  });
};

export const useStartMyTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => businessApi.startMyTask(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
};

export const useCompleteMyTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, submissionData }: { assignmentId: string; submissionData?: any }) =>
      businessApi.completeMyTask(assignmentId, submissionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-programme'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
};

export const useMyProgramme = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['my-programme'],
    queryFn: () => businessApi.getMyProgramme(),
    enabled: !!token,
    staleTime: 1000 * 30,
  });
};

export const useCompleteMission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (missionId: string) => businessApi.completeMission(missionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-programme'] });
      queryClient.invalidateQueries({ queryKey: ['programmeBusinesses'] });
    },
  });
};

export const useProgrammePhases = () => {
  return useQuery({
    queryKey: ['programme-phases'],
    queryFn: () => businessApi.getProgrammePhases(),
    staleTime: 1000 * 60 * 10,
  });
};

export const useUploadBusinessFile = () => {
  return useMutation({
    mutationFn: (file: File) => businessApi.uploadFile(file),
  });
};

export const useEcosystemApps = (enabled = true) => {
  return useQuery({
    queryKey: ['ecosystem-apps'],
    queryFn: () => businessApi.getEcosystemApps(),
    staleTime: 1000 * 60, // 1 minute
    enabled,
  });
};

export const useSupportTickets = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['my-support-tickets'],
    queryFn: () => businessApi.getSupportTickets(),
    enabled: !!token,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useCreateSupportTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupportTicket) =>
      businessApi.createSupportTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
    },
  });
};





// ─── Account manager + delegated tasks ─────────────────────────────────
export const useAccountManager = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['account-manager'],
    queryFn: () => businessApi.getAccountManager(),
    enabled: !!token,
    staleTime: 1000 * 60,
  });
};

export const useReassignAccountManager = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => businessApi.reassignAccountManager(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-manager'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
};

export const usePlatformAccess = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['business-platform-access'],
    queryFn: () => businessApi.getPlatformAccess(),
    enabled: !!token,
    staleTime: 1000 * 60,
  });
};

export const useDelegationQuota = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['business-delegation-quota'],
    queryFn: () => businessApi.getTaskQuota(),
    enabled: !!token,
    staleTime: 1000 * 15,
  });
};

export const useNearbyAffiliates = (params?: {
  role?: string;
  page?: number;
  limit?: number;
  postcode?: string;
  skill?: string;
  radiusMiles?: number;
  availableOnly?: string;
}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['nearby-affiliates', params],
    queryFn: () => businessApi.getNearbyAffiliates(params),
    enabled: !!token,
    staleTime: 1000 * 60,
  });
};

export const useAffiliateTasks = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  platform?: string;
  search?: string;
  category?: string;
  projectId?: string;
}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['affiliate-tasks', params],
    queryFn: () => businessApi.getAffiliateTasks(params),
    enabled: !!token,
    staleTime: 1000 * 15,
  });
};

export const useCreateAffiliateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof businessApi.createAffiliateTask>[0]) =>
      businessApi.createAffiliateTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['account-manager'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-projects'] });
      queryClient.invalidateQueries({ queryKey: ['business-delegation-quota'] });
    },
  });
};

export const useLockAffiliateTaskFunds = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.lockAffiliateTaskFunds(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['account-manager'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['business-delegation-quota'] });
    },
  });
};

export const useReviewAffiliateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { decision: 'APPROVED' | 'CHANGES_REQUESTED'; notes?: string; acceptanceNotes?: string };
    }) => businessApi.reviewAffiliateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-projects'] });
    },
  });
};

export const useReviewAffiliateTaskCharge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { decision: 'APPROVED' | 'DECLINED'; notes?: string };
    }) => businessApi.reviewAffiliateTaskCharge(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-tasks'] });
    },
  });
};

// ─── Service requests ─────────────────────────────────────────────────
export const useServiceRequests = (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['service-requests', params],
    queryFn: () => businessApi.getServiceRequests(params),
    enabled: !!token,
    staleTime: 1000 * 15,
  });
};

export const useCreateServiceRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof businessApi.createServiceRequest>[0]) =>
      businessApi.createServiceRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    },
  });
};

export const useApproveServiceRequestPrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { estimatedCost?: number; currency?: string; notes?: string };
    }) => businessApi.approveServiceRequestPrice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    },
  });
};

// ─── Projects ─────────────────────────────────────────────────────────
export const useAffiliateProjects = (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery({
    queryKey: ['affiliate-projects', params],
    queryFn: () => businessApi.getProjects(params),
    enabled: !!token,
    staleTime: 1000 * 15,
  });
};

export const useCreateAffiliateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof businessApi.createProject>[0]) =>
      businessApi.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-projects'] });
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    },
  });
};

export const useCloseAffiliateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { outcomeSummary: string; followUpNotes?: string; followUpRequired?: boolean };
    }) => businessApi.closeProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-projects'] });
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    },
  });
};

export const useCancelAffiliateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.cancelAffiliateTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['business-delegation-quota'] });
    },
  });
};

export const useReassignAffiliateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof businessApi.reassignAffiliateTask>[1];
    }) => businessApi.reassignAffiliateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['business-delegation-quota'] });
    },
  });
};

export const useRateAffiliate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { rating: number; comment?: string } }) =>
      businessApi.rateAffiliate(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-manager'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-affiliates'] });
    },
  });
};

export const useReportAffiliate = () => {
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: { reason: string; description: string };
    }) => businessApi.reportAffiliate(userId, data),
  });
};
