import { AppWindow, CheckCircle2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { SsoClientListItem } from '../../../services/admin/types';

interface ConsoleMetricsProps {
  apps: SsoClientListItem[];
}

export default function ConsoleMetrics({ apps }: ConsoleMetricsProps) {
  const totalApps = apps.length;
  const activeApps = apps.filter((a) => a.isActive).length;
  const systemApps = apps.filter((a) => a.isSystemApp).length;
  const customApps = apps.filter((a) => !a.isSystemApp).length;
  const dynamicPermissions = apps.filter((a) => !!a.platformSlug).length;

  const stats = [
    {
      label: 'Registered Apps',
      value: totalApps,
      subtext: `${activeApps} currently active`,
      icon: AppWindow,
      iconBg: 'bg-brand-blue text-white',
    },
    {
      label: 'Active Services',
      value: activeApps,
      subtext: `${totalApps > 0 ? Math.round((activeApps / totalApps) * 100) : 0}% operational rate`,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-600 text-white',
    },
    {
      label: 'System Core Apps',
      value: systemApps,
      subtext: 'Built-in ecosystem engines',
      icon: ShieldCheck,
      iconBg: 'bg-amber-500 text-white',
    },
    {
      label: 'Custom Integrations',
      value: customApps,
      subtext: 'Dynamic tenant platforms',
      icon: Sparkles,
      iconBg: 'bg-purple-600 text-white',
    },
    {
      label: 'Dynamic Permissions',
      value: dynamicPermissions,
      subtext: 'canAccess_* permission keys',
      icon: Zap,
      iconBg: 'bg-sky-600 text-white',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider line-clamp-1">
              {stat.label}
            </span>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shadow-sm ${stat.iconBg}`}>
              <stat.icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight font-display">
              {stat.value}
            </span>
          </div>
          <p className="text-[11px] font-medium text-gray-400 mt-1 line-clamp-1">
            {stat.subtext}
          </p>
        </div>
      ))}
    </div>
  );
}
