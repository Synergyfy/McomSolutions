import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, LifeBuoy, Send, Plus, X, Trash2, Eye, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData } from '../../context/AdminDataContext';

export default function CommunicationPanel() {
  const [tab, setTab] = useState<'notifications' | 'support'>('notifications');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        <button onClick={() => setTab('notifications')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'notifications' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><Bell className="w-4 h-4" />Notifications</button>
        <button onClick={() => setTab('support')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'support' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><LifeBuoy className="w-4 h-4" />Support Tickets</button>
      </div>
      {tab === 'notifications' ? <NotificationsPanel /> : <SupportPanel />}
    </div>
  );
}

function NotificationsPanel() {
  const { notifications, addNotification, deleteNotification, updateNotification } = useAdminData();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500 font-medium">{notifications.length} notifications</p>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"><Send className="w-4 h-4" /> Create Notification</button>
      </div>
      <div className="space-y-4">
        {notifications.map(n => (
          <div key={n.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">{n.title}</h3><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", n.status === 'Sent' ? 'bg-green-50 text-green-700' : n.status === 'Scheduled' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600')}>{n.status}</span></div>
                <p className="text-xs text-gray-500 mt-1">{n.message}</p>
              </div>
              <div className="flex gap-1.5">
                {n.status === 'Draft' && <button onClick={() => updateNotification(n.id, { status: 'Scheduled' })} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Send className="w-3.5 h-3.5 text-gray-400" /></button>}
                <button onClick={() => deleteNotification(n.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Audience: <span className="font-bold text-gray-600">{n.audience.join(', ')}</span></span>
              {n.sentCount > 0 && <span>Sent to: <span className="font-bold text-gray-600">{n.sentCount}</span></span>}
              <span>Scheduled: {n.scheduledDate}</span>
            </div>
          </div>
        ))}
      </div>
      {notifications.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400 bg-white rounded-2xl border border-gray-100">No notifications created yet</div>}

      <AnimatePresence>
        {showAdd && <NotificationForm onSave={(data) => { addNotification(data); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
}

function NotificationForm({ onSave, onCancel }: any) {
  const [form, setForm] = useState({ title: '', message: '', audience: [] as string[], scheduledDate: new Date().toISOString().split('T')[0], status: 'Draft' as const, sentCount: 0, createdAt: new Date().toISOString().split('T')[0] });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h4 className="text-lg font-bold">Create Notification</h4><button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Title</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Message</label><textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-24 resize-none" /></div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Target Audience</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">
              {['Businesses', 'Customers', 'Agents', 'Consultants', 'Account Managers'].map(a => (
                <button key={a} type="button" onClick={() => setForm({ ...form, audience: form.audience.includes(a) ? form.audience.filter(x => x !== a) : [...form.audience, a] })}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", form.audience.includes(a) ? "bg-brand-blue text-white" : "bg-white text-gray-500 hover:bg-gray-100")}>{a}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Scheduled Date</label><input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={() => onSave({ ...form, status: 'Scheduled' })} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">Schedule</button>
        </div>
      </motion.div>
    </div>
  );
}

function SupportPanel() {
  const { supportTickets, updateSupportTicket } = useAdminData();
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? supportTickets : supportTickets.filter(t => t.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {['All', 'Open', 'Resolved', 'Escalated'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", filter === f ? "bg-brand-blue text-white shadow-glow" : "bg-white text-gray-400 hover:text-gray-600 border border-gray-100")}>{f}</button>
        ))}
      </div>
      <div className="space-y-4">
        {filtered.map(ticket => (
          <div key={ticket.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{ticket.subject}</h3>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", ticket.priority === 'High' ? 'bg-red-50 text-red-700' : ticket.priority === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600')}>{ticket.priority}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", ticket.status === 'Open' ? 'bg-blue-50 text-blue-700' : ticket.status === 'Resolved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{ticket.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{ticket.message}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                  <span>From: <span className="font-bold text-gray-600">{ticket.from}</span> ({ticket.fromType})</span>
                  <span>Assigned: {ticket.assignedTo}</span>
                  <span>{ticket.createdAt}</span>
                </div>
              </div>
              <div className="flex gap-1.5 ml-4">
                {ticket.status === 'Open' && <button onClick={() => updateSupportTicket(ticket.id, { status: 'Resolved' })} className="p-2 bg-gray-50 rounded-lg hover:bg-green-50 hover:text-green-600 transition-all" title="Resolve"><CheckCircle2 className="w-3.5 h-3.5 text-gray-400" /></button>}
                {ticket.status === 'Open' && <button onClick={() => updateSupportTicket(ticket.id, { status: 'Escalated' })} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all" title="Escalate"><AlertTriangle className="w-3.5 h-3.5 text-gray-400" /></button>}
                <button className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all" title="Reply"><MessageSquare className="w-3.5 h-3.5 text-gray-400" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400 bg-white rounded-2xl border border-gray-100">No tickets found</div>}
    </div>
  );
}
