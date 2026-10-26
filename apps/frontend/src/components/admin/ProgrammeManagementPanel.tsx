import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket, Users, BarChart3, Crown,
  Plus, Trash2, Save, RefreshCw, Search, Filter,
  PauseCircle, PlayCircle, FastForward, SkipForward,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Edit3, Copy, Eye,
  User, HeadphonesIcon, Briefcase, ToggleLeft,
  GripVertical, ArrowUpDown, Download, Upload,
  FileText, Calendar, Target, Check, X, Lock,
  ChevronLeft, ChevronsLeft, ChevronsRight, Loader2,
  Zap, Building2
} from 'lucide-react';
import TaskEngineSection from './TaskEngineSection';
import { PROGRAMME_PHASES, getPhaseForDay, getProgressForDay } from '../../lib/programmeData';
import type { ProgrammePhase } from '../../lib/programmeData';
import { cn } from '../../lib/utils';
import {
  useProgrammeAgents,
  useProgrammeBusinesses,
  useProgrammeBusinessAction,
  useUpdateProgrammeBusiness,
} from '../../services/admin/hooks';

// ─── Types ────────────────────────────────────────────────

interface BusinessProgrammeRecord {
  id: string;
  businessName: string;
  sector: string;
  currentDay: number;
  status: 'active' | 'paused' | 'completed' | 'extended';
  agentId: string | null;
  agentName: string;
  accountManagerId: string | null;
  accountManagerName: string;
  consultantId: string | null;
  consultantName: string;
  completedMissions: string[];
  startedAt: string;
  extendedBy: number;
}

interface SupportAgent {
  id: string;
  name: string;
  role: 'agent' | 'account_manager' | 'consultant';
  email: string;
}

type SubTab = 'tasks' | 'businesses' | 'monitoring';

const INTERNAL_PLATFORMS = [
  { id: 'mall', name: 'MCOM Mall' },
  { id: 'rewards', name: 'MCOM Rewards' },
  { id: 'spin', name: 'MCOM Spin' },
  { id: 'hotspot', name: 'MCOM Hotspot' },
  { id: 'qlinks', name: 'MCOM QLinks' },
  { id: 'affiliates', name: '247GBS Affiliates' },
  { id: 'expo', name: '247GBS Expo' },
  { id: 'audit', name: '247GBS Audit' },
  { id: 'central', name: 'MCOM Central' },
];

// ─── Business Action Types & Config ──────────────

type BusinessAction = 'pause' | 'resume' | 'fastTrack' | 'extend' | 'skipPhase' | 'reset';

