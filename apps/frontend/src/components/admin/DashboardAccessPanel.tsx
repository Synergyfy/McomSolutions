import { useEffect, useState } from 'react';
import { Bot, Shield, Save, Loader2, CheckCircle2 } from 'lucide-react';
import {
  useProgrammeSettings,
  useUpdateProgrammeSettings,
} from '../../services/admin/hooks';
import EcosystemAccessSkillModal from './EcosystemAccessSkillModal';

export default function DashboardAccessPanel() {
  const { data: settingsRes } = useProgrammeSettings();
  const updateSettingsMutation = useUpdateProgrammeSettings();
  const [trialDays, setTrialDays] = useState(14);
  const [feeAmount, setFeeAmount] = useState(1.00);
  const [verificationReq, setVerificationReq] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);

  useEffect(() => {
    if (settingsRes?.data) {
      setTrialDays(settingsRes.data.trialAccessDays ?? 14);
      setFeeAmount(settingsRes.data.verificationFeeAmount ?? 1.00);
      setVerificationReq(settingsRes.data.verificationRequired ?? true);
    }
  }, [settingsRes]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await updateSettingsMutation.mutateAsync({
        trialAccessDays: trialDays,
        verificationFeeAmount: feeAmount,
        verificationRequired: verificationReq,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 5000);
    } catch (err) {
      console.error('Failed to update dashboard access settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ─── Dashboard Access & Verification Settings Card ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Dashboard Access & Verification Settings</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure verification requirements, the one-time fee, and how many days of platform access businesses receive before needing a full membership.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setShowSkillModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs transition-all shadow-xs hover:shadow min-h-[44px]"
              title="AI skill that explains how platforms verify memberships, access passes, and trials over SSO"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              Access Verification Skill
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/10 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Access Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Trial Access Duration (Days)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="365"
                value={trialDays}
                onChange={e => setTrialDays(parseInt(e.target.value) || 1)}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                days
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Days of platform access after paying the verification fee. When verification is not mandatory, this is the free trial length from signup.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Verification Fee Amount (£)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.00"
                value={feeAmount}
                onChange={e => setFeeAmount(parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                GBP
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              One-time charge for identity & anti-fraud validation during onboarding. Only charged when verification is mandatory.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Status & Enforcement
            </label>
            <div className="flex items-center gap-3 h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <input
                type="checkbox"
                id="reqCheck"
                checked={verificationReq}
                onChange={e => setVerificationReq(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
              />
              <label htmlFor="reqCheck" className="text-xs font-bold text-gray-800 cursor-pointer">
                Mandatory Verification Required
              </label>
            </div>
            <p className="text-[11px] text-gray-500">
              When checked, businesses must pay the verification fee before accessing the dashboard. When unchecked, they get a free trial of the configured days from signup.
            </p>
          </div>
        </div>

        {settingsSaved && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {verificationReq
              ? `Access settings successfully updated! New businesses will receive ${trialDays} days of trial access after paying the £${feeAmount.toFixed(2)} verification fee.`
              : `Access settings successfully updated! Verification is optional — new businesses get a ${trialDays}-day free trial, and existing unverified businesses start theirs now.`}
          </div>
        )}
      </div>

      {showSkillModal && (
        <EcosystemAccessSkillModal onClose={() => setShowSkillModal(false)} />
      )}
    </div>
  );
}
