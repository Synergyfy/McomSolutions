import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../components/AdminLayout', () => ({
  default: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./AdminAccessEditor', () => ({
  default: () => <div>ACCESS_EDITOR_MARKER</div>,
}));
vi.mock('../components/admin/AccessPlansPanel', () => ({
  default: () => <div>ACCESS_LIST_MARKER</div>,
}));
vi.mock('./AdminMembershipEditor', () => ({ default: () => <div>MEMBERSHIP_EDITOR</div> }));
vi.mock('./AdminCouponEditor', () => ({ default: () => <div>COUPON_EDITOR</div> }));

import AdminDashboard from './AdminDashboard';

describe('AdminDashboard access routing', () => {
  it('renders the access editor for /admin/access/new', () => {
    render(
      <MemoryRouter initialEntries={['/admin/access/new']}>
        <AdminDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText('ACCESS_EDITOR_MARKER')).toBeTruthy();
  });

  it('renders the access list for /admin/access', () => {
    render(
      <MemoryRouter initialEntries={['/admin/access']}>
        <AdminDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText('ACCESS_LIST_MARKER')).toBeTruthy();
  });
});
