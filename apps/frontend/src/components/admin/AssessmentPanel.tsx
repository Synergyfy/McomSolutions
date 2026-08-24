import { useState } from 'react';
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff,
  X, Check, Clock, Users, Globe, Heart, Target, Megaphone,
  HelpCircle, Zap, Award, Briefcase, BarChart3, Sparkles, MessageSquare,
  FileText, Star, TrendingUp, ShoppingCart, Package, MapPin,
  Hash, CalendarDays, ToggleLeft, AlignLeft, Type,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAssessmentQuestions, useCreateAssessmentQuestion, useUpdateAssessmentQuestion, useDeleteAssessmentQuestion, useReorderAssessmentQuestions } from '../../services/admin/hooks';
import { Loader2 } from 'lucide-react';

interface AssessmentQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'single-choice' | 'multi-choice' | 'number' | 'date' | 'rating' | 'yes-no';
  fieldType: 'text' | 'textarea' | 'single-choice' | 'multi-choice' | 'number' | 'date' | 'rating' | 'yes-no';
  options?: string[];
  required: boolean;
  section: string;
  icon?: string;
  iconName?: string;
  hint?: string;
  enabled?: boolean;
  order: number;
}
type AssessmentFieldType = AssessmentQuestion['type'];

const ICON_OPTIONS: { name: string; icon: any }[] = [
  { name: 'Clock', icon: Clock },
  { name: 'Users', icon: Users },
  { name: 'Globe', icon: Globe },
  { name: 'Heart', icon: Heart },
  { name: 'Target', icon: Target },
  { name: 'Megaphone', icon: Megaphone },
  { name: 'HelpCircle', icon: HelpCircle },
  { name: 'Zap', icon: Zap },
  { name: 'Award', icon: Award },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'MessageSquare', icon: MessageSquare },
  { name: 'FileText', icon: FileText },
  { name: 'Star', icon: Star },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Package', icon: Package },
  { name: 'MapPin', icon: MapPin },
];

function getIconByName(name: string) {
  return ICON_OPTIONS.find(i => i.name === name)?.icon || HelpCircle;
}

const FIELD_TYPES: { value: AssessmentFieldType; label: string; icon: any; description: string }[] = [
  { value: 'single-choice', label: 'Single Choice', icon: ToggleLeft, description: 'One option from a list (radio buttons)' },
  { value: 'multi-choice', label: 'Multi Choice', icon: Check, description: 'Multiple options (checkboxes)' },
  { value: 'text', label: 'Short Text', icon: Type, description: 'Single line text input' },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft, description: 'Multi-line text input' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric input' },
  { value: 'date', label: 'Date', icon: CalendarDays, description: 'Date picker' },
  { value: 'rating', label: 'Star Rating', icon: Star, description: '1–5 star rating' },
  { value: 'yes-no', label: 'Yes / No', icon: HelpCircle, description: 'Binary yes or no' },
];

