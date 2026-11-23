import { apiClient } from '../api';

export interface LocalMallHierarchyNode {
  id: string;
  name: string;
}

export interface LocalMallDetails extends LocalMallHierarchyNode {
  slug: string | null;
  status: string | null;
  postcodes: string[];
}

export interface LocalMallPartner {
  id: string;
  businessName: string;
  logoUrl: string | null;
  category: string | null;
  industry: string | null;
  membershipTier: string | null;
}

export interface MyLocalMallOverview {
  assigned: boolean;
  role: string;
  postcode: string | null;
  city: LocalMallHierarchyNode | null;
  borough: LocalMallHierarchyNode | null;
  highStreet: LocalMallHierarchyNode | null;
  localMall: LocalMallDetails | null;
  locationAssignedAt: string | null;
  partners: LocalMallPartner[];
  partnerCount: number;
}

export const localMallApi = {
  getOverview: async (): Promise<MyLocalMallOverview> => {
    const res = await apiClient.get('/geography/my-local-mall');
    const body = res.data;
    return (body?.data ?? body) as MyLocalMallOverview;
  },
};
