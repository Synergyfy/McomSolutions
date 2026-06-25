import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Globe, MapPin, Phone, Mail, Link2,
  Instagram, Twitter, Facebook, CheckCircle2, AlertCircle,
  Edit2, Upload, ShieldCheck, Camera, Plus, ExternalLink
} from 'lucide-react';

const SOCIAL = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@yourhandle', value: '@mcom_business' },
  { id: 'twitter', label: 'Twitter / X', icon: Twitter, placeholder: '@yourhandle', value: '@mcom_biz' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'fb.com/yourpage', value: 'fb.com/mcom' },
  { id: 'website', label: 'Website', icon: Link2, placeholder: 'https://...', value: 'https://mcom.co.uk' },
];

const LOCATIONS = [
  { name: 'Head Office', address: '24 Commerce Street, London, EC1A 1BB', primary: true },
  { name: 'Birmingham Branch', address: '12 Business Park, Birmingham, B1 1AA', primary: false },
];

export default function DashboardBusinessProfile() {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    businessName: 'MCOM Solutions Ltd',
    businessType: 'Retail & Technology',
    description: 'A leading enterprise solutions provider operating across the MCOM and 247GBS ecosystems, delivering cutting-edge digital commerce tools to businesses of all sizes.',
    email: 'contact@mcomsolutions.co.uk',
    phone: '+44 20 7946 0800',
    country: 'United Kingdom',
    city: 'London',
    website: 'https://mcomsolutions.co.uk',
    openingHours: 'Mon–Fri: 9:00am – 6:00pm',
    industry: 'Technology & Commerce',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
              <button onClick={() => setEditing(false)} className="px-7 py-3 rounded-full border border-gray-200 hover:bg-gray-50 font-bold text-gray-600 transition-colors">Cancel</button>
              <button onClick={() => setEditing(false)} className="px-7 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20">Save Changes</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-7 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20">
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Profile Hero */}
      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-10">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Logo Upload */}
          <div className="relative flex-shrink-0">
            <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/25 text-white text-5xl font-black">
              M
            </div>
            {editing && (
              <button className="absolute -bottom-3 -right-3 w-10 h-10 bg-white border-2 border-orange-500 rounded-full flex items-center justify-center shadow-md hover:bg-orange-50 transition-colors">
                <Camera className="w-4 h-4 text-orange-500" />
              </button>
            )}
          </div>

          {/* Core Info */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-4">
                <input name="businessName" value={formData.businessName} onChange={handleChange} className="w-full text-3xl font-black bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900" />
                <input name="businessType" value={formData.businessType} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 font-semibold" />
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-600 text-sm resize-none" />
              </div>
            ) : (
              <>
                <h3 className="text-3xl font-black text-gray-900 mb-1">{formData.businessName}</h3>
                <p className="text-orange-500 font-bold text-base mb-4">{formData.businessType}</p>
                <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">{formData.description}</p>
              </>
            )}

            {/* Verification Badge */}
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-full text-sm font-bold">
                <ShieldCheck className="w-4 h-4" /> Verified Business
              </div>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded-full text-sm font-bold">
                <Globe className="w-4 h-4" /> Google Business Linked
              </div>
              <button className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 px-4 py-2 rounded-full text-sm font-bold hover:bg-orange-100 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Verify Business
              </button>
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
              { label: 'Country', name: 'country', icon: Globe },
              { label: 'City', name: 'city', icon: MapPin },
              { label: 'Opening Hours', name: 'openingHours', icon: AlertCircle },
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
                      <span className="text-gray-800 font-semibold text-sm">{(formData as any)[field.name]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Details */}
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
                      <span className="text-gray-800 font-semibold text-sm">{(formData as any)[field.name]}</span>
                      {field.name === 'website' && <ExternalLink className="w-3 h-3 text-orange-400" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Social Media */}
          <h3 className="text-lg font-bold text-gray-900 mt-8 mb-6 flex items-center gap-2">
            <Instagram className="w-5 h-5 text-orange-500" /> Social Media
          </h3>
          <div className="space-y-4">
            {SOCIAL.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  {editing ? (
                    <input defaultValue={s.value} placeholder={s.placeholder} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold text-sm" />
                  ) : (
                    <span className="text-gray-700 font-semibold text-sm">{s.value}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Google Business Status */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-orange-500" /> Google Business Status
          </h3>
          <div className="flex items-start gap-5 p-6 bg-green-50 rounded-2xl border border-green-200 mb-6">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Globe className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-black text-gray-900">Connected</p>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-sm text-gray-500">Your Google Business Profile is linked and syncing data to your MCOM storefront.</p>
            </div>
          </div>
          <button className="w-full py-3.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> View on Google Maps
          </button>
        </div>

        {/* Locations */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" /> Locations
            </h3>
            <button className="flex items-center gap-1.5 text-orange-500 font-bold text-sm hover:underline">
              <Plus className="w-4 h-4" /> Add Location
            </button>
          </div>
          <div className="space-y-4">
            {LOCATIONS.map((loc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-start gap-4 p-5 rounded-2xl border ${loc.primary ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className={`w-10 h-10 ${loc.primary ? 'bg-orange-500' : 'bg-gray-400'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-gray-900 text-sm">{loc.name}</p>
                    {loc.primary && <span className="bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Primary</span>}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{loc.address}</p>
                </div>
                {editing && (
                  <button className="text-gray-300 hover:text-orange-500 transition-colors flex-shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
