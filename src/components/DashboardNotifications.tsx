import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, AlertTriangle, Info, CheckCircle, PackageOpen, Crown,
  CreditCard, Megaphone, Trash2, CheckCheck
} from 'lucide-react';

type NotifType = 'membership' | 'package' | 'update' | 'payment' | 'announcement';

const NOTIFICATIONS = [
  { id: 1, type: 'membership', title: 'Membership Renewing Soon', message: 'Your Silver Membership will automatically renew on 23 Jul 2026.', time: '2 hours ago', read: false, icon: Crown, color: 'text-amber-500', bg: 'bg-amber-100' },
  { id: 2, type: 'payment', title: 'Payment Successful', message: 'Invoice INV-0023 for £99.00 has been paid successfully.', time: '5 hours ago', read: false, icon: CreditCard, color: 'text-green-500', bg: 'bg-green-100' },
  { id: 3, type: 'package', title: 'Package Expired', message: 'Your 247GBS Audit Starter package has expired. Renew to regain access.', time: 'Yesterday', read: true, icon: PackageOpen, color: 'text-red-500', bg: 'bg-red-100' },
  { id: 4, type: 'update', title: 'MCOM Spin Update', message: 'We have added 5 new wheel templates to your library.', time: '2 days ago', read: true, icon: Info, color: 'text-blue-500', bg: 'bg-blue-100' },
  { id: 5, type: 'announcement', title: 'MCOM Expo Launching Q3', message: 'Get ready for the ultimate virtual event platform. Join the waitlist now.', time: 'Last week', read: true, icon: Megaphone, color: 'text-purple-500', bg: 'bg-purple-100' },
];

export default function DashboardNotifications() {
  const [filter, setFilter] = useState<'all' | NotifType>('all');
  const [notifs, setNotifs] = useState(NOTIFICATIONS);

  const visible = filter === 'all' ? notifs : notifs.filter(n => n.type === filter);
  const unreadCount = notifs.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifs(notifs.map(n => ({ ...n, read: true })));
  };

  const removeNotif = (id: number) => {
    setNotifs(notifs.filter(n => n.id !== id));
  };

  const filters = [
    { id: 'all', label: 'All Alerts' },
    { id: 'membership', label: 'Membership' },
    { id: 'package', label: 'Packages' },
    { id: 'payment', label: 'Payments' },
    { id: 'update', label: 'Platform Updates' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-3">
            Notifications Center 
            {unreadCount > 0 && <span className="bg-orange-500 text-white text-sm font-black px-3 py-1 rounded-full">{unreadCount} New</span>}
          </h2>
          <p className="text-gray-500">System alerts, updates, and important announcements.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={markAllRead} className="flex items-center gap-2 px-6 py-3 rounded-full border border-gray-200 hover:bg-gray-50 font-bold text-gray-600 transition-colors text-sm">
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              filter === f.id
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No notifications</h3>
            <p className="text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {visible.map((n, i) => {
                const Icon = n.icon;
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`flex items-start gap-5 p-6 transition-colors group ${n.read ? 'hover:bg-gray-50' : 'bg-orange-50/30 hover:bg-orange-50/50'}`}
                  >
                    <div className={`w-12 h-12 ${n.bg} rounded-2xl flex items-center justify-center flex-shrink-0 mt-1`}>
                      <Icon className={`w-6 h-6 ${n.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-base font-bold ${n.read ? 'text-gray-800' : 'text-gray-900'}`}>{n.title}</h4>
                        {!n.read && <span className="w-2 h-2 bg-orange-500 rounded-full" />}
                      </div>
                      <p className="text-gray-600 text-sm mb-2 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-gray-400 font-medium">{n.time}</p>
                    </div>
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => removeNotif(n.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
