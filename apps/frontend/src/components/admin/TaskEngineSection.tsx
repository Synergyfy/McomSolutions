import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target,
  Plus,
  Edit3,
  Trash2,
  Users,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  Loader2,
  Lock,
  Building2,
  User,
  Filter,
  RefreshCw,
  Gift,
  Ticket,
  HelpCircle,
  Globe,
  ExternalLink,
  FileText,
  Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toDateTimeLocal } from '../../lib/couponValidation';
import { useConsoleApps } from './console/hooks/useConsoleApps';
import {
  useTaskFeatures,
  useTaskOverviewStats,
  useTaskDefinitions,
  useCreateTaskDefinition,
  useUpdateTaskDefinition,
  useDeleteTaskDefinition,
  useAssignTask,
  useTaskAssignments,
  useUpdateTaskAssignmentStatus,
  useAdminPlans,
  useAdminAccessPlans,
} from '../../services/admin/hooks';

interface TaskFormData {
  title: string;
  description: string;
  targetAudience: 'BUSINESS' | 'CUSTOMER' | 'BOTH';
  accessScope: 'ALL' | 'PAID' | 'TRIAL';
  submissionType: 'AUTO' | 'EXTERNAL_LINK' | 'TEXT_INPUT' | 'DIGIT_INPUT' | 'IMAGE_UPLOAD';
  taskSource: 'INTERNAL' | 'EXTERNAL';
  actionUrl: string;
  actionLabel: string;
  featureKey: string;
  externalClientId: string;
  deadlineDays: number;
  rewardPoints: number;
  rewardCouponEnabled: boolean;
  rewardCouponDiscountType: 'PERCENTAGE' | 'FIXED';
  rewardCouponValue: number;
  rewardCouponAppliesToAll: boolean;
  rewardCouponPlanIds: string[];
  rewardCouponAppliesToAllAccess: boolean;
  rewardCouponAccessPlanIds: string[];
  rewardCouponValidDays: number;
  rewardCouponExpiresAt: string;
  isActive: boolean;
  platform: string;
}

const DEFAULT_FORM: TaskFormData = {
  title: '',
  description: '',
  targetAudience: 'BUSINESS',
  accessScope: 'ALL',
  submissionType: 'AUTO',
  taskSource: 'INTERNAL',
  actionUrl: '',
  actionLabel: '',
  featureKey: 'business.logo_uploaded',
  externalClientId: '',
  deadlineDays: 7,
  rewardPoints: 50,
  rewardCouponEnabled: false,
  rewardCouponDiscountType: 'PERCENTAGE',
  rewardCouponValue: 10,
  rewardCouponAppliesToAll: true,
  rewardCouponPlanIds: [],
  rewardCouponAppliesToAllAccess: false,
  rewardCouponAccessPlanIds: [],
  rewardCouponValidDays: 30,
  rewardCouponExpiresAt: '',
  isActive: true,
  platform: 'mcom_central',
};

