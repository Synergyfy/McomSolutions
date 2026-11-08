import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  FileText,
  LayoutGrid,
  Loader2,
  Rocket,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { BusinessUser } from '../../../services/admin/types';
import {
  useAdminAccountManagers,
  useAdminAgents,
  useAdminBusinesses,
  useAdminConsultants,
  useCreateAffiliateTask,
} from '../../../services/admin/hooks';
import { useUploadBusinessFile } from '../../../services/business/hooks';
import StepBrief from '../../task-composer/StepBrief';
import StepSkills from '../../task-composer/StepSkills';
import StepTaskType from '../../task-composer/StepTaskType';
import {
  buildMaterialsText,
  isHttpUrl,
  type CompensationModel,
  type TaskCategory,
  type UploadedMaterial,
} from '../../task-composer/taskComposerUtils';
import StepBusiness from './StepBusiness';
import StepDispatch from './StepDispatch';
import StepPlatformsAdmin from './StepPlatformsAdmin';
import {
  amountNeededFor,
  platformLabel,
  type AdminAssignee,
} from './adminTaskComposerUtils';

const STEPS = [
  { label: 'Business', short: 'Business', icon: Building2 },
  { label: 'Type', short: 'Type', icon: BriefcaseBusiness },
  { label: 'Platforms', short: 'Tags', icon: LayoutGrid },
  { label: 'Brief', short: 'Brief', icon: FileText },
  { label: 'Skills', short: 'Skills', icon: Wand2 },
  { label: 'Dispatch', short: 'Dispatch', icon: Users },
] as const;

const NEXT_LABELS = [
  'Choose the type',
  'Tag platforms',
  'Write the brief',
  'Add skills',
  'Dispatch & price',
];

