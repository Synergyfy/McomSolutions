import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Link as LinkIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useUploadCatalogImage } from '../../services/admin/hooks';

interface CatalogImagePickerProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  helperText?: string;
}

export default function CatalogImagePicker({
  value,
  onChange,
  label = 'Image / Icon',
  helperText = 'Upload an image or paste a valid image URL',
}: CatalogImagePickerProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [pastedUrl, setPastedUrl] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlVerified, setUrlVerified] = useState(false);

  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadCatalogImage();

  // Validate uploaded file integrity
  const validateAndUploadFile = (file: File) => {
    setFileError(null);

    // 1. Strict MIME type check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      setFileError('Invalid file type. Only JPG, PNG, WEBP, GIF, and SVG images are allowed.');
      return;
    }

    // 2. Max size 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds the 5MB limit.');
      return;
    }

    // 3. Client-side corruption test (load in Image object)
    const objectUrl = URL.createObjectURL(file);
    const testImg = new Image();

    testImg.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (testImg.naturalWidth === 0 || testImg.naturalHeight === 0) {
        setFileError('The selected file is corrupted or contains empty dimensions.');
        return;
      }

      // Image is non-corrupt and valid! Proceed to upload to Cloudinary
      uploadMutation.mutate(file, {
        onSuccess: (res) => {
          if (res?.url) {
            onChange(res.url);
            setFileError(null);
          } else {
            setFileError('Upload succeeded but no URL was returned.');
          }
        },
        onError: (err: any) => {
          setFileError(err?.response?.data?.message || err?.message || 'Failed to upload to Cloudinary');
        },
      });
    };

    testImg.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setFileError('The selected file is corrupt or not a readable image.');
    };

    testImg.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndUploadFile(file);
    }
    // reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndUploadFile(file);
    }
  };

  // Test and validate pasted image URL
  const testImageUrl = (urlToTest: string) => {
    const trimmed = urlToTest.trim();
    if (!trimmed) {
      setUrlError(null);
      setUrlVerified(false);
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setUrlError('URL must begin with http:// or https://');
        setUrlVerified(false);
        return;
      }
    } catch {
      setUrlError('Please enter a valid web address (URL)');
      setUrlVerified(false);
      return;
    }

    setIsValidatingUrl(true);
    setUrlError(null);
    setUrlVerified(false);

    const testImg = new Image();
    testImg.onload = () => {
      setIsValidatingUrl(false);
      if (testImg.naturalWidth === 0 || testImg.naturalHeight === 0) {
        setUrlError('Image appears corrupt or has invalid dimensions.');
        setUrlVerified(false);
      } else {
        setUrlVerified(true);
        setUrlError(null);
      }
    };

    testImg.onerror = () => {
      setIsValidatingUrl(false);
      setUrlError('Could not load image. The URL may be broken, inaccessible, or corrupted.');
      setUrlVerified(false);
    };

    testImg.src = trimmed;
  };

  const handleApplyUrl = () => {
    if (!pastedUrl.trim() || !urlVerified) return;
    onChange(pastedUrl.trim());
    setPastedUrl('');
    setUrlVerified(false);
    setUrlError(null);
  };

  const handleRemove = () => {
    onChange(null);
    setPastedUrl('');
    setUrlError(null);
    setUrlVerified(false);
    setFileError(null);
  };

  const isCloudinary = value?.includes('cloudinary.com');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium flex items-center gap-1 transition"
          >
            <X className="w-3.5 h-3.5" /> Remove Image
          </button>
        )}
      </div>

      {/* Existing Image Preview */}
      {value ? (
        <div className="relative group border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center shadow-xs">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                // Fallback icon if preview fails
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Valid Image
              </span>
              {isCloudinary && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Sparkles className="w-3 h-3" /> Cloudinary
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate mt-1">
              {value}
            </p>
          </div>

          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition flex-shrink-0"
            title="Open full image"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ) : (
        /* Image Selection Tabs & Uploader */
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-850">
          {/* Tabs header */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium transition ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-[1px]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload from Device
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium transition ${
                activeTab === 'url'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-[1px]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Paste URL
            </button>
          </div>

          <div className="p-3">
            {activeTab === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-800/30'
                  } ${uploadMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {uploadMutation.isPending ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Uploading to Cloudinary & validating...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Click to select or drag & drop image
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        PNG, JPG, WEBP, GIF, SVG (up to 5MB) • Auto-uploaded to Cloudinary
                      </p>
                    </div>
                  )}
                </div>

                {fileError && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={pastedUrl}
                      onChange={(e) => {
                        setPastedUrl(e.target.value);
                        testImageUrl(e.target.value);
                      }}
                      placeholder="https://example.com/images/icon.png"
                      className={`w-full text-xs px-3 py-2 pl-8 border rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        urlError
                          ? 'border-rose-300 dark:border-rose-700 focus:ring-rose-400'
                          : urlVerified
                          ? 'border-emerald-300 dark:border-emerald-700 focus:ring-emerald-400'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500'
                      }`}
                    />
                    <LinkIcon className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    {isValidatingUrl && (
                      <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-blue-500 animate-spin" />
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!urlVerified || isValidatingUrl}
                    onClick={handleApplyUrl}
                    className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
                  >
                    Apply URL
                  </button>
                </div>

                {/* Real-time status / validation feedback */}
                {isValidatingUrl && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Validating image accessibility and integrity...
                  </p>
                )}

                {urlVerified && (
                  <div className="flex items-center gap-3 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <img
                      src={pastedUrl}
                      alt="Verified Preview"
                      className="w-8 h-8 rounded object-contain bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 p-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid Image Confirmed
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        Ready to apply to this catalog item.
                      </p>
                    </div>
                  </div>
                )}

                {urlError && (
                  <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{urlError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>
    </div>
  );
}
