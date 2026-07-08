import { useState } from 'react';
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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const getTabInfo = (tab: AdminTab): { title: string; subtitle: string } => {
    const map: Record<AdminTab, { title: string; subtitle: string }> = {
      dashboard: { title: 'Ecosystem Dashboard', subtitle: 'Master overview of the entire MCOM ecosystem' },
      users: { title: 'User Management', subtitle: 'Manage all ecosystem users across roles' },
      businesses: { title: 'Business Management', subtitle: 'Master business control and verification' },
      customers: { title: 'Customer Management', subtitle: 'Manage customer profiles and loyalty' },
      agents: { title: 'Agent Management', subtitle: 'Manage agents and their permissions' },
      consultants: { title: 'Consultant Management', subtitle: 'Manage ecosystem consultants' },
      'account-managers': { title: 'Account Manager Management', subtitle: 'Manage account managers and assignments' },
      memberships: { title: 'Membership Management', subtitle: 'Create and manage ecosystem membership tiers' },
      packages: { title: 'Package Management', subtitle: 'Create platform-specific packages' },
      pricing: { title: 'Pricing Management', subtitle: 'Centralized pricing engine' },
      subscriptions: { title: 'Subscription Management', subtitle: 'Control all ecosystem subscriptions' },
      'platform-access': { title: 'Platform Access Control', subtitle: 'Control platform availability and status' },
      'platform-directory': { title: 'Platform Directory', subtitle: 'Manage the platform directory' },
      'platform-launch': { title: 'Platform Launch Control', subtitle: 'Manage platform launching rules' },
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
      'programme': { title: '90-Day Programme Control', subtitle: 'Full lifecycle control — configure, override, fast-track, monitor every business journey' },
      'system-settings': { title: 'System Settings', subtitle: 'Global ecosystem configuration' },
      'developer-center': { title: 'Developer Center', subtitle: 'Technical administration and tools' },
      'super-admin': { title: 'Super Admin Control Center', subtitle: 'Highest-level administrative control' },
    };
    return map[tab] || { title: tab, subtitle: '' };
  };

  const { title, subtitle } = getTabInfo(activeTab);

  const renderPanel = () => {
    switch (activeTab) {
      case 'dashboard':
        return <OverviewPanel onNavigate={(tab: string) => setActiveTab(tab as AdminTab)} />;
      case 'users':
      case 'businesses':
      case 'customers':
      case 'agents':
      case 'consultants':
      case 'account-managers':
        return <UserManagementPanel />;
      case 'memberships':
      case 'packages':
      case 'pricing':
        return <PlanManagementPanel />;
      case 'subscriptions':
        return <SubscriptionManagementPanel />;
      case 'platform-access':
      case 'platform-directory':
      case 'platform-launch':
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
      case 'programme':
        return <ProgrammeManagementPanel />;
      case 'audit-logs':
      case 'system-settings':
      case 'developer-center':
      case 'super-admin':
        return <SystemPanel />;
      default:
        return <OverviewPanel onNavigate={(tab: string) => setActiveTab(tab as AdminTab)} />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab} title={title} subtitle={subtitle}>
      {renderPanel()}
    </AdminLayout>
  );
}