const ACTION_CONFIGS: Record<BusinessAction, {
  icon: any;
  title: string;
  description: (b: BusinessProgrammeRecord) => string;
  inputType: 'none' | 'number';
  inputLabel?: string;
  inputPlaceholder?: string;
  inputDefault?: number;
  min?: number;
  max?: number;
  confirmLabel: string;
  confirmColor: string;
}> = {
  pause: {
    icon: PauseCircle,
    title: 'Pause Programme',
    description: (b) => `This will pause ${b.businessName}'s activity programme. The business will not be able to progress or complete tasks until resumed.`,
    inputType: 'none',
    confirmLabel: 'Pause Programme',
    confirmColor: 'bg-amber-500 hover:bg-amber-600',
  },
  resume: {
    icon: PlayCircle,
    title: 'Resume Programme',
    description: (b) => `${b.businessName} will continue their activity programme from Day ${b.currentDay} as normal.`,
    inputType: 'none',
    confirmLabel: 'Resume Programme',
    confirmColor: 'bg-green-500 hover:bg-green-600',
  },
  fastTrack: {
    icon: FastForward,
    title: 'Fast-Track Business',
    description: (b) => `Advance ${b.businessName} to a specific day. Their programme will jump forward to that day (missions are tracked by the system automatically).`,
    inputType: 'number',
    inputLabel: 'Target Day',
    inputPlaceholder: 'e.g. 30',
    inputDefault: 30,
    min: 1,
    max: 90,
    confirmLabel: 'Fast-Track',
    confirmColor: 'bg-blue-500 hover:bg-blue-600',
  },
  extend: {
    icon: Clock,
    title: 'Extend Programme',
    description: (b) => `Extend ${b.businessName}'s programme beyond the standard 90 days. The business will have extra time to complete their remaining tasks.`,
    inputType: 'number',
    inputLabel: 'Extra Days',
    inputPlaceholder: 'e.g. 30',
    inputDefault: 30,
    min: 1,
    max: 365,
    confirmLabel: 'Extend',
    confirmColor: 'bg-orange-500 hover:bg-orange-600',
  },
  skipPhase: {
    icon: SkipForward,
    title: 'Skip Phase',
    description: (b) => {
      const current = getPhaseForDay(b.currentDay);
      const next = PROGRAMME_PHASES.find(p => p.dayStart > (current?.dayStart || 0));
      if (current && next) {
        return `${b.businessName} will skip "${current.name}" and advance to "${next.name}" starting at Day ${next.dayStart}.`;
      }
      return `${b.businessName} will be advanced to the next phase.`;
    },
    inputType: 'none',
    confirmLabel: 'Skip to Next Phase',
    confirmColor: 'bg-purple-500 hover:bg-purple-600',
  },
  reset: {
    icon: RefreshCw,
    title: 'Reset Programme',
    description: (b) => `This will completely reset ${b.businessName}'s programme back to Day 1. All progress, completed missions, and extensions will be permanently lost. This action cannot be undone.`,
    inputType: 'none',
    confirmLabel: 'Reset Programme',
    confirmColor: 'bg-red-500 hover:bg-red-600',
  },
};

