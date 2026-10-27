import { useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Building2,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLogout } from '../services/auth/hooks';
import {
  getAffiliatePortalUrl,
  getAuthUserDisplay,
  isAffiliateRole,
  type StoredAuthUser,
} from '../lib/authUser';

export interface UserShortcut {
  label: string;
  description: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
}

/** Dashboard shortcuts offered for each role. */
export function getUserShortcuts(role?: string | null): UserShortcut[] {
  const normalized = (role || '').toUpperCase();

  if (normalized === 'ADMIN') {
    return [
      {
        label: 'Admin Console',
        description: 'Platform overview & management',
        to: '/admin',
        icon: ShieldCheck,
      },
      {
        label: 'Programme Control',
        description: 'Tasks, phases & business journeys',
        to: '/admin/programme',
        icon: Users,
      },
    ];
  }

  if (normalized === 'CUSTOMER') {
    return [
      {
        label: 'Customer Dashboard',
        description: 'Your account & activity',
        to: '/customer',
        icon: LayoutDashboard,
      },
      {
        label: 'Membership Plans',
        description: 'Compare plans and upgrade',
        to: '/membership',
        icon: CreditCard,
      },
    ];
  }

  if (isAffiliateRole(normalized)) {
    return [
      {
        label: 'Affiliate Portal',
        description: 'Your 247GBS affiliate dashboard',
        to: getAffiliatePortalUrl(),
        icon: ExternalLink,
        external: true,
      },
    ];
  }

  return [
    {
      label: 'Business Dashboard',
      description: 'Overview & programme tasks',
      to: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Memberships',
      description: 'Plans, access passes & billing',
      to: '/dashboard/memberships',
      icon: CreditCard,
    },
    {
      label: 'Business Profile',
      description: 'Company details & storefront',
      to: '/dashboard/business-profile',
      icon: Building2,
    },
    {
      label: 'Billing',
      description: 'Invoices & payment history',
      to: '/dashboard/billing',
      icon: Wallet,
    },
  ];
}

export function UserAvatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 font-black text-white shadow-sm',
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export default function NavbarUserMenu({
  user,
  onLoggedOut,
}: {
  user: StoredAuthUser;
  onLoggedOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const logout = useLogout();
  const display = getAuthUserDisplay(user);

  if (!display) return null;

  const shortcuts = getUserShortcuts(user.role);

  const handleLogout = () => {
    setOpen(false);
    onLoggedOut?.();
    logout('/');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2.5 rounded-full border border-gray-200 bg-white/90 py-1 pl-1 pr-2.5 transition-all hover:border-gray-300 hover:shadow-sm',
          open && 'border-gray-300 shadow-sm'
        )}
      >
        <UserAvatar initials={display.initials} className="h-9 w-9 text-xs" />
        <span className="hidden min-w-0 text-left leading-tight md:block">
          <span className="block max-w-[130px] truncate text-xs font-bold text-gray-900">
            {display.name}
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {display.roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/5"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl"
            >
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
                <UserAvatar initials={display.initials} className="h-10 w-10 text-sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900">{display.name}</div>
                  {display.email && (
                    <div className="truncate text-xs text-gray-500">{display.email}</div>
                  )}
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                    {display.roleLabel}
                  </div>
                </div>
              </div>

              <div className="mt-1.5 space-y-0.5">
                {shortcuts.map((shortcut) => {
                  const Icon = shortcut.icon;
                  const content = (
                    <>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors group-hover:bg-orange-50 group-hover:text-orange-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-orange-600">
                          {shortcut.label}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {shortcut.description}
                        </span>
                      </span>
                      {shortcut.external && (
                        <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400" />
                      )}
                    </>
                  );

                  return shortcut.external ? (
                    <a
                      key={shortcut.label}
                      role="menuitem"
                      href={shortcut.to}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-gray-50"
                    >
                      {content}
                    </a>
                  ) : (
                    <Link
                      key={shortcut.label}
                      role="menuitem"
                      to={shortcut.to}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-gray-50"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-1.5 border-t border-gray-100 pt-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-red-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-red-600">Log out</span>
                    <span className="block text-xs text-gray-500">End this session</span>
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
