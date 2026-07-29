import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { SECTORS, CATEGORIES, SUBCATEGORIES, type Sector, type Category, type Subcategory } from '../data/sectors';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

async function fetchSectors(): Promise<Sector[]> {
  if (USE_MOCK) return SECTORS;
  try {
    const res = await apiClient.get('/sectors');
    return res.data;
  } catch {
    console.warn('[Categories] Backend unreachable, using static sector data');
    return SECTORS;
  }
}

async function fetchCategories(sectorId?: string): Promise<Category[]> {
  if (USE_MOCK) {
    return sectorId ? CATEGORIES.filter(c => c.sectorId === sectorId) : [];
  }
  try {
    const url = sectorId ? `/categories?sectorId=${sectorId}` : '/categories';
    const res = await apiClient.get(url);
    return res.data;
  } catch {
    console.warn('[Categories] Backend unreachable, using static category data');
    return sectorId ? CATEGORIES.filter(c => c.sectorId === sectorId) : [];
  }
}

async function fetchSubCategories(categoryId?: string): Promise<Subcategory[]> {
  if (USE_MOCK) {
    return categoryId ? SUBCATEGORIES.filter(sc => sc.categoryId === categoryId) : [];
  }
  try {
    const url = categoryId ? `/subcategories?categoryId=${categoryId}` : '/subcategories';
    const res = await apiClient.get(url);
    return res.data;
  } catch {
    console.warn('[Categories] Backend unreachable, using static subcategory data');
    return categoryId ? SUBCATEGORIES.filter(sc => sc.categoryId === categoryId) : [];
  }
}

export function useGetSectors() {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: fetchSectors,
    staleTime: 5 * 60 * 1000,
    placeholderData: SECTORS,
  });
}

export function useGetCategoriesBySector(sectorId?: string) {
  return useQuery({
    queryKey: ['categories', sectorId],
    queryFn: () => fetchCategories(sectorId),
    enabled: !!sectorId,
    staleTime: 5 * 60 * 1000,
    placeholderData: sectorId ? CATEGORIES.filter(c => c.sectorId === sectorId) : [],
  });
}

export function useGetSubCategoriesByCategory(categoryId?: string) {
  return useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => fetchSubCategories(categoryId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
    placeholderData: categoryId ? SUBCATEGORIES.filter(sc => sc.categoryId === categoryId) : [],
  });
}