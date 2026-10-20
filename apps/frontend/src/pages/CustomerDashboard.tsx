import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Archive, Award, BadgeCheck, Bell, Box, Camera,
  Check, CheckCheck, ChevronDown, ChevronLeft, Compass, Copy, ExternalLink, Eye, EyeOff,
  Filter, Gamepad2, Gift, Globe2, Grid2X2, Headphones, Home, KeyRound, Link2, LogOut,
  Mail, MapPin, MessageSquare, MoreVertical, Paperclip, Pencil, Phone, PiggyBank,
  Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Smile, Ticket, UserRound, WalletCards, X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CHSLogo from '../components/CHSLogo';
import DashboardAllProducts from '../components/DashboardAllProducts';
import DashboardMessages from '../components/DashboardMessages';
import DashboardWallet from '../components/DashboardWallet';
import { useLogout, useCurrentUser } from '../services/auth/hooks';
import { useMyWallet, useWalletTransactions } from '../services/wallet/hooks';
import { useEcosystemApps } from '../services/business/hooks';
import { CUSTOMER_CONVERSATIONS, CUSTOMER_NOTIFICATIONS, OLDER_CUSTOMER_NOTIFICATIONS, CUSTOMER_PREVIEW, CUSTOMER_PRODUCTS, CUSTOMER_TRANSACTIONS, type CustomerPreviewConversation, type CustomerPreviewNotification } from '../data/customerDashboardMock';

type CustomerPage = 'overview' | 'ecosystem' | 'wallet' | 'messages' | 'notifications' | 'settings' | 'profile';

const NAV_ITEMS: { id: CustomerPage; label: string; icon: typeof Home }[] = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'ecosystem', label: 'MCOM Ecosystem', icon: Grid2X2 },
  { id: 'wallet', label: 'My Wallet', icon: WalletCards },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const MOBILE_NAV_ITEMS = NAV_ITEMS.filter(({ id }) => id !== 'settings');

const PAGE_TITLES: Record<CustomerPage, { title: string; subtitle: string }> = {
  overview: { title: 'Your CHS workspace', subtitle: 'Your wallet, connected apps, and messages in one place.' },
  ecosystem: { title: 'MCOM Ecosystem', subtitle: 'Discover and open the MCOM apps connected to your account.' },
  wallet: { title: 'My Wallet', subtitle: 'Check your balance, add funds, and review transactions.' },
  messages: { title: 'Messages & Support', subtitle: 'Talk with CHS support and your connected businesses.' },
  notifications: { title: 'Notifications Center', subtitle: 'Stay up to date with activity across your CHS and MCOM accounts.' },
  settings: { title: 'Settings & Security', subtitle: 'Manage your customer account and sign-in details.' },
  profile: { title: 'Customer Profile', subtitle: 'Your master customer identity and account details.' },
};

