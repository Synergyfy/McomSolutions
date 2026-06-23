import React, { useState } from 'react';
import {
  User, Lock, ShieldCheck, Bell, Smartphone,
  Mail, Key, CheckCircle2, AlertCircle, Apple
} from 'lucide-react';

export default function DashboardSettings() {
  const [twoFactor, setTwoFactor] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Account Settings</h2>
          <p className="text-gray-500">Manage your personal account, security, and preferences.</p>
        </div>
        <button className="px-7 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20">
          Save Preferences
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Personal Information */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" /> Personal Information
          </h3>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Full Name</label>
              <input defaultValue="Frank Castle" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Email Address</label>
              <input defaultValue="frank@mcomsolutions.co.uk" disabled className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 font-semibold text-sm cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Contact support to change your primary email.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Job Title</label>
              <input defaultValue="Managing Director" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold text-sm" />
            </div>
          </div>
        </div>

        {/* Security & Passwords */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" /> Security
          </h3>
          
          <div className="mb-8">
            <p className="text-sm font-bold text-gray-900 mb-2">Change Password</p>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 hover:bg-gray-50 font-bold text-gray-600 transition-colors text-sm">
              <Key className="w-4 h-4" /> Send Reset Link
            </button>
            <p className="text-xs text-gray-400 mt-2">We will send a secure link to your primary email.</p>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Two-Factor Authentication (2FA)</p>
                <p className="text-xs text-gray-500 max-w-sm">Protect your account with an extra layer of security using an authenticator app or SMS.</p>
              </div>
              <button 
                onClick={() => setTwoFactor(!twoFactor)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${twoFactor ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${twoFactor ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {twoFactor && (
              <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">2FA is actively protecting your account.</p>
              </div>
            )}
          </div>
        </div>

        {/* Notifications Preferences */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" /> Notification Preferences
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center"><Mail className="w-5 h-5 text-gray-600" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Email Notifications</p>
                  <p className="text-xs text-gray-500">Receive alerts, billing updates, and digests via email.</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailNotifs(!emailNotifs)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotifs ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center"><Smartphone className="w-5 h-5 text-gray-600" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-900">SMS Alerts</p>
                  <p className="text-xs text-gray-500">Receive critical security and billing alerts via SMS.</p>
                </div>
              </div>
              <button 
                onClick={() => setSmsNotifs(!smsNotifs)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsNotifs ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smsNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" /> Connected Accounts
          </h3>
          <p className="text-sm text-gray-500 mb-6">Link third-party accounts for seamless login.</p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="w-5 h-5" />
                <span className="font-bold text-sm text-gray-900">Google</span>
              </div>
              <button className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors">Disconnect</button>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <Apple className="w-5 h-5 text-gray-900" />
                <span className="font-bold text-sm text-gray-900">Apple</span>
              </div>
              <button className="text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 border border-gray-200 rounded-full transition-colors">Connect</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
