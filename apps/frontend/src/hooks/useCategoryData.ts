import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Sector, Category, Subcategory } from '../data/sectors';

export async function fetchSectors(): Promise<Sector[]> {
  const res = await apiClient.get('/sectors');
  return res.data;
}

export async function fetchCategories(sectorId?: string): Promise<Category[]> {
  const res = await apiClient.get('/categories', { params: sectorId ? { sectorId } : undefined });
  return res.data;
}

export async function fetchSubCategories(categoryId?: string): Promise<Subcategory[]> {
  const res = await apiClient.get('/subcategories', { params: categoryId ? { categoryId } : undefined });
  return res.data;
}

export function useGetSectors() {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: fetchSectors,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetCategoriesBySector(sectorId?: string) {
  return useQuery({
    queryKey: ['categories', sectorId],
    queryFn: () => fetchCategories(sectorId),
    enabled: !!sectorId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetSubCategoriesByCategory(categoryId?: string) {
  return useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => fetchSubCategories(categoryId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
}
