import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './index';
import { useNavigate } from 'react-router-dom';

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(['currentUser'], data.user);
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data),
    onSuccess: (data) => {
      queryClient.setQueryData(['currentUser'], data.user);
    },
  });
};

export const useSendOtp = () => {
  return useMutation({
    mutationFn: (email: string) => authApi.sendOtp(email),
  });
};

export const useVerifyOtp = () => {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authApi.verifyOtp(email, code),
  });
};

export const useResendOtp = () => {
  return useMutation({
    mutationFn: (email: string) => authApi.resendOtp(email),
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: (data: ResetPasswordData) => authApi.resetPassword(data),
  });
};

export const usePostSsoAuthorize = () => {
  return useMutation({
    mutationFn: ({ clientId, redirectUri, scope, state }: { clientId: string; redirectUri: string; scope?: string; state?: string }) =>
      authApi.postSsoAuthorize(clientId, redirectUri, scope, state),
  });
};

export const useCurrentUser = (enabled = true) => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authApi.getCurrentUser(),
    staleTime: 1000 * 60 * 5, // 5 minutes — current user profile rarely changes
    retry: false,
    enabled,
  });
};

// Converted to useMutation so errors are thrown as promises (consistent with all other hooks)
// and it can be called imperatively with await / .mutateAsync()
export const useGetSsoToken = () => {
  return useMutation({
    mutationFn: (targetClientId?: string) => authApi.getSsoToken(targetClientId),
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: SettingsUpdateData) => authApi.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return () => {
    authApi.logout();
    queryClient.clear(); // clears all cached queries including ssoToken, currentUser, profile
    navigate('/login');
  };
};

// --- TypeScript interfaces ---

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  businessName?: string;
  businessType?: string;
  country?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface ResetPasswordData {
  email: string;
  code: string;
  newPassword: string;
}

export interface SettingsUpdateData {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
}