export default function AssessmentPanel() {
  const { data: questionsRes, isLoading } = useAssessmentQuestions();
  const createQuestion = useCreateAssessmentQuestion();
  const updateQuestion = useUpdateAssessmentQuestion();
  const deleteQuestion = useDeleteAssessmentQuestion();
  const reorderQuestions = useReorderAssessmentQuestions();

  const assessmentQuestions: AssessmentQuestion[] = (questionsRes?.data ?? []) as AssessmentQuestion[];

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AssessmentQuestion | null>(null);
  const [form, setForm] = useState({
    question: '',
    iconName: 'HelpCircle',
    fieldType: 'single-choice' as AssessmentFieldType,
    hint: '',
    options: ['', '', '', ''],
  });

  const sorted = [...assessmentQuestions].sort((a, b) => a.order - b.order);
  const enabledCount = sorted.filter(q => (q as any).enabled !== false).length;

  const openAdd = () => {
    setEditing(null);
    setForm({ question: '', iconName: 'HelpCircle', fieldType: 'single-choice', hint: '', options: ['', '', '', ''] });
    setShowModal(true);
  };

  const openEdit = (q: AssessmentQuestion) => {
    setEditing(q);
    setForm({
      question: q.question,
      iconName: q.iconName,
      fieldType: q.fieldType,
      hint: q.hint,
      options: [...q.options, '', '', '', ''].slice(0, Math.max(q.options.length, 4)),
    });
    setShowModal(true);
  };

  const handleSave = () => {
    const cleanOptions = form.options.filter(o => o.trim());
    if (!form.question.trim()) return;
    if ((form.fieldType === 'single-choice' || form.fieldType === 'multi-choice') && cleanOptions.length < 2) return;

    if (editing) {
      updateQuestion.mutate({ id: editing.id, data: {
        question: form.question.trim(),
        icon: form.iconName,
        type: form.fieldType,
        required: true,
        section: 'General',
        options: cleanOptions.length > 0 ? cleanOptions : undefined,
      }});
    } else {
      createQuestion.mutate({
        question: form.question.trim(),
        icon: form.iconName,
        type: form.fieldType,
        required: true,
        section: 'General',
        enabled: true,
        options: cleanOptions.length > 0 ? cleanOptions : undefined,
      });
    }
    setShowModal(false);
  };

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const ids = sorted.map(q => q.id);
    const idx = ids.indexOf(id);
    if (direction === 'up' && idx > 0) {
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    } else if (direction === 'down' && idx < ids.length - 1) {
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    }
    reorderQuestions.mutate(ids);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...form.options];
    newOptions[index] = value;
    setForm({ ...form, options: newOptions });
  };

  const removeOption = (index: number) => {
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
  };

  const addOption = () => {
    setForm({ ...form, options: [...form.options, ''] });
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{sorted.length}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Questions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Eye className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{enabledCount}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{sorted.length - enabledCount}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Disabled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Assessment Questions</h3>
          <p className="text-xs text-gray-500">Manage the questions shown during the Initial Business Assessment onboarding step.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {sorted.map((q, idx) => {
          const Icon = getIconByName(q.iconName);
          return (
            <div
              key={q.id}
              className={cn(
                "bg-white rounded-2xl border shadow-sm p-5 transition-all",
                q.enabled ? "border-gray-100" : "border-gray-100 opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Drag Handle + Order */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <button
                    onClick={() => moveQuestion(q.id, 'up')}
                    disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-black text-gray-300 w-5 text-center">{idx + 1}</span>
                  <button
                    onClick={() => moveQuestion(q.id, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-orange-500" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">{q.id}</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                      {FIELD_TYPES.find(ft => ft.value === q.fieldType)?.label || q.fieldType}
                    </span>
                    {q.enabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">ACTIVE</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">DISABLED</span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{q.question}</h4>
                  <p className="text-xs text-gray-400 mb-2">{q.hint}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt, oi) => (
                      <span key={oi} className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-[11px] font-medium border border-gray-100">
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQuestion.mutate({ id: q.id, data: { enabled: !(q as any).enabled } })}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      q.enabled ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"
                    )}
                    title={q.enabled ? 'Disable' : 'Enable'}
                  >
                    {q.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(q)}
                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteQuestion.mutate(q.id)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-500">No assessment questions</p>
            <p className="text-xs text-gray-400 mt-1">Add questions to create the business assessment flow.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl relative z-10">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-t-3xl" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-gray-900">
                  {editing ? 'Edit Question' : 'Add Question'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Question Text */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Question</label>
                  <input
                    type="text"
                    value={form.question}
                    onChange={e => setForm({ ...form, question: e.target.value })}
                    placeholder="e.g. How long has your business been operating?"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Hint */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Hint / Description</label>
                  <input
                    type="text"
                    value={form.hint}
                    onChange={e => setForm({ ...form, hint: e.target.value })}
                    placeholder="e.g. This helps us understand your growth stage"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.name}
                          onClick={() => setForm({ ...form, iconName: opt.name })}
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                            form.iconName === opt.name
                              ? "bg-blue-500 text-white shadow-md"
                              : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Field Type Picker */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Answer Type</label>
                  <select
                    value={form.fieldType}
                    onChange={e => setForm({ ...form, fieldType: e.target.value as AssessmentFieldType })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label} — {ft.description}</option>
                    ))}
                  </select>
                </div>

                {/* Options (only for choice types) */}
                {(form.fieldType === 'single-choice' || form.fieldType === 'multi-choice') && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Options {form.fieldType === 'single-choice' ? '(user picks one)' : '(user picks many)'} — min 2
                    </label>
                    <div className="space-y-2">
                      {form.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {form.fieldType === 'single-choice' ? (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
                          )}
                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateOption(i, e.target.value)}
                            placeholder={`Option ${i + 1}`}
                            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {form.options.length > 2 && (
                            <button
                              onClick={() => removeOption(i)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {form.options.length < 8 && (
                      <button
                        onClick={addOption}
                        className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add option
                      </button>
                    )}
                  </div>
                )}

                {/* Preview for non-choice types */}
                {form.fieldType === 'text' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <input type="text" disabled placeholder="Short text answer..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-400" />
                  </div>
                )}
                {form.fieldType === 'textarea' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <textarea disabled placeholder="Long text answer..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-400 h-20 resize-none" />
                  </div>
                )}
                {form.fieldType === 'number' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <input type="number" disabled placeholder="0" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-400" />
                  </div>
                )}
                {form.fieldType === 'date' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <input type="date" disabled className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-400" />
                  </div>
                )}
                {form.fieldType === 'rating' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-7 h-7 text-gray-300" />)}
                    </div>
                  </div>
                )}
                {form.fieldType === 'yes-no' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
                    <div className="flex gap-3">
                      <div className="px-6 py-2 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-400">Yes</div>
                      <div className="px-6 py-2 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-400">No</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save / Cancel */}
              <div className="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-gray-100">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.question.trim() || ((form.fieldType === 'single-choice' || form.fieldType === 'multi-choice') && form.options.filter(o => o.trim()).length < 2)}
                  className="px-6 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:opacity-90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editing ? 'Save Changes' : 'Add Question'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
