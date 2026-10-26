import type { Category, Sector, Subcategory } from '../../data/sectors';
import FieldRequirementHint from '../../components/onboarding/FieldRequirementHint';

interface BusinessCategorySelectorsProps {
  sectors: Sector[];
  categories: Category[];
  subcategories: Subcategory[];
  sectorId: string;
  categoryId: string;
  subcategoryId: string;
  sectorsLoading: boolean;
  categoriesLoading: boolean;
  subcategoriesLoading: boolean;
  sectorsError: boolean;
  categoriesError: boolean;
  subcategoriesError: boolean;
  onSectorChange: (sectorId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
}

export default function BusinessCategorySelectors({
  sectors,
  categories,
  subcategories,
  sectorId,
  categoryId,
  subcategoryId,
  sectorsLoading,
  categoriesLoading,
  subcategoriesLoading,
  sectorsError,
  categoriesError,
  subcategoriesError,
  onSectorChange,
  onCategoryChange,
  onSubcategoryChange,
}: BusinessCategorySelectorsProps) {
  const catalogError = sectorsError
    ? 'Could not load sectors from the CHS catalog. Check the connection and try again.'
    : sectorId && categoriesError
      ? 'Could not load categories from the CHS catalog. Check the connection and try again.'
      : categoryId && subcategoriesError
        ? 'Could not load business types from the CHS catalog. Check the connection and try again.'
        : null;

  return (
    <div className="space-y-6">
      {catalogError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">{catalogError}</p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="business-sector" className="block text-sm font-bold text-gray-800 tracking-tight">Sector<FieldRequirementHint kind="required" /></label>
        <p className="text-xs text-gray-500 -mt-1">Choose the broad industry your business belongs to</p>
        <select
          id="business-sector"
          value={sectorId}
          onChange={(event) => onSectorChange(event.target.value)}
          disabled={sectorsLoading || sectorsError || sectors.length === 0}
          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {sectorsLoading ? 'Loading sectors…' : sectorsError ? 'Sectors unavailable' : sectors.length ? 'Select a Sector' : 'No sectors in the CHS catalog'}
          </option>
          {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="business-primary-category" className="block text-sm font-bold text-gray-800 tracking-tight">Primary Category<FieldRequirementHint kind="required" /></label>
        <p className="text-xs text-gray-500 -mt-1">Narrow down to the specific group within your sector</p>
        <select
          id="business-primary-category"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          disabled={!sectorId || categoriesLoading || categoriesError || categories.length === 0}
          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {!sectorId ? 'Select a Sector first' : categoriesLoading ? 'Loading categories…' : categoriesError ? 'Categories unavailable' : categories.length ? 'Select a Category' : 'No categories for this sector'}
          </option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="business-subcategory" className="block text-sm font-bold text-gray-800 tracking-tight">Business Type</label>
        <p className="text-xs text-gray-500 -mt-1">Pick the exact type that matches your operations (optional)</p>
        <select
          id="business-subcategory"
          value={subcategoryId}
          onChange={(event) => onSubcategoryChange(event.target.value)}
          disabled={!categoryId || subcategoriesLoading || subcategoriesError || subcategories.length === 0}
          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {!categoryId ? 'Select a Category first' : subcategoriesLoading ? 'Loading business types…' : subcategoriesError ? 'Business types unavailable' : subcategories.length ? 'Select a Business Type' : 'No business types for this category'}
          </option>
          {subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
        </select>
      </div>
    </div>
  );
}
