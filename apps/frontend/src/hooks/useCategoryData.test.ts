import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/api', () => ({ apiClient: { get } }));

import { fetchCategories, fetchSectors, fetchSubCategories } from './useCategoryData';

describe('CHS catalog API requests', () => {
  beforeEach(() => get.mockReset());

  it('loads sectors from the catalog endpoint', async () => {
    get.mockResolvedValue({ data: [{ id: 'sector-1', name: 'Sector One' }] });
    await expect(fetchSectors()).resolves.toEqual([{ id: 'sector-1', name: 'Sector One' }]);
    expect(get).toHaveBeenCalledWith('/sectors');
  });

  it('filters categories by the selected sector', async () => {
    get.mockResolvedValue({ data: [] });
    await fetchCategories('sector-1');
    expect(get).toHaveBeenCalledWith('/categories', { params: { sectorId: 'sector-1' } });
  });

  it('filters business types by the selected category', async () => {
    get.mockResolvedValue({ data: [] });
    await fetchSubCategories('category-1');
    expect(get).toHaveBeenCalledWith('/subcategories', { params: { categoryId: 'category-1' } });
  });
});
