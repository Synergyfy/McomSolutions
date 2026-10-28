import { useNavigate, useLocation, useMatch } from 'react-router-dom';
import AdminLayout, { AdminTab } from '../components/AdminLayout';
import OverviewPanel from '../components/admin/OverviewPanel';
import UserManagementPanel from '../components/admin/UserManagementPanel';
import PlanManagementPanel from '../components/admin/PlanManagementPanel';
import SubscriptionManagementPanel from '../components/admin/SubscriptionManagementPanel';
import PlatformPanel from '../components/admin/PlatformPanel';
import PermissionPanel from '../components/admin/PermissionPanel';
import ConfigPanel from '../components/admin/ConfigPanel';
import FinancePanel from '../components/admin/FinancePanel';
import IntegrationPanel from '../components/admin/IntegrationPanel';
import AnalyticsPanel from '../components/admin/AnalyticsPanel';
import CommunicationPanel from '../components/admin/CommunicationPanel';
import SystemPanel from '../components/admin/SystemPanel';
import ProgrammeManagementPanel from '../components/admin/ProgrammeManagementPanel';
import ProgrammeProgressPanel from '../components/admin/ProgrammeProgressPanel';
import HighStreetsPanel from '../components/admin/HighStreetsPanel';
import BoroughsPanel from '../components/admin/BoroughsPanel';
import LocalMallsPanel from '../components/admin/LocalMallsPanel';
import ConsolePanel from '../components/admin/console/ConsolePanel';
import { WalletPanel } from '../components/admin/wallet/WalletPanel';
import { McomPayPanel } from '../components/admin/mcom-pay/McomPayPanel';
import SectorsCategoriesPanel from '../components/admin/SectorsCategoriesPanel';
import CouponsPanel from '../components/admin/CouponsPanel';
import AdminMembershipEditor from './AdminMembershipEditor';
import AdminAccessEditor from './AdminAccessEditor';
import AccessPlansPanel from '../components/admin/AccessPlansPanel';
import AdminCouponEditor from './AdminCouponEditor';
import DashboardAccessPanel from '../components/admin/DashboardAccessPanel';

