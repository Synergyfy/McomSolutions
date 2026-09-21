import { apiClient } from '../services/api';

/**
 * Affiliate API requests are unified through McomSolutions central apiClient
 * to ensure all requests hit the production API URL (VITE_API_URL) with standard
 * authentication, headers, and credentials.
 */
export const affiliateApiClient = apiClient;
export default apiClient;

