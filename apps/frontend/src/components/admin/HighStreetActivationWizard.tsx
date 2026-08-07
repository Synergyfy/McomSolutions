import React, { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Users, 
  MapPin, 
  Globe, 
  ShieldCheck,
  Info,
  LayoutDashboard,
  Store,
  Activity,
  CheckCircle2,
  Layers,
  Rocket,
  X
} from 'lucide-react';

interface WizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  { id: 1, title: 'Basic Details', icon: Info },
  { id: 2, title: 'Hub Setup', icon: Building2 },
  { id: 3, title: 'Community', icon: Users },
  { id: 4, title: 'Management', icon: ShieldCheck },
  { id: 5, title: 'Review', icon: LayoutDashboard },
];

const FieldLabel = ({ children, tooltip }: { children: React.ReactNode, tooltip: string }) => (
  <div className="flex items-center gap-1.5 mb-1.5">
    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{children}</span>
    <div className="group relative flex items-center">
      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help hover:text-brand-blue transition-colors" />
      <div className="absolute left-6 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl z-50 leading-relaxed">
        {tooltip}
      </div>
    </div>
  </div>
);

export default function HighStreetActivationWizard({ open, onOpenChange }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    borough: '',
    region: '',
    categories: '',
    description: '',
    hubType: 'both',
    hubAddress: '',
    hubManager: '',
    contact: '',
    hours: '',
    communityName: '',
    communityDescription: '',
    goals: '',
    visibleToBorough: false,
    boroughManager: 'James Wilson',
    moderators: ['Sarah Chen', 'Mike Ross'],
    campaignManagers: ['David G. (Lead)'],
    communityLeaders: ['Local influencers & business owners'],
  });

  if (!open) return null;

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, steps.length));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const handleManagementAction = (type: string) => {
    console.log(`Triggering ${type} action`);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel tooltip="The official name of the high street area being activated.">
                High Street Name
              </FieldLabel>
              <input 
                type="text"
                placeholder="e.g. Oxford Street" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel tooltip="The administrative borough where this high street is located.">
                  Borough
                </FieldLabel>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-955"
                  value={formData.borough}
                  onChange={(e) => setFormData({ ...formData, borough: e.target.value })}
                >
                  <option value="">Select borough</option>
                  <option value="Westminster">Westminster</option>
                  <option value="Camden">Camden</option>
                  <option value="Tower Hamlets">Tower Hamlets</option>
                </select>
              </div>
              <div>
                <FieldLabel tooltip="Specific neighborhood or commercial zone within the borough.">
                  Region
                </FieldLabel>
                <input 
                  type="text"
                  placeholder="e.g. West End" 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel tooltip="Primary business sectors represented on this high street (e.g., Fashion, Dining).">
                Categories
              </FieldLabel>
              <input 
                type="text"
                placeholder="e.g. Retail, Fashion, Dining" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.categories}
                onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel tooltip="A detailed overview of the high street's character and strategic goals.">
                Description
              </FieldLabel>
              <textarea 
                placeholder="Describe the high street ecosystem..." 
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel tooltip="Choose between a digital-only presence, a physical storefront hub, or a hybrid model.">
                Hub Options
              </FieldLabel>
              <div className="grid grid-cols-3 gap-4">
                <div 
                  onClick={() => setFormData({ ...formData, hubType: 'virtual' })}
                  className={`border rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-500 transition-all ${
                    formData.hubType === 'virtual' ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500" : "bg-white border-gray-200"
                  }`}
                >
                  <Globe className={`h-6 w-6 ${formData.hubType === 'virtual' ? "text-orange-600" : "text-gray-400"}`} />
                  <span className={`text-xs font-bold ${formData.hubType === 'virtual' ? "text-orange-950" : "text-gray-600"}`}>Virtual Hub</span>
                </div>

                <div 
                  onClick={() => setFormData({ ...formData, hubType: 'physical' })}
                  className={`border rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-500 transition-all ${
                    formData.hubType === 'physical' ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500" : "bg-white border-gray-200"
                  }`}
                >
                  <Building2 className={`h-6 w-6 ${formData.hubType === 'physical' ? "text-orange-600" : "text-gray-400"}`} />
                  <span className={`text-xs font-bold ${formData.hubType === 'physical' ? "text-orange-950" : "text-gray-600"}`}>Physical Hub</span>
                </div>

                <div 
                  onClick={() => setFormData({ ...formData, hubType: 'both' })}
                  className={`border rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-500 transition-all ${
                    formData.hubType === 'both' ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500" : "bg-white border-gray-200"
                  }`}
                >
                  <Layers className={`h-6 w-6 ${formData.hubType === 'both' ? "text-orange-600" : "text-gray-400"}`} />
                  <span className={`text-xs font-bold ${formData.hubType === 'both' ? "text-orange-950" : "text-gray-600"}`}>Both</span>
                </div>
              </div>
            </div>
            <div>
              <FieldLabel tooltip="The physical street address of the Mcom Hub office or storefront.">
                Hub Address
              </FieldLabel>
              <input 
                type="text"
                placeholder="Physical location if applicable" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.hubAddress}
                onChange={(e) => setFormData({ ...formData, hubAddress: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel tooltip="The lead official responsible for daily hub operations and business support.">
                  Hub Manager
                </FieldLabel>
                <input 
                  type="text"
                  placeholder="Assign manager" 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                  value={formData.hubManager}
                  onChange={(e) => setFormData({ ...formData, hubManager: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel tooltip="Primary email or phone number for hub-related inquiries.">
                  Contact Details
                </FieldLabel>
                <input 
                  type="text"
                  placeholder="Email or Phone" 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel tooltip="When the physical hub is open to the public and businesses.">
                Operational Hours
              </FieldLabel>
              <input 
                type="text"
                placeholder="e.g. 09:00 - 18:00" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel tooltip="The public name for the community group associated with this high street.">
                Community Group Name
              </FieldLabel>
              <input 
                type="text"
                placeholder="e.g. Oxford Street Traders" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.communityName}
                onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel tooltip="The purpose and mission statement for this local business community.">
                Community Description
              </FieldLabel>
              <textarea 
                placeholder="Community vision..." 
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.communityDescription}
                onChange={(e) => setFormData({ ...formData, communityDescription: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel tooltip="Key performance indicators (KPIs) for community growth and participation.">
                Engagement Goals
              </FieldLabel>
              <input 
                type="text"
                placeholder="e.g. 20% increase in local footfall" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={formData.goals}
                onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input 
                id="visibility" 
                type="checkbox"
                className="w-4 h-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue"
                checked={formData.visibleToBorough}
                onChange={(e) => setFormData({ ...formData, visibleToBorough: e.target.checked })}
              />
              <label htmlFor="visibility" className="text-sm font-semibold text-gray-700 cursor-pointer">
                Make group visible to all customers in borough
              </label>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 py-2">
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-4 border border-gray-150 rounded-2xl hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-xl text-orange-600"><ShieldCheck className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Borough Manager</p>
                    <p className="text-xs text-gray-500 font-semibold">{formData.boroughManager}</p>
                  </div>
                </div>
                <button onClick={() => handleManagementAction('change-manager')} className="text-xs font-bold text-brand-blue hover:text-brand-blue/80 py-1.5 px-3 rounded-lg hover:bg-gray-100/80 transition-all">Change</button>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-150 rounded-2xl hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Users className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Moderators</p>
                    <p className="text-xs text-gray-500 font-semibold">{formData.moderators.join(', ')}</p>
                  </div>
                </div>
                <button onClick={() => handleManagementAction('add-moderator')} className="text-xs font-bold text-brand-blue hover:text-brand-blue/80 py-1.5 px-3 rounded-lg hover:bg-gray-100/80 transition-all">Add</button>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-150 rounded-2xl hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Activity className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Campaign Managers</p>
                    <p className="text-xs text-gray-500 font-semibold">{formData.campaignManagers.join(', ')}</p>
                  </div>
                </div>
                <button onClick={() => handleManagementAction('assign-campaign-manager')} className="text-xs font-bold text-brand-blue hover:text-brand-blue/80 py-1.5 px-3 rounded-lg hover:bg-gray-100/80 transition-all">Assign</button>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-150 rounded-2xl hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-50 rounded-xl text-pink-600"><Store className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Community Leaders</p>
                    <p className="text-xs text-gray-500 font-semibold">{formData.communityLeaders.join(', ')}</p>
                  </div>
                </div>
                <button onClick={() => handleManagementAction('invite-leader')} className="text-xs font-bold text-brand-blue hover:text-brand-blue/80 py-1.5 px-3 rounded-lg hover:bg-gray-100/80 transition-all">Invite</button>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4 py-2 max-h-[350px] overflow-y-auto pr-1">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150">
              <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Summary Preview
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 font-semibold">High Street Name</span>
                  <span className="font-bold text-gray-950">{formData.name || 'Not specified'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 font-semibold">Borough</span>
                  <span className="font-bold text-gray-950">{formData.borough || 'Not specified'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 font-semibold">Hub Setup</span>
                  <span className="font-bold text-gray-950 capitalize">{formData.hubType} Hub</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 font-semibold">Community Group</span>
                  <span className="font-bold text-gray-950">{formData.communityName || 'Not created'}</span>
                </div>
              </div>
            </div>

            <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100">
              <h4 className="text-xs font-bold text-orange-950 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Globe className="h-4 w-4 text-orange-600" />
                Ecosystem Activation Preview
              </h4>
              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-orange-700">
                <div className="bg-white p-3 rounded-xl border border-orange-100 flex flex-col items-center gap-1.5 shadow-sm">
                  <Store className="h-4 w-4 text-orange-500" />
                  <span>Marketplace Listing</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-orange-100 flex flex-col items-center gap-1.5 shadow-sm">
                  <Users className="h-4 w-4 text-orange-500" />
                  <span>Community Group</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed font-semibold">
                Activating this high street will notify all assigned managers and create the associated community groups immediately.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-gray-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <MapPin className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ecosystem Activation</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">High Street Activation Flow</h3>
            <p className="text-xs text-gray-400 font-medium">Complete the steps below to activate a new physical or virtual high street ecosystem.</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100 overflow-x-auto no-scrollbar">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className={`flex flex-col items-center gap-1.5 relative z-10 ${
                currentStep >= step.id ? "text-orange-600" : "text-gray-400"
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 font-bold text-xs ${
                  currentStep === step.id ? "border-orange-600 bg-orange-50" : 
                  currentStep > step.id ? "border-orange-600 bg-orange-600 text-white" : "border-gray-200 bg-white"
                }`}>
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[9px] font-bold uppercase whitespace-nowrap tracking-wider">{step.title}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 -mt-4 transition-all duration-200 min-w-[20px] ${
                  currentStep > step.id ? "bg-orange-600" : "bg-gray-200"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/55">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:hover:text-gray-500 transition-all hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => onOpenChange(false)}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:shadow transition-all"
            >
              Save Draft
            </button>
            {currentStep === steps.length ? (
              <button 
                onClick={() => {
                  console.log("Activating High Street with data:", formData);
                  onOpenChange(false);
                }}
                className="py-2.5 px-5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 shadow-lg shadow-orange-100 hover:shadow-xl hover:scale-[1.01] transition-all"
              >
                <Rocket className="h-4 w-4" />
                Activate High Street
              </button>
            ) : (
              <button 
                onClick={nextStep}
                className="py-2.5 px-5 rounded-xl text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2 hover:scale-[1.01] transition-all"
              >
                Next Step
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