export default function TaskEngineSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [audiencePicked, setAudiencePicked] = useState(false);
  const [pickedAudience, setPickedAudience] = useState<'BUSINESS' | 'CUSTOMER' | 'BOTH' | null>(
    null,
  );
  const [formData, setFormData] = useState<TaskFormData>(DEFAULT_FORM);
  const rewardCouponAccessPlanIds = formData.rewardCouponAccessPlanIds ?? [];
  const rewardCouponAppliesToAllAccess = formData.rewardCouponAppliesToAllAccess ?? false;
  const [selectedTaskForProgress, setSelectedTaskForProgress] = useState<any | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<'ALL' | 'BUSINESS' | 'CUSTOMER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [progressSearch, setProgressSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries & Mutations
  const { data: featuresRes, isLoading: loadingFeatures } = useTaskFeatures();
  const { data: statsRes, refetch: refetchStats } = useTaskOverviewStats();
  const { data: tasksRes, isLoading: loadingTasks, refetch: refetchTasks } = useTaskDefinitions();
  const { data: plansRes } = useAdminPlans();
  const membershipPlans = (plansRes?.data ?? []).filter((plan: any) => !plan.archived);
  const { data: accessPlansRes } = useAdminAccessPlans();
  const accessPlans = (accessPlansRes?.data ?? []).filter((plan: any) => !plan.archived);
  // Console-registered external apps (read-only reuse — no console changes here).
  const { data: consoleApps = [], isLoading: loadingApps } = useConsoleApps();
  const activeApps = (consoleApps || []).filter((a: any) => a.isActive);
  const isExternalForm = formData.taskSource === 'EXTERNAL';
  const createTask = useCreateTaskDefinition();
  const updateTask = useUpdateTaskDefinition();
  const deleteTask = useDeleteTaskDefinition();
  const assignTask = useAssignTask();

  // Progress assignments query for selected task
  const {
    data: assignmentsRes,
    isLoading: loadingAssignments,
    refetch: refetchAssignments,
  } = useTaskAssignments(selectedTaskForProgress?.id, {
    search: progressSearch,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });

  const updateAssignment = useUpdateTaskAssignmentStatus();

  const features = featuresRes?.data || [];
  const stats = statsRes?.data || {
    totalTasks: 0,
    activeTasks: 0,
    totalAssignments: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    expiredAssignments: 0,
    totalPointsAwarded: 0,
    completionRate: 0,
  };
  const tasks = tasksRes?.data || [];

  // ─── Audience capabilities ────────────────────────────────────
  // A platform trigger can only fire for the audience it belongs to (or BOTH),
  // and customers never resolve as trial users.
  const audienceFeatures = features.filter(
    (feat: any) =>
      feat.targetAudience === formData.targetAudience || feat.targetAudience === 'BOTH',
  );
  const autoAvailable = audienceFeatures.length > 0;
  const isCustomerAudience = formData.targetAudience === 'CUSTOMER';
  const audienceMeta =
    formData.targetAudience === 'BUSINESS'
      ? {
          label: 'Businesses',
          icon: Building2,
          blurb: 'Business owners & their teams',
        }
      : formData.targetAudience === 'CUSTOMER'
        ? {
            label: 'Customers',
            icon: User,
            blurb: 'Everyday members and shoppers',
          }
        : {
            label: 'Businesses & Customers',
            icon: Users,
            blurb: 'Shared mission for both audiences',
          };
  const accessScopeOptions = isCustomerAudience
    ? [
        { id: 'ALL', label: 'All customers', icon: Users },
        { id: 'PAID', label: 'Members only', icon: Award },
      ]
    : [
        { id: 'ALL', label: 'Paid & Trial', icon: Users },
        { id: 'PAID', label: 'Paid only', icon: Award },
        { id: 'TRIAL', label: 'Trial only', icon: Clock },
      ];

  // The helper line under "Available To" explains exactly who receives the task
  // for the selected scope (customers have no trial tier).
  const accessScopeNote = isCustomerAudience
    ? formData.accessScope === 'PAID'
      ? 'Only customers with an active membership will see this task — non-members are excluded.'
      : 'Every customer will see this task, whether they hold an active membership or not — trial access does not apply to customers.'
    : formData.accessScope === 'PAID'
      ? 'Only users with an active membership will see this task — trial users are excluded.'
      : formData.accessScope === 'TRIAL'
        ? 'Only trial users will see this task — paid members are excluded. Trials are set in Dashboard Access settings.'
        : 'Trial users are determined by the Dashboard Access settings. Paid users have an active membership.';
  const taskTypeOptions = [
    ...(autoAvailable
      ? [
          {
            id: 'AUTO',
            label: 'Auto Event',
            description: 'Completes automatically via platform event worker',
            icon: Zap,
          },
        ]
      : []),
    {
      id: 'EXTERNAL_LINK',
      label: 'External Link',
      description: 'Admin sets a link; user opens it, then marks complete',
      icon: ExternalLink,
    },
    {
      id: 'TEXT_INPUT',
      label: 'Text Input',
      description: 'User submits a written answer',
      icon: FileText,
    },
    {
      id: 'DIGIT_INPUT',
      label: 'Digit Input',
      description: 'User submits digits only',
      icon: Clock,
    },
    {
      id: 'IMAGE_UPLOAD',
      label: 'Image Upload',
      description: 'User uploads an image as proof',
      icon: Upload,
    },
  ];

  const handleSelectAudience = (audience: 'BUSINESS' | 'CUSTOMER' | 'BOTH') => {
    if (loadingFeatures) return;
    const available = features.filter(
      (feat: any) => feat.targetAudience === audience || feat.targetAudience === 'BOTH',
    );
    const featureStillValid = available.some((feat: any) => feat.key === formData.featureKey);
    setFormData({
      ...formData,
      targetAudience: audience,
      // Customers never resolve as trial users.
      accessScope:
        audience === 'CUSTOMER' && formData.accessScope === 'TRIAL'
          ? 'ALL'
          : formData.accessScope,
      // No auto trigger for this audience → fall back to a manual proof type.
      submissionType:
        available.length === 0 && formData.submissionType === 'AUTO'
          ? 'TEXT_INPUT'
          : formData.submissionType,
      featureKey: featureStillValid ? formData.featureKey : available[0]?.key || '',
    });
    setAudiencePicked(true);
    setPickedAudience(audience);
    setFormError(null);
  };

  const filteredTasks = tasks.filter((t: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      t.title.toLowerCase().includes(q) ||
      (t.featureKey || '').toLowerCase().includes(q) ||
      (t.externalAppName || '').toLowerCase().includes(q) ||
      (t.externalClientId || '').toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    const matchesAudience = audienceFilter === 'ALL' || t.targetAudience === audienceFilter;
    return matchesSearch && matchesAudience;
  });

  const handleOpenCreateModal = () => {
    setEditingTaskId(null);
    setFormData(DEFAULT_FORM);
    setAudiencePicked(false);
    setPickedAudience(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: any) => {
    setEditingTaskId(task.id);
    const taskSource = task.taskSource === 'EXTERNAL' || (!task.taskSource && task.externalClientId)
      ? 'EXTERNAL'
      : 'INTERNAL';
    setFormData({
      title: task.title,
      description: task.description,
      targetAudience: task.targetAudience,
      accessScope: task.accessScope || 'ALL',
      submissionType: task.submissionType || 'AUTO',
      taskSource,
      actionUrl: task.actionUrl || '',
      actionLabel: task.actionLabel || '',
      featureKey: task.featureKey || 'business.logo_uploaded',
      externalClientId: task.externalClientId || '',
      deadlineDays: task.deadlineDays,
      rewardPoints: task.rewardPoints,
      rewardCouponEnabled: !!task.rewardCouponEnabled,
      rewardCouponDiscountType: task.rewardCouponDiscountType || 'PERCENTAGE',
      rewardCouponValue: Number(task.rewardCouponValue) || 10,
      rewardCouponAppliesToAll: task.rewardCouponAppliesToAll ?? true,
      rewardCouponPlanIds: Array.isArray(task.rewardCouponPlans)
        ? task.rewardCouponPlans.map((plan: any) => plan.id)
        : [],
      rewardCouponAppliesToAllAccess: task.rewardCouponAppliesToAllAccess ?? false,
      rewardCouponAccessPlanIds: Array.isArray(task.rewardCouponAccessPlans)
        ? task.rewardCouponAccessPlans.map((plan: any) => plan.id)
        : [],
      rewardCouponValidDays: task.rewardCouponValidDays ?? 30,
      rewardCouponExpiresAt: toDateTimeLocal(task.rewardCouponExpiresAt),
      isActive: task.isActive,
      platform: task.platform || 'mcom_central',
    });
    setAudiencePicked(true);
    setPickedAudience(task.targetAudience ?? 'BUSINESS');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!audiencePicked) {
      setFormError('Choose who this task is for first.');
      return;
    }
    if (!formData.title.trim() || !formData.description.trim()) return;
    if (isCustomerAudience && formData.accessScope === 'TRIAL') {
      setFormError(
        'Customers never resolve as trial users — choose "All customers" or "Members only".',
      );
      return;
    }
    if (
      formData.taskSource === 'INTERNAL' &&
      formData.submissionType === 'AUTO' &&
      !audienceFeatures.some((feat: any) => feat.key === formData.featureKey)
    ) {
      setFormError('Pick a platform trigger that matches this task audience.');
      return;
    }
    if (formData.taskSource === 'INTERNAL' && formData.submissionType === 'EXTERNAL_LINK') {
      const rawLink = formData.actionUrl.trim();
      if (!rawLink) {
        setFormError('Add the link users must open to complete this task.');
        return;
      }
      try {
        const url = new URL(rawLink);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid');
      } catch {
        setFormError('Enter a valid http(s) link for the task.');
        return;
      }
    }
    if (formData.taskSource === 'EXTERNAL' && !formData.externalClientId) return;
    if (formData.rewardCouponEnabled) {
      if (!Number.isFinite(formData.rewardCouponValue) || formData.rewardCouponValue <= 0) {
        setFormError('Enter a reward coupon discount greater than zero.');
        return;
      }
      if (formData.rewardCouponDiscountType === 'PERCENTAGE' && formData.rewardCouponValue >= 100) {
        setFormError('Reward coupon percentage must be between 1% and 99%.');
        return;
      }
      const hasMembershipScope =
        formData.rewardCouponAppliesToAll || formData.rewardCouponPlanIds.length > 0;
      const hasAccessScope =
        rewardCouponAppliesToAllAccess || rewardCouponAccessPlanIds.length > 0;
      if (!hasMembershipScope && !hasAccessScope) {
        setFormError('Select at least one membership or access pass for the reward coupon.');
        return;
      }
      if (!formData.rewardCouponValidDays && !formData.rewardCouponExpiresAt) {
        setFormError('Set how many days the reward coupon is valid for, or an expiry date.');
        return;
      }
      if (formData.rewardCouponExpiresAt && new Date(formData.rewardCouponExpiresAt) <= new Date()) {
        setFormError('Reward coupon expiry must be in the future.');
        return;
      }
    }

    // Platform is derived server-side (mcom_central | console platformSlug) — not sent.
    const payload: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      targetAudience: formData.targetAudience,
      accessScope: formData.accessScope,
      submissionType: formData.taskSource === 'INTERNAL' ? formData.submissionType : 'AUTO',
      taskSource: formData.taskSource,
      deadlineDays: formData.deadlineDays,
      rewardPoints: formData.rewardPoints,
      isActive: formData.isActive,
      rewardCouponEnabled: formData.rewardCouponEnabled,
      ...(formData.rewardCouponEnabled
        ? {
            rewardCouponDiscountType: formData.rewardCouponDiscountType,
            rewardCouponValue: formData.rewardCouponValue,
            rewardCouponAppliesToAll: formData.rewardCouponAppliesToAll,
            rewardCouponPlanIds: formData.rewardCouponAppliesToAll
              ? []
              : formData.rewardCouponPlanIds,
            rewardCouponAppliesToAllAccess,
            rewardCouponAccessPlanIds: rewardCouponAppliesToAllAccess
              ? []
              : rewardCouponAccessPlanIds,
            rewardCouponValidDays: formData.rewardCouponValidDays || undefined,
            rewardCouponExpiresAt: formData.rewardCouponExpiresAt
              ? new Date(formData.rewardCouponExpiresAt).toISOString()
              : undefined,
          }
        : {}),
    };
    if (formData.taskSource === 'INTERNAL') {
      if (formData.submissionType === 'AUTO') {
        payload.featureKey = formData.featureKey;
      }
      if (formData.submissionType === 'EXTERNAL_LINK') {
        payload.actionUrl = formData.actionUrl.trim();
        payload.actionLabel = formData.actionLabel.trim() || undefined;
      }
    } else {
      payload.externalClientId = formData.externalClientId;
    }

    try {
      if (editingTaskId) {
        await updateTask.mutateAsync({ id: editingTaskId, data: payload });
      } else {
        await createTask.mutateAsync(payload);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || err?.message || 'Could not save this task.',
      );
    }
  };

  const handleDeleteTask = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete task "${title}"? All user assignments will be removed.`)) {
      await deleteTask.mutateAsync(id);
      if (selectedTaskForProgress?.id === id) {
        setSelectedTaskForProgress(null);
      }
    }
  };

  const handleBulkAssign = async (task: any) => {
    setAssigningTaskId(task.id);
    try {
      const res: any = await assignTask.mutateAsync({ id: task.id });
      alert(res?.message || `Assigned task to ${res?.assignedCount || 0} users!`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to assign task');
    } finally {
      setAssigningTaskId(null);
    }
  };

  const handleToggleManualStatus = async (assignment: any, newStatus: string, grantReward: boolean = true) => {
    try {
      await updateAssignment.mutateAsync({
        assignmentId: assignment.id,
        data: { status: newStatus, grantReward },
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update assignment status');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Stats Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Tasks</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-gray-900">{stats.totalTasks}</span>
              <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                {stats.activeTasks} Active
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Target className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assigned Users</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-gray-900">{stats.totalAssignments}</span>
              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                {stats.pendingAssignments} In Progress
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completion Rate</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-gray-900">{stats.completionRate}%</span>
              <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                {stats.completedAssignments} Done
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Points Awarded</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-gray-900">{stats.totalPointsAwarded.toLocaleString()}</span>
              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                MCOM Points
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ─── Automation Status Banner ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-500/20 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base">MCOM Central Event Workers (BullMQ)</h4>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active & Listening
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Tasks automatically complete and deposit MCOM Points directly into user wallets whenever the specified
              module action is detected. Nightly sweeps automatically expire tasks past their deadline.
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white shadow-md shadow-blue-600/30 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Task
        </button>
      </div>

      {/* ─── Task Definition Management ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header Controls */}
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Configured Tasks</h3>
            <p className="text-xs text-gray-500">Customizable missions with deadlines and reward points</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Audience filter tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600">
              {(['ALL', 'BUSINESS', 'CUSTOMER'] as const).map((aud) => (
                <button
                  key={aud}
                  onClick={() => setAudienceFilter(aud)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg transition-all',
                    audienceFilter === aud
                      ? 'bg-white text-gray-900 font-bold shadow-sm'
                      : 'hover:text-gray-900',
                  )}
                >
                  {aud === 'ALL' ? 'All Audiences' : aud}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-44"
              />
            </div>

            <button
              onClick={() => {
                refetchTasks();
                refetchStats();
              }}
              title="Refresh"
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task Cards / Table */}
        {loadingTasks ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading task definitions...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">No tasks created yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Click "Create New Task" above to define your first mission.</p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 text-xs text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create task now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTasks.map((task: any) => {
              const matchedFeature = features.find((f: any) => f.key === task.featureKey);
              const isSelected = selectedTaskForProgress?.id === task.id;
              const isExternal = task.taskSource === 'EXTERNAL' || (!task.taskSource && !!task.externalClientId);

              return (
                <div
                  key={task.id}
                  className={cn(
                    'p-5 transition-all hover:bg-gray-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4',
                    isSelected && 'bg-blue-50/40 border-l-4 border-l-blue-600',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider',
                          task.targetAudience === 'BUSINESS'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            : task.targetAudience === 'CUSTOMER'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
                        )}
                      >
                        {task.targetAudience === 'BUSINESS' && <Building2 className="w-3 h-3 inline mr-1" />}
                        {task.targetAudience === 'CUSTOMER' && <User className="w-3 h-3 inline mr-1" />}
                        {task.targetAudience === 'BOTH' && <Users className="w-3 h-3 inline mr-1" />}
                        {task.targetAudience}
                      </span>

                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1',
                          task.accessScope === 'PAID'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                            : task.accessScope === 'TRIAL'
                              ? 'bg-sky-50 text-sky-700 border-sky-200/60'
                              : 'bg-slate-100 text-slate-700 border-slate-200/60',
                        )}
                      >
                        {task.accessScope === 'PAID' && <Award className="w-3 h-3" />}
                        {task.accessScope === 'TRIAL' && <Clock className="w-3 h-3" />}
                        {(!task.accessScope || task.accessScope === 'ALL') && <Users className="w-3 h-3" />}
                        {task.accessScope === 'PAID'
                          ? 'Paid only'
                          : task.accessScope === 'TRIAL'
                            ? 'Trial only'
                            : 'Paid & Trial'}
                      </span>

                      {task.submissionType && task.submissionType !== 'AUTO' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1">
                          {task.submissionType === 'EXTERNAL_LINK' && <ExternalLink className="w-3 h-3" />}
                          {task.submissionType === 'TEXT_INPUT' && <FileText className="w-3 h-3" />}
                          {task.submissionType === 'DIGIT_INPUT' && <Clock className="w-3 h-3" />}
                          {task.submissionType === 'IMAGE_UPLOAD' && <Upload className="w-3 h-3" />}
                          {task.submissionType === 'EXTERNAL_LINK'
                            ? 'Link task'
                            : task.submissionType === 'TEXT_INPUT'
                              ? 'Text input'
                              : task.submissionType === 'DIGIT_INPUT'
                                ? 'Digit input'
                                : 'Image upload'}
                        </span>
                      )}

                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {task.deadlineDays} Days
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center gap-1">
                        <Gift className="w-3 h-3 text-amber-500" />
                        +{task.rewardPoints} Points
                      </span>

                      {task.rewardCouponEnabled && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                          <Ticket className="w-3 h-3 text-emerald-600" />
                          {task.rewardCouponDiscountType === 'PERCENTAGE'
                            ? `${task.rewardCouponValue}% off coupon`
                            : `£${task.rewardCouponValue} off coupon`}
                          {task.issuedCouponCount > 0 ? ` · ${task.issuedCouponCount} issued` : ''}
                        </span>
                      )}

                      {task.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                          Inactive
                        </span>
                      )}

                      <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        {isExternal ? (task.externalPlatformSlug || task.platform) : 'mcom_central'}
                      </span>
                      {isExternal && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {task.externalAppName || 'External'} · Manual
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-gray-900">{task.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 max-w-3xl">{task.description}</p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      {isExternal ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Globe className="w-3.5 h-3.5 text-violet-600" />
                          <span>Platform:</span>
                          <span className="text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded font-bold text-[11px]">
                            {task.externalAppName || task.externalClientId || task.platform}
                          </span>
                          <span className="text-gray-400">(manual completion — no event worker)</span>
                          {task.externalAppUrl && (
                            <a
                              href={task.externalAppUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                            >
                              Open app <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : task.submissionType === 'EXTERNAL_LINK' ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Link:</span>
                          {task.actionUrl ? (
                            <a
                              href={task.actionUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-0.5 max-w-[280px] truncate"
                              title={task.actionUrl}
                            >
                              {task.actionLabel || task.actionUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-amber-600 text-[11px] font-bold">No link set</span>
                          )}
                          <span className="text-gray-400">(user opens the link, then marks complete)</span>
                        </div>
                      ) : task.submissionType && task.submissionType !== 'AUTO' ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Type:</span>
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold text-[11px]">
                            {task.submissionType === 'TEXT_INPUT'
                              ? 'Text input'
                              : task.submissionType === 'DIGIT_INPUT'
                                ? 'Digit input'
                                : 'Image upload'}
                          </span>
                          <span className="text-gray-400">(completed when the user submits)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Zap className="w-3.5 h-3.5 text-blue-600" />
                          <span>Trigger:</span>
                          <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">
                            {task.featureKey}
                          </code>
                          {matchedFeature && (
                            <span className="text-gray-400">({matchedFeature.label})</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
                        <span>Assigned: <strong className="text-gray-900">{task.stats?.totalAssigned || 0}</strong></span>
                        <span>Completed: <strong className="text-emerald-600">{task.stats?.completed || 0}</strong></span>
                        <span>Pending: <strong className="text-amber-600">{task.stats?.pending || 0}</strong></span>
                        {task.stats?.expired > 0 && (
                          <span>Expired: <strong className="text-red-500">{task.stats?.expired}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                    <button
                      onClick={() => handleBulkAssign(task)}
                      disabled={assigningTaskId === task.id}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                      title="Assign this task to all eligible users who don't have it yet"
                    >
                      {assigningTaskId === task.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Users className="w-3.5 h-3.5" />
                      )}
                      Bulk Assign
                    </button>

                    <button
                      onClick={() => setSelectedTaskForProgress(isSelected ? null : task)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all',
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
                      )}
                    >
                      <Target className="w-3.5 h-3.5" />
                      {isSelected ? 'Hide Progress' : 'View Progress'}
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(task)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                      title="Edit Task"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Task Progress Drill-Down (When a task is selected) ──── */}
      {selectedTaskForProgress && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-blue-200/80 shadow-md overflow-hidden"
        >
          <div className="p-5 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 border-b border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-100/80 px-2 py-0.5 rounded">
                  Live Progress Tracking
                </span>
                <span className="text-xs text-gray-500">
                  {(selectedTaskForProgress.taskSource === 'EXTERNAL' || selectedTaskForProgress.externalClientId) ? (
                    <>App: <strong className="text-violet-700">{selectedTaskForProgress.externalAppName || selectedTaskForProgress.externalClientId}</strong> (manual)</>
                  ) : selectedTaskForProgress.submissionType === 'EXTERNAL_LINK' ? (
                    <>Link: <strong className="text-blue-700">{selectedTaskForProgress.actionUrl || 'not set'}</strong> (user opens it, then confirms)</>
                  ) : (
                    <>Trigger: <code className="font-mono text-blue-700 font-bold">{selectedTaskForProgress.featureKey}</code></>
                  )}
                </span>
              </div>
              <h3 className="text-lg font-black text-gray-900 mt-1">
                {selectedTaskForProgress.title}
              </h3>
              <p className="text-xs text-gray-500">
                Deadline: {selectedTaskForProgress.deadlineDays} days from assignment | Reward: {selectedTaskForProgress.rewardPoints} MCOM points
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white/80 border border-gray-200 p-0.5 rounded-lg text-xs font-medium">
                {['ALL', 'PENDING', 'COMPLETED', 'EXPIRED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all text-xs',
                      statusFilter === s ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={progressSearch}
                  onChange={(e) => setProgressSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                />
              </div>

              <button
                onClick={() => refetchAssignments()}
                className="p-1.5 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-all"
                title="Refresh user progress"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Assignments List */}
          {loadingAssignments ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading assigned users...</span>
            </div>
          ) : !assignmentsRes?.data || assignmentsRes.data.length === 0 ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <Users className="w-8 h-8 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">No users assigned yet</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Click "Bulk Assign" to assign this task to all eligible {selectedTaskForProgress.targetAudience.toLowerCase()} users.
              </p>
              <button
                onClick={() => handleBulkAssign(selectedTaskForProgress)}
                disabled={assigningTaskId === selectedTaskForProgress.id}
                className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 shadow-sm"
              >
                Assign Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User / Business</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned On</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Points Credited</th>
                    <th className="py-3 px-4 text-right">Manual Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignmentsRes.data.map((assign: any) => {
                    const isCompleted = assign.status === 'COMPLETED';
                    const isExpired = assign.status === 'EXPIRED';
                    const now = new Date();
                    const deadline = new Date(assign.deadlineAt);
                    const isPast = deadline < now;

                    return (
                      <tr key={assign.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">
                            {assign.user?.businessName || assign.user?.name || assign.user?.email}
                          </div>
                          <div className="text-[11px] text-gray-400">{assign.user?.email}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                            {assign.userType}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          {new Date(assign.assignedAt).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className={cn('font-semibold', isPast && !isCompleted ? 'text-red-600' : 'text-gray-700')}>
                            {deadline.toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {isCompleted
                              ? `Completed on ${new Date(assign.completedAt).toLocaleDateString()}`
                              : isPast
                                ? 'Deadline has passed'
                                : `${Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days left`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <AlertCircle className="w-3 h-3" />
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {assign.rewardGranted ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <Award className="w-3.5 h-3.5 text-emerald-600" />
                              +{assign.rewardPoints} MCOM
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isCompleted ? (
                              <button
                                onClick={() => handleToggleManualStatus(assign, 'COMPLETED', true)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] transition-all"
                                title="Manually mark completed and grant reward"
                              >
                                Mark Done
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleManualStatus(assign, 'PENDING', false)}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] transition-all"
                                title="Reset back to pending"
                              >
                                Reset
                              </button>
                            )}

                            {!isExpired && !isCompleted && (
                              <button
                                onClick={() => handleToggleManualStatus(assign, 'EXPIRED', false)}
                                className="px-2 py-1 rounded-lg hover:bg-red-50 text-red-600 text-[11px] transition-all"
                                title="Expire assignment"
                              >
                                Expire
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Create / Edit Task Modal ─────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">
                      {editingTaskId ? 'Edit Programme Task' : 'Create Programme Task'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Audience-first setup — triggers and completion types adapt to what each role can actually do
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                >
                  ✕
                </button>
              </div>

              {!audiencePicked ? (
                <div className="pt-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Who is this task for?</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pick the audience first — we&apos;ll only show the actions that audience can
                      actually perform.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        id: 'BUSINESS' as const,
                        label: 'Businesses',
                        icon: Building2,
                        blurb:
                          'Auto triggers for logo, profile, socials, opening hours, Google and membership — plus link, text, digit and image tasks.',
                      },
                      {
                        id: 'CUSTOMER' as const,
                        label: 'Customers',
                        icon: User,
                        blurb:
                          'Auto triggers for customer profile and membership — plus link, text, digit and image tasks. No trial access.',
                      },
                      {
                        id: 'BOTH' as const,
                        label: 'Businesses & Customers',
                        icon: Users,
                        blurb:
                          'One shared mission for both audiences. Manual proof tasks only — there is no shared auto trigger yet.',
                      },
                    ].map((aud) => (
                      <button
                        key={aud.id}
                        type="button"
                        onClick={() => handleSelectAudience(aud.id)}
                        disabled={loadingFeatures}
                        className={cn(
                          'w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all group disabled:opacity-60 disabled:cursor-wait',
                          pickedAudience === aud.id
                            ? 'border-blue-500 bg-blue-50/60'
                            : 'border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50',
                        )}
                      >
                        <span className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-blue-600 flex items-center justify-center shrink-0 group-hover:border-blue-300">
                          <aud.icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-bold text-gray-900">{aud.label}</span>
                          <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">
                            {aud.blurb}
                          </span>
                        </span>
                        {pickedAudience === aud.id ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 mt-2 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-2 shrink-0 group-hover:text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>

                  {loadingFeatures && (
                    <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading the actions each audience can perform…
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                    {editingTaskId && (
                      <button
                        type="button"
                        onClick={() => setAudiencePicked(true)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSubmitForm} className="space-y-4 pt-4">
                {/* Audience summary (picked in step 1) */}
                <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
                      <audienceMeta.icon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{audienceMeta.label}</p>
                      <p className="text-[11px] text-gray-500">
                        {audienceMeta.blurb}
                        {isCustomerAudience
                          ? ' · no trial access'
                          : formData.targetAudience === 'BOTH'
                            ? ' · manual tasks only'
                            : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudiencePicked(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Change
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Upload Your Business Logo"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Instructions / Description *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Explain what the business or customer needs to do to achieve this..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Access Scope */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Available To
                  </label>
                  <div className={cn('grid gap-2', isCustomerAudience ? 'grid-cols-2' : 'grid-cols-3')}>
                    {accessScopeOptions.map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, accessScope: scope.id as any })}
                        className={cn(
                          'p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                          formData.accessScope === scope.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                        )}
                      >
                        <scope.icon className="w-3.5 h-3.5" />
                        {scope.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {accessScopeNote}
                  </p>
                </div>

                {/* Task Source */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Task Source
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, taskSource: 'INTERNAL' })}
                      className={cn(
                        'p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                        !isExternalForm
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                      )}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      MCOM Central (auto)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, taskSource: 'EXTERNAL', submissionType: 'AUTO' })}
                      className={cn(
                        'p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                        isExternalForm
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                      )}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      External Platform (manual)
                    </button>
                  </div>
                </div>

                {/* Task Type (MCOM Central only) */}
                {!isExternalForm && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Task Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {taskTypeOptions.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, submissionType: type.id as any })}
                          className={cn(
                            'p-2.5 rounded-xl border text-left transition-all',
                            formData.submissionType === type.id
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                          )}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-bold">
                            <type.icon className="w-3.5 h-3.5" />
                            {type.label}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 block text-[10px] font-medium',
                              formData.submissionType === type.id ? 'text-white/75' : 'text-gray-400',
                            )}
                          >
                            {type.description}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!autoAvailable && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/70 rounded-lg p-2 mt-2">
                        {formData.targetAudience === 'BOTH'
                          ? 'There is no automatic trigger shared by businesses and customers yet — choose a manual task type.'
                          : 'No automatic trigger is available for this audience — choose a manual task type.'}
                      </p>
                    )}
                    {formData.submissionType !== 'AUTO' && (
                      <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200/70 rounded-lg p-2 mt-2">
                        {formData.submissionType === 'EXTERNAL_LINK'
                          ? 'Add the link the user must open. They click it in their dashboard, complete the step on that page, then mark the task complete — their click is recorded as proof.'
                          : 'The description above is what the user sees. Explain exactly what they must do and how to complete the task; their submission will automatically mark it done.'}
                      </p>
                    )}
                  </div>
                )}

                {/* Feature Key Trigger (internal auto tasks only) */}
                {!isExternalForm ? (
                  formData.submissionType === 'AUTO' ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Platform Trigger Feature (Event Worker) *
                      </label>
                      <select
                        value={formData.featureKey}
                        onChange={(e) => setFormData({ ...formData, featureKey: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {audienceFeatures.map((feat: any) => (
                          <option key={feat.key} value={feat.key}>
                            {feat.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-blue-600" />
                        When a user performs this action in MCOM Central, the BullMQ worker automatically completes this task.
                      </p>
                    </div>
                  ) : formData.submissionType === 'EXTERNAL_LINK' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Task Link (user must open this) *
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://example.com/complete-this-step"
                          value={formData.actionUrl}
                          onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                          Users click this link from their dashboard, finish the step there, then mark the task complete.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Button Label (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Open link"
                          value={formData.actionLabel}
                          onChange={(e) => setFormData({ ...formData, actionLabel: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-800 font-medium flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>
                        This task completes when the user submits the requested {formData.submissionType === 'TEXT_INPUT' ? 'text' : formData.submissionType === 'DIGIT_INPUT' ? 'digits' : 'image'} from their dashboard.
                      </span>
                    </div>
                  )
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      External App (from Console) *
                    </label>
                    <select
                      value={formData.externalClientId}
                      onChange={(e) => setFormData({ ...formData, externalClientId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    >
                      <option value="">Select an app...</option>
                      {activeApps.map((app: any) => (
                        <option key={app.clientId} value={app.clientId}>
                          {app.name}{app.platformSlug ? ` (${app.platformSlug})` : ''}
                        </option>
                      ))}
                    </select>
                    {loadingApps ? (
                      <p className="text-[11px] text-gray-400 mt-1">Loading console apps...</p>
                    ) : activeApps.length === 0 ? (
                      <p className="text-[11px] text-amber-600 mt-1">
                        No active apps registered yet — register one in /admin/console, then return here.
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-violet-600" />
                          No event worker — the user opens the app, completes the work there, then manually marks this task done.
                        </p>
                        {!isCustomerAudience && (
                          <div className="mt-2 p-2.5 bg-violet-50/80 border border-violet-200/60 rounded-xl text-[11px] text-violet-800 font-medium flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0" />
                            <span>
                              <strong className="font-bold">Trial Access Protocol:</strong> Assigning a task to this app automatically unlocks access to this platform for verified businesses during their trial period.
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Deadline & Points Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Deadline in days */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Time to Complete (Days) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        required
                        value={formData.deadlineDays}
                        onChange={(e) => setFormData({ ...formData, deadlineDays: parseInt(e.target.value, 10) || 7 })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                        Days
                      </span>
                    </div>
                    {/* Quick Presets */}
                    <div className="flex gap-1.5 mt-1.5">
                      {[3, 7, 14, 30].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFormData({ ...formData, deadlineDays: d })}
                          className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-[11px] font-semibold"
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reward in points */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Reward Points *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        required
                        value={formData.rewardPoints}
                        onChange={(e) => setFormData({ ...formData, rewardPoints: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">
                        Points
                      </span>
                    </div>
                    {/* Quick Presets */}
                    <div className="flex gap-1.5 mt-1.5">
                      {[25, 50, 100, 250].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({ ...formData, rewardPoints: p })}
                          className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-bold"
                        >
                          +{p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Completion coupon reward */}
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                        Completion Coupon Reward
                      </span>
                      <span className="text-[11px] text-gray-500 block mt-0.5">
                        Issue a personal, single-use coupon when this task is completed.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={formData.rewardCouponEnabled}
                        onChange={(e) => setFormData({ ...formData, rewardCouponEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>

                  {formData.rewardCouponEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Discount type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['PERCENTAGE', 'FIXED'] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setFormData({ ...formData, rewardCouponDiscountType: type })}
                                className={cn(
                                  'px-2.5 py-2 rounded-lg border text-[11px] font-bold transition-all',
                                  formData.rewardCouponDiscountType === type
                                    ? 'border-emerald-500 bg-emerald-600 text-white'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                                )}
                              >
                                {type === 'PERCENTAGE' ? 'Percentage (%)' : 'Fixed (£)'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Discount value
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={formData.rewardCouponDiscountType === 'PERCENTAGE' ? 1 : 0.01}
                              max={formData.rewardCouponDiscountType === 'PERCENTAGE' ? 99 : 100000}
                              step="0.01"
                              value={formData.rewardCouponValue}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  rewardCouponValue: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-400">
                              {formData.rewardCouponDiscountType === 'PERCENTAGE' ? '%' : '£'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-gray-200">
                        <div>
                          <p className="text-[11px] font-bold text-gray-700">All memberships</p>
                          <p className="text-[10px] text-gray-400">Otherwise choose specific plans below.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.rewardCouponAppliesToAll}
                            onChange={(e) =>
                              setFormData({ ...formData, rewardCouponAppliesToAll: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                        </label>
                      </div>

                      {!formData.rewardCouponAppliesToAll && (
                        <div className="flex flex-wrap gap-1.5">
                          {membershipPlans.length === 0 ? (
                            <span className="text-[11px] text-red-600">No active membership plans found.</span>
                          ) : (
                            membershipPlans.map((plan: any) => {
                              const selected = formData.rewardCouponPlanIds.includes(plan.id);
                              return (
                                <button
                                  key={plan.id}
                                  type="button"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      rewardCouponPlanIds: selected
                                        ? formData.rewardCouponPlanIds.filter((id) => id !== plan.id)
                                        : [...formData.rewardCouponPlanIds, plan.id],
                                    })
                                  }
                                  className={cn(
                                    'px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all',
                                    selected
                                      ? 'border-emerald-500 bg-emerald-600 text-white'
                                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                                  )}
                                >
                                  {plan.name}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-gray-200">
                        <div>
                          <p className="text-[11px] font-bold text-gray-700">All access passes</p>
                          <p className="text-[10px] text-gray-400">Otherwise choose specific access passes below.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rewardCouponAppliesToAllAccess}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                rewardCouponAppliesToAllAccess: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                        </label>
                      </div>

                      {!rewardCouponAppliesToAllAccess && (
                        <div className="flex flex-wrap gap-1.5">
                          {accessPlans.length === 0 ? (
                            <span className="text-[11px] text-gray-500">No active access passes found.</span>
                          ) : (
                            accessPlans.map((plan: any) => {
                              const selected = rewardCouponAccessPlanIds.includes(plan.id);
                              return (
                                <button
                                  key={plan.id}
                                  type="button"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      rewardCouponAccessPlanIds: selected
                                        ? rewardCouponAccessPlanIds.filter((id) => id !== plan.id)
                                        : [...rewardCouponAccessPlanIds, plan.id],
                                    })
                                  }
                                  className={cn(
                                    'px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all',
                                    selected
                                      ? 'border-emerald-500 bg-emerald-600 text-white'
                                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                                  )}
                                >
                                  {plan.name}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Valid for (days after earned)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            value={formData.rewardCouponValidDays}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                rewardCouponValidDays: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                            Absolute expiry (optional)
                          </label>
                          <input
                            type="datetime-local"
                            min={new Date().toISOString().slice(0, 16)}
                            value={formData.rewardCouponExpiresAt}
                            onChange={(e) =>
                              setFormData({ ...formData, rewardCouponExpiresAt: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <p className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/70 rounded-lg p-2 flex items-start gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Each completion generates a unique one-use code locked to that user. The code is emailed automatically; if both limits are set, the earlier expiry wins.
                      </p>
                    </div>
                  )}
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Task Status</span>
                    <span className="text-[11px] text-gray-500">
                      Inactive tasks will not be auto-completed or assigned.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>

                {/* Platform Tag */}
                <div className="text-[11px] text-gray-400 bg-gray-50 p-2.5 rounded-xl border border-dashed border-gray-200">
                  {isExternalForm ? (
                    <>Scope: <strong className="text-gray-700 font-mono">external platform</strong> (manual completion — no event worker).</>
                  ) : formData.submissionType === 'EXTERNAL_LINK' ? (
                    <>Scope: <strong className="text-gray-700 font-mono">MCOM Central</strong> (user opens the link, then confirms completion).</>
                  ) : formData.submissionType === 'AUTO' ? (
                    <>Scope: <strong className="text-gray-700 font-mono">MCOM Central</strong> (auto-completed by event worker).</>
                  ) : (
                    <>Scope: <strong className="text-gray-700 font-mono">MCOM Central</strong> (completed when the user submits proof).</>
                  )}
                </div>

                {/* Submit Buttons */}
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTask.isPending || updateTask.isPending}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {createTask.isPending || updateTask.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {editingTaskId ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>
              </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