export default function CustomerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const customerPreview = import.meta.env.DEV
    && localStorage.getItem('chs_customer_dashboard_preview') === 'true';
  const [search, setSearch] = useState('');
  const [previewBalance, setPreviewBalance] = useState(CUSTOMER_PREVIEW.walletBalance);
  const [customerNotifications, setCustomerNotifications] = useState<CustomerPreviewNotification[]>(() => customerPreview ? CUSTOMER_NOTIFICATIONS.map((item) => ({ ...item })) : []);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { data: user } = useCurrentUser(!customerPreview);
  const { data: wallet, isLoading: walletLoading } = useMyWallet(!customerPreview);
  const { data: transactions } = useWalletTransactions({ limit: 5 }, !customerPreview);
  const { data: ecosystemApps } = useEcosystemApps(!customerPreview);
  const logout = useLogout();

  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('business_user') || '{}'); } catch { return {}; }
  }, []);
  const [profileOverride, setProfileOverride] = useState<Record<string, any>>(() => {
    if (!customerPreview) return {};
    try { return JSON.parse(localStorage.getItem('chs_customer_profile_mock') || '{}'); } catch { return {}; }
  });
  const customer = useMemo(
    () => ({ ...(user || (customerPreview ? CUSTOMER_PREVIEW : storedUser.email ? storedUser : {})), ...profileOverride }),
    [user, storedUser, customerPreview, profileOverride],
  );
  const name = customer.firstName || customer.name || customer.email?.split('@')[0] || 'there';
  const profileName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.name || name;
  const email = customer.email || '';
  const appCount = customerPreview ? 4 : Array.isArray(ecosystemApps) ? ecosystemApps.length : Array.isArray(ecosystemApps?.data) ? ecosystemApps.data.length : 0;
  const recentTransactions = transactions?.data || [];
  const unreadNotificationCount = customerNotifications.filter((item) => item.unread).length;
  const requestedPage = location.pathname.replace(/^\/customer\/?/, '').split('/')[0] || 'overview';
  const page: CustomerPage = NAV_ITEMS.some((item) => item.id === requestedPage) || requestedPage === 'profile' ? requestedPage as CustomerPage : 'overview';
  const title = PAGE_TITLES[page];

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  const goTo = (next: CustomerPage) => {
    setSearch('');
    navigate(next === 'overview' ? '/customer' : `/customer/${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="customer-dashboard-ui min-h-screen bg-[#f6f8fb] pt-16 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <CHSLogo variant="full" size="sm" imageClassName="h-8 w-auto" />
        </div>

        <label className="mx-6 hidden max-w-xl flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 md:flex">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => navigate('/customer/ecosystem')}
            placeholder="Search products, messages, transactions..."
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            aria-label="Search products"
          />
        </label>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <button onClick={() => goTo('wallet')} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-2.5 text-xs font-semibold text-slate-800 sm:min-h-10 sm:px-3 sm:text-sm" aria-label="Open wallet">
            <WalletCards className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Wallet: {customerPreview ? `$${previewBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : walletLoading ? '…' : `${Number(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} MCOM`}</span>
            <Plus className="hidden h-4 w-4 rounded-full bg-orange-600 p-0.5 text-white sm:block" />
          </button>
          <button onClick={() => goTo('notifications')} aria-label="Open notifications" aria-current={page === 'notifications' ? 'page' : undefined} className={`relative inline-flex min-h-10 min-w-10 items-center justify-center p-2 ${page === 'notifications' ? 'text-orange-700' : 'text-slate-500 hover:text-slate-900'}`}>
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-red-600" />}
          </button>
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              aria-label={`Profile menu for ${profileName}`}
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((open) => !open)}
              className="flex min-h-11 items-center gap-2 border-l border-slate-200 pl-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#a93200] text-white"><UserRound className="h-4 w-4" /></span>
              <span className="hidden max-w-40 truncate text-sm font-semibold text-slate-900 md:inline">{profileName}</span>
              <BadgeCheck className="hidden h-[18px] w-[18px] shrink-0 fill-blue-600 text-white sm:block" aria-label="Verified customer" />
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileMenuOpen && <div className="absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 text-left shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="truncate font-semibold text-slate-900">{profileName}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{email || 'Customer account'}</p>
              </div>
              <div className="py-2">
                <button onClick={() => { setProfileMenuOpen(false); goTo('profile'); }} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <UserRound className="h-5 w-5 text-orange-700" />
                  <span><span className="block text-sm font-semibold text-slate-900">Customer Profile</span><span className="mt-0.5 block text-xs text-slate-500">View your account information</span></span>
                </button>
                <button onClick={() => { setProfileMenuOpen(false); goTo('settings'); }} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <Settings className="h-5 w-5 text-slate-600" />
                  <span><span className="block text-sm font-semibold text-slate-900">Settings &amp; Security</span><span className="mt-0.5 block text-xs text-slate-500">Account and sign-in preferences</span></span>
                </button>
                <button onClick={() => { setProfileMenuOpen(false); goTo('wallet'); }} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <WalletCards className="h-5 w-5 text-emerald-700" />
                  <span><span className="block text-sm font-semibold text-slate-900">Wallet &amp; Transactions</span><span className="mt-0.5 block text-xs text-slate-500">Balances, funding, and receipts</span></span>
                </button>
              </div>
              <div className="border-t border-slate-100 pt-2">
                <button onClick={() => { setProfileMenuOpen(false); if (customerPreview) localStorage.removeItem('chs_customer_dashboard_preview'); logout(); }} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-red-50">
                  <LogOut className="h-5 w-5 text-red-600" />
                  <span><span className="block text-sm font-semibold text-red-700">Sign Out</span><span className="mt-0.5 block text-xs text-slate-500">Return to the login page</span></span>
                </button>
              </div>
            </div>}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <aside className="fixed left-0 top-16 z-20 hidden h-[calc(100dvh-4rem)] min-h-0 w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
          <nav className="space-y-1" aria-label="Customer dashboard">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => goTo(id)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors ${page === id || (page === 'profile' && id === 'settings') ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" />{label}
                {id === 'messages' && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${page === id ? 'bg-white text-orange-700' : 'bg-orange-600 text-white'}`}>3</span>}
                {id === 'notifications' && unreadNotificationCount > 0 && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${page === id ? 'bg-white text-orange-700' : 'bg-orange-600 text-white'}`}>{unreadNotificationCount}</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => logout()} className="mt-auto flex min-h-11 items-center gap-3 border-t border-slate-200 px-3 pt-4 text-sm font-medium text-slate-600 hover:text-orange-700">
            <LogOut className="h-[18px] w-[18px]" />Sign Out
          </button>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:ml-60 lg:px-8 lg:pb-8">
          {page !== 'profile' && page !== 'notifications' && page !== 'settings' && (!customerPreview || page === 'overview') && <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page === 'overview' ? `Welcome back, ${name}` : title.title}</h1>
              <p className="mt-1 text-sm text-slate-600 sm:text-base">{title.subtitle}</p>
            </div>
            {page === 'overview' && <button onClick={() => goTo('wallet')} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 sm:w-auto"><WalletCards className="h-4 w-4" />Fund Wallet</button>}
          </div>}

          {customerPreview ? (
            <>
              {page === 'overview' && <PreviewOverview balance={previewBalance} onNavigate={goTo} />}
              {page === 'ecosystem' && <PreviewEcosystem />}
              {page === 'wallet' && <PreviewWallet balance={previewBalance} onBalanceChange={setPreviewBalance} />}
              {page === 'messages' && <PreviewMessages />}
              {page === 'notifications' && <CustomerNotifications preview={customerPreview} onNavigate={goTo} notifications={customerNotifications} setNotifications={setCustomerNotifications} />}
              {page === 'settings' && <CustomerSettings name={profileName} email={email} preview={customerPreview} onSignOut={() => logout()} />}
              {page === 'profile' && <CustomerProfile customer={customer} preview={customerPreview} onNavigate={goTo} onProfileChange={setProfileOverride} />}
            </>
          ) : page === 'overview' ? (
            <CustomerOverview
              walletBalance={wallet?.balance}
              walletLoading={walletLoading}
              appCount={appCount}
              transactions={recentTransactions}
              onNavigate={goTo}
            />
          ) : page === 'ecosystem' ? <DashboardAllProducts initialFilter="mcom" initialSearch={search} />
            : page === 'wallet' ? <DashboardWallet />
              : page === 'messages' ? <DashboardMessages />
                : page === 'notifications' ? <CustomerNotifications preview={customerPreview} onNavigate={goTo} notifications={customerNotifications} setNotifications={setCustomerNotifications} />
                  : page === 'profile' ? <CustomerProfile customer={customer} preview={customerPreview} onNavigate={goTo} onProfileChange={setProfileOverride} />
                : <CustomerSettings name={profileName} email={email} preview={customerPreview} onSignOut={() => logout()} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur lg:hidden" aria-label="Mobile customer navigation">
        {MOBILE_NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => goTo(id)} aria-label={label} aria-current={page === id || (page === 'profile' && id === 'settings') ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${page === id || (page === 'profile' && id === 'settings') ? 'text-orange-700' : 'text-slate-500'}`}>
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate min-[390px]:hidden">{id === 'ecosystem' ? 'MCOM' : id === 'wallet' ? 'Wallet' : id === 'messages' ? 'Inbox' : id === 'notifications' ? 'Alerts' : 'Home'}</span>
            <span className="hidden max-w-full truncate min-[390px]:block">{label === 'MCOM Ecosystem' ? 'MCOM' : label === 'My Wallet' ? 'Wallet' : label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function CustomerNotifications({ preview, onNavigate, notifications, setNotifications }: { preview: boolean; onNavigate: (page: CustomerPage) => void; notifications: CustomerPreviewNotification[]; setNotifications: Dispatch<SetStateAction<CustomerPreviewNotification[]>> }) {
  const [activeCategory, setActiveCategory] = useState('All Alerts');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notice, setNotice] = useState('');
  const [emailDigest, setEmailDigest] = useState(true);
  const [securitySms, setSecuritySms] = useState(true);
  const unreadCount = notifications.filter((item) => item.unread).length;
  const categories = ['All Alerts', 'Wallet & Payments', 'MCOM Ecosystem', 'Tier & Loyalty', 'Messages & Chat', 'Security & System', 'Local Perks'];
  const visible = notifications.filter((item) =>
    (activeCategory === 'All Alerts' || item.category === activeCategory)
    && (!unreadOnly || item.unread),
  );
  const iconMap: Record<string, typeof Bell> = {
    award: Award,
    wallet: WalletCards,
    game: Ticket,
    perk: Box,
    support: Headphones,
    security: ShieldCheck,
  };
  const markAllRead = () => setNotifications((items) => items.map((item) => ({ ...item, unread: false })));

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications Center</h1>{unreadCount > 0 && <span className="rounded-full bg-orange-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{unreadCount} new</span>}</div>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">Stay updated on real-time ecosystem rewards, wallet transactions, tier upgrades, and security alerts.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={markAllRead} disabled={unreadCount === 0} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"><CheckCheck className="h-4 w-4 text-blue-700" />Mark All as Read</button>
        <button onClick={() => setNotice('Notification preferences are preview controls and are not saved to an account service.')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"><SlidersHorizontal className="h-4 w-4 text-slate-600" />Preferences</button>
      </div>
    </div>

    {notice && <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X className="h-4 w-4" /></button></div>}

    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Notification categories">
      {categories.map((category) => <button key={category} role="tab" aria-selected={activeCategory === category} onClick={() => setActiveCategory(category)} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors ${activeCategory === category ? 'border-[#1e3147] bg-[#1e3147] text-white' : 'border-slate-100 bg-white text-slate-700 hover:border-slate-300'}`}>{category}{category === 'All Alerts' && unreadCount > 0 && <span className="ml-2 rounded-full bg-orange-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}</button>)}
    </div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/80 px-5 py-3 text-xs text-slate-700"><span className="flex items-center gap-2 font-semibold uppercase tracking-wide"><span className="h-1.5 w-1.5 rounded-full bg-orange-600" />Recent stream · {preview ? 'Preview activity' : 'Account activity'}</span><label className="inline-flex cursor-pointer items-center gap-2 font-medium"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} className="h-4 w-4 accent-orange-600" />Show unread only</label></div>
      <div className="divide-y divide-slate-100">
        {visible.map((item) => {
          const Icon = iconMap[item.icon] || Bell;
          const toneClasses: Record<CustomerPreviewNotification['tone'], string> = {
            orange: 'border-l-orange-600 bg-[#fff8f4] text-orange-700',
            blue: 'border-l-blue-700 bg-white text-blue-700',
            sky: 'border-l-blue-500 bg-white text-blue-700',
            rose: 'border-l-rose-900 bg-white text-rose-800',
            slate: 'border-l-slate-300 bg-blue-50/50 text-slate-600',
          };
          const iconTone: Record<CustomerPreviewNotification['tone'], string> = {
            orange: 'text-orange-700',
            blue: 'text-blue-700',
            sky: 'text-blue-700',
            rose: 'text-rose-800',
            slate: 'text-slate-600',
          };
          return <article key={item.id} className={`border-l-[5px] px-4 py-5 sm:px-6 sm:py-6 ${toneClasses[item.tone]}`}>
            <div className="flex items-start gap-4">
              <Icon aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 ${iconTone[item.tone]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col-reverse gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-base font-semibold leading-6 text-slate-950">{item.title}</h2>{item.unread && <span className="h-2 w-2 rounded-full bg-orange-600" aria-label="Unread" />}<span className="w-fit rounded bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700">{item.category}</span></div><time className="shrink-0 text-xs text-slate-500">{item.time}</time></div>
                <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">{item.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button onClick={() => { setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry)); onNavigate(item.destination); }} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold ${item.tone === 'orange' ? 'bg-orange-600 text-white hover:bg-orange-700' : item.tone === 'sky' ? 'bg-[#1e3147] text-white hover:bg-slate-800' : 'bg-blue-100 text-slate-900 hover:bg-blue-200'}`}>{item.action}{item.category === 'Messages & Chat' ? <MessageSquare className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</button>
                  {item.unread && <button onClick={() => setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))} className="min-h-9 px-1 text-xs font-medium text-slate-600 hover:text-slate-950">Mark read</button>}
                  <button onClick={() => setNotifications((items) => items.filter((entry) => entry.id !== item.id))} className="min-h-9 px-1 text-xs font-medium text-slate-600 hover:text-red-700">Dismiss</button>
                </div>
              </div>
            </div>
          </article>;
        })}
        {visible.length === 0 && <div className="px-5 py-14 text-center"><Bell className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-800">{preview ? 'You’re all caught up' : 'Notifications are not connected yet'}</p><p className="mt-1 text-xs text-slate-500">{preview ? 'There are no notifications in this view.' : 'Account alerts will appear here when notification delivery is available.'}</p></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 px-5 py-3 text-xs text-slate-600"><span>Showing {visible.length} of {notifications.length} notification records</span>{preview && !notifications.some((item) => item.id === OLDER_CUSTOMER_NOTIFICATIONS[0]?.id) && <button onClick={() => { setNotifications((items) => [...items, ...OLDER_CUSTOMER_NOTIFICATIONS.filter((older) => !items.some((item) => item.id === older.id)).map((item) => ({ ...item }))]); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-4 font-semibold text-slate-800 shadow-sm hover:bg-slate-50"><Archive className="h-4 w-4" />Load Older Activity<ChevronDown className="h-4 w-4" /></button>}</div>
    </section>

    <section aria-labelledby="notification-preferences-title">
      <h2 id="notification-preferences-title" className="sr-only">Notification preferences</h2>
      <div className="grid gap-4 xl:grid-cols-3">
        <PreferenceCard icon={Mail} title="Email Digest Frequency" description={emailDigest ? 'Currently receiving instant notifications for financial activity and a weekly digest for MCOM updates.' : 'Email digests are paused in this preview.'} action={emailDigest ? 'Pause email digest' : 'Enable email digest'} onAction={() => setEmailDigest((value) => !value)} />
        <PreferenceCard icon={ShieldCheck} title="Critical Security Alerts" description={securitySms ? 'SMS alerts are enabled for new device sessions, password changes, and security events.' : 'Security SMS alerts are paused in this preview.'} action={securitySms ? 'Pause security alerts' : 'Enable security alerts'} onAction={() => setSecuritySms((value) => !value)} accent />
        <PreferenceCard icon={Archive} title="Retention & Archiving" description="Notifications stay searchable in your workspace stream. Retention and exports will be available when connected to the account service." action="View retention details" onAction={() => setNotice('Notification retention settings are not connected yet.')} />
      </div>
      {!preview && <p className="mt-3 text-xs text-slate-500">Notification controls are a frontend preview; preferences and alert delivery are not connected to the account service.</p>}
    </section>
  </div>;
}

function PreferenceCard({ icon: Icon, title, description, action, onAction, accent = false }: { icon: typeof Bell; title: string; description: string; action: string; onAction: () => void; accent?: boolean }) {
  return <article className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><Icon className={`h-6 w-6 ${accent ? 'text-orange-700' : 'text-blue-700'}`} /><h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3><p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-slate-600">{description}</p><button onClick={onAction} className={`mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold ${accent ? 'text-orange-700' : 'text-blue-700'}`}>{action}<ArrowRight className="h-3.5 w-3.5" /></button></article>;
}

function CustomerOverview({
  walletBalance,
  walletLoading,
  appCount,
  transactions,
  onNavigate,
}: {
  walletBalance?: number;
  walletLoading: boolean;
  appCount: number;
  transactions: any[];
  onNavigate: (page: CustomerPage) => void;
}) {
  const stats = [
    { label: 'Wallet balance', value: walletLoading ? 'Loading…' : `${Number(walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} MCOM`, icon: WalletCards, color: 'text-orange-700', action: 'wallet' as const },
    { label: 'MCOM apps', value: `${appCount} available`, icon: Grid2X2, color: 'text-blue-700', action: 'ecosystem' as const },
    { label: 'Recent transactions', value: `${transactions.length} records`, icon: ArrowUpRight, color: 'text-emerald-700', action: 'wallet' as const },
  ];
  const highlights = [
    { title: 'Loyalty & rewards', text: 'Keep your connected rewards apps close at hand.', icon: Compass },
    { title: 'Local offers', text: 'Explore offers and services from the MCOM network.', icon: Box },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, color, action }) => (
          <button key={label} onClick={() => onNavigate(action)} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
              </div>
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            </div>
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">MCOM Product Highlights</h2><p className="mt-1 text-sm text-slate-600">Explore apps available to your customer account.</p></div>
          <button onClick={() => onNavigate('ecosystem')} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-orange-700 sm:inline-flex">View ecosystem <ArrowRight className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {highlights.map(({ title, text, icon: Icon }) => (
            <button key={title} onClick={() => onNavigate('ecosystem')} className="flex min-h-24 items-start gap-3 rounded-lg border border-slate-200 p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/30">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />
              <span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{text}</span><span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-700">Explore apps <ArrowUpRight className="h-4 w-4" /></span></span>
            </button>
          ))}
        </div>
        <button onClick={() => onNavigate('ecosystem')} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700 sm:hidden">View MCOM ecosystem <ArrowRight className="h-4 w-4" /></button>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
          <div><h2 className="font-semibold">Recent wallet activity</h2><p className="mt-1 text-xs text-slate-500">Your latest wallet transactions</p></div>
          <button onClick={() => onNavigate('wallet')} className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700">Wallet <ArrowRight className="h-4 w-4" /></button>
        </div>
        {transactions.length ? <div className="divide-y divide-slate-100">{transactions.slice(0, 4).map((transaction) => (
          <div key={transaction.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <ArrowUpRight className={`h-4 w-4 shrink-0 ${transaction.type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-500'}`} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{transaction.description || transaction.reference || 'Wallet transaction'}</p><p className="mt-0.5 text-xs text-slate-500">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : ''}</p></div>
            <span className={`shrink-0 text-sm font-semibold ${transaction.type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-800'}`}>{transaction.type === 'CREDIT' ? '+' : '−'}{Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        ))}</div> : <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">No wallet activity to show yet.</p>}
      </section>
    </div>
  );
}

function CustomerProfile({ customer, preview, onNavigate, onProfileChange }: { customer: Record<string, any>; preview: boolean; onNavigate: (page: CustomerPage) => void; onProfileChange: (profile: Record<string, any>) => void }) {
  const [profile, setProfile] = useState<Record<string, any>>(() => {
    if (!preview) return customer;
    try { return { ...customer, ...JSON.parse(localStorage.getItem('chs_customer_profile_mock') || '{}') }; } catch { return customer; }
  });
  useEffect(() => setProfile(customer), [customer]);
  const [editOpen, setEditOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(profile.twoFactorEnabled));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    jobTitle: profile.jobTitle || '',
    country: profile.country || '',
    region: profile.region || '',
    phone: profile.phone || '',
  });
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || 'Customer';
  const referralUrl = `https://www.centralhubsolution.com/register?ref=${profile.referralCode || 'CUSTOMER'}`;
  const syncToken = 'mcom_preview_sk_89f02a...c7d82c33';

  const saveProfile = () => {
    if (!preview) {
      setEditOpen(false);
      setNotice('Profile editing is not connected to the customer account service yet.');
      return;
    }
    const updated = { ...profile, ...draft };
    setProfile(updated);
    localStorage.setItem('chs_customer_profile_mock', JSON.stringify(updated));
    onProfileChange(updated);
    setEditOpen(false);
    setNotice('Profile details saved in this browser preview.');
  };
  const copyText = async (value: string, message: string) => {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard may be unavailable in local browser contexts */ }
    setNotice(message);
  };
  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!preview) {
      setNotice('Profile photo uploads are not connected to the customer account service yet.');
      return;
    }
    setAvatarUrl(URL.createObjectURL(file));
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customer Profile</h1><p className="mt-1 text-sm text-slate-600 sm:text-base">Your master customer identity and account details — shared seamlessly across all connected MCOM ecosystem apps.</p></div>
      <button onClick={() => { setDraft({ firstName: profile.firstName || '', lastName: profile.lastName || '', jobTitle: profile.jobTitle || '', country: profile.country || '', region: profile.region || '', phone: profile.phone || '' }); setEditOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"><Pencil className="h-4 w-4" />Edit Profile</button>
    </div>

    {notice && <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X className="h-4 w-4" /></button></div>}

    <section className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
        <div className="relative shrink-0">
          {avatarUrl ? <img src={avatarUrl} alt="Customer profile" className="h-20 w-20 rounded-2xl object-cover shadow-sm sm:h-24 sm:w-24" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-orange-800 text-3xl font-semibold text-white shadow-sm sm:h-24 sm:w-24">{`${profile.firstName?.[0] || 'C'}${profile.lastName?.[0] || ''}`}</div>}
          <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-white text-slate-700 shadow-sm hover:text-orange-700" aria-label="Change profile photo"><Camera className="h-4 w-4" /><input type="file" accept="image/*" className="sr-only" onChange={chooseAvatar} /></label>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{fullName}</h2>{preview && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-800"><BadgeCheck className="h-3.5 w-3.5" />Verified Customer</span>}{(profile.tier || preview) && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold text-orange-900"><Award className="h-3.5 w-3.5" />{profile.tier || 'Gold Tier Status'}</span>}</div>
          <p className="mt-1 text-sm font-medium text-slate-700">{profile.jobTitle || 'CHS Customer'}</p><p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">Managing personal MCOM ecosystem rewards, loyalty stamps, and local merchant perks.</p>
        </div>
      </div>
      <button onClick={() => onNavigate('ecosystem')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-stretch rounded-xl bg-[#fff7f3] px-4 text-sm font-semibold text-orange-900 hover:bg-orange-50 sm:self-center">Manage Tier Benefits <ArrowRight className="h-4 w-4" /></button>
    </section>

    <div className="grid items-stretch gap-5 xl:grid-cols-2">
      <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7"><h3 className="flex items-center gap-3 text-lg font-medium"><UserRound className="h-5 w-5 text-slate-600" />Personal Information</h3><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Public Profile</span></div>
        <dl className="grid flex-1 gap-y-5 px-6 py-6 sm:px-8 sm:py-7">
          <ProfileDatum label="Full name" value={fullName} />
          <ProfileDatum label="Primary location / country" value={<>{profile.country || 'Add your country'} {profile.country === 'Nigeria' && <span aria-label="Nigeria">🇳🇬</span>} {profile.region && <span className="ml-1 font-normal text-slate-500">({profile.region})</span>}</>} />
          <ProfileDatum label="Connected phone" value={<>{profile.phone || 'No phone number added'} {profile.phone && <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-800">• Verified</span>}</>} />
          <ProfileDatum label="Preferred currency" value={<>{profile.currency || 'USD ($) - US Dollar'}<span className="mt-1 block text-sm font-normal text-slate-500">Default billing &amp; rewards currency</span></>} />
          <ProfileDatum label="Account member since" value={<>{profile.memberSince || 'Membership date unavailable'}{profile.memberSince && <span className="ml-2 text-sm font-normal text-slate-500">(Active member)</span>}</>} />
          {preview && <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-sm text-slate-700"><ShieldCheck className="h-5 w-5 text-slate-600" />ID verification valid until {profile.idVerificationValidUntil || '—'}</span><button onClick={() => setNotice('Identity credentials are not connected in the local preview.')} className="shrink-0 text-left text-xs font-semibold text-orange-800 hover:text-orange-950 sm:text-right">View credentials</button></div>}
        </dl>
      </section>

      <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7"><h3 className="flex items-center gap-3 text-lg font-medium"><ShieldCheck className="h-5 w-5 text-slate-600" />Contact &amp; Security</h3><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />Protected</span></div>
        <div className="flex flex-1 flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7">
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Email address</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><span className="break-all text-base font-medium text-slate-950">{profile.email || 'Email not available'}</span>{preview && <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-800">• Primary &amp; Verified</span>}</div></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Two-factor authentication (2FA)</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${twoFactorEnabled ? 'bg-orange-500' : 'bg-slate-300'}`} />{preview ? (twoFactorEnabled ? 'Enabled (SMS & Authenticator App)' : 'Not enabled') : 'Status unavailable'}</span><button onClick={() => setNotice(preview ? 'Two-factor settings are shown for preview; no security setting was changed.' : 'Two-factor settings are not connected to the customer account service yet.')} className="text-sm font-semibold text-orange-800">Manage 2FA</button></div></div>
          {preview && <div className="rounded-xl bg-[#edf2ff] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-slate-700" />MCOM Sync Token</p><span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-semibold text-slate-700">Read &amp; Sync Only</span></div><p className="mt-2 text-xs leading-5 text-slate-600">Use this token to manually sync legacy MCOM wallet cards.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="flex min-w-0 flex-1 items-center rounded-lg bg-white px-3"><code className="min-w-0 flex-1 truncate py-3 text-xs text-slate-700">{showToken ? syncToken : 'mcom_preview_sk_••••••••••••••••c7d82c33'}</code><button onClick={() => setShowToken(!showToken)} aria-label={showToken ? 'Hide sync token' : 'Show sync token'} className="p-1.5 text-slate-600">{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><button onClick={() => copyText(syncToken, 'Preview token copied. It is not an active credential.')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"><Copy className="h-4 w-4" />Copy token</button></div><p className="mt-2 text-[10px] text-slate-500">Sample token for the UI preview; it cannot authenticate.</p></div>}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs text-slate-600">Last password update: {profile.lastPasswordUpdate || 'Not available'}</span><button onClick={() => setNotice('Password changes will be connected to the account service.')} className="text-xs font-semibold text-orange-800">Change password</button></div>
        </div>
      </section>
    </div>

    {preview && <section className="rounded-2xl bg-[#fbf4f5] p-5 sm:p-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
        <div><h3 className="flex items-center gap-3 text-xl font-semibold tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white"><Link2 className="h-5 w-5" /></span>Your Personal Referral Link</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Share this link with friends or local merchants. Anyone who registers with it earns you 500 bonus MCOM loyalty points.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="flex min-h-11 min-w-0 flex-1 items-center rounded-lg bg-white px-4"><code className="truncate text-xs text-slate-700">{referralUrl}</code></div><button onClick={() => copyText(referralUrl, 'Referral link copied.')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700"><Copy className="h-4 w-4" />Copy link</button></div></div>
        <div className="grid grid-cols-2 divide-x divide-blue-100 rounded-xl bg-white p-4 text-center"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Total referrals</p><p className="mt-1 text-2xl font-semibold text-slate-950">{preview ? `${profile.activeReferrals || 0} Active` : '—'}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Points earned</p><p className="mt-1 text-2xl font-semibold text-orange-600">{preview ? `${Number(profile.pointsEarned || 0).toLocaleString()} PTS` : '—'}</p></div></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rose-100 pt-4 text-sm"><span className="font-semibold text-slate-900">Quick share:</span><button onClick={() => setNotice('Referral link ready to share via WhatsApp.')} className="inline-flex items-center gap-2 text-slate-800"><Phone className="h-4 w-4 text-blue-700" />Share via WhatsApp</button><button onClick={() => setNotice('Referral link ready to share on X.')} className="inline-flex items-center gap-2 text-slate-800"><span className="font-semibold">𝕏</span>Share via X</button><button onClick={() => setNotice(`Referral link ready to share by email to ${profile.email || 'your contacts'}.`)} className="inline-flex items-center gap-2 text-slate-800"><Mail className="h-4 w-4 text-red-700" />Share via Email</button></div>
    </section>}

    {editOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="edit-customer-profile-title" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 id="edit-customer-profile-title" className="text-xl font-semibold">Edit your profile</h2><p className="mt-1 text-sm text-slate-600">Update the details connected to your customer identity.</p></div><button onClick={() => setEditOpen(false)} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{[{ key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' }, { key: 'jobTitle', label: 'Role or occupation' }, { key: 'phone', label: 'Phone number' }, { key: 'country', label: 'Country' }, { key: 'region', label: 'State or region' }].map(({ key, label }) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input value={(draft as Record<string, string>)[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-base font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 sm:text-sm" /></label>)}</div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setEditOpen(false)} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold">Cancel</button><button onClick={saveProfile} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white"><Check className="h-4 w-4" />Save changes</button></div></section></div>}
  </div>;
}

function ProfileDatum({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 text-base font-medium text-slate-950">{value}</dd></div>;
}

function CustomerSettings({ name, email, preview, onSignOut }: { name: string; email: string; preview: boolean; onSignOut: () => void }) {
  const initialParts = name.trim().split(/\s+/);
  const initialFirstName = initialParts.shift() || '';
  const initialLastName = initialParts.join(' ');
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [role, setRole] = useState('');
  const [currency, setCurrency] = useState('USD ($) - US Dollar');
  const [twoFactor, setTwoFactor] = useState(preview);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [marketingAlerts, setMarketingAlerts] = useState(true);
  const [notice, setNotice] = useState('');
  const accounts = [
    { name: 'Google', detail: preview ? email || 'Preview account' : 'Not connected', connected: preview },
    { name: 'Apple ID', detail: 'Not linked', connected: false },
    { name: 'GitHub', detail: 'Not linked', connected: false },
  ];
  const toggle = (value: boolean, setValue: (next: boolean) => void, label: string) => (
    <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => {
      if (preview) setValue(!value);
      else setNotice('This setting is not connected to the customer account service yet.');
    }} className={`relative h-7 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 ${value ? 'bg-orange-600' : 'bg-slate-300'}`}>
      <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${value ? 'translate-x-7' : 'translate-x-0'}`} />
    </button>
  );
  const fieldClass = 'mt-1.5 h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-[#edf2ff] px-3 text-base text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm';
  const labelClass = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-600';
  const save = () => setNotice(preview ? 'Preview only: no account settings were changed.' : 'Account settings are not connected to the customer service yet.');
  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account Settings</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Manage your personal account information, security credentials, notification channels, and connected sign-in providers.</p></div>
      <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
        <button onClick={() => { setFirstName(initialFirstName); setLastName(initialLastName); setRole(''); setCurrency('USD ($) - US Dollar'); setTwoFactor(preview); setEmailAlerts(true); setSmsAlerts(false); setMarketingAlerts(true); setNotice('Changes were discarded.'); }} className="min-h-11 rounded-lg bg-[#edf2ff] px-4 text-sm font-semibold text-slate-800">Cancel</button>
        <button onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"><Check className="h-4 w-4" /><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save Preferences</span></button>
      </div>
    </div>
    {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice" className="shrink-0"><X className="h-4 w-4" /></button></div>}
    {!preview && <p className="text-xs text-slate-500">Some settings are display-only until customer account settings are connected.</p>}

    <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:gap-6">
      <section className="min-w-0 rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-5 flex items-start gap-3"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" /><div><h2 className="font-semibold">Personal Information</h2><p className="mt-0.5 text-sm text-slate-600">Update your public profile details and regional preference.</p></div></header>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} className={fieldClass} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Email address<div className="relative"><input value={email || 'Email unavailable'} readOnly className={`${fieldClass} pr-10 text-slate-600`} /><KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /></div><span className="mt-1.5 block text-xs font-normal normal-case tracking-normal text-slate-600">Primary account email. Contact CHS support if it needs to be changed.</span></label>
          <label className={`${labelClass} sm:col-span-2`}>Role / job title<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Add your role or job title" className={fieldClass} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Preferred currency<select value={currency} onChange={(event) => setCurrency(event.target.value)} className={fieldClass}><option>USD ($) - US Dollar</option><option>GBP (£) - British Pound</option><option>NGN (₦) - Nigerian Naira</option></select></label>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-lg bg-blue-50/80 p-4 text-sm leading-5 text-slate-600"><span className="shrink-0 font-semibold text-blue-700">i</span><p>Public profile details can be shared with connected MCOM ecosystem apps.</p></div>
      </section>

      <section className="flex min-w-0 flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-5 flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" /><div><h2 className="font-semibold">Security &amp; Authentication</h2><p className="mt-0.5 text-sm text-slate-600">Manage password and account protection.</p></div></header>
        <p className={labelClass}>Change password</p>
        <div className="mt-2 flex flex-col gap-3 rounded-lg bg-blue-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Password</p><p className="mt-1 text-xs text-slate-600">Reset it using a secure email link.</p></div><button onClick={() => setNotice(preview ? 'Password reset is shown for preview; no email was sent.' : 'Password reset is not connected to the customer account service yet.')} className="min-h-10 shrink-0 rounded-lg bg-white px-3 text-sm font-semibold text-slate-800">Send reset link</button></div>
        <div className="mt-5 border-t border-slate-200 pt-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Two-factor authentication (2FA)</h3><p className="mt-1 text-sm leading-5 text-slate-600">Add another verification step when signing in.</p></div>{toggle(twoFactor, setTwoFactor, 'Two-factor authentication')}</div><p className="mt-4 rounded-lg bg-blue-50/80 p-3 text-xs leading-5 text-slate-700">{preview ? (twoFactor ? '2FA is enabled in this preview.' : '2FA is disabled in this preview.') : '2FA status is not available from the customer account service.'}</p></div>
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-600">Current session details are not shown here.</span><button onClick={() => setNotice('Session management is not connected yet.')} className="min-h-9 text-left text-sm font-semibold text-blue-700 sm:text-right">Log out other devices</button></div>
      </section>

      <section className="min-w-0 rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-5 flex items-start gap-3"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" /><div><h2 className="font-semibold">Notification Preferences</h2><p className="mt-0.5 text-sm text-slate-600">Choose which updates you receive from CHS and MCOM.</p></div></header>
        <div className="divide-y divide-slate-200">
          {[
            { title: 'Email notifications', description: 'Rewards updates, wallet receipts, and account activity.', value: emailAlerts, setter: setEmailAlerts },
            { title: 'SMS & push alerts', description: 'Important security updates and time-sensitive alerts.', value: smsAlerts, setter: setSmsAlerts },
            { title: 'MCOM marketing & promotions', description: 'New local offers, campaigns, and rewards news.', value: marketingAlerts, setter: setMarketingAlerts },
          ].map((item) => <div key={item.title} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="min-w-0"><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p></div>{toggle(item.value, item.setter, item.title)}</div>)}
        </div>
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{preview ? 'Preference changes apply to this local preview only.' : 'Notification preferences are not connected to the customer account service yet.'}</p>
      </section>

      <section className="flex min-w-0 flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-5 flex items-start gap-3"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" /><div><h2 className="font-semibold">Connected Accounts &amp; SSO</h2><p className="mt-0.5 text-sm text-slate-600">Link a sign-in provider for easier access.</p></div></header>
        <div className="space-y-3">{accounts.map((account) => <div key={account.name} className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg bg-blue-50/80 p-3 sm:flex-nowrap"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{account.name}</p><p className="truncate text-xs text-slate-600">{account.detail}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${account.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{account.connected ? 'Connected' : 'Not linked'}</span><button onClick={() => setNotice(preview ? `${account.name} sign-in is for preview only; no account was changed.` : 'Connected account management is not available yet.')} className={`min-h-9 shrink-0 text-xs font-semibold ${account.connected ? 'text-red-700' : 'text-slate-800'}`}>{account.connected ? 'Disconnect' : 'Connect'}</button></div>)}</div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><span className="text-xs text-slate-600">Provider changes require secure account authorization.</span><button onClick={() => setNotice('Account connection activity is not available yet.')} className="min-h-9 text-sm font-semibold text-orange-700">View activity</button></div>
      </section>
    </div>

    <section className="flex flex-col gap-4 rounded-xl border border-red-100 bg-red-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-semibold text-red-800">Deactivate or delete account</h2><p className="mt-1 max-w-3xl text-sm leading-5 text-red-700">Account removal is permanent and can’t be undone. Contact support to review your options.</p></div><button onClick={() => setNotice('Account deletion is not connected. No account changes were made.')} className="min-h-11 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-red-700">Delete customer account</button></section>
  </div>;
}

const amount = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const previewIcon = (name: string) => {
  const icons: Record<string, typeof WalletCards> = { wallet: WalletCards, piggy: PiggyBank, game: Gamepad2, pin: MapPin, gift: Gift, award: Award };
  return icons[name] || Globe2;
};

function PreviewOverview({ balance, onNavigate }: { balance: number; onNavigate: (page: CustomerPage) => void }) {
  const stats = [
    { title: 'Total wallet balance', value: amount(balance), note: '↗ +$250.00 funded this week', icon: WalletCards, color: 'text-orange-700', action: 'wallet' as const },
    { title: 'Connected ecosystem apps', value: '4 Active Apps', note: '3 Rewards, 1 Local Business Perk', icon: Grid2X2, color: 'text-blue-700', action: 'ecosystem' as const },
    { title: 'Unread communications', value: '3 New Messages', note: 'Latest from CHS Concierge Desk', icon: MessageSquare, color: 'text-blue-700', action: 'messages' as const },
  ];
  return <div className="space-y-7">
    <div className="grid gap-4 xl:grid-cols-3">
      {stats.map(({ title, value, note, icon: Icon, color, action }) => <button key={title} onClick={() => onNavigate(action)} className="min-h-40 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p><Icon className={`h-5 w-5 shrink-0 ${color}`} /></div>
        <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p>
        {action === 'wallet' && <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700"><Plus className="h-4 w-4" />Fund wallet</span>}
        {action === 'messages' && <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-800">Open inbox <ArrowRight className="h-4 w-4" /></span>}
        {action === 'ecosystem' && <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-700"><Grid2X2 className="h-4 w-4" />Manage apps</span>}
      </button>)}
    </div>

    <section>
      <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">MCOM Product Highlights</h2><p className="text-sm text-slate-500">Explore connected rewards, cashback, and local offers.</p></div><button onClick={() => onNavigate('ecosystem')} className="hidden items-center gap-1 text-sm font-semibold text-orange-800 sm:inline-flex">View all ecosystem <ArrowRight className="h-4 w-4" /></button></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {CUSTOMER_PRODUCTS.slice(0, 4).map((product, index) => {
          const Icon = previewIcon(product.icon);
          return <article key={product.id} className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${index === 2 ? 'bg-[#1e3147] text-white' : ''}`}>
            <div className="flex items-center justify-between gap-2"><Icon className={`h-6 w-6 ${index === 2 ? 'text-amber-400' : product.tone === 'blue' ? 'text-blue-700' : 'text-orange-700'}`} /><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.state === 'Connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{product.state}</span></div>
            <h3 className="mt-3 font-semibold">{product.name}</h3><p className={`mt-1 min-h-10 text-sm leading-5 ${index === 2 ? 'text-slate-200' : 'text-slate-600'}`}>{product.description}</p>
            <div className={`mt-4 flex items-center justify-between border-t pt-3 text-xs ${index === 2 ? 'border-white/10 text-amber-300' : 'border-slate-100 text-slate-600'}`}><span>{product.detail}</span><button onClick={() => onNavigate('ecosystem')} className={`font-semibold ${index === 2 ? 'text-amber-300' : 'text-slate-800'}`}>{product.action} <ArrowUpRight className="inline h-3.5 w-3.5" /></button></div>
          </article>;
        })}
      </div>
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold">Recent Activity</h2><p className="text-sm text-slate-500">Recent wallet funding and MCOM partner rewards.</p></div><button onClick={() => onNavigate('wallet')} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">View wallet <ArrowRight className="h-4 w-4" /></button></div>
      <TransactionTable compact />
    </section>
  </div>;
}

function PreviewEcosystem() {
  const [category, setCategory] = useState('All Products');
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const categories = ['All Products', 'Loyalty & Rewards', 'Local Perks', 'Gamification & Play', 'Utilities & Gift Cards'];
  const filtered = CUSTOMER_PRODUCTS.filter((product) => (category === 'All Products' || product.category === category) && (!connectedOnly || product.state === 'Connected') && (!query || `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase())));
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">MCOM Ecosystem Marketplace</h2><p className="mt-1 text-sm text-slate-600">Discover, connect, and launch apps across MCOM rewards and local business network.</p></div><div className="flex flex-wrap items-center gap-3"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 sm:flex-none"><Search className="h-4 w-4 shrink-0 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search apps" className="w-full min-w-0 bg-transparent text-base outline-none sm:w-52 sm:text-sm" /></label><button className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">Most Popular⌄</button><button onClick={() => setConnectedOnly(!connectedOnly)} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">Connected only <span className={`relative h-5 w-9 rounded-full transition ${connectedOnly ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${connectedOnly ? 'left-[18px]' : 'left-0.5'}`} /></span></button></div></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${category === item ? 'bg-[#1e3147] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{item}</button>)}</div>
    <section className="grid gap-5 rounded-2xl bg-[#1e3147] p-5 text-white sm:p-7 xl:grid-cols-[1.4fr_0.8fr] xl:items-center">
      <div><span className="rounded-full bg-orange-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">✦ New discovery engine</span><h3 className="mt-4 max-w-2xl text-2xl font-semibold sm:text-3xl">MCOM Rewards Expo &amp; Offline Quests</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">Gather with local businesses, complete offline quests in your area, and claim exclusive ticket rewards directly inside your synced digital wallet.</p><div className="mt-5 flex flex-wrap gap-3"><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700">Explore Expo Details <ArrowRight className="h-4 w-4" /></button><span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm text-slate-200"><Award className="h-4 w-4" />+2,400 XP available</span></div></div>
      <div className="rounded-xl border border-white/10 bg-white/10 p-4"><div className="flex items-center justify-between text-xs font-semibold"><span className="text-orange-400">● &nbsp;METRO ARENA PASS</span><span className="rounded bg-amber-900/50 px-2 py-1 text-amber-200">VIP ACCESS</span></div><div className="mt-4 rounded-lg bg-[#18283b] p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Compass className="h-5 w-5 text-orange-300" /><div><p className="text-sm font-semibold">Downtown Coffee Trail</p><p className="text-xs text-slate-400">4 of 5 stops visited</p></div></div><span className="text-sm font-semibold text-orange-300">+500 PTS</span></div></div><div className="mt-4 flex items-center justify-between text-xs"><span>Quest Progression</span><span>80% Complete</span></div><div className="mt-2 h-1.5 rounded-full bg-white/20"><div className="h-full w-4/5 rounded-full bg-orange-500" /></div></div>
    </section>
    {notice && <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((product) => { const Icon = previewIcon(product.icon); const tone = product.tone === 'blue' ? 'text-blue-700' : 'text-orange-700'; return <article key={product.id} className="flex min-h-64 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><Icon className={`h-6 w-6 ${tone}`} /><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.state === 'Connected' ? 'bg-emerald-50 text-emerald-700' : product.state === 'Available' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{product.state}</span></div><h3 className="mt-4 font-semibold">{product.name}</h3><p className="mt-1 flex-1 text-sm leading-5 text-slate-600">{product.description}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600"><span>{product.detail}</span><span>{product.state === 'Connected' ? 'v3.4.1' : ''}</span></div><button onClick={() => setNotice(`${product.name}: app launch will be connected when the backend integration is ready.`)} className={`mt-3 flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${product.state === 'Connected' || product.action === 'Play now' || product.action === 'Upgrade status' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-blue-50 text-slate-800 hover:bg-blue-100'}`}>{product.action} {product.state === 'Connected' && <ExternalLink className="h-4 w-4" />}</button></article>; })}</div>
    {filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No apps match those filters.</div>}
    <aside className="flex flex-col items-start justify-between gap-4 rounded-xl bg-[#fbf5f1] p-5 sm:flex-row sm:items-center"><div><h3 className="font-semibold">Are you a local business owner?</h3><p className="mt-1 text-sm text-slate-600">Partner with Central Hub Solution to reach nearby customers and grow loyalty.</p></div><button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-orange-800">Join as a business partner <ArrowRight className="h-4 w-4" /></button></aside>
  </div>;
}

function PreviewWallet({ balance, onBalanceChange }: { balance: number; onBalanceChange: (value: number) => void }) {
  const [deposit, setDeposit] = useState('250');
  const [customAmount, setCustomAmount] = useState('250');
  const [gateway, setGateway] = useState('Debit / Credit Card');
  const [notice, setNotice] = useState('');
  const funding = Number(deposit === 'custom' ? customAmount : deposit) || 0;
  const gateways = [{ name: 'Debit / Credit Card', note: 'Instant processing · 0% fee' }, { name: 'Paystack Transfer', note: 'Bank transfer & USSD rail' }, { name: 'Flutterwave / Bank', note: 'Direct account debit & barter' }, { name: 'Crypto / USDT', note: 'ERC20 & TRC20 networks' }];
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold tracking-tight">My Wallet &amp; Funding</h2><span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase text-orange-800">MCOM verified</span></div><p className="mt-1 text-sm text-slate-600">Manage your digital balances, fund your account, and track cross-ecosystem transactions.</p></div><div className="flex flex-wrap gap-2"><button className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium">↓ Export statement</button><button className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium">↔ Withdraw / Transfer</button></div></div>
    {notice && <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}
    <div className="grid gap-3 md:grid-cols-3">{[{ label: 'Total wallet balance', value: amount(balance), note: 'Instant redemption available', icon: WalletCards, tone: 'text-orange-700' }, { label: 'Pending rewards & cashback', value: amount(CUSTOMER_PREVIEW.pendingRewards), note: '↗ +$15.00 in 24 hrs · Tier 3 Multiplier', icon: Award, tone: 'text-blue-700' }, { label: 'Total loyalty points', value: '12,450 PTS', note: 'Value: ~$124.50 USD · Gold Tier', icon: Award, tone: 'text-blue-700' }].map(({ label, value, note, icon: Icon, tone }) => <div key={label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start justify-between p-5"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p></div><Icon className={`h-5 w-5 ${tone}`} /></div><p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600">{note}</p></div>)}</div>
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><span className="h-2 w-2 rounded-full bg-orange-600" />Quick Wallet Funding</h3><p className="mt-1 text-sm text-slate-600">Instantly add funds to your CHS Customer Wallet with zero deposit fees.</p></div><span className="rounded-md bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Guaranteed zero fees</span></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><div><h4 className="text-sm font-semibold">1. Select deposit amount</h4><div className="mt-3 grid grid-cols-4 gap-2">{['25', '50', '100', '250'].map((value) => <button key={value} onClick={() => setDeposit(value)} className={`min-h-10 rounded-lg text-sm font-semibold ${deposit === value ? 'bg-orange-50 text-orange-800 ring-1 ring-orange-300' : 'bg-blue-50 text-slate-700 hover:bg-blue-100'}`}>${value}</button>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs"><label htmlFor="custom-fund">Or enter custom amount</label><span className="font-semibold text-blue-800">Min $10.00 · Max $10,000</span></div><div className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3"><span className="text-slate-500">$</span><input id="custom-fund" type="number" min="10" max="10000" value={customAmount} onChange={(e) => { setCustomAmount(e.target.value); setDeposit('custom'); }} className="w-full text-base outline-none" /><button onClick={() => { setCustomAmount(String(Number(customAmount || 0) + 50)); setDeposit('custom'); }} className="min-h-9 shrink-0 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-slate-700">+ $50</button></div><div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm"><div className="flex justify-between"><span>Funding amount:</span><span className="font-semibold">{amount(funding)}</span></div><div className="mt-2 flex justify-between"><span>Processing surcharge:</span><span>$0.00 (Free)</span></div><div className="mt-2 flex justify-between border-t border-blue-100 pt-2 font-semibold"><span>Credited to wallet:</span><span className="text-orange-800">{amount(funding)}</span></div></div></div>
        <div><h4 className="text-sm font-semibold">2. Select payment gateway</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{gateways.map((item) => <button key={item.name} onClick={() => setGateway(item.name)} className={`min-h-20 rounded-lg border p-3 text-left transition ${gateway === item.name ? 'border-orange-400 bg-orange-50/70' : 'border-slate-200 bg-blue-50/70 hover:border-blue-200'}`}><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><span className={`h-3 w-3 shrink-0 rounded-full border-2 ${gateway === item.name ? 'border-orange-600 bg-orange-600 ring-2 ring-orange-100' : 'border-slate-300'}`} />{item.name}</span><GatewayBrand name={item.name} /></div><p className="mt-2 pl-5 text-xs text-slate-500">{item.note}</p></button>)}</div><button onClick={() => { onBalanceChange(balance + funding); setNotice(`Preview top-up complete: ${amount(funding)} added using ${gateway}. No real payment was taken.`); }} disabled={funding < 10 || funding > 10000} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">Proceed to fund {amount(funding)} <ArrowRight className="h-4 w-4" /></button><p className="mt-2 text-center text-[11px] text-slate-500"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-blue-700" />Preview only — no payment will be processed.</p></div>
      </div>
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap items-center gap-2 sm:gap-3"><h3 className="text-lg font-semibold">Transaction History</h3><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Showing 6 entries</span></div><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><label className="col-span-2 flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-blue-50/70 px-3 sm:min-w-44"><Search className="h-4 w-4 shrink-0 text-slate-500" /><input placeholder="Search transactions…" className="w-full min-w-0 bg-transparent text-base outline-none sm:text-xs" /></label><select className="min-h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs sm:w-auto sm:px-3"><option>All Types</option><option>Credit</option><option>Debit</option></select><select className="min-h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs sm:w-auto sm:px-3"><option>All Statuses</option><option>Success</option><option>Pending</option></select><select className="col-span-2 min-h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-xs sm:col-span-1 sm:w-auto sm:px-3"><option>Last 30 Days</option><option>Last 90 Days</option></select></div></div><TransactionTable /></section>
  </div>;
}

function TransactionTable({ compact = false }: { compact?: boolean }) {
  const entries = compact ? CUSTOMER_TRANSACTIONS.slice(0, 3) : CUSTOMER_TRANSACTIONS;
  const statusClass = (status: string) => status === 'Pending' ? 'bg-amber-50 text-amber-800' : status === 'Success' || status === 'Completed' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700';
  const amountClass = (type: string) => type === 'points' ? 'text-blue-800' : type === 'credit' ? 'text-emerald-700' : 'text-slate-800';
  const rowAmount = (row: typeof entries[number]) => row.type === 'points' ? '−500 PTS' : `${row.type === 'credit' ? '+' : '−'}${amount(row.amount)}`;
  return <div>
    <div className="divide-y divide-slate-100 xl:hidden">
      {entries.map((row) => <article key={row.id} className="space-y-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{row.source}</p>
            <p className="mt-1 text-xs text-slate-500">{compact ? row.date.split(' · ')[0] : row.date}</p>
          </div>
          <span className={`shrink-0 font-semibold ${amountClass(row.type)}`}>{rowAmount(row)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-slate-600">
          <span className="min-w-0 break-words">{compact ? row.description : `${row.id} · ${row.method}`}</span>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${statusClass(row.status)}`}>{row.status}</span>
        </div>
        {!compact && <button className="min-h-9 text-xs font-semibold text-slate-700">View receipt ↗</button>}
      </article>)}
    </div>
    <div className="hidden overflow-x-auto xl:block"><table className="w-full border-collapse text-left"><thead className="bg-blue-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-600"><tr>{(compact ? ['Date', 'Service / Source', 'Description', 'Amount', 'Status'] : ['Transaction ID', 'Date & Time', 'Service / Source', 'Method / Channel', 'Amount', 'Status', 'Receipt']).map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{entries.map((row) => <tr key={row.id} className="text-xs text-slate-700"><td className="px-4 py-4 text-slate-500">{compact ? row.date.split(' · ')[0] : row.id}</td>{!compact && <td className="px-4 py-4">{row.date}</td>}<td className="px-4 py-4"><span className="flex items-center gap-2 font-semibold"><span className={row.type === 'credit' ? 'text-orange-700' : 'text-blue-700'}>{row.type === 'credit' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}</span>{row.source}</span></td>{compact ? <td className="px-4 py-4">{row.description}</td> : <td className="px-4 py-4">{row.method}</td>}<td className={`px-4 py-4 font-semibold ${amountClass(row.type)}`}>{rowAmount(row)}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${statusClass(row.status)}`}>{row.status}</span></td>{!compact && <td className="px-4 py-4"><button className="font-semibold text-slate-700">View receipt ↗</button></td>}</tr>)}</tbody></table></div>
    {!compact && <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>Showing 1 to {entries.length} of 24 entries</span><div className="hidden items-center gap-1 sm:flex"><button className="rounded-md px-2 py-1 hover:bg-slate-100">‹ Previous</button>{[1, 2, 3, 4].map((p) => <button key={p} className={`h-7 w-7 rounded-md ${p === 1 ? 'bg-[#1e3147] text-white' : 'hover:bg-slate-100'}`}>{p}</button>)}<button className="rounded-md px-2 py-1 hover:bg-slate-100">Next ›</button></div></div>}
  </div>;
}

function GatewayBrand({ name }: { name: string }) {
  if (name === 'Debit / Credit Card') return <span className="flex shrink-0 items-center gap-1.5" aria-label="Visa and Mastercard accepted"><img src="/payment-logos/visa.svg" alt="Visa" className="h-4 w-6 object-contain" /><img src="/payment-logos/mastercard.svg" alt="Mastercard" className="h-5 w-5 object-contain" /></span>;
  if (name === 'Paystack Transfer') return <img src="/payment-logos/paystack.svg" alt="Paystack" className="h-5 w-[76px] shrink-0 object-contain object-right" />;
  if (name === 'Flutterwave / Bank') return <img src="/payment-logos/flutterwave.svg" alt="Flutterwave" className="h-6 w-[78px] shrink-0 object-contain object-right" />;
  return <span className="flex shrink-0 items-center gap-1.5"><img src="/payment-logos/tether.svg" alt="Tether" className="h-5 w-5 object-contain" /><span className="text-[10px] font-bold tracking-wide text-emerald-700">USDT</span></span>;
}

function PreviewMessages() {
  const [conversations, setConversations] = useState<CustomerPreviewConversation[]>(() => CUSTOMER_CONVERSATIONS.map((item) => ({ ...item, messages: [...item.messages] })));
  const [selectedId, setSelectedId] = useState(() => window.matchMedia('(min-width: 1024px)').matches ? 'concierge' : '');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const selected = conversations.find((item) => item.id === selectedId);
  const visible = conversations.filter((item) => (filter === 'All' || (filter === 'Unread' ? item.unread > 0 : item.kind === filter)) && item.name.toLowerCase().includes(query.toLowerCase()));
  const send = () => { if (!draft.trim()) return; const message = { id: `local-${Date.now()}`, from: 'me' as const, text: draft.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }; setConversations((items) => items.map((item) => item.id === selectedId ? { ...item, preview: message.text, time: 'Now', messages: [...item.messages, message] } : item)); setDraft(''); };
  return <div className="space-y-4">
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Messages &amp; Support Inbox</h2><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Live sync preview</span></div><p className="mt-1 text-sm text-slate-600">Message CHS Concierge, MCOM support, and partner businesses.</p></div><button onClick={() => setNotice('New chat creation will be connected to the messaging API.')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"><Plus className="h-4 w-4" />Start new chat</button></div>
    {notice && <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}<button onClick={() => setNotice('')}><X className="h-4 w-4" /></button></div>}
    <section className="grid h-[min(640px,calc(100dvh-15rem))] min-h-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-[min(740px,calc(100dvh-230px))] lg:min-h-[500px] lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className={`${selectedId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-slate-200`}>
        <div className="border-b border-slate-200 p-4"><label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 shrink-0 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…" className="min-w-0 flex-1 text-base outline-none sm:text-sm" /><button aria-label="Search filters" className="min-h-9 min-w-9"><Filter className="mx-auto h-4 w-4 text-slate-500" /></button></label><div className="mt-3 flex gap-1.5 overflow-x-auto">{['All', 'Unread', 'Support', 'Merchants'].map((item) => <button key={item} onClick={() => setFilter(item)} className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === item ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700'}`}>{item}{item === 'All' && ' (5)'}{item === 'Unread' && ' (3)'}</button>)}</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{visible.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50 ${selectedId === item.id ? 'border-l-4 border-l-orange-600 bg-[#fff9f4]' : ''}`}><div className="flex gap-3"><ConversationAvatar avatar={item.avatar} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{item.name}</span><span className="shrink-0 text-[10px] text-slate-500">{item.time}</span></div><p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-600">{item.preview}</p><div className="mt-2 flex items-center justify-between"><span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] text-orange-900">{item.tag}</span>{item.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">{item.unread}</span>}</div></div></div></button>)}</div>
      </aside>
      <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col bg-[#f8fbfc]`}>
        {selected && <><header className="flex min-h-[62px] items-center justify-between border-b border-slate-200 bg-white px-4 py-2 sm:px-6"><div className="flex min-w-0 items-center gap-3"><button className="lg:hidden" onClick={() => setSelectedId('')} aria-label="Back to conversations"><ChevronLeft className="h-5 w-5" /></button><ConversationAvatar avatar={selected.avatar} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{selected.name}</span>{selected.label && <span className="rounded bg-blue-100 px-2 py-1 text-[9px] font-semibold text-blue-800">{selected.label} support</span>}</div><p className="mt-0.5 text-[11px] text-emerald-700">● Online · Avg response &lt; 5 min</p></div></div><div className="flex items-center gap-2 text-slate-500"><button className="rounded-lg border border-slate-200 p-2" aria-label="Search chat"><Search className="h-4 w-4" /></button><button className="rounded-lg border border-slate-200 p-2" aria-label="Notifications"><Bell className="h-4 w-4" /></button><button className="rounded-lg border border-slate-200 p-2" aria-label="More options"><MoreVertical className="h-4 w-4" /></button></div></header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-7"><div className="mb-5 self-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600">Today, October 19, 2026</div>{selected.messages.map((message) => <div key={message.id} className={`mb-5 flex items-start gap-3 ${message.from === 'me' ? 'justify-end' : ''}`}>{message.from === 'them' && <ConversationAvatar avatar={selected.avatar} small />}<div className={`min-w-0 ${message.from === 'me' ? 'max-w-[88%] text-right sm:max-w-[78%]' : 'max-w-[calc(100%-2.75rem)] sm:max-w-[78%]'}`}><p className="mb-1 text-[10px] text-slate-500">{message.from === 'me' ? 'You' : `${selected.name} · ${selected.kind === 'Support' ? 'Support Agent' : 'Partner'}`}</p><div className={`break-words rounded-2xl border px-4 py-3 text-sm leading-6 ${message.from === 'me' ? 'rounded-tr-sm border-orange-600 bg-orange-600 text-white' : 'rounded-tl-sm border-slate-200 bg-white text-slate-800'}`}>{message.text}{message.perk && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 p-3 text-left text-xs text-slate-700"><Award className="h-4 w-4 shrink-0 text-orange-700" /><span className="min-w-0 flex-1">{message.perk}</span><button onClick={() => setNotice('Wallet activity opened in preview mode.')} className="shrink-0 font-semibold text-orange-800">View wallet ↗</button></div>}</div><p className="mt-1 text-[10px] text-slate-400">{message.time} {message.from === 'me' && <CheckCheck className="ml-1 inline h-3 w-3" />}</p></div></div>)}</div>
        <div className="border-t border-slate-200 bg-white p-3 sm:px-4 sm:py-3"><div className="mb-2 flex gap-2 overflow-x-auto">{['Thank you so much! 🙌', 'How do I redeem points?', 'Check another transaction'].map((reply) => <button key={reply} onClick={() => setDraft(reply)} className="min-h-9 shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] text-slate-700">{reply}</button>)}</div><div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:gap-2"><button aria-label="Attach file" className="min-h-9 min-w-8 text-slate-500"><Paperclip className="mx-auto h-4 w-4" /></button><button aria-label="Add emoji" className="hidden min-h-9 min-w-8 text-slate-500 sm:block"><Smile className="mx-auto h-4 w-4" /></button><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder={`Type your message to ${selected.name}…`} className="min-w-0 flex-1 bg-transparent px-1 text-base outline-none sm:px-2 sm:text-sm" /><button onClick={send} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white sm:px-4 sm:text-sm">Send <span className="hidden sm:inline">Message</span><Send className="h-4 w-4" /></button></div><p className="mt-1.5 text-center text-[10px] text-slate-400">Messages are saved in this browser preview only.</p></div></>}
      </div>
    </section>
  </div>;
}

function ConversationAvatar({ avatar, small = false }: { avatar: string; small?: boolean }) {
  const isText = avatar.length <= 2;
  const Icon = avatar === 'headset' ? Headphones : ShieldCheck;
  return <span className={`${small ? 'h-8 w-8' : 'h-10 w-10'} flex shrink-0 items-center justify-center rounded-full ${avatar === 'headset' || avatar === 'shield' ? 'bg-[#1e3147] text-orange-400' : avatar === 'MA' ? 'border border-amber-200 bg-amber-50 text-amber-900' : avatar === 'BC' ? 'border border-emerald-200 bg-emerald-50 text-emerald-900' : 'border border-blue-200 bg-blue-50 text-blue-900'} ${small ? 'text-xs' : 'text-sm font-semibold'}`}>{isText ? avatar : <Icon className={`${small ? 'h-4 w-4' : 'h-5 w-5'}`} />}</span>;
}
