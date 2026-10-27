import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavbarUserMenu, { getUserShortcuts } from './NavbarUserMenu';

const logoutMock = vi.fn();

vi.mock('../services/auth/hooks', () => ({
  useLogout: () => logoutMock,
}));

function renderMenu(user: Parameters<typeof NavbarUserMenu>[0]['user'], onLoggedOut?: () => void) {
  return render(
    <MemoryRouter>
      <NavbarUserMenu user={user} onLoggedOut={onLoggedOut} />
    </MemoryRouter>
  );
}

describe('NavbarUserMenu', () => {
  beforeEach(() => {
    logoutMock.mockClear();
  });

  it('shows the business name and role next to the avatar', () => {
    renderMenu({ role: 'BUSINESS', businessName: 'Acme Corp', email: 'ada@acme.com' });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Business Owner')).toBeInTheDocument();
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('opens the dropdown with business dashboard shortcuts', () => {
    renderMenu({ role: 'BUSINESS', businessName: 'Acme Corp' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Business Dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('menuitem', { name: /Memberships/i })).toHaveAttribute(
      'href',
      '/dashboard/memberships'
    );
  });

  it('shows admin shortcuts for administrators', () => {
    renderMenu({ role: 'ADMIN', email: 'root@mcom.com' });

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('menuitem', { name: /Admin Console/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('menuitem', { name: /Programme Control/i })).toHaveAttribute(
      'href',
      '/admin/programme'
    );
  });

  it('logs out and notifies the parent', () => {
    const onLoggedOut = vi.fn();
    renderMenu({ role: 'BUSINESS', businessName: 'Acme Corp' }, onLoggedOut);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Log out/i }));

    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith('/');
  });
});

describe('getUserShortcuts', () => {
  it('routes customers to the customer dashboard', () => {
    const shortcuts = getUserShortcuts('CUSTOMER');

    expect(shortcuts[0]).toMatchObject({ to: '/customer' });
  });

  it('sends affiliate roles to the external affiliate portal', () => {
    const shortcuts = getUserShortcuts('AGENT');

    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].external).toBe(true);
    expect(shortcuts[0].to).toMatch(/\/dashboard$/);
  });

  it('defaults to the business dashboard for unknown roles', () => {
    expect(getUserShortcuts(null)[0]).toMatchObject({ to: '/dashboard' });
  });
});