const ADMIN_TABS: AdminTab[] = [
  'dashboard', 'users',
  'memberships', 'access', 'subscriptions',
  'coupons', 'dashboard-access',
  'platform-access',
  'permissions', 'auth', 'registration-flow', 'business-profile',
  'payments', 'billing',
  'api-keys', 'integrations',
  'analytics', 'reports',
  'notifications', 'support',
  'audit-logs',
  'console',
  'wallet',
  'mcom-pay',
  'programme',
  'programme-progress',
  'system-settings', 'developer-center', 'super-admin',
  'high-streets', 'boroughs', 'local-malls',
  'sectors-categories',
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const segments = location.pathname.split('/');
  const pathTab = segments[2] || 'dashboard';
  const activeTab = (ADMIN_TABS as readonly string[]).includes(pathTab) ? (pathTab as AdminTab) : 'dashboard';

  // Dedicated editor pages use explicit route matches so nested paths are
  // never mistaken for the list view.
  const membershipNewMatch = useMatch('/admin/memberships/new');
  const membershipEditMatch = useMatch('/admin/memberships/:id/edit');
  const isMembershipEditor = !!(membershipNewMatch || membershipEditMatch);
  const editorTitle = membershipNewMatch ? 'New Membership' : 'Edit Membership';

  const couponNewMatch = useMatch('/admin/coupons/new');
  const couponEditMatch = useMatch('/admin/coupons/:id/edit');
  const isCouponEditor = !!(couponNewMatch || couponEditMatch);
  const couponEditorTitle = couponNewMatch ? 'New Coupon' : 'Edit Coupon';

  const accessNewMatch = useMatch('/admin/access/new');
  const accessEditMatch = useMatch('/admin/access/:id/edit');
  const isAccessEditor = !!(accessNewMatch || accessEditMatch);
  const accessEditorTitle = accessNewMatch ? 'New Access Pass' : 'Edit Access Pass';

  const handleTabChange = (tab: AdminTab) => {
    navigate(tab === 'dashboard' ? '/admin' : `/admin/${tab}`);
  };

  const getTabInfo = (tab: AdminTab): { title: string; subtitle: string } => {
    const map: Record<AdminTab, { title: string; subtitle: string }> = {
      dashboard: { title: 'Ecosystem Dashboard', subtitle: 'Master overview of the entire MCOM ecosystem' },
      users: { title: 'User Management', subtitle: 'Manage all ecosystem users across roles' },
      memberships: { title: 'Membership Management', subtitle: 'Create and manage ecosystem membership tiers' },
      access: { title: 'Access Passes', subtitle: 'Create fixed-duration, one-time access passes and bundle platform plans' },
      subscriptions: { title: 'Subscription Management', subtitle: 'Control all ecosystem subscriptions' },
      coupons: { title: 'Coupon Management', subtitle: 'Create codes, control redemption limits, and audit every discount' },
      'dashboard-access': { title: 'Dashboard Access & Verification', subtitle: 'Configure trial access duration, verification fee, and verification enforcement' },
      'platform-access': { title: 'Platform Access Control', subtitle: 'Control platform availability and status' },
      permissions: { title: 'Permission Management', subtitle: 'Role and permission control matrix' },
      auth: { title: 'Authentication Management', subtitle: 'Manage login, registration, and security policies' },
      'registration-flow': { title: 'Registration Flow Management', subtitle: 'Control the onboarding process' },
      'business-profile': { title: 'Business Profile Management', subtitle: 'Configure business profile structure' },
      payments: { title: 'Payment Management', subtitle: 'Central payment control and reconciliation' },
      billing: { title: 'Billing Management', subtitle: 'Subscription billing and recurring payments' },
      'api-keys': { title: 'API Management', subtitle: 'Manage platform API keys and permissions' },
      integrations: { title: 'Integration Management', subtitle: 'Manage ecosystem integrations' },
      analytics: { title: 'Analytics Center', subtitle: 'Ecosystem intelligence and metrics' },
      reports: { title: 'Reporting Center', subtitle: 'Generate and export ecosystem reports' },
      notifications: { title: 'Notification Management', subtitle: 'Create and manage ecosystem notifications' },
      support: { title: 'Support Management', subtitle: 'Manage support tickets and assignments' },
      'audit-logs': { title: 'Audit Logs', subtitle: 'Track all admin activity in the ecosystem' },
      'console': { title: 'MCOM Console', subtitle: 'Register and manage ecosystem applications' },
      'wallet': { title: 'Wallet Management', subtitle: 'View and manage user wallets and transactions across all platforms' },
      'mcom-pay': { title: 'MCOM Pay Ledger', subtitle: 'Read-only ledger of every charge processed through registered apps' },
      'programme': { title: 'Activity Programme Control', subtitle: 'Full lifecycle control — configure, override, fast-track, monitor every business journey' },
      'programme-progress': { title: 'Programme Progress', subtitle: 'Track every business and customer — tasks done, expired, and still outstanding' },
      'system-settings': { title: 'System Settings', subtitle: 'Global ecosystem configuration' },
      'developer-center': { title: 'Developer Center', subtitle: 'Technical administration and tools' },
      'super-admin': { title: 'Super Admin Control Center', subtitle: 'Highest-level administrative control' },
      'high-streets': { title: 'High Street Management', subtitle: 'Manage physical and virtual high street ecosystems across boroughs' },
      boroughs: { title: 'Borough Management', subtitle: 'Command center for local borough ecosystems and engagement systems' },
      'local-malls': { title: 'LocalMall Management', subtitle: 'Control centre for local digital economies — postcode territories, businesses, and ecosystem participation' },
      'sectors-categories': { title: 'Sector & Category Management', subtitle: 'Manage ecosystem business sectors, categories, and subcategories' },
    };
    return map[tab] || { title: tab, subtitle: '' };
  };

  const tabInfo = getTabInfo(activeTab);
  const title = isMembershipEditor
    ? editorTitle
    : isAccessEditor
      ? accessEditorTitle
      : isCouponEditor
        ? couponEditorTitle
        : tabInfo.title;
  const subtitle = isMembershipEditor
    ? 'Step-by-step setup — tiers, splits, features, limits and bundles'
    : isAccessEditor
      ? 'One-time pass — price, fixed duration, platform plans and variants'
      : isCouponEditor
        ? 'Discount, membership/access scope, validity and redemption limits'
        : tabInfo.subtitle;

  const renderPanel = () => {
    switch (activeTab) {
      case 'dashboard':
        return <OverviewPanel onNavigate={(tab: string) => handleTabChange(tab as AdminTab)} />;
      case 'users':
        return <UserManagementPanel />;
      case 'memberships':
        return <PlanManagementPanel />;
      case 'access':
        return <AccessPlansPanel />;
      case 'subscriptions':
        return <SubscriptionManagementPanel />;
      case 'coupons':
        return <CouponsPanel />;
      case 'dashboard-access':
        return <DashboardAccessPanel />;
      case 'platform-access':
        return <PlatformPanel />;
      case 'permissions':
        return <PermissionPanel />;
      case 'auth':
      case 'registration-flow':
      case 'business-profile':
        return <ConfigPanel />;
      case 'payments':
      case 'billing':
        return <FinancePanel />;
      case 'api-keys':
      case 'integrations':
        return <IntegrationPanel />;
      case 'analytics':
      case 'reports':
        return <AnalyticsPanel />;
      case 'notifications':
      case 'support':
        return <CommunicationPanel />;
      case 'console':
        return <ConsolePanel />;
      case 'wallet':
        return <WalletPanel />;
      case 'mcom-pay':
        return <McomPayPanel />;
      case 'programme':
        return <ProgrammeManagementPanel />;
      case 'programme-progress':
        return <ProgrammeProgressPanel />;
      case 'audit-logs':
      case 'system-settings':
      case 'developer-center':
      case 'super-admin':
        return <SystemPanel />;
      case 'high-streets':
        return <HighStreetsPanel />;
      case 'boroughs':
        return <BoroughsPanel />;
      case 'local-malls':
        return <LocalMallsPanel />;
      case 'sectors-categories':
        return <SectorsCategoriesPanel />;
      default:
        return <OverviewPanel onNavigate={(tab: string) => handleTabChange(tab as AdminTab)} />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={handleTabChange} title={title} subtitle={subtitle}>
      {isMembershipEditor ? (
        <AdminMembershipEditor />
      ) : isAccessEditor ? (
        <AdminAccessEditor />
      ) : isCouponEditor ? (
        <AdminCouponEditor />
      ) : (
        renderPanel()
      )}
    </AdminLayout>
  );
}
