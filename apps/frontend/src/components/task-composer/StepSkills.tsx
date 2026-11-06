import { useEffect, useState } from 'react';
import { Check, Lightbulb, Plus, Wand2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import StepIntro from './StepIntro';
import FieldTooltip from '../common/FieldTooltip';
import { SKILL_SUGGESTIONS } from './taskComposerUtils';

interface StepSkillsProps {
  skills: string[];
  onToggle: (skill: string) => void;
  onAdd: (skill: string) => void;
  onRemove: (skill: string) => void;
  eyebrow?: string;
}

export default function StepSkills({
  skills,
  onToggle,
  onAdd,
  onRemove,
  eyebrow = 'Quest 4 of 5',
}: StepSkillsProps) {
  const [draft, setDraft] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(null), 1200);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const addDraft = () => {
    const value = draft.trim();
    if (!value) return;
    onAdd(value);
    setJustAdded(value);
    setDraft('');
  };

  const selectedLower = new Set(skills.map((skill) => skill.toLowerCase()));

  return (
    <div>
      <StepIntro
        icon={Wand2}
        eyebrow={eyebrow}
        title="What skills does this need?"
        description="Add the skills that matter for this outcome. We use them to rank people by real fit, not just who is nearby."
        tip="Two or three focused skills beat a long wish list. Affiliates can still apply if they are a strong overall match."
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
          Popular skills
          <FieldTooltip text="Tap the skills this task needs. We use them to rank affiliates by real fit, not just distance." />
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SKILL_SUGGESTIONS.map((skill) => {
            const active = selectedLower.has(skill.toLowerCase());
            return (
              <button
                key={skill}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(skill)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                  active
                    ? 'border-brand-blue bg-brand-blue text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand-blue/40 hover:text-brand-blue',
                )}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4">
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
            Add your own
            <FieldTooltip text="Cannot see a skill? Type it in the box and press Enter to add it to this task." />
          </span>
          <div className="mt-1.5 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addDraft();
                }
              }}
              maxLength={40}
              placeholder="e.g. Shopify, voiceover, event styling"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-sm"
            />
            <button
              type="button"
              onClick={addDraft}
              disabled={!draft.trim()}
              className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 text-[11px] font-black text-white hover:bg-brand-dark disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </label>
      </div>

      {skills.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-600">
              Skill set for this task
            </p>
            <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-black text-brand-blue">
              {skills.length} selected
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors',
                  justAdded === skill
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-brand-blue/20 bg-brand-blue/[0.06] text-brand-blue',
                )}
              >
                {justAdded === skill && <Check className="h-3 w-3" strokeWidth={3} />}
                {skill}
                <button
                  type="button"
                  onClick={() => onRemove(skill)}
                  aria-label={`Remove ${skill}`}
                  className="rounded-full p-0.5 hover:bg-white/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] font-semibold leading-5 text-sky-800">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No skills selected yet. You can skip this, but adding skills unlocks much sharper
          recommendations in the next step.
        </p>
      )}
    </div>
  );
}
