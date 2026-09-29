import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { businessApi } from './index';

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => businessApi.getProfile(),
    staleTime: 1000 * 60 * 5, // 5 minutes
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

export const useAllBusinesses = (searchQuery?: string) => {
  return useQuery({
    queryKey: ['businesses', searchQuery],
    queryFn: () => businessApi.getAllBusinesses(searchQuery),
    staleTime: 1000 * 60 * 2, // 2 minutes
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

export const useEcosystemApps = () => {
  return useQuery({
    queryKey: ['ecosystem-apps'],
    queryFn: () => businessApi.getEcosystemApps(),
    staleTime: 1000 * 60, // 1 minute
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
    mutationFn: (data: { subject: string; message: string; priority?: string }) =>
      businessApi.createSupportTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
    },
  });
};




