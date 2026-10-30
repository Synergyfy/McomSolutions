import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BusinessCategorySelectors from './BusinessCategorySelectors';

const baseProps = {
  sectors: [{ id: 'sector-admin', name: 'Admin-managed sector' }],
  categories: [{ id: 'category-admin', name: 'Admin-managed category', sectorId: 'sector-admin' }],
  subcategories: [{ id: 'type-admin', name: 'Admin-managed business type', categoryId: 'category-admin' }],
  sectorId: '',
  categoryId: '',
  subcategoryId: '',
  sectorsLoading: false,
  categoriesLoading: false,
  subcategoriesLoading: false,
  sectorsError: false,
  categoriesError: false,
  subcategoriesError: false,
  onSectorChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onSubcategoryChange: vi.fn(),
};

describe('BusinessCategorySelectors', () => {
  it('renders the catalog values and preserves the parent selection relationships', () => {
    const { rerender } = render(<BusinessCategorySelectors {...baseProps} />);

    const sector = screen.getByLabelText('Sector') as HTMLSelectElement;
    fireEvent.change(sector, { target: { value: 'sector-admin' } });
    expect(baseProps.onSectorChange).toHaveBeenCalledWith('sector-admin');
    expect(within(sector).getByRole('option', { name: 'Admin-managed sector' })).toBeInTheDocument();

    const category = screen.getByLabelText('Primary Category') as HTMLSelectElement;
    expect(category).toBeDisabled();
    rerender(<BusinessCategorySelectors {...baseProps} sectorId="sector-admin" />);
    const selectedCategory = screen.getByLabelText('Primary Category') as HTMLSelectElement;
    expect(within(selectedCategory).getByRole('option', { name: 'Admin-managed category' })).toBeInTheDocument();

    rerender(<BusinessCategorySelectors {...baseProps} sectorId="sector-admin" categoryId="category-admin" />);
    const businessType = screen.getByLabelText('Business Type') as HTMLSelectElement;
    expect(within(businessType).getByRole('option', { name: 'Admin-managed business type' })).toBeInTheDocument();
  });

  it('shows loading, empty, and API error states without substituting sample options', () => {
    const { rerender } = render(<BusinessCategorySelectors {...baseProps} sectorsLoading />);
    expect(screen.getByRole('option', { name: 'Loading sectors…' })).toBeInTheDocument();

    rerender(<BusinessCategorySelectors {...baseProps} sectors={[]} />);
    expect(screen.getByRole('option', { name: 'No sectors in the CHS catalog' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Hospitality, Food & Beverage' })).not.toBeInTheDocument();

    rerender(<BusinessCategorySelectors {...baseProps} sectorsError />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load sectors from the CHS catalog');
    expect(screen.getByRole('option', { name: 'Sectors unavailable' })).toBeInTheDocument();
  });

  it('shows category and business type errors in their respective selection context', () => {
    const { rerender } = render(<BusinessCategorySelectors {...baseProps} sectorId="sector-admin" categoriesError />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load categories from the CHS catalog');

    rerender(<BusinessCategorySelectors {...baseProps} sectorId="sector-admin" categoryId="category-admin" subcategoriesError />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load business types from the CHS catalog');
  });
});
