import React, { useState, useMemo } from 'react';
import {
  Layers,
  FolderTree,
  Tag,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  ListTree,
  Info,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAdminCatalogTree,
  useCreateSector,
  useUpdateSector,
  useDeleteSector,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateSubCategory,
  useUpdateSubCategory,
  useDeleteSubCategory,
} from '../../services/admin/hooks';
import type {
  AdminSector,
  AdminCategory,
  AdminSubCategory,
} from '../../services/admin/types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function SectorsCategoriesPanel() {
  const { data: treeRes, isLoading } = useAdminCatalogTree();

  const createSectorMutation = useCreateSector();
  const updateSectorMutation = useUpdateSector();
  const deleteSectorMutation = useDeleteSector();

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const createSubCategoryMutation = useCreateSubCategory();
  const updateSubCategoryMutation = useUpdateSubCategory();
  const deleteSubCategoryMutation = useDeleteSubCategory();

  const sectors = useMemo(() => treeRes?.data?.sectors ?? [], [treeRes]);
  const stats = treeRes?.data?.stats ?? { totalSectors: 0, totalCategories: 0, totalSubcategories: 0 };

  // View mode
  const [viewMode, setViewMode] = useState<'drilldown' | 'tree'>('drilldown');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item in drilldown
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Auto-select first sector if none selected
  const activeSector = useMemo(() => {
    if (!sectors.length) return null;
    const found = sectors.find((s) => s.id === selectedSectorId);
    return found || sectors[0];
  }, [sectors, selectedSectorId]);

  const activeCategories = useMemo(() => activeSector?.categories ?? [], [activeSector]);

  const activeCategory = useMemo(() => {
    if (!activeCategories.length) return null;
    const found = activeCategories.find((c) => c.id === selectedCategoryId);
    return found || activeCategories[0];
  }, [activeCategories, selectedCategoryId]);

  const activeSubCategories = useMemo(() => activeCategory?.subCategories ?? [], [activeCategory]);

  // Modals state
  const [sectorModal, setSectorModal] = useState<{
    open: boolean;
    editing: AdminSector | null;
  }>({ open: false, editing: null });

  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    editing: AdminCategory | null;
    defaultSectorId?: string;
  }>({ open: false, editing: null });

  const [subCategoryModal, setSubCategoryModal] = useState<{
    open: boolean;
    editing: AdminSubCategory | null;
    defaultCategoryId?: string;
  }>({ open: false, editing: null });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: 'sector' | 'category' | 'subcategory';
    id: string;
    name: string;
    childCount?: { categories?: number; subcategories?: number };
  }>({ open: false, type: 'sector', id: '', name: '' });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered tree for search query
  const filteredSectors = useMemo(() => {
    if (!searchQuery.trim()) return sectors;
    const q = searchQuery.toLowerCase().trim();

    return sectors
      .map((sector) => {
        const sectorMatches =
          sector.name.toLowerCase().includes(q) || sector.slug.toLowerCase().includes(q);

        const matchingCategories = (sector.categories || [])
          .map((cat) => {
            const catMatches =
              cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q);

            const matchingSubs = (cat.subCategories || []).filter(
              (sub) => sub.name.toLowerCase().includes(q) || sub.slug.toLowerCase().includes(q),
            );

            if (catMatches || matchingSubs.length > 0) {
              return { ...cat, subCategories: catMatches ? cat.subCategories : matchingSubs };
            }
            return null;
          })
          .filter(Boolean) as AdminCategory[];

        if (sectorMatches || matchingCategories.length > 0) {
          return {
            ...sector,
            categories: sectorMatches ? sector.categories : matchingCategories,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof sectors;
  }, [sectors, searchQuery]);

  // Handle Quick Reorder (sortOrder + 1 / - 1)
  const handleReorderSector = async (sector: AdminSector, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? Math.max(0, sector.sortOrder - 1) : sector.sortOrder + 1;
    await updateSectorMutation.mutateAsync({ id: sector.id, data: { sortOrder: newOrder } });
    showToast(`Updated "${sector.name}" sort order`);
  };

  const handleReorderCategory = async (cat: AdminCategory, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? Math.max(0, cat.sortOrder - 1) : cat.sortOrder + 1;
    await updateCategoryMutation.mutateAsync({ id: cat.id, data: { sortOrder: newOrder } });
    showToast(`Updated "${cat.name}" sort order`);
  };

  const handleReorderSubCategory = async (sub: AdminSubCategory, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? Math.max(0, sub.sortOrder - 1) : sub.sortOrder + 1;
    await updateSubCategoryMutation.mutateAsync({ id: sub.id, data: { sortOrder: newOrder } });
    showToast(`Updated "${sub.name}" sort order`);
  };

  // Handle Deletion Confirmation
  const confirmDelete = async () => {
    try {
      if (deleteModal.type === 'sector') {
        await deleteSectorMutation.mutateAsync(deleteModal.id);
        if (selectedSectorId === deleteModal.id) {
          setSelectedSectorId(null);
          setSelectedCategoryId(null);
        }
        showToast(`Sector "${deleteModal.name}" deleted`);
      } else if (deleteModal.type === 'category') {
        await deleteCategoryMutation.mutateAsync(deleteModal.id);
        if (selectedCategoryId === deleteModal.id) {
          setSelectedCategoryId(null);
        }
        showToast(`Category "${deleteModal.name}" deleted`);
      } else if (deleteModal.type === 'subcategory') {
        await deleteSubCategoryMutation.mutateAsync(deleteModal.id);
        showToast(`Subcategory "${deleteModal.name}" deleted`);
      }
      setDeleteModal({ open: false, type: 'sector', id: '', name: '' });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete item');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Sectors</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalSectors}</p>
            <p className="text-xs text-gray-500 mt-0.5">Top-level business sectors</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Categories</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalCategories}</p>
            <p className="text-xs text-gray-500 mt-0.5">Categorical classifications</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Subcategories</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalSubcategories}</p>
            <p className="text-xs text-gray-500 mt-0.5">Granular business types</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <FolderTree className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search sectors, categories, subcategories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* View mode switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('drilldown')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all',
                viewMode === 'drilldown'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              3-Column View
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all',
                viewMode === 'tree'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <ListTree className="w-3.5 h-3.5" />
              Tree Table
            </button>
          </div>

          <button
            onClick={() => setSectorModal({ open: true, editing: null })}
            className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Add Sector
          </button>
        </div>
      </div>

      {/* ─── 3-COLUMN DRILL-DOWN VIEW ────────────────────────── */}
      {viewMode === 'drilldown' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Sectors */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-blue" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Sectors ({filteredSectors.length})
                </h3>
              </div>
              <button
                onClick={() => setSectorModal({ open: true, editing: null })}
                className="p-1 text-gray-500 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"
                title="Add Sector"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-50 overflow-y-auto flex-1 max-h-[620px]">
              {filteredSectors.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No sectors found. Click "+ Add Sector" to create one.
                </div>
              ) : (
                filteredSectors.map((sector) => {
                  const isSelected = (activeSector?.id || '') === sector.id;
                  const catCount = sector.categories?.length || 0;

                  return (
                    <div
                      key={sector.id}
                      onClick={() => {
                        setSelectedSectorId(sector.id);
                        if (sector.categories && sector.categories[0]) {
                          setSelectedCategoryId(sector.categories[0].id);
                        } else {
                          setSelectedCategoryId(null);
                        }
                      }}
                      className={cn(
                        'p-3.5 cursor-pointer transition-all flex items-center justify-between group',
                        isSelected
                          ? 'bg-blue-50/60 border-l-4 border-brand-blue text-brand-blue font-bold'
                          : 'hover:bg-gray-50/80 text-gray-700',
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate">{sector.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 font-mono">#{sector.slug}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                            {catCount} {catCount === 1 ? 'category' : 'categories'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorderSector(sector, 'up');
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorderSector(sector, 'down');
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectorModal({ open: true, editing: sector });
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                            title="Edit Sector"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              let totalSub = 0;
                              (sector.categories || []).forEach((c) => {
                                totalSub += c.subCategories?.length || 0;
                              });
                              setDeleteModal({
                                open: true,
                                type: 'sector',
                                id: sector.id,
                                name: sector.name,
                                childCount: { categories: catCount, subcategories: totalSub },
                              });
                            }}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                            title="Delete Sector"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 ml-1 transition-transform',
                            isSelected ? 'text-brand-blue translate-x-0.5' : 'text-gray-300',
                          )}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Categories */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Categories ({activeCategories.length})
                </h3>
              </div>
              {activeSector && (
                <button
                  onClick={() =>
                    setCategoryModal({
                      open: true,
                      editing: null,
                      defaultSectorId: activeSector.id,
                    })
                  }
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Add Category to this Sector"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-50 overflow-y-auto flex-1 max-h-[620px]">
              {!activeSector ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Select a sector on the left to view its categories.
                </div>
              ) : activeCategories.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 space-y-2">
                  <p>No categories in &ldquo;{activeSector.name}&rdquo;.</p>
                  <button
                    onClick={() =>
                      setCategoryModal({
                        open: true,
                        editing: null,
                        defaultSectorId: activeSector.id,
                      })
                    }
                    className="text-emerald-600 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add first category
                  </button>
                </div>
              ) : (
                activeCategories.map((cat) => {
                  const isSelected = (activeCategory?.id || '') === cat.id;
                  const subCount = cat.subCategories?.length || 0;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={cn(
                        'p-3.5 cursor-pointer transition-all flex items-center justify-between group',
                        isSelected
                          ? 'bg-emerald-50/60 border-l-4 border-emerald-500 text-emerald-800 font-bold'
                          : 'hover:bg-gray-50/80 text-gray-700',
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 font-mono">#{cat.slug}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                            {subCount} {subCount === 1 ? 'subcategory' : 'subcategories'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorderCategory(cat, 'up');
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorderCategory(cat, 'down');
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategoryModal({ open: true, editing: cat });
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                            title="Edit Category"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal({
                                open: true,
                                type: 'category',
                                id: cat.id,
                                name: cat.name,
                                childCount: { subcategories: subCount },
                              });
                            }}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 ml-1 transition-transform',
                            isSelected ? 'text-emerald-600 translate-x-0.5' : 'text-gray-300',
                          )}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Subcategories */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Subcategories ({activeSubCategories.length})
                </h3>
              </div>
              {activeCategory && (
                <button
                  onClick={() =>
                    setSubCategoryModal({
                      open: true,
                      editing: null,
                      defaultCategoryId: activeCategory.id,
                    })
                  }
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Add Subcategory to this Category"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-50 overflow-y-auto flex-1 max-h-[620px]">
              {!activeCategory ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Select a category in the middle column to view subcategories.
                </div>
              ) : activeSubCategories.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 space-y-2">
                  <p>No subcategories in &ldquo;{activeCategory.name}&rdquo;.</p>
                  <button
                    onClick={() =>
                      setSubCategoryModal({
                        open: true,
                        editing: null,
                        defaultCategoryId: activeCategory.id,
                      })
                    }
                    className="text-purple-600 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add first subcategory
                  </button>
                </div>
              ) : (
                activeSubCategories.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 hover:bg-purple-50/40 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-xs font-bold text-gray-800 truncate">{sub.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{sub.slug}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleReorderSubCategory(sub, 'up')}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleReorderSubCategory(sub, 'down')}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setSubCategoryModal({ open: true, editing: sub })}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        title="Edit Subcategory"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteModal({
                            open: true,
                            type: 'subcategory',
                            id: sub.id,
                            name: sub.name,
                          })
                        }
                        className="p-1 hover:bg-red-50 rounded text-red-500"
                        title="Delete Subcategory"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── FULL HIERARCHY TREE VIEW ────────────────────────── */}
      {viewMode === 'tree' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Complete Ecosystem Taxonomy
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              Expand rows to view nested categories and subcategories
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredSectors.map((sector) => (
              <SectorTreeRow
                key={sector.id}
                sector={sector}
                onEditSector={() => setSectorModal({ open: true, editing: sector })}
                onDeleteSector={() => {
                  let subCount = 0;
                  (sector.categories || []).forEach((c) => {
                    subCount += c.subCategories?.length || 0;
                  });
                  setDeleteModal({
                    open: true,
                    type: 'sector',
                    id: sector.id,
                    name: sector.name,
                    childCount: { categories: sector.categories?.length || 0, subcategories: subCount },
                  });
                }}
                onAddCategory={() =>
                  setCategoryModal({ open: true, editing: null, defaultSectorId: sector.id })
                }
                onEditCategory={(cat) => setCategoryModal({ open: true, editing: cat })}
                onDeleteCategory={(cat) =>
                  setDeleteModal({
                    open: true,
                    type: 'category',
                    id: cat.id,
                    name: cat.name,
                    childCount: { subcategories: cat.subCategories?.length || 0 },
                  })
                }
                onAddSubCategory={(cat) =>
                  setSubCategoryModal({ open: true, editing: null, defaultCategoryId: cat.id })
                }
                onEditSubCategory={(sub) => setSubCategoryModal({ open: true, editing: sub })}
                onDeleteSubCategory={(sub) =>
                  setDeleteModal({
                    open: true,
                    type: 'subcategory',
                    id: sub.id,
                    name: sub.name,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── MODALS ─────────────────────────────────────────── */}

      {/* Sector Modal */}
      {sectorModal.open && (
        <SectorModalForm
          editing={sectorModal.editing}
          onClose={() => setSectorModal({ open: false, editing: null })}
          onSubmit={async (data) => {
            if (sectorModal.editing) {
              await updateSectorMutation.mutateAsync({ id: sectorModal.editing.id, data });
              showToast(`Sector "${data.name}" updated`);
            } else {
              await createSectorMutation.mutateAsync(data);
              showToast(`Sector "${data.name}" created`);
            }
            setSectorModal({ open: false, editing: null });
          }}
          isLoading={createSectorMutation.isPending || updateSectorMutation.isPending}
        />
      )}

      {/* Category Modal */}
      {categoryModal.open && (
        <CategoryModalForm
          editing={categoryModal.editing}
          sectors={sectors}
          defaultSectorId={categoryModal.defaultSectorId || activeSector?.id}
          onClose={() => setCategoryModal({ open: false, editing: null })}
          onSubmit={async (data) => {
            if (categoryModal.editing) {
              await updateCategoryMutation.mutateAsync({ id: categoryModal.editing.id, data });
              showToast(`Category "${data.name}" updated`);
            } else {
              await createCategoryMutation.mutateAsync(data as any);
              showToast(`Category "${data.name}" created`);
            }
            setCategoryModal({ open: false, editing: null });
          }}
          isLoading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
        />
      )}

      {/* Subcategory Modal */}
      {subCategoryModal.open && (
        <SubCategoryModalForm
          editing={subCategoryModal.editing}
          sectors={sectors}
          defaultCategoryId={subCategoryModal.defaultCategoryId || activeCategory?.id}
          onClose={() => setSubCategoryModal({ open: false, editing: null })}
          onSubmit={async (data) => {
            if (subCategoryModal.editing) {
              await updateSubCategoryMutation.mutateAsync({ id: subCategoryModal.editing.id, data });
              showToast(`Subcategory "${data.name}" updated`);
            } else {
              await createSubCategoryMutation.mutateAsync(data as any);
              showToast(`Subcategory "${data.name}" created`);
            }
            setSubCategoryModal({ open: false, editing: null });
          }}
          isLoading={createSubCategoryMutation.isPending || updateSubCategoryMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-900">
                Delete {deleteModal.type === 'sector' ? 'Sector' : deleteModal.type === 'category' ? 'Category' : 'Subcategory'}?
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete <strong className="text-gray-900">&ldquo;{deleteModal.name}&rdquo;</strong>?
              </p>
            </div>

            {deleteModal.childCount && (deleteModal.childCount.categories || deleteModal.childCount.subcategories) ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Info className="w-4 h-4 text-amber-600" />
                  Cascade Deletion Warning:
                </div>
                <p>
                  Deleting this item will also permanently remove:
                </p>
                <ul className="list-disc pl-5 font-semibold">
                  {deleteModal.childCount.categories !== undefined && (
                    <li>{deleteModal.childCount.categories} nested categories</li>
                  )}
                  {deleteModal.childCount.subcategories !== undefined && (
                    <li>{deleteModal.childCount.subcategories} nested subcategories</li>
                  )}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModal({ open: false, type: 'sector', id: '', name: '' })}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={
                  deleteSectorMutation.isPending ||
                  deleteCategoryMutation.isPending ||
                  deleteSubCategoryMutation.isPending
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                {(deleteSectorMutation.isPending ||
                  deleteCategoryMutation.isPending ||
                  deleteSubCategoryMutation.isPending) ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────

function SectorTreeRow({
  sector,
  onEditSector,
  onDeleteSector,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddSubCategory,
  onEditSubCategory,
  onDeleteSubCategory,
}: {
  key?: React.Key;
  sector: AdminSector;
  onEditSector: () => void;
  onDeleteSector: () => void;
  onAddCategory: () => void;
  onEditCategory: (cat: AdminCategory) => void;
  onDeleteCategory: (cat: AdminCategory) => void;
  onAddSubCategory: (cat: AdminCategory) => void;
  onEditSubCategory: (sub: AdminSubCategory) => void;
  onDeleteSubCategory: (sub: AdminSubCategory) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catCount = sector.categories?.length || 0;

  return (
    <div>
      <div className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 cursor-pointer flex-1"
        >
          <div className="p-1 rounded text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900">{sector.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-400 font-mono">#{sector.slug}</span>
              <span className="text-[10px] text-gray-500 font-medium">Order: {sector.sortOrder}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-brand-blue font-bold">
                {catCount} {catCount === 1 ? 'category' : 'categories'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddCategory}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Category
          </button>
          <button
            onClick={onEditSector}
            className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"
            title="Edit Sector"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteSector}
            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
            title="Delete Sector"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pl-12 pr-4 pb-3 space-y-2 bg-gray-50/40">
          {(sector.categories || []).length === 0 ? (
            <p className="py-2 text-xs text-gray-400">No categories under this sector.</p>
          ) : (
            sector.categories!.map((cat) => (
              <CategoryTreeRow
                key={cat.id}
                category={cat}
                onEdit={() => onEditCategory(cat)}
                onDelete={() => onDeleteCategory(cat)}
                onAddSubCategory={() => onAddSubCategory(cat)}
                onEditSubCategory={onEditSubCategory}
                onDeleteSubCategory={onDeleteSubCategory}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CategoryTreeRow({
  category,
  onEdit,
  onDelete,
  onAddSubCategory,
  onEditSubCategory,
  onDeleteSubCategory,
}: {
  key?: React.Key;
  category: AdminCategory;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubCategory: () => void;
  onEditSubCategory: (sub: AdminSubCategory) => void;
  onDeleteSubCategory: (sub: AdminSubCategory) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const subCount = category.subCategories?.length || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2.5 cursor-pointer flex-1"
        >
          <div className="p-1 rounded text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
          <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-800">{category.name}</span>
            <span className="text-[10px] text-gray-400 font-mono ml-2">#{category.slug}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold ml-2">
              {subCount} subs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddSubCategory}
            className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[11px] font-bold flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Sub
          </button>
          <button onClick={onEdit} className="p-1 hover:bg-gray-200 rounded text-gray-500">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded text-red-500">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pl-10 pr-4 pb-2.5 pt-1 divide-y divide-gray-50 bg-gray-50/20">
          {(category.subCategories || []).length === 0 ? (
            <p className="py-1 text-[11px] text-gray-400">No subcategories.</p>
          ) : (
            category.subCategories!.map((sub) => (
              <div key={sub.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span className="font-semibold text-gray-700">{sub.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">#{sub.slug}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditSubCategory(sub)}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => onDeleteSubCategory(sub)}
                    className="p-1 hover:bg-red-50 rounded text-red-500"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Form Modals ────────────────────────────────────────────

function SectorModalForm({
  editing,
  onClose,
  onSubmit,
  isLoading,
}: {
  editing: AdminSector | null;
  onClose: () => void;
  onSubmit: (data: { name: string; slug?: string; sortOrder?: number }) => Promise<void>;
  isLoading: boolean;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [slug, setSlug] = useState(editing?.slug || '');
  const [sortOrder, setSortOrder] = useState(editing?.sortOrder ?? 0);
  const [manualSlug, setManualSlug] = useState(!!editing);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!manualSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setError(null);
      await onSubmit({
        name: name.trim(),
        slug: slug.trim() || undefined,
        sortOrder: Number(sortOrder),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save sector');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">
            {editing ? 'Edit Sector' : 'Add New Sector'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Sector Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Retail & Fashion"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">URL Slug</label>
              {!manualSlug && (
                <span className="text-[10px] text-gray-400">Auto-generated</span>
              )}
            </div>
            <input
              type="text"
              placeholder="retail-fashion"
              value={slug}
              onChange={(e) => {
                setManualSlug(true);
                setSlug(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Display Sort Order</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Sector'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModalForm({
  editing,
  sectors,
  defaultSectorId,
  onClose,
  onSubmit,
  isLoading,
}: {
  editing: AdminCategory | null;
  sectors: AdminSector[];
  defaultSectorId?: string;
  onClose: () => void;
  onSubmit: (data: { sectorId: string; name: string; slug?: string; sortOrder?: number }) => Promise<void>;
  isLoading: boolean;
}) {
  const [sectorId, setSectorId] = useState(editing?.sectorId || defaultSectorId || sectors[0]?.id || '');
  const [name, setName] = useState(editing?.name || '');
  const [slug, setSlug] = useState(editing?.slug || '');
  const [sortOrder, setSortOrder] = useState(editing?.sortOrder ?? 0);
  const [manualSlug, setManualSlug] = useState(!!editing);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!manualSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sectorId) return;
    try {
      setError(null);
      await onSubmit({
        sectorId,
        name: name.trim(),
        slug: slug.trim() || undefined,
        sortOrder: Number(sortOrder),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save category');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">
            {editing ? 'Edit Category' : 'Add New Category'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {sectors.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Please create at least one Sector first before adding a Category.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Parent Sector <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              >
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Clothing & Apparel"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">URL Slug</label>
              {!manualSlug && <span className="text-[10px] text-gray-400">Auto-generated</span>}
            </div>
            <input
              type="text"
              placeholder="clothing-apparel"
              value={slug}
              onChange={(e) => {
                setManualSlug(true);
                setSlug(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Display Sort Order</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

function SubCategoryModalForm({
  editing,
  sectors,
  defaultCategoryId,
  onClose,
  onSubmit,
  isLoading,
}: {
  editing: AdminSubCategory | null;
  sectors: AdminSector[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSubmit: (data: { categoryId: string; name: string; slug?: string; sortOrder?: number }) => Promise<void>;
  isLoading: boolean;
}) {
  const allCategories = useMemo(() => {
    const list: { id: string; name: string; sectorName: string }[] = [];
    sectors.forEach((s) => {
      (s.categories || []).forEach((c) => {
        list.push({ id: c.id, name: c.name, sectorName: s.name });
      });
    });
    return list;
  }, [sectors]);

  const [categoryId, setCategoryId] = useState(
    editing?.categoryId || defaultCategoryId || allCategories[0]?.id || '',
  );
  const [name, setName] = useState(editing?.name || '');
  const [slug, setSlug] = useState(editing?.slug || '');
  const [sortOrder, setSortOrder] = useState(editing?.sortOrder ?? 0);
  const [manualSlug, setManualSlug] = useState(!!editing);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!manualSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    try {
      setError(null);
      await onSubmit({
        categoryId,
        name: name.trim(),
        slug: slug.trim() || undefined,
        sortOrder: Number(sortOrder),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save subcategory');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">
            {editing ? 'Edit Subcategory' : 'Add New Subcategory'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {allCategories.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Please create at least one Category first before adding a Subcategory.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Parent Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              >
                {allCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sectorName} → {c.name}
                  </option>
                ))}
              </select>
            </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Subcategory Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Vintage Boutiques"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">URL Slug</label>
              {!manualSlug && <span className="text-[10px] text-gray-400">Auto-generated</span>}
            </div>
            <input
              type="text"
              placeholder="vintage-boutiques"
              value={slug}
              onChange={(e) => {
                setManualSlug(true);
                setSlug(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Display Sort Order</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Subcategory'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
