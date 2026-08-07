import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket, Settings, Users, BarChart3, Shield, Crown,
  Plus, Trash2, Save, RefreshCw, Search, Filter,
  PauseCircle, PlayCircle, FastForward, SkipForward,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Edit3, Copy, Eye,
  User, HeadphonesIcon, Briefcase, ToggleLeft,
  GripVertical, ArrowUpDown, Download, Upload,
  FileText, Calendar, Target, Check, X, Lock,
  ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { PROGRAMME_PHASES, getPhaseForDay, getProgressForDay, getTotalMissions } from '../../lib/programmeData';
import type { ProgrammePhase, ProgrammeMission } from '../../lib/programmeData';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────

interface ReadinessGate {
  id: string;
  name: string;
  minProgressPercent: number;
  isEnabled: boolean;
}

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

type SubTab = 'config' | 'businesses' | 'monitoring';

const DEFAULT_GATES: ReadinessGate[] = [
  { id: 'gate-audit', name: 'Audit Access', minProgressPercent: 80, isEnabled: true },
  { id: 'gate-expo', name: 'Expo Publishing', minProgressPercent: 60, isEnabled: true },
  { id: 'gate-campaign', name: 'Campaign Creation', minProgressPercent: 40, isEnabled: true },
  { id: 'gate-advanced', name: 'Advanced Tools', minProgressPercent: 20, isEnabled: true },
];

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
    description: (b) => `This will pause ${b.businessName}'s 90-day programme. The business will not be able to progress or complete tasks until resumed.`,
    inputType: 'none',
    confirmLabel: 'Pause Programme',
    confirmColor: 'bg-amber-500 hover:bg-amber-600',
  },
  resume: {
    icon: PlayCircle,
    title: 'Resume Programme',
    description: (b) => `${b.businessName} will continue their 90-day programme from Day ${b.currentDay} as normal.`,
    inputType: 'none',
    confirmLabel: 'Resume Programme',
    confirmColor: 'bg-green-500 hover:bg-green-600',
  },
  fastTrack: {
    icon: FastForward,
    title: 'Fast-Track Business',
    description: (b) => `Advance ${b.businessName} to a specific day. All missions up to that day will be marked as completed and their status updated accordingly.`,
    inputType: 'number',
    inputLabel: 'Target Day',
    inputPlaceholder: 'e.g. 90',
    inputDefault: 90,
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

const MOCK_SUPPORT: SupportAgent[] = [
  { id: 'agent-1', name: 'John Smith', role: 'agent', email: 'john@mcom.com' },
  { id: 'agent-2', name: 'Sarah Jones', role: 'agent', email: 'sarah@mcom.com' },
  { id: 'am-1', name: 'Emily Davis', role: 'account_manager', email: 'emily@mcom.com' },
  { id: 'am-2', name: 'Michael Brown', role: 'account_manager', email: 'michael@mcom.com' },
  { id: 'con-1', name: 'David Wilson', role: 'consultant', email: 'david@mcom.com' },
  { id: 'con-2', name: 'Lisa Taylor', role: 'consultant', email: 'lisa@mcom.com' },
];

const MOCK_BUSINESSES: BusinessProgrammeRecord[] = [
  { id: 'b1', businessName: 'Toby Barbers', sector: 'Hospitality', currentDay: 17, status: 'active', agentId: 'agent-1', agentName: 'John Smith', accountManagerId: 'am-1', accountManagerName: 'Emily Davis', consultantId: null, consultantName: '', completedMissions: [], startedAt: '2026-06-20', extendedBy: 0 },
  { id: 'b2', businessName: 'Jane\'s Café', sector: 'Food & Beverage', currentDay: 4, status: 'paused', agentId: 'agent-2', agentName: 'Sarah Jones', accountManagerId: null, accountManagerName: '', consultantId: null, consultantName: '', completedMissions: [], startedAt: '2026-07-03', extendedBy: 0 },
  { id: 'b3', businessName: 'Green Grocers', sector: 'Retail', currentDay: 8, status: 'active', agentId: 'agent-1', agentName: 'John Smith', accountManagerId: 'am-2', accountManagerName: 'Michael Brown', consultantId: 'con-1', consultantName: 'David Wilson', completedMissions: [], startedAt: '2026-06-28', extendedBy: 5 },
  { id: 'b4', businessName: 'TechFix Ltd', sector: 'Technology', currentDay: 45, status: 'active', agentId: 'agent-2', agentName: 'Sarah Jones', accountManagerId: 'am-1', accountManagerName: 'Emily Davis', consultantId: 'con-2', consultantName: 'Lisa Taylor', completedMissions: [], startedAt: '2026-05-15', extendedBy: 0 },
  { id: 'b5', businessName: 'Bright Smiles Dental', sector: 'Health & Wellness', currentDay: 90, status: 'completed', agentId: 'agent-1', agentName: 'John Smith', accountManagerId: null, accountManagerName: '', consultantId: null, consultantName: '', completedMissions: [], startedAt: '2026-03-01', extendedBy: 0 },
];

// ─── Task Editor Modal ──────────────────────────────

const SUBMISSION_TYPES = [
  { id: 'internal_platform', label: 'Internal Platform', description: 'Task completed within an MCOM platform' },
  { id: 'external_link', label: 'External Link', description: 'Task completed via external URL' },
  { id: 'image_upload', label: 'Image Upload', description: 'User uploads an image to complete' },
  { id: 'text_input', label: 'Text Input', description: 'User enters text to complete' },
  { id: 'digit_input', label: 'Digit Input', description: 'User enters digits to complete' },
] as const;

type SubmissionTypeId = typeof SUBMISSION_TYPES[number]['id'];

interface TaskFormData {
  id: string;
  title: string;
  description: string;
  instructions: string;
  estimatedMinutes: number;
  reward: string;
  submissionType: SubmissionTypeId;
  system: string;
  systemUrl: string;
  ctaLabel: string;
}

const EMPTY_TASK: TaskFormData = {
  id: '',
  title: '',
  description: '',
  instructions: '',
  estimatedMinutes: 10,
  reward: '+50 points',
  submissionType: 'internal_platform',
  system: 'MCOM Central',
  systemUrl: '',
  ctaLabel: 'Continue',
};

function TaskEditorModal({
  open,
  formData,
  onClose,
  onSave,
}: {
  open: boolean;
  formData: TaskFormData;
  onClose: () => void;
  onSave: (data: TaskFormData) => void;
}) {
  const [local, setLocal] = useState<TaskFormData>(formData);
  const [step, setStep] = useState(1);

  useEffect(() => {
    setLocal(formData);
    setStep(1);
  }, [formData, open]);

  if (!open) return null;

  const isValid = local.title.trim().length > 0;
  const showPlatform = local.submissionType === 'internal_platform' || local.submissionType === 'external_link';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{local.id ? 'Edit Task' : 'New Task'}</h3>
              <p className="text-sm text-gray-500 mt-0.5">Configure the task details and how it's completed.</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 1 ? 'bg-brand-blue text-white shadow-sm' : 'bg-gray-200 text-gray-400'}`}>1</div>
              <span className={`text-xs font-bold transition-colors ${step === 1 ? 'text-brand-blue' : 'text-gray-400'}`}>Task Details</span>
            </div>
            <div className="w-10 h-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 2 ? 'bg-brand-blue text-white shadow-sm' : 'bg-gray-200 text-gray-400'}`}>2</div>
              <span className={`text-xs font-bold transition-colors ${step === 2 ? 'text-brand-blue' : 'text-gray-400'}`}>Instructions</span>
            </div>
          </div>

          {/* Step 1: Task Details */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-6 py-5 space-y-5"
            >
              {/* Task Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Task Name</label>
                <input
                  value={local.title}
                  onChange={e => setLocal({ ...local, title: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all placeholder:text-gray-300"
                  placeholder="e.g. Complete Business Profile"
                  autoFocus
                />
              </div>

              {/* Short Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Short Description</label>
                <p className="text-[11px] text-gray-400 -mt-1">A one-line summary shown in the task list.</p>
                <input
                  value={local.description}
                  onChange={e => setLocal({ ...local, description: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all placeholder:text-gray-300"
                  placeholder="Brief description for the task list"
                />
              </div>

              {/* Submission Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Submission Type</label>
                <p className="text-[11px] text-gray-400 -mt-1">Determines how the business completes this task.</p>
                <select
                  value={local.submissionType}
                  onChange={e => setLocal({ ...local, submissionType: e.target.value as SubmissionTypeId })}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                >
                  {SUBMISSION_TYPES.map(st => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
              </div>

              {/* Conditional Platform / URL Fields */}
              {showPlatform && (
                <>
                  <div className="border-t border-gray-100" />
                  <div className="space-y-3">
                    {local.submissionType === 'internal_platform' ? (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Platform</label>
                        <p className="text-[11px] text-gray-400 -mt-1">Select the internal MCOM platform for this task.</p>
                        <select
                          value={local.system}
                          onChange={e => setLocal({ ...local, system: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                        >
                          <option value="">Select a platform</option>
                          {INTERNAL_PLATFORMS.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">External Platform</label>
                        <p className="text-[11px] text-gray-400 -mt-1">Enter the external URL where the task is completed.</p>
                        <input
                          value={local.systemUrl}
                          onChange={e => setLocal({ ...local, systemUrl: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all"
                          placeholder="https://example.com/tool"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* CTA Button Label */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">CTA Button Text</label>
                <p className="text-[11px] text-gray-400 -mt-1">What the action button should say (e.g. "Continue", "Start", "Open Platform").</p>
                <input
                  value={local.ctaLabel}
                  onChange={e => setLocal({ ...local, ctaLabel: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all"
                  placeholder="Continue"
                />
              </div>

              <div className="border-t border-gray-100" />

              {/* Time & Reward */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Est. Time</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={local.estimatedMinutes}
                      onChange={e => setLocal({ ...local, estimatedMinutes: parseInt(e.target.value) || 1 })}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all"
                      min="1"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">minutes</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Reward</label>
                  <input
                    value={local.reward}
                    onChange={e => setLocal({ ...local, reward: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all"
                    placeholder="+50 points"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Instructions */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-6 py-5 space-y-5"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Instructions</label>
                <p className="text-[11px] text-gray-400 -mt-1">Explain step-by-step how the business should complete this task. This appears on the task detail screen.</p>
                <textarea
                  value={local.instructions}
                  onChange={e => setLocal({ ...local, instructions: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-all placeholder:text-gray-300 resize-none"
                  placeholder="Describe step-by-step how to complete this task..."
                  autoFocus
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700">
                  These instructions will be shown to the business when they open this task.
                </p>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            {step === 1 ? (
              <>
                <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-white rounded-xl transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!isValid}
                  className="px-8 py-2.5 text-sm font-bold text-white bg-brand-blue rounded-xl hover:bg-brand-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-blue/20 flex items-center gap-2"
                >
                  Next: Instructions
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setStep(1)} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-white rounded-xl transition-all">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => onSave(local)}
                  className="px-8 py-2.5 text-sm font-bold text-white bg-brand-blue rounded-xl hover:bg-brand-dark transition-all shadow-lg shadow-brand-blue/20"
                >
                  {local.id ? 'Save Changes' : 'Add Task'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ─── Config Section ─────────────────────────────────

function ConfigSection() {
  const [phases, setPhases] = useState<ProgrammePhase[]>(() => {
    const saved = localStorage.getItem('adminProgrammePhases');
    return saved ? JSON.parse(saved) : PROGRAMME_PHASES;
  });
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [gates, setGates] = useState<ReadinessGate[]>(() => {
    const saved = localStorage.getItem('adminReadinessGates');
    return saved ? JSON.parse(saved) : DEFAULT_GATES;
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<TaskFormData>(EMPTY_TASK);

  useEffect(() => {
    localStorage.setItem('adminProgrammePhases', JSON.stringify(phases));
  }, [phases]);

  useEffect(() => {
    localStorage.setItem('adminReadinessGates', JSON.stringify(gates));
  }, [gates]);

  const totalMissions = phases.reduce((s, p) => s + p.missions.length, 0);

  const updatePhase = (id: string, field: string, value: any) => {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPhase = () => {
    const newPhase: ProgrammePhase = {
      id: `phase-${Date.now()}`,
      name: 'New Phase',
      dayStart: 1,
      dayEnd: 14,
      description: 'Describe this phase',
      icon: Rocket,
      color: 'gray',
      missions: [],
    };
    setPhases(prev => [...prev, newPhase]);
    setEditingPhase(newPhase.id);
  };

  const removePhase = (id: string) => {
    if (phases.length <= 1) return;
    setPhases(prev => prev.filter(p => p.id !== id));
  };

  const removeMission = (phaseId: string, missionId: string) => {
    if (!confirm('Delete this task?')) return;
    setPhases(prev => prev.map(p => p.id === phaseId ? {
      ...p,
      missions: p.missions.filter(m => m.id !== missionId),
    } : p));
  };

  const movePhase = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;
    const newPhases = [...phases];
    [newPhases[index], newPhases[newIndex]] = [newPhases[newIndex], newPhases[index]];
    setPhases(newPhases);
  };

  const updateGate = (id: string, field: string, value: any) => {
    setGates(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const resetToDefault = () => {
    setPhases(PROGRAMME_PHASES);
    setGates(DEFAULT_GATES);
  };

  const openAddTask = (phaseId: string) => {
    setActivePhaseId(phaseId);
    setTaskFormData({ ...EMPTY_TASK, id: `mission-${Date.now()}` });
    setModalOpen(true);
  };

  const openEditTask = (phaseId: string, mission: ProgrammeMission) => {
    setActivePhaseId(phaseId);
    setTaskFormData({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      instructions: mission.instructions || '',
      estimatedMinutes: mission.estimatedMinutes,
      reward: mission.reward,
      submissionType: mission.submissionType || 'internal_platform',
      system: mission.system || '',
      systemUrl: mission.systemUrl || '',
      ctaLabel: mission.ctaLabel || 'Continue',
    });
    setModalOpen(true);
  };

  const saveTask = (data: TaskFormData) => {
    if (!activePhaseId) return;
    const mission: ProgrammeMission = {
      id: data.id,
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      estimatedMinutes: data.estimatedMinutes,
      reward: data.reward,
      submissionType: data.submissionType,
      system: data.submissionType === 'internal_platform' ? data.system : undefined,
      systemUrl: data.submissionType === 'external_link' ? data.systemUrl : undefined,
      ctaLabel: data.ctaLabel,
    };

    setPhases(prev => prev.map(p => {
      if (p.id !== activePhaseId) return p;
      const exists = p.missions.find(m => m.id === data.id);
      if (exists) {
        return { ...p, missions: p.missions.map(m => m.id === data.id ? mission : m) };
      }
      return { ...p, missions: [...p.missions, mission] };
    }));

    setModalOpen(false);
    setActivePhaseId(null);
  };

  return (
    <div className="space-y-8">
      {/* Task Editor Modal */}
      <TaskEditorModal
        open={modalOpen}
        formData={taskFormData}
        onClose={() => { setModalOpen(false); setActivePhaseId(null); }}
        onSave={saveTask}
      />

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Phases</p>
          <p className="text-2xl font-black text-brand-dark mt-1">{phases.length}</p>
        </div>
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Tasks</p>
          <p className="text-2xl font-black text-brand-dark mt-1">{totalMissions}</p>
        </div>
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Duration</p>
          <p className="text-2xl font-black text-brand-dark mt-1">
            {phases.length > 0 ? `${phases[0].dayStart}–${phases[phases.length - 1].dayEnd} days` : '—'}
          </p>
        </div>
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gates</p>
          <p className="text-2xl font-black text-brand-dark mt-1">{gates.filter(g => g.isEnabled).length} active</p>
        </div>
      </div>

      {/* Phase Editor */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Phases & Tasks</h3>
          <div className="flex items-center gap-2">
            <button onClick={resetToDefault} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Reset Default
            </button>
            <button onClick={addPhase} className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-xs hover:bg-brand-dark transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Phase
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {phases.map((phase, pi) => (
            <motion.div key={phase.id} layout className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Phase Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50/80 border-b border-gray-100">
                <div className="flex flex-col gap-0.5 text-gray-300">
                  <button onClick={() => movePhase(pi, 'up')} disabled={pi === 0} className="disabled:opacity-30 hover:text-brand-blue"><ChevronLeft className="w-3 h-3 rotate-90" /></button>
                  <button onClick={() => movePhase(pi, 'down')} disabled={pi === phases.length - 1} className="disabled:opacity-30 hover:text-brand-blue"><ChevronLeft className="w-3 h-3 -rotate-90" /></button>
                </div>

                <div className="flex-1 min-w-0">
                  {editingPhase === phase.id ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      <input value={phase.name} onChange={e => updatePhase(phase.id, 'name', e.target.value)} className="px-2 py-1 text-sm font-bold rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white" />
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span>Days</span>
                        <input type="number" value={phase.dayStart} onChange={e => updatePhase(phase.id, 'dayStart', parseInt(e.target.value) || 1)} className="w-14 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white text-center" />
                        <span>–</span>
                        <input type="number" value={phase.dayEnd} onChange={e => updatePhase(phase.id, 'dayEnd', parseInt(e.target.value) || 1)} className="w-14 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white text-center" />
                      </div>
                      <input value={phase.description} onChange={e => updatePhase(phase.id, 'description', e.target.value)} className="px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white flex-1 min-w-[200px]" />
                      <button onClick={() => setEditingPhase(null)} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 text-sm">{phase.name}</span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Days {phase.dayStart}–{phase.dayEnd}</span>
                      <span className="text-xs text-gray-400 truncate hidden sm:block">{phase.description}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingPhase(editingPhase === phase.id ? null : phase.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-brand-blue transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!editingPhase && (
                    <button onClick={() => openAddTask(phase.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-green-600 transition-colors" title="Add task">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => removePhase(phase.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30" disabled={phases.length <= 1}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Missions List */}
              <div className="divide-y divide-gray-50">
                {phase.missions.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-gray-400 font-medium">No tasks yet.</p>
                    <button onClick={() => openAddTask(phase.id)} className="mt-2 text-xs font-bold text-brand-blue hover:underline">+ Add your first task</button>
                  </div>
                )}
                {phase.missions.map((mission, mi) => (
                  <div key={mission.id} className="flex items-center gap-3 p-3 pl-8 hover:bg-gray-50/50 group transition-colors">
                    <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">{mi + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{mission.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {mission.estimatedMinutes} min</span>
                        <span className="text-[10px] text-amber-600 font-semibold">{mission.reward}</span>
                        {mission.submissionType === 'internal_platform' && mission.system ? (
                          <span className="text-[10px] text-sky-600 font-semibold">{mission.system}</span>
                        ) : mission.submissionType === 'external_link' ? (
                          <span className="text-[10px] text-purple-600 font-semibold">External Link</span>
                        ) : mission.submissionType === 'image_upload' ? (
                          <span className="text-[10px] text-green-600 font-semibold">Image Upload</span>
                        ) : mission.submissionType === 'text_input' ? (
                          <span className="text-[10px] text-orange-600 font-semibold">Text Input</span>
                        ) : mission.submissionType === 'digit_input' ? (
                          <span className="text-[10px] text-blue-600 font-semibold">Digit Input</span>
                        ) : null}
                        {mission.ctaLabel && mission.ctaLabel !== 'Continue' && (
                          <span className="text-[10px] text-gray-400 font-mono">CTA: "{mission.ctaLabel}"</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditTask(phase.id, mission)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-brand-blue transition-colors" title="Edit task">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeMission(phase.id, mission.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition-colors" title="Delete task">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Readiness Gates */}
      <div>
        <h3 className="font-bold text-gray-900 mb-4">Readiness Gates</h3>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {gates.map(gate => (
            <div key={gate.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{gate.name}</p>
                <p className="text-xs text-gray-400">Min progress: <strong>{gate.minProgressPercent}%</strong></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <input type="number" value={gate.minProgressPercent} onChange={e => updateGate(gate.id, 'minProgressPercent', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-center" min="0" max="100" />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <button onClick={() => updateGate(gate.id, 'isEnabled', !gate.isEnabled)} className={cn("relative w-10 h-5 rounded-full transition-colors", gate.isEnabled ? 'bg-green-500' : 'bg-gray-300')}>
                  <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", gate.isEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BusinessesSection() {
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>(() => {
    const saved = localStorage.getItem('adminBusinessProgrammes');
    return saved ? JSON.parse(saved) : MOCK_BUSINESSES;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessProgrammeRecord | null>(null);
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [actionModal, setActionModal] = useState<{ type: BusinessAction; business: BusinessProgrammeRecord } | null>(null);

  useEffect(() => {
    localStorage.setItem('adminBusinessProgrammes', JSON.stringify(businesses));
  }, [businesses]);

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
      const allMissionIds: string[] = [];
      PROGRAMME_PHASES.forEach(p => p.missions.forEach(m => allMissionIds.push(m.id)));
      const completedCount = Math.round((day / 90) * allMissionIds.length);
      updateBusiness(b.id, {
        currentDay: day,
        completedMissions: allMissionIds.slice(0, completedCount),
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
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>(() => {
    const saved = localStorage.getItem('adminBusinessProgrammes');
    return saved ? JSON.parse(saved) : MOCK_BUSINESSES;
  });
  const [selectedBiz, setSelectedBiz] = useState<string | null>(null);

  const agents = MOCK_SUPPORT.filter(a => a.role === 'agent');
  const accountManagers = MOCK_SUPPORT.filter(a => a.role === 'account_manager');
  const consultants = MOCK_SUPPORT.filter(a => a.role === 'consultant');

  const assign = (bId: string, field: 'agentId' | 'accountManagerId' | 'consultantId', agent: SupportAgent | null) => {
    setBusinesses(prev => prev.map(b => {
      if (b.id !== bId) return b;
      const updates: any = {};
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
      return { ...b, ...updates };
    }));
    localStorage.setItem('adminBusinessProgrammes', JSON.stringify(businesses));
  };

  const getAssignedName = (b: BusinessProgrammeRecord, field: 'agentId' | 'accountManagerId' | 'consultantId', nameField: 'agentName' | 'accountManagerName' | 'consultantName') => {
    return b[field] ? b[nameField] : '—';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Assign support personnel to businesses on the 90-day programme.</p>
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
  const [businesses] = useState<BusinessProgrammeRecord[]>(() => {
    const saved = localStorage.getItem('adminBusinessProgrammes');
    return saved ? JSON.parse(saved) : MOCK_BUSINESSES;
  });
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

  const bulkAction = (action: string) => {
    if (selectedIds.length === 0) return;
    const msg = `${action} ${selectedIds.length} business(es)?`;
    if (confirm(msg)) {
      setSelectedIds([]);
    }
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
    const allMissionIds = PROGRAMME_PHASES.flatMap(p => p.missions.map(m => m.id));
    const bizTaskStatuses = localStorage.getItem('businessTaskStatuses');
    const parsed = bizTaskStatuses ? JSON.parse(bizTaskStatuses) : {};
    const completed = Object.values(parsed).filter(v => v === 'completed').length;
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
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <span className="text-xs text-gray-400 font-medium ml-auto">{overall.completed}/{overall.total} tasks completed across all businesses</span>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 bg-brand-blue/5 rounded-xl border border-brand-blue/20">
          <span className="text-sm font-bold text-brand-blue">{selectedIds.length} selected</span>
          <button onClick={() => bulkAction('Pause')} className="px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Pause</button>
          <button onClick={() => bulkAction('Resume')} className="px-3 py-1.5 text-xs font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Resume</button>
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
  { id: 'config', label: 'Programme Config', icon: Settings },
  { id: 'businesses', label: 'Business Override', icon: Users },
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
];

export default function ProgrammeManagementPanel() {
  const [subTab, setSubTab] = useState<SubTab>(() => {
    return (localStorage.getItem('adminProgrammeSubTab') as SubTab) || 'config';
  });

  useEffect(() => {
    localStorage.setItem('adminProgrammeSubTab', subTab);
  }, [subTab]);

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-br from-brand-blue to-brand-dark rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-5 h-5 text-white/80" />
            <h2 className="text-lg font-black">90-Day Programme Control Center</h2>
          </div>
          <p className="text-sm text-white/70 max-w-2xl">
            Configure programme phases and tasks, override individual business progress, assign support personnel, and monitor all businesses in the programme.
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
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
          {subTab === 'config' && <ConfigSection />}
          {subTab === 'businesses' && <BusinessesSection />}
          {subTab === 'monitoring' && <MonitoringSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
