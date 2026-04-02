import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  CreditCard, 
  Zap, 
  Star, 
  Trophy, 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft,
  Search,
  LayoutGrid,
  Target,
  Settings,
  Bell,
  LogOut,
  BadgeCheck,
  RefreshCw,
  Edit3,
  CheckCircle2,
  X,
  Layers,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { usePricing, ICON_MAP, Membership, PricingPlan, SubTier } from '../context/PricingContext';

export default function PricingManager() {
  const { plans, updatePlan, resetToDefaults } = usePricing();
  const [editingId, setEditingId] = useState<Membership | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleSave = () => {
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleFeatureAdd = (planId: Membership, tier?: SubTier) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (tier) {
        const newTierFeatures = { ...plan.tierFeatures };
        newTierFeatures[tier] = [...(newTierFeatures[tier] || []), 'New Benefit'];
        updatePlan(planId, { tierFeatures: newTierFeatures });
    } else {
        updatePlan(planId, { features: [...plan.features, 'New Global Feature'] });
    }
  };

  const handleFeatureRemove = (planId: Membership, index: number, tier?: SubTier) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (tier) {
        const newTierFeatures = { ...plan.tierFeatures };
        const updated = [...newTierFeatures[tier]];
        updated.splice(index, 1);
        newTierFeatures[tier] = updated;
        updatePlan(planId, { tierFeatures: newTierFeatures });
    } else {
        const newFeatures = [...plan.features];
        newFeatures.splice(index, 1);
        updatePlan(planId, { features: newFeatures });
    }
  };

  const handleFeatureChange = (planId: Membership, index: number, value: string, tier?: SubTier) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (tier) {
        const newTierFeatures = { ...plan.tierFeatures };
        const updated = [...newTierFeatures[tier]];
        updated[index] = value;
        newTierFeatures[tier] = updated;
        updatePlan(planId, { tierFeatures: newTierFeatures });
    } else {
        const newFeatures = [...plan.features];
        newFeatures[index] = value;
        updatePlan(planId, { features: newFeatures });
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-gray-900 overflow-x-hidden">
      {/* Admin Sidebar */}
      <aside className="w-20 lg:w-72 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-glow">24</div>
          <div className="hidden lg:block">
            <div className="font-bold text-xl tracking-tighter text-gray-900 uppercase">Admin Hub</div>
            <div className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">Global Ecosystem</div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          <Link to="/admin" className="w-full">
            <NavItem icon={LayoutGrid} label="Admin Overview" />
          </Link>
          <NavItem icon={CreditCard} label="Pricing Manager" active />
          <NavItem icon={Building2} label="All Businesses" />
          <NavItem icon={Target} label="Campaigns" />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden lg:block">System Control</span>
          </div>
          <NavItem icon={Settings} label="Global Settings" />
        </nav>

        <div className="p-6">
          <button className="w-full flex items-center gap-3 p-4 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all group">
            <LogOut className="w-5 h-5 group-hover:rotate-180 transition-transform" />
            <span className="font-semibold text-sm hidden lg:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-72 bg-mesh min-h-screen">
        <header className="sticky top-0 z-10 px-12 py-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <h2 className="text-xl font-bold tracking-tight">Pricing & Membership Editor</h2>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={resetToDefaults}
              className="px-4 py-2 text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-2 text-sm font-bold"
            >
              <RefreshCw className="w-4 h-4" /> Reset Defaults
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow"
            >
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </header>

        <div className="p-12">
          {editingId ? (
            <EditPanel 
              plan={plans.find(p => p.id === editingId)!} 
              onClose={() => setEditingId(null)}
              updatePlan={updatePlan}
              onFeatureRemove={handleFeatureRemove}
              onFeatureAdd={handleFeatureAdd}
              onFeatureChange={handleFeatureChange}
            />
          ) : (
            <div className="space-y-12">
              <div className="max-w-4xl">
                <h1 className="text-4xl font-bold mb-4 tracking-tight">Configure Membership Tiers</h1>
                <p className="text-lg text-gray-500 font-medium leading-relaxed">
                  Select a membership card below to edit its specific details including pricing, 
                  features, and tier-specific benefits.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map(plan => (
                  <div key={plan.id} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm transition-all hover:border-brand-blue/30 group relative flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        plan.color
                      )}>
                        <PlanIcon name={plan.iconName} className="w-6 h-6 text-white" />
                      </div>
                      <button 
                        onClick={() => setEditingId(plan.id)}
                        className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:text-brand-blue hover:bg-blue-50 transition-all"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-brand-blue transition-colors mb-1">{plan.name}</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{plan.whoItIsFor}</p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 mb-8">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Base Pricing</div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">£{plan.price.Normal}</span>
                            <span className="text-xs text-gray-400">/mo Normal</span>
                        </div>
                    </div>

                    <div className="space-y-3 mb-8 flex-1">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tier Options</div>
                      <div className="space-y-2">
                        {(['Normal', 'Pro', 'Pro+'] as SubTier[]).map(t => (
                            <div key={t} className="flex items-center justify-between text-xs font-bold p-2 bg-gray-50 rounded-xl">
                                <span className="text-gray-400">{t}</span>
                                <span className="text-brand-blue">£{plan.price[t]}</span>
                            </div>
                        ))}
                      </div>
                    </div>

                    <button 
                         onClick={() => setEditingId(plan.id)}
                        className="w-full py-4 border-2 border-brand-blue/10 rounded-2xl text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition-all shadow-sm"
                    >
                        Advanced Editor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <AnimatePresence>
            {showSavedToast && (
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed bottom-12 right-12 bg-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4"
                >
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                    <div className="font-bold">Configuration Sync Successful</div>
                    <button onClick={() => setShowSavedToast(false)}><X className="w-4 h-4 text-gray-400" /></button>
                </motion.div>
            )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function EditPanel({ plan, onClose, updatePlan, onFeatureRemove, onFeatureAdd, onFeatureChange }: any) {
    const [activeTab, setActiveTab] = useState<'Global' | SubTier>('Global');

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20"
        >
            <div className="lg:col-span-2 space-y-8">
                {/* Header Section */}
                <div className="bg-white rounded-[3rem] p-12 border border-blue-100 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4">
                        <PlanIcon name={plan.iconName} className="w-64 h-64" />
                    </div>
                    
                    <div className="flex items-center gap-6 mb-12">
                         <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center p-4", plan.color)}>
                            <PlanIcon name={plan.iconName} className="w-full h-full text-white" />
                         </div>
                         <div>
                            <h2 className="text-4xl font-bold">{plan.name} Membership</h2>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Full Advanced Configuration</p>
                         </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <InputGroup 
                            label="Membership Heading" 
                            value={plan.name} 
                            onChange={(v: string) => updatePlan(plan.id, { name: v })} 
                        />
                        <InputGroup 
                            label="Target Segment" 
                            value={plan.whoItIsFor} 
                            onChange={(v: string) => updatePlan(plan.id, { whoItIsFor: v })} 
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-4 ml-2">Tier Price Scaling</label>
                        <div className="grid grid-cols-3 gap-4">
                            {(['Normal', 'Pro', 'Pro+'] as SubTier[]).map(tier => (
                                <div key={tier} className="bg-gray-50 p-4 rounded-2xl border border-transparent hover:border-brand-blue/10">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">{tier}</div>
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="font-bold text-gray-400">£</span>
                                        <input 
                                            type="number"
                                            className="bg-transparent border-none focus:ring-0 w-full text-center font-bold text-xl"
                                            value={plan.price[tier]}
                                            onChange={(e) => updatePlan(plan.id, { price: { ...plan.price, [tier]: parseInt(e.target.value) } })}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Advanced Features Editor */}
                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-1 border-b border-gray-100 flex gap-1 bg-gray-50/50">
                        {(['Global', 'Normal', 'Pro', 'Pro+'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 py-6 text-xs font-bold uppercase tracking-widest transition-all",
                                    activeTab === tab ? "bg-white text-brand-blue shadow-sm border-b-2 border-brand-blue" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                {tab === 'Global' ? 'Core Features' : `${tab} Benefits`}
                            </button>
                        ))}
                    </div>

                    <div className="p-12">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight mb-1">
                                    {activeTab === 'Global' ? 'Standard Inclusions' : `${activeTab} Specific Benefits`}
                                </h3>
                                <p className="text-sm text-gray-400 font-medium">
                                    {activeTab === 'Global' ? "Applied to all tiers regardless of user's choice." : `These benefits only appear when the user selects the ${activeTab} sub-tier.`}
                                </p>
                            </div>
                            <button 
                                onClick={() => onFeatureAdd(plan.id, activeTab === 'Global' ? undefined : activeTab)}
                                className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm shadow-glow flex items-center gap-2 hover:bg-blue-600 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Add Item
                            </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            {(activeTab === 'Global' ? plan.features : (plan.tierFeatures?.[activeTab] || [])).map((f: string, i: number) => (
                                <div key={i} className="flex items-center gap-3 bg-gray-50 p-2 pl-6 rounded-2xl group border border-transparent hover:border-brand-blue/20 hover:bg-white transition-all shadow-sm">
                                    <input 
                                        className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-sm"
                                        value={f}
                                        onChange={(e) => onFeatureChange(plan.id, i, e.target.value, activeTab === 'Global' ? undefined : activeTab)}
                                    />
                                    <button 
                                        onClick={() => onFeatureRemove(plan.id, i, activeTab === 'Global' ? undefined : activeTab)}
                                        className="p-4 text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-brand-dark text-white rounded-[3rem] p-10 flex flex-col h-fit sticky top-24 shadow-2xl">
                    <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                        <BadgeCheck className="w-6 h-6 text-brand-blue shadow-glow" /> Plan Actions
                    </h4>
                    <div className="space-y-4 mb-10">
                        <ActionButton icon={Plus} label="Duplicate Tier" />
                        <ActionButton icon={Trash2} label="Remove Permanent" variant="danger" />
                        <ActionButton icon={ChevronRight} label="Preview Layout" />
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-full py-5 bg-white text-brand-dark rounded-2xl font-black text-xl hover:bg-gray-100 transition-all active:scale-95 shadow-glow"
                    >
                        Save & Exit
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function ActionButton({ label, variant = 'default', icon: Icon }: any) {
    return (
        <button className={cn(
            "w-full p-5 rounded-2xl text-left font-bold transition-all flex items-center justify-between group",
            variant === 'danger' ? "hover:bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-white/10 text-gray-400 hover:text-white border border-white/5"
        )}>
            <div className="flex items-center gap-3">
                {Icon && <Icon className="w-4 h-4" />}
                {label}
            </div>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all" />
        </button>
    );
}

function InputGroup({ label, value, onChange }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block pl-4">{label}</label>
            <input 
                className="w-full bg-gray-50 border-transparent rounded-3xl px-8 py-5 focus:bg-white focus:ring-4 focus:ring-brand-blue/5 transition-all font-bold text-lg border border-gray-100"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

function PlanIcon({ name, ...props }: any) {
  const Icon = ICON_MAP[name as keyof typeof ICON_MAP];
  return <Icon {...props} />;
}

function NavItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "w-full flex items-center gap-4 p-4 rounded-xl transition-all group cursor-pointer",
      active ? "bg-brand-blue text-white shadow-glow" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    )}>
      <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", active ? "text-white" : "text-gray-400 group-hover:text-gray-900")} />
      <span className="font-semibold text-sm hidden lg:block tracking-tight">{label}</span>
    </div>
  );
}
