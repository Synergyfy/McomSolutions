import { useRef } from 'react';
import {
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Target,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import StepIntro from './StepIntro';
import type { UploadedMaterial } from './taskComposerUtils';

interface StepBriefProps {
  title: string;
  description: string;
  deliverables: string;
  materialsNote: string;
  materialFiles: UploadedMaterial[];
  materialLinks: string[];
  linkDraft: string;
  uploading: boolean;
  uploadError: string | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDeliverablesChange: (value: string) => void;
  onMaterialsNoteChange: (value: string) => void;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveFile: (url: string) => void;
  onLinkDraftChange: (value: string) => void;
  onAddLink: () => void;
  onRemoveLink: (link: string) => void;
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-sm';

export default function StepBrief({
  title,
  description,
  deliverables,
  materialsNote,
  materialFiles,
  materialLinks,
  linkDraft,
  uploading,
  uploadError,
  onTitleChange,
  onDescriptionChange,
  onDeliverablesChange,
  onMaterialsNoteChange,
  onFilesSelected,
  onRemoveFile,
  onLinkDraftChange,
  onAddLink,
  onRemoveLink,
}: StepBriefProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <StepIntro
        icon={FileText}
        eyebrow="Quest 3 of 5"
        title="Brief the mission"
        description="A clear brief gets a better result. Tell us the outcome you want, what success looks like, and hand over anything useful."
        tip="If an affiliate has to guess, the work will show it. One or two extra sentences here saves a revision round later."
      />

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-600">
            Task title <span className="text-brand-blue">Required</span>
          </span>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            maxLength={180}
            placeholder="e.g. Refresh our brand for the summer campaign"
            className={inputClass}
          />
          <span className="mt-1 flex justify-end text-[10px] font-semibold text-gray-400">
            {title.length}/180
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-600">
            The outcome you need <span className="text-brand-blue">Required</span>
          </span>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Describe what done looks like. Include the audience, tone, must-haves and anything to avoid."
            className={`${inputClass} min-h-[132px] resize-y leading-6`}
          />
          <span className="mt-1 flex items-center justify-between text-[10px] font-semibold text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3" /> Outcome first, steps second
            </span>
            <span>{description.length}/5000</span>
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-600">
            Deliverables <span className="text-gray-400">Optional</span>
          </span>
          <textarea
            value={deliverables}
            onChange={(event) => onDeliverablesChange(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="e.g. 3 social posts, 1 landscape banner and the editable source file"
            className={`${inputClass} min-h-[76px] resize-y leading-6`}
          />
        </label>

        <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-600">
                Materials supplied
              </p>
              <p className="mt-1 text-[11px] font-medium leading-5 text-gray-500">
                Add files from your device or paste links to a shared drive. Images up to 5MB.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-500">
              <Paperclip className="h-3 w-3" />
              {materialFiles.length + materialLinks.length} attached
            </span>
          </div>

          <textarea
            value={materialsNote}
            onChange={(event) => onMaterialsNoteChange(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Anything the affiliate should know about these materials? e.g. Use the logo on page 2, ignore the old brand colours."
            className={`${inputClass} mt-3 min-h-[72px] resize-y leading-6`}
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(event) => {
              onFilesSelected(event.target.files);
              event.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-3 flex min-h-[72px] w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-brand-blue/40 hover:bg-brand-blue/[0.02] disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
            ) : (
              <UploadCloud className="h-5 w-5 text-brand-blue" />
            )}
            <span>
              <span className="block text-[12px] font-black text-gray-900">
                {uploading ? 'Uploading your files…' : 'Choose files from your device'}
              </span>
              <span className="block text-[10px] font-semibold text-gray-500">
                PNG, JPG, GIF or WEBP · select multiple
              </span>
            </span>
          </button>

          {uploadError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
              {uploadError}
            </p>
          )}

          {materialFiles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {materialFiles.map((file) => (
                <li
                  key={file.url}
                  className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                    <Paperclip className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-gray-900">
                      {file.name}
                    </span>
                    <span className="block truncate text-[10px] font-medium text-gray-400">
                      Uploaded
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.url)}
                    aria-label={`Remove ${file.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
              <Link2 className="h-3.5 w-3.5" /> Or add a link
            </p>
            <div className="flex gap-2">
              <input
                value={linkDraft}
                onChange={(event) => onLinkDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddLink();
                  }
                }}
                placeholder="https://drive.google.com/…"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={onAddLink}
                disabled={!linkDraft.trim()}
                className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border border-brand-blue/30 bg-white px-3 text-[11px] font-black text-brand-blue hover:bg-brand-blue/5 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {materialLinks.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {materialLinks.map((link) => (
                  <li
                    key={link}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-[11px] font-semibold text-brand-blue hover:underline"
                    >
                      {link}
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveLink(link)}
                      aria-label={`Remove ${link}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
