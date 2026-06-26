import { useMutation } from "@tanstack/react-query";
import affiliateApiClient from "../lib/affiliateApiClient";
import { useAffiliateAuthStore } from "../store/useAffiliateAuthStore";
import { useNavigate } from "react-router-dom";

export const useAffiliateAuth = () => {
  const navigate = useNavigate();
  const { setAuth, clearAuth, user, isAuthenticated } = useAffiliateAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password?: string }) => {
      const response = await affiliateApiClient.post("/auth/login", credentials);
      return response.data;
    },
    onSuccess: (data) => {
      let accessToken = data.access_token || data.accessToken;
      let user = data.user;

      // If backend only returns { access_token }, decode the JWT to get the user
      if (!user && accessToken) {
        try {
          const base64Url = accessToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const decoded = JSON.parse(jsonPayload);
          
          user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || decoded.email?.split('@')[0] || "User",
            isOnboarded: decoded.isOnboarded || false,
          };
        } catch (e) {
          console.error("Failed to decode token", e);
        }
      }

      setAuth(user, accessToken);
      if (user?.role) {
        navigate(`/dashboard/${user.role.toLowerCase().replace('_', '-')}`);
      } else {
        navigate("/dashboard/agent"); // fallback
      }
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await affiliateApiClient.post("/auth/register", userData);
      return response.data;
    },
    onSuccess: (data) => {
      let accessToken = data.access_token || data.accessToken;
      let user = data.user;

      if (accessToken) {
        if (!user) {
          try {
            const base64Url = accessToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const decoded = JSON.parse(jsonPayload);
            
            user = {
              id: decoded.sub || decoded.id,
              email: decoded.email,
              role: decoded.role,
              name: decoded.name || decoded.email?.split('@')[0] || "User",
              isOnboarded: decoded.isOnboarded || false,
            };
          } catch (e) {
            console.error("Failed to decode token", e);
          }
        }
        setAuth(user, accessToken);
        if (user?.role) {
          navigate(`/dashboard/${user.role.toLowerCase().replace('_', '-')}`);
        } else {
          navigate("/dashboard/agent");
        }
      } else {
        navigate("/login");
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return Promise.resolve();
    },
    onSuccess: () => {
      clearAuth();
      navigate("/login");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await affiliateApiClient.delete("/users/me");
      return response.data;
    },
    onSuccess: () => {
      clearAuth();
      navigate("/");
    },
  });

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    signup: signupMutation.mutateAsync,
    isSigningUp: signupMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeletingAccount: deleteAccountMutation.isPending,
    loginError: loginMutation.error,
    signupError: signupMutation.error,
  };
};