function BusinessActionModal({
  business,
  actionType,
  onClose,
  onConfirm,
}: {
  business: BusinessProgrammeRecord | null;
  actionType: BusinessAction | null;
  onClose: () => void;
  onConfirm: (action: BusinessAction, value?: number) => void;
}) {
  const [value, setValue] = useState<number | ''>('');

  useEffect(() => {
    if (actionType && ACTION_CONFIGS[actionType]?.inputDefault !== undefined) {
      setValue(ACTION_CONFIGS[actionType].inputDefault!);
    } else {
      setValue('');
    }
  }, [actionType]);

  if (!business || !actionType) return null;

  const config = ACTION_CONFIGS[actionType];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <config.icon className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">{config.title}</h3>
            <p className="text-sm text-gray-500 truncate">{business.businessName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 leading-relaxed">{config.description(business)}</p>

          {config.inputType === 'number' && (
            <div className="mt-5 space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">{config.inputLabel}</label>
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-all"
                placeholder={config.inputPlaceholder}
                min={config.min}
                max={config.max}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-white rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(actionType, value || undefined); onClose(); }}
            className={`px-8 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg ${config.confirmColor}`}
          >
            {config.confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Support agents now come from API via useProgrammeAgents() ────────────────

// ─── Business programme records now come from API via useProgrammeBusinesses() ────────────────

function BusinessesSection() {
  const { data: bizRes, isLoading } = useProgrammeBusinesses();
  const businessAction = useProgrammeBusinessAction();
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessProgrammeRecord | null>(null);
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [actionModal, setActionModal] = useState<{ type: BusinessAction; business: BusinessProgrammeRecord } | null>(null);

  useEffect(() => {
    if (bizRes?.data) setBusinesses(bizRes.data as BusinessProgrammeRecord[]);
  }, [bizRes]);

  const filtered = businesses.filter(b =>
    b.businessName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateBusiness = (id: string, updates: Partial<BusinessProgrammeRecord>) => {
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const togglePause = (b: BusinessProgrammeRecord) => {
    updateBusiness(b.id, { status: b.status === 'paused' ? 'active' : 'paused' });
  };

  const fastTrack = (b: BusinessProgrammeRecord, day: number) => {
    if (day >= 1 && day <= 90) {
      // Only update currentDay — backend will handle completedMissions
      updateBusiness(b.id, {
        currentDay: day,
        status: day >= 90 ? 'completed' : 'active',
      });
    }
  };

  const extendProgramme = (b: BusinessProgrammeRecord, days: number) => {
    if (days > 0) {
      updateBusiness(b.id, { extendedBy: (b.extendedBy || 0) + days, status: 'extended' });
    }
  };

  const skipPhase = (b: BusinessProgrammeRecord) => {
    const currentPhase = getPhaseForDay(b.currentDay);
    if (!currentPhase) return;
    const nextPhaseDay = PROGRAMME_PHASES.find(p => p.dayStart > currentPhase.dayStart)?.dayStart || 90;
    updateBusiness(b.id, { currentDay: nextPhaseDay });
  };

  const resetBusiness = (b: BusinessProgrammeRecord) => {
    updateBusiness(b.id, { currentDay: 1, status: 'active', completedMissions: [], extendedBy: 0 });
  };

  const handleActionConfirm = (action: BusinessAction, value?: number) => {
    if (!actionModal) return;
    const b = actionModal.business;
    if (action === 'pause' || action === 'resume') togglePause(b);
    else if (action === 'fastTrack' && value) fastTrack(b, value);
    else if (action === 'extend' && value) extendProgramme(b, value);
    else if (action === 'skipPhase') skipPhase(b);
    else if (action === 'reset') resetBusiness(b);
    businessAction.mutate({ id: b.id, data: { action, days: value } });
    setActionModal(null);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'active': return <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><PlayCircle className="w-3.5 h-3.5" /> Active</span>;
      case 'paused': return <span className="flex items-center gap-1 text-amber-600 text-xs font-bold"><PauseCircle className="w-3.5 h-3.5" /> Paused</span>;
      case 'completed': return <span className="flex items-center gap-1 text-blue-600 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>;
      case 'extended': return <span className="flex items-center gap-1 text-purple-600 text-xs font-bold"><Clock className="w-3.5 h-3.5" /> Extended</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Modal */}
      <BusinessActionModal
        business={actionModal?.business || null}
        actionType={actionModal?.type || null}
        onClose={() => setActionModal(null)}
        onConfirm={handleActionConfirm}
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search businesses..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-sm"
        />
      </div>

      {/* Override Panel */}
      {showOverridePanel && selectedBusiness && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-brand-blue/20 shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 bg-brand-blue/5 border-b border-brand-blue/10">
            <div>
              <h3 className="font-bold text-gray-900">{selectedBusiness.businessName}</h3>
              <p className="text-xs text-gray-500">Day {selectedBusiness.currentDay} of {90 + (selectedBusiness.extendedBy || 0)} · {selectedBusiness.sector}</p>
            </div>
            <button onClick={() => { setShowOverridePanel(false); setSelectedBusiness(null); }} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={() => setActionModal({ type: selectedBusiness.status === 'paused' ? 'resume' : 'pause', business: selectedBusiness })} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors group">
                {selectedBusiness.status === 'paused' ? <PlayCircle className="w-6 h-6 text-green-500" /> : <PauseCircle className="w-6 h-6 text-amber-500" />}
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">{selectedBusiness.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>
              <button onClick={() => setActionModal({ type: 'fastTrack', business: selectedBusiness })} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group">
                <FastForward className="w-6 h-6 text-blue-500" />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">Fast-Track</span>
              </button>
              <button onClick={() => setActionModal({ type: 'skipPhase', business: selectedBusiness })} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors group">
                <SkipForward className="w-6 h-6 text-purple-500" />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">Skip Phase</span>
              </button>
              <button onClick={() => setActionModal({ type: 'extend', business: selectedBusiness })} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group">
                <Clock className="w-6 h-6 text-orange-500" />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">Extend</span>
              </button>
            </div>

            {/* Day Override */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Current Day</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={selectedBusiness.currentDay}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      updateBusiness(selectedBusiness.id, { currentDay: val });
                      setSelectedBusiness({ ...selectedBusiness, currentDay: val });
                    }}
                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    min="1" max="120"
                  />
                  <span className="text-xs text-gray-400">of {90 + (selectedBusiness.extendedBy || 0)}</span>
                  <button
                    onClick={() => businessAction.mutate({ id: selectedBusiness.id, data: { action: 'fastTrack', days: selectedBusiness.currentDay } })}
                    disabled={businessAction.isPending}
                    className="px-3 py-2 text-xs font-bold bg-brand-blue text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
                  >
                    Save Day
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Progress</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(selectedBusiness.currentDay)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{getProgressForDay(selectedBusiness.currentDay)}%</span>
                </div>
              </div>
              <button onClick={() => setActionModal({ type: 'reset', business: selectedBusiness })} className="self-end px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                Reset
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Business Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No businesses found</p>
          </div>
        )}
        {filtered.map(b => (
          <motion.div
            key={b.id}
            layout
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => { setSelectedBusiness(b); setShowOverridePanel(true); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-dark/10 flex items-center justify-center font-bold text-brand-dark shrink-0">
                {b.businessName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{b.businessName}</p>
                <p className="text-xs text-gray-400">{b.sector} · Day {b.currentDay}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-gray-400">Progress</span>
                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(b.currentDay)}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-500">{getProgressForDay(b.currentDay)}%</span>
              </div>
              <div className="w-24 text-right">{statusIcon(b.status)}</div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SupportSection() {
  const { data: bizRes } = useProgrammeBusinesses();
  const { data: agentsRes } = useProgrammeAgents();
  const updateBizMutation = useUpdateProgrammeBusiness();
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string | null>(null);

  useEffect(() => {
    if (bizRes?.data) setBusinesses(bizRes.data as BusinessProgrammeRecord[]);
  }, [bizRes]);

  const allAgents = ((agentsRes?.data ?? []) as SupportAgent[]);
  const agents = allAgents.filter(a => a.role === 'agent');
  const accountManagers = allAgents.filter(a => a.role === 'account_manager');
  const consultants = allAgents.filter(a => a.role === 'consultant');

  const assign = (bId: string, field: 'agentId' | 'accountManagerId' | 'consultantId', agent: SupportAgent | null) => {
    const updates: Partial<BusinessProgrammeRecord> = {};
    if (field === 'agentId') {
      updates.agentId = agent?.id || null;
      updates.agentName = agent?.name || '';
    } else if (field === 'accountManagerId') {
      updates.accountManagerId = agent?.id || null;
      updates.accountManagerName = agent?.name || '';
    } else if (field === 'consultantId') {
      updates.consultantId = agent?.id || null;
      updates.consultantName = agent?.name || '';
    }
    // Optimistic local update
    setBusinesses(prev => prev.map(b => b.id !== bId ? b : { ...b, ...updates }));
    // Persist to backend
    updateBizMutation.mutate({ id: bId, data: updates as any });
  };

  const getAssignedName = (b: BusinessProgrammeRecord, field: 'agentId' | 'accountManagerId' | 'consultantId', nameField: 'agentName' | 'accountManagerName' | 'consultantName') => {
    return b[field] ? b[nameField] : '—';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Assign support personnel to businesses on the activity programme.</p>
      <div className="space-y-3">
        {businesses.map(b => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setSelectedBiz(selectedBiz === b.id ? null : b.id)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors text-left">
              <div className="w-10 h-10 rounded-xl bg-brand-dark/10 flex items-center justify-center font-bold text-brand-dark shrink-0">{b.businessName.slice(0, 2).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{b.businessName}</p>
                <p className="text-xs text-gray-400">{b.sector}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500">
                <span>Agent: <strong className="text-gray-700">{getAssignedName(b, 'agentId', 'agentName')}</strong></span>
                <span>AM: <strong className="text-gray-700">{getAssignedName(b, 'accountManagerId', 'accountManagerName')}</strong></span>
                <span>Con: <strong className="text-gray-700">{getAssignedName(b, 'consultantId', 'consultantName')}</strong></span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-gray-300 transition-transform", selectedBiz === b.id && "rotate-180")} />
            </button>
            <AnimatePresence>
              {selectedBiz === b.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50/50">
                    {/* Agent */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><User className="w-3.5 h-3.5" /> Assigned Agent</label>
                      <select value={b.agentId || ''} onChange={e => assign(b.id, 'agentId', e.target.value ? agents.find(a => a.id === e.target.value) || null : null)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
                        <option value="">— None —</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    {/* Account Manager */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><HeadphonesIcon className="w-3.5 h-3.5" /> Account Manager</label>
                      <select value={b.accountManagerId || ''} onChange={e => assign(b.id, 'accountManagerId', e.target.value ? accountManagers.find(a => a.id === e.target.value) || null : null)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
                        <option value="">— None —</option>
                        {accountManagers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    {/* Consultant */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><Briefcase className="w-3.5 h-3.5" /> Consultant</label>
                      <select value={b.consultantId || ''} onChange={e => assign(b.id, 'consultantId', e.target.value ? consultants.find(a => a.id === e.target.value) || null : null)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
                        <option value="">— None —</option>
                        {consultants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitoringSection() {
  const { data: bizRes } = useProgrammeBusinesses();
  const businessAction = useProgrammeBusinessAction();
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>([]);

  useEffect(() => {
    if (bizRes?.data) setBusinesses(bizRes.data as BusinessProgrammeRecord[]);
  }, [bizRes]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<BusinessProgrammeRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = businesses.filter(b => {
    const matchesSearch = b.businessName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(b => b.id));
    }
  };

  const bulkAction = (action: 'pause' | 'resume') => {
    if (selectedIds.length === 0) return;
    const msg = `${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedIds.length} business(es)?`;
    if (confirm(msg)) {
      selectedIds.forEach(id => businessAction.mutate({ id, data: { action } }));
      setSelectedIds([]);
    }
  };

  const handleExport = () => {
    const rows = filtered.map(b => {
      const { completed, total } = getPhaseTaskCount(b);
      return [b.businessName, b.status, b.currentDay, `${completed}/${total}`, (b.completedMissions ?? []).length];
    });
    const csv = [['Business', 'Status', 'Current Day', 'Phase Tasks', 'Total Completed Missions'], ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programme-monitoring-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPhaseTaskCount = (b: BusinessProgrammeRecord): { completed: number; total: number; phase: ProgrammePhase | null } => {
    const phase = getPhaseForDay(b.currentDay);
    if (!phase) return { completed: 0, total: 0, phase: null };
    const total = phase.missions.length;
    const completed = b.completedMissions.filter(id => phase.missions.some(m => m.id === id)).length;
    return { completed, total, phase };
  };

  const getOverallTaskCount = (): { completed: number; total: number } => {
    const total = PROGRAMME_PHASES.reduce((s, p) => s + p.missions.length, 0);
    const allMissionIds = new Set(PROGRAMME_PHASES.flatMap(p => p.missions.map(m => m.id)));
    const completed = businesses.reduce((count, b) => {
      return count + (b.completedMissions?.filter(m => allMissionIds.has(m)).length ?? 0);
    }, 0);
    return { completed, total };
  };

  const overall = getOverallTaskCount();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search business..." className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="extended">Extended</option>
        </select>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <span className="text-xs text-gray-400 font-medium ml-auto">{overall.completed}/{overall.total} tasks completed across all businesses</span>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 bg-brand-blue/5 rounded-xl border border-brand-blue/20">
          <span className="text-sm font-bold text-brand-blue">{selectedIds.length} selected</span>
          <button onClick={() => bulkAction('pause')} className="px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Pause</button>
          <button onClick={() => bulkAction('resume')} className="px-3 py-1.5 text-xs font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Resume</button>
          <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Clear</button>
        </motion.div>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedBiz && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-white rounded-xl border border-brand-blue/20 shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-brand-blue/5 border-b border-brand-blue/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-dark/10 flex items-center justify-center font-bold text-brand-dark shrink-0">{selectedBiz.businessName.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedBiz.businessName}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{selectedBiz.sector}</span>
                    <span>·</span>
                    <span>Day {selectedBiz.currentDay}</span>
                    <span>·</span>
                    <span>{selectedBiz.status}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedBiz(null)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Progress Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Day</p>
                  <p className="text-2xl font-black text-brand-dark mt-1">{selectedBiz.currentDay} <span className="text-sm font-bold text-gray-400">/ 90</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Progress</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(selectedBiz.currentDay)}%` }} />
                    </div>
                    <span className="text-lg font-black text-brand-dark">{getProgressForDay(selectedBiz.currentDay)}%</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Phase Tasks</p>
                  <p className="text-2xl font-black text-brand-dark mt-1">
                    {getPhaseTaskCount(selectedBiz).completed} <span className="text-sm font-bold text-gray-400">/ {getPhaseTaskCount(selectedBiz).total}</span>
                  </p>
                </div>
              </div>

              {/* Current Phase Tasks Breakdown */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">
                  Current Phase: {getPhaseTaskCount(selectedBiz).phase?.name || 'N/A'}
                </h4>
                <div className="space-y-2">
                  {getPhaseTaskCount(selectedBiz).phase?.missions.map(mission => {
                    const isCompleted = selectedBiz.completedMissions.includes(mission.id);
                    return (
                      <div key={mission.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                        isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                        )}>
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-semibold",
                            isCompleted ? 'text-green-700' : 'text-gray-700'
                          )}>{mission.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400">{mission.estimatedMinutes} min</span>
                            {mission.system && <span className="text-[10px] text-sky-600">{mission.system}</span>}
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap",
                          isCompleted ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                        )}>
                          {isCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                  {(!getPhaseTaskCount(selectedBiz).phase || getPhaseTaskCount(selectedBiz).phase.missions.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-4">No tasks in current phase</p>
                  )}
                </div>
              </div>

              {/* All Phases Summary */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">All Phases</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {PROGRAMME_PHASES.map(phase => {
                    const phaseCompleted = selectedBiz.completedMissions.filter(id => phase.missions.some(m => m.id === id)).length;
                    const phaseTotal = phase.missions.length;
                    const allDone = phaseCompleted >= phaseTotal;
                    return (
                      <div key={phase.id} className={cn(
                        "p-3 rounded-xl border text-center",
                        allDone ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'
                      )}>
                        <p className="text-[10px] font-bold text-gray-500 truncate">{phase.name}</p>
                        <p className={cn(
                          "text-lg font-black mt-1",
                          allDone ? 'text-green-600' : 'text-gray-700'
                        )}>{phaseCompleted}<span className="text-xs font-bold text-gray-400">/{phaseTotal}</span></p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="p-4 text-left w-10">
                  <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Business</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Day / Progress</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Phase</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tasks</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Agent</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map(b => {
                const phase = getPhaseForDay(b.currentDay);
                const { completed, total } = getPhaseTaskCount(b);
                return (
                  <tr
                    key={b.id}
                    className={cn(
                      "transition-colors cursor-pointer",
                      selectedBiz?.id === b.id ? 'bg-brand-blue/5' : 'hover:bg-gray-50/50'
                    )}
                    onClick={() => setSelectedBiz(b)}
                  >
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggleSelect(b.id)} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-dark/10 flex items-center justify-center text-[10px] font-bold text-brand-dark shrink-0">{b.businessName.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{b.businessName}</p>
                          <p className="text-[10px] text-gray-400">{b.sector}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-900 text-sm">Day {b.currentDay}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(b.currentDay)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{getProgressForDay(b.currentDay)}%</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-gray-700 font-medium">{phase?.name || '—'}</span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold",
                        completed === total && total > 0 ? 'bg-green-100 text-green-700' :
                        completed > 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      )}>
                        {completed}/{total}
                      </span>
                    </td>
                    <td className="p-4">
                      {b.status === 'active' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold"><PlayCircle className="w-3 h-3" /> Active</span>}
                      {b.status === 'paused' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold"><PauseCircle className="w-3 h-3" /> Paused</span>}
                      {b.status === 'completed' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> Done</span>}
                      {b.status === 'extended' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold"><Clock className="w-3 h-3" /> Extended</span>}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{b.agentName || '—'}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{b.startedAt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No businesses match your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{filtered.length} business{filtered.length !== 1 ? 'es' : ''} found</span>
          <span className="text-gray-300">|</span>
          <span className="font-medium">{businesses.filter(b => b.status === 'active').length} active · {businesses.filter(b => b.status === 'paused').length} paused · {businesses.filter(b => b.status === 'completed').length} completed</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          >
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <span className="text-xs text-gray-400 mx-2">
            Page {safePage} of {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button onClick={() => goToPage(1)} disabled={safePage <= 1} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => goToPage(safePage - 1)} disabled={safePage <= 1} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>

            {(() => {
              const pages: (number | string)[] = [];
              const delta = 1;
              const left = Math.max(2, safePage - delta);
              const right = Math.min(totalPages - 1, safePage + delta);

              pages.push(1);
              if (left > 2) pages.push('...');
              for (let i = left; i <= right; i++) pages.push(i);
              if (right < totalPages - 1) pages.push('...');
              if (totalPages > 1) pages.push(totalPages);

              return pages.map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={cn(
                      "w-7 h-7 rounded-lg text-xs font-bold transition-colors",
                      p === safePage ? 'bg-brand-blue text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {p}
                  </button>
                )
              );
            })()}

            <button onClick={() => goToPage(safePage + 1)} disabled={safePage >= totalPages} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => goToPage(totalPages)} disabled={safePage >= totalPages} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────

const SUB_TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'tasks', label: 'Task Engine & Rewards', icon: Target },
  { id: 'businesses', label: 'Business Override', icon: Users },
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
];

export default function ProgrammeManagementPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('subTab') as SubTab;

  const [subTab, setSubTab] = useState<SubTab>(() => {
    if (urlTab && ['tasks', 'businesses', 'monitoring'].includes(urlTab)) {
      return urlTab;
    }
    const stored = localStorage.getItem('adminProgrammeSubTab') as SubTab | null;
    return stored && ['tasks', 'businesses', 'monitoring'].includes(stored) ? stored : 'tasks';
  });

  useEffect(() => {
    if (urlTab && ['tasks', 'businesses', 'monitoring'].includes(urlTab) && urlTab !== subTab) {
      setSubTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (newTab: SubTab) => {
    setSubTab(newTab);
    localStorage.setItem('adminProgrammeSubTab', newTab);
    setSearchParams({ subTab: newTab });
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-br from-brand-blue to-brand-dark rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-5 h-5 text-white/80" />
            <h2 className="text-lg font-black">Activity Programme Control Center</h2>
          </div>
          <p className="text-sm text-white/70 max-w-2xl">
            Configure programme tasks and rewards, override individual business progress, assign support personnel, and monitor all businesses in the programme.
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all",
              subTab === tab.id
                ? "bg-white text-brand-blue shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {subTab === 'tasks' && <TaskEngineSection />}
          {subTab === 'businesses' && <BusinessesSection />}
          {subTab === 'monitoring' && <MonitoringSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
