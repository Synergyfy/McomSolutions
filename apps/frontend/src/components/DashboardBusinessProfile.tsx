import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Globe, MapPin, Phone, Mail, Link2,
  Instagram, Twitter, Facebook, CheckCircle2, AlertCircle,
  Edit2, Upload, ShieldCheck, Camera, Plus, ExternalLink
} from 'lucide-react';
import { businessApi } from '../lib/api';

export default function DashboardBusinessProfile() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await businessApi.getProfile();
      setFormData({
        businessName: data.businessName || '',
        businessType: data.businessType || '',
        description: data.description || '',
        email: data.email || '',
        phone: data.phone || '',
        country: data.country || '',
        address: data.address || '',
        postcode: data.postcode || '',
        website: data.website || '',
        openingHours: data.openingHours || '',
        socialMedia: data.socialMedia || '',
        industry: data.industry || '',
        category: data.category || '',
        isOnGoogle: data.isOnGoogle || false,
        apiKey: data.apiKey || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load business profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await businessApi.updateProfile(formData);
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update business profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const res = await businessApi.generateApiKey();
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-2xl flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Hero */}
      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-10">
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className="relative flex-shrink-0">
            <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/25 text-white text-5xl font-black">
              {formData.businessName ? formData.businessName.charAt(0).toUpperCase() : 'B'}
            </div>
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
    </div>
  );
}

