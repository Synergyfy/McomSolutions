import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Globe, MapPin, Phone, Mail, Link2,
  Instagram, Twitter, Facebook, CheckCircle2, AlertCircle,
  Edit2, Upload, ShieldCheck, Camera, Plus, ExternalLink, Loader2
} from 'lucide-react';
import { useProfile, useUpdateProfile, useGenerateApiKey, useUploadBusinessFile } from '../services/business/hooks';
import { useReferralInfo } from '../services/referrals/hooks';
import ReferralLinkCard from './ReferralLinkCard';

export default function DashboardBusinessProfile() {
  const { data: profile, isLoading: loading } = useProfile();
  const { data: referralInfo, isLoading: referralLoading } = useReferralInfo();
  const { mutateAsync: updateProfile } = useUpdateProfile();
  const { mutateAsync: generateApiKey } = useGenerateApiKey();
  const uploadLogoMutation = useUploadBusinessFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    description: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    postcode: '',
    website: '',
    openingHours: '',
    socialMedia: '',
    industry: '',
    category: '',
    isOnGoogle: false,
    apiKey: '',
    logoUrl: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        businessName: profile.businessName || '',
        businessType: profile.businessType || '',
        description: profile.description || '',
        email: profile.email || '',
        phone: profile.phone || '',
        country: profile.country || '',
        address: profile.address || '',
        postcode: profile.postcode || '',
        website: profile.website || '',
        openingHours: profile.openingHours || '',
        socialMedia: profile.socialMedia || '',
        industry: profile.industry || '',
        category: profile.category || '',
        isOnGoogle: profile.isOnGoogle || false,
        apiKey: profile.apiKey || '',
        logoUrl: profile.logoUrl || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size must be less than 5MB');
      return;
    }

    setError(null);
    try {
      const res = await uploadLogoMutation.mutateAsync(file);
      const newLogoUrl = res.secure_url;
      setFormData(prev => ({ ...prev, logoUrl: newLogoUrl }));
      // Save to business profile immediately to persist and trigger task event worker
      await updateProfile({ ...formData, logoUrl: newLogoUrl });
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload logo.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile(formData);
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update business profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const res = await generateApiKey();
      setFormData(prev => ({ ...prev, apiKey: res.apiKey }));
    } catch (err: any) {
      alert('Failed to generate API Key');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-semibold">Loading business profile...</p>
      </div>
    );
  }

  const socialLinks = [
    { id: 'instagram', label: 'Social Link', icon: Instagram, placeholder: 'Enter handles or links', name: 'socialMedia', value: formData.socialMedia },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Business Profile</h2>
          <p className="text-gray-500">Your master business record — shared across all MCOM platforms.</p>
        </div>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button disabled={saving} onClick={() => setEditing(false)} className="px-7 py-3 rounded-full border border-gray-200 hover:bg-gray-50 font-bold text-gray-600 transition-colors disabled:opacity-50">Cancel</button>
              <button disabled={saving} onClick={handleSave} className="px-7 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-7 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20">
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {logoSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-2xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>Official business logo updated and verified! Points awarded to your wallet.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-2xl flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Hero */}
      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-10">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Logo container */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl border-2 border-gray-100 bg-gray-50 flex items-center justify-center shadow-xl overflow-hidden relative group-hover:border-orange-300 transition-all">
                {formData.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    alt={formData.businessName || 'Business Logo'}
                    className="w-full h-full object-contain p-2 bg-white"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-5xl font-black">
                    {formData.businessName ? formData.businessName.charAt(0).toUpperCase() : 'B'}
                  </div>
                )}

                {/* Uploading Overlay */}
                {uploadLogoMutation.isPending && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-white">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                    <span className="text-[10px] font-bold">Uploading...</span>
                  </div>
                )}
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />

              {/* Camera Trigger Badge */}
              <button
                type="button"
                disabled={uploadLogoMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg border-2 border-white transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                title="Upload Business Logo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Text Button */}
            <button
              type="button"
              disabled={uploadLogoMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadLogoMutation.isPending ? 'Uploading...' : formData.logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
            </button>
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-4">
                <input name="businessName" value={formData.businessName} onChange={handleChange} className="w-full text-3xl font-black bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900" />
                <input name="businessType" value={formData.businessType} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 font-semibold" />
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-600 text-sm resize-none" />
              </div>
            ) : (
              <>
                <h3 className="text-3xl font-black text-gray-900 mb-1">{formData.businessName || 'Business Name'}</h3>
                <p className="text-orange-500 font-bold text-base mb-4">{formData.businessType || 'Type'}</p>
                <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">{formData.description || 'No description provided.'}</p>
              </>
            )}

            {/* Verification Badge */}
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-full text-sm font-bold">
                <ShieldCheck className="w-4 h-4" /> Verified Business
              </div>
              {formData.isOnGoogle && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded-full text-sm font-bold">
                  <Globe className="w-4 h-4" /> Google Business Linked
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Information */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" /> Business Information
          </h3>
          <div className="space-y-5">
            {[
              { label: 'Industry', name: 'industry', icon: Building2 },
              { label: 'Category', name: 'category', icon: Building2 },
              { label: 'Country', name: 'country', icon: Globe },
              { label: 'Business Hours', name: 'openingHours', icon: AlertCircle },
            ].map(field => {
              const Icon = field.icon;
              return (
                <div key={field.name}>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">{field.label}</label>
                  {editing ? (
                    <input name={field.name} value={(formData as any)[field.name]} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold text-sm" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <span className="text-gray-800 font-semibold text-sm">{(formData as any)[field.name] || 'Not specified'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact & API Details */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Phone className="w-5 h-5 text-orange-500" /> Contact Details
          </h3>
          <div className="space-y-5">
            {[
              { label: 'Email Address', name: 'email', icon: Mail },
              { label: 'Phone Number', name: 'phone', icon: Phone },
              { label: 'Website', name: 'website', icon: Link2 },
            ].map(field => {
              const Icon = field.icon;
              return (
                <div key={field.name}>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">{field.label}</label>
                  {editing ? (
                    <input name={field.name} value={(formData as any)[field.name]} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold text-sm" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <span className="text-gray-800 font-semibold text-sm">{(formData as any)[field.name] || 'Not specified'}</span>
                      {field.name === 'website' && formData.website && <ExternalLink className="w-3 h-3 text-orange-400" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* API Key Integration */}
          <h3 className="text-lg font-bold text-gray-900 mt-8 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" /> Platform Integration API Key
          </h3>
          <p className="text-xs text-gray-500 mb-4">Use this key to securely link other MCOM platforms (Rewards, Mall) to this storefront.</p>
          <div className="space-y-3">
            {formData.apiKey ? (
              <div className="flex items-center gap-2">
                <input readOnly value={formData.apiKey} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-xs text-gray-700" />
                <button onClick={handleGenerateKey} className="px-4 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-600 rounded-xl font-semibold text-xs transition">Rotate Key</button>
              </div>
            ) : (
              <button onClick={handleGenerateKey} className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-xs transition shadow-md shadow-orange-500/10">
                Generate API Key
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <ReferralLinkCard
        referralLink={referralInfo?.referralLink}
        referralCode={referralInfo?.referralCode}
        isLoading={referralLoading}
      />
    </div>
  );
}