const ALLOWED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export default function AdminTaskComposer() {
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — business
  const [businessSearch, setBusinessSearch] = useState('');
  const deferredBusinessSearch = useDeferredValue(businessSearch.trim());
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessUser | null>(null);
  const businessesRes = useAdminBusinesses({
    limit: 100,
    search: deferredBusinessSearch || undefined,
  });
  const businesses: BusinessUser[] = businessesRes.data?.data ?? [];

  // Step 2 — type
  const [category, setCategory] = useState<TaskCategory>('EXTERNAL');

  // Step 3 — platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Step 4 — brief
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [materialsNote, setMaterialsNote] = useState('');
  const [materialFiles, setMaterialFiles] = useState<UploadedMaterial[]>([]);
  const [materialLinks, setMaterialLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 5 — skills
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);

  // Step 6 — dispatch & pricing
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [compensationModel, setCompensationModel] = useState<CompensationModel>('FIXED');
  const [compensationAmount, setCompensationAmount] = useState('');
  const [billableToBusiness, setBillableToBusiness] = useState(false);
  const [businessChargeAmount, setBusinessChargeAmount] = useState('');
  const [platformFeePercent, setPlatformFeePercent] = useState('');
  const [requiresBusinessApproval, setRequiresBusinessApproval] = useState(true);

  const agentsRes = useAdminAgents({ limit: 100 });
  const consultantsRes = useAdminConsultants({ limit: 100 });
  const managersRes = useAdminAccountManagers({ limit: 100 });

  const assignees = useMemo<AdminAssignee[]>(() => {
    const agents = (agentsRes.data?.data ?? []).map((agent: any) => ({
      userId: agent.userId,
      name: agent.name,
      email: agent.email,
      role: 'AGENT' as const,
    }));
    const managers = (managersRes.data?.data ?? []).map((manager: any) => ({
      userId: manager.userId,
      name: manager.name,
      email: manager.email,
      role: 'ACCOUNT_MANAGER' as const,
    }));
    const consultants = (consultantsRes.data?.data ?? []).map((consultant: any) => ({
      userId: consultant.userId,
      name: consultant.name,
      email: consultant.email,
      role: 'CONSULTANT' as const,
    }));
    return [...managers, ...agents, ...consultants];
  }, [agentsRes.data, managersRes.data, consultantsRes.data]);

  const assigneesLoading =
    agentsRes.isLoading || managersRes.isLoading || consultantsRes.isLoading;

  const createTask = useCreateAffiliateTask();
  const upload = useUploadBusinessFile();

  const platformKeys = useMemo(
    () => Array.from(new Set(selectedBusiness?.platformAccess ?? [])),
    [selectedBusiness],
  );

  const selectedAssignee = assignees.find((assignee) => assignee.userId === assigneeUserId);

  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / STEPS.length) * 100),
    [stepIndex],
  );

  const selectBusiness = (business: BusinessUser) => {
    setSelectedBusiness(business);
    setSelectedPlatforms((current) =>
      current.filter((platform) => (business.platformAccess ?? []).includes(platform)),
    );
    setStepError(null);
  };

  const togglePlatform = (key: string) => {
    setSelectedPlatforms((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const addSkill = (skill: string) => {
    const value = skill.trim().slice(0, 40);
    if (!value) return;
    setRequiredSkills((current) => {
      if (current.some((item) => item.toLowerCase() === value.toLowerCase())) return current;
      return [...current, value];
    });
  };

  const toggleSkill = (skill: string) => {
    setRequiredSkills((current) => {
      const exists = current.some((item) => item.toLowerCase() === skill.toLowerCase());
      return exists
        ? current.filter((item) => item.toLowerCase() !== skill.toLowerCase())
        : [...current, skill];
    });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);

    const remainingSlots = Math.max(0, 10 - materialFiles.length);
    const selected = Array.from(files);
    if (selected.length > remainingSlots) {
      setUploadError('You can attach up to 10 files. Add the rest as links.');
    }

    for (const file of selected.slice(0, remainingSlots)) {
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        setUploadError(`${file.name} is not an image. Use PNG, JPG, GIF or WEBP, or add a link.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError(`${file.name} is larger than 5MB. Compress it or add a shared link.`);
        continue;
      }
      try {
        const result = await upload.mutateAsync(file);
        const url =
          (result as any)?.secure_url ||
          (result as any)?.data?.secure_url ||
          (result as any)?.url;
        if (!url) throw new Error('No upload URL returned');
        setMaterialFiles((current) => {
          if (current.some((item) => item.url === url)) return current;
          return [...current, { name: file.name, url }];
        });
      } catch (error: any) {
        const message = error?.response?.data?.message;
        setUploadError(
          Array.isArray(message)
            ? message.join(', ')
            : message || `Could not upload ${file.name}. Please try again.`,
        );
      }
    }
  };

  const addLink = () => {
    const value = linkDraft.trim();
    if (!value) return;
    if (!isHttpUrl(value)) {
      setUploadError('Enter a full link starting with http:// or https://');
      return;
    }
    if (materialLinks.length >= 10) {
      setUploadError('You can add up to 10 links. Put the rest in the materials note.');
      return;
    }
    if (materialLinks.some((link) => link.toLowerCase() === value.toLowerCase())) {
      setLinkDraft('');
      return;
    }
    setMaterialLinks((current) => [...current, value]);
    setLinkDraft('');
    setUploadError(null);
  };

  const validateStep = (index: number): string | null => {
    if (index === 0 && !selectedBusiness) {
      return 'Choose the business this task is being created for.';
    }
    if (index === 3) {
      if (title.trim().length < 3) return 'Give the task a short title (at least 3 characters).';
      if (description.trim().length < 5) {
        return 'Describe the outcome you need so the affiliate knows what done looks like.';
      }
    }
    if (index === 5) {
      if (
        amountNeededFor(compensationModel) &&
        compensationAmount &&
        Number(compensationAmount) < 0
      ) {
        return 'The affiliate reward cannot be negative.';
      }
      if (
        platformFeePercent &&
        (Number(platformFeePercent) < 0 || Number(platformFeePercent) > 100)
      ) {
        return 'The platform fee must be between 0 and 100 percent.';
      }
      if (businessChargeAmount && Number(businessChargeAmount) < 0) {
        return 'The business charge cannot be negative.';
      }
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(stepIndex);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setSubmitError(null);
    if (stepIndex === STEPS.length - 1) {
      void submit();
      return;
    }
    setStepIndex((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const goBack = () => {
    setStepError(null);
    setSubmitError(null);
    if (stepIndex === 0) {
      navigate('/admin/affiliate-tasks');
      return;
    }
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const submit = async () => {
    if (!selectedBusiness) {
      setStepIndex(0);
      setStepError('Choose the business this task is being created for.');
      return;
    }

    for (const index of [0, 3, 5]) {
      const error = validateStep(index);
      if (error) {
        setStepIndex(index);
        setStepError(error);
        return;
      }
    }

    const materials = buildMaterialsText(materialsNote, materialFiles, materialLinks);
    if (materials && materials.length > 4000) {
      setStepIndex(3);
      setStepError('Materials are too long. Shorten the note or remove a link.');
      return;
    }

    setSubmitError(null);
    try {
      await createTask.mutateAsync({
        businessId: selectedBusiness.id,
        title: title.trim(),
        description: description.trim(),
        platforms: selectedPlatforms,
        assigneeUserId: assigneeUserId || undefined,
        dueAt: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : undefined,
        category,
        requiredSkills,
        deliverables: deliverables.trim() || undefined,
        materials,
        compensationModel,
        compensationPence:
          amountNeededFor(compensationModel) && compensationAmount
            ? Math.round(Number(compensationAmount) * 100)
            : undefined,
        billableToBusiness,
        businessChargePence:
          billableToBusiness && businessChargeAmount
            ? Math.round(Number(businessChargeAmount) * 100)
            : undefined,
        requiresBusinessApproval,
        platformFeePercent:
          billableToBusiness && platformFeePercent ? Number(platformFeePercent) : undefined,
      });

      navigate('/admin/affiliate-tasks', {
        state: {
          taskCreated: true,
          taskTitle: title.trim(),
          businessName: selectedBusiness.name,
          assigneeName: selectedAssignee?.name ?? null,
        },
      });
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setSubmitError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'The task could not be created. Check the business wallet balance.',
      );
    }
  };

  const isFinalStep = stepIndex === STEPS.length - 1;
  const busy = createTask.isPending || upload.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl pb-6">
      <button
        type="button"
        onClick={() => navigate('/admin/affiliate-tasks')}
        className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-[11px] font-black text-gray-500 transition-colors hover:text-brand-blue"
      >
        <ArrowLeft className="h-4 w-4" /> Back to affiliate tasks
      </button>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-blue/80 p-4 text-white shadow-xl shadow-slate-900/10 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-brand-blue/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/90">
            <Sparkles className="h-3 w-3" /> Admin delegation
          </span>
          <h1 className="mt-2 text-xl font-black leading-tight tracking-tight sm:text-2xl">
            Create a task for a business
          </h1>
          <p className="mt-1 max-w-xl text-[12px] font-medium leading-5 text-white/70 sm:text-sm">
            Six quick steps. Choose the business, write the brief, then dispatch it to an affiliate or
            let auto-routing handle it.
          </p>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-white/70">
            <span className="rounded-full bg-white/10 px-2 py-1">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-1">
              {selectedBusiness ? selectedBusiness.name : 'No business yet'}
            </span>
            <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline">
              {progress}% complete
            </span>
          </div>
        </div>
      </header>

      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STEPS.map((step, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            const Icon = step.icon;
            return (
              <button
                key={step.label}
                type="button"
                onClick={() => {
                  if (index < stepIndex) {
                    setStepError(null);
                    setStepIndex(index);
                  }
                }}
                className={cn(
                  'flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-black transition-colors sm:flex-1 sm:justify-center',
                  active
                    ? 'bg-brand-blue text-white'
                    : done
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-50 text-gray-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full',
                    active
                      ? 'bg-white/20'
                      : done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white text-gray-400',
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.short}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-blue to-rose-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-3 rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="p-4 sm:p-6">
          {submitError && (
            <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-red-800">
              {submitError}
            </p>
          )}
          {stepError && (
            <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-amber-800">
              {stepError}
            </p>
          )}

          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {stepIndex === 0 && (
              <StepBusiness
                businesses={businesses}
                loading={businessesRes.isLoading}
                search={businessSearch}
                onSearchChange={setBusinessSearch}
                selected={selectedBusiness}
                selectedId={selectedBusiness?.id ?? ''}
                onSelect={selectBusiness}
              />
            )}

            {stepIndex === 1 && (
              <StepTaskType value={category} onChange={setCategory} eyebrow="Step 2 of 6" />
            )}

            {stepIndex === 2 && (
              <StepPlatformsAdmin
                businessName={selectedBusiness?.name ?? ''}
                platforms={platformKeys}
                selected={selectedPlatforms}
                onToggle={togglePlatform}
              />
            )}

            {stepIndex === 3 && (
              <StepBrief
                eyebrow="Step 4 of 6"
                title={title}
                description={description}
                deliverables={deliverables}
                materialsNote={materialsNote}
                materialFiles={materialFiles}
                materialLinks={materialLinks}
                linkDraft={linkDraft}
                uploading={upload.isPending}
                uploadError={uploadError}
                onTitleChange={setTitle}
                onDescriptionChange={setDescription}
                onDeliverablesChange={setDeliverables}
                onMaterialsNoteChange={setMaterialsNote}
                onFilesSelected={(files) => void handleFilesSelected(files)}
                onRemoveFile={(url) =>
                  setMaterialFiles((current) => current.filter((file) => file.url !== url))
                }
                onLinkDraftChange={setLinkDraft}
                onAddLink={addLink}
                onRemoveLink={(link) =>
                  setMaterialLinks((current) => current.filter((item) => item !== link))
                }
              />
            )}

            {stepIndex === 4 && (
              <StepSkills
                eyebrow="Step 5 of 6"
                skills={requiredSkills}
                onToggle={toggleSkill}
                onAdd={addSkill}
                onRemove={toggleSkill}
              />
            )}

            {stepIndex === 5 && (
              <StepDispatch
                assignees={assignees}
                assigneesLoading={assigneesLoading}
                assigneeUserId={assigneeUserId}
                onAssigneeChange={setAssigneeUserId}
                dueAt={dueAt}
                onDueAtChange={setDueAt}
                compensationModel={compensationModel}
                onCompensationModelChange={setCompensationModel}
                compensationAmount={compensationAmount}
                onCompensationAmountChange={setCompensationAmount}
                billableToBusiness={billableToBusiness}
                onBillableToBusinessChange={(value) => {
                  setBillableToBusiness(value);
                  if (!value) {
                    setBusinessChargeAmount('');
                    setPlatformFeePercent('');
                  }
                }}
                businessChargeAmount={businessChargeAmount}
                onBusinessChargeAmountChange={setBusinessChargeAmount}
                platformFeePercent={platformFeePercent}
                onPlatformFeePercentChange={setPlatformFeePercent}
                requiresBusinessApproval={requiresBusinessApproval}
                onRequiresBusinessApprovalChange={setRequiresBusinessApproval}
                summary={{
                  businessName: selectedBusiness?.name ?? '',
                  title: title.trim(),
                  category,
                  platforms: selectedPlatforms.map(platformLabel),
                  requiredSkills,
                  assigneeName: selectedAssignee?.name ?? '',
                }}
              />
            )}
          </motion.div>
        </div>

        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 rounded-b-3xl border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:bottom-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-[11px] font-black text-gray-600 hover:bg-gray-50 disabled:opacity-50 sm:px-4"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{stepIndex === 0 ? 'Cancel' : 'Back'}</span>
            </button>

            <div className="hidden flex-1 items-center gap-1.5 px-2 text-[10px] font-semibold text-gray-400 sm:flex">
              <span className="h-1.5 flex-1 rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-brand-blue transition-all"
                  style={{ width: `${progress}%` }}
                />
              </span>
              <span className="shrink-0">{progress}%</span>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={busy}
              className={cn(
                'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-[11px] font-black text-white transition-all sm:flex-none sm:px-5',
                isFinalStep
                  ? 'bg-gradient-to-r from-brand-blue to-rose-500 shadow-lg shadow-brand-blue/20 hover:brightness-105'
                  : 'bg-brand-blue hover:bg-brand-dark',
                busy && 'opacity-60',
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFinalStep ? (
                <Rocket className="h-4 w-4" />
              ) : null}
              {busy
                ? upload.isPending
                  ? 'Uploading…'
                  : 'Creating…'
                : isFinalStep
                  ? 'Create task'
                  : NEXT_LABELS[stepIndex]}
              {!busy && !isFinalStep && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[9px] font-semibold text-gray-400 sm:text-left">
            {isFinalStep
              ? "The business's free allowance is applied automatically. Over the allowance the task becomes chargeable."
              : 'You can jump back to any completed step.'}
          </p>
        </div>
      </div>
    </div>
  );
}
