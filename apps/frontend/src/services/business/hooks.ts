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
