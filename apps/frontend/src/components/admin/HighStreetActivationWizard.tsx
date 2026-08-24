import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronRight, ChevronLeft, MapPin, Search, Info, LayoutDashboard, Rocket, X, Loader2 } from 'lucide-react';
import { useCreateHighStreet, useAdminBoroughs } from '../../services/admin/hooks';

interface WizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const steps = [
  { id: 1, title: 'Details', icon: MapPin },
  { id: 2, title: 'Location', icon: Search },
  { id: 3, title: 'Review', icon: LayoutDashboard },
];

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export default function HighStreetActivationWizard({ open, onOpenChange, onCreated }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const createHighStreet = useCreateHighStreet();
  const { data: boroughsRes } = useAdminBoroughs();
  const boroughNames = ((boroughsRes?.data ?? []) as { name: string }[]).map(b => b.name);

  const [name, setName] = useState('');
  const [borough, setBorough] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchNominatim = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' London UK')}&format=json&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNominatim(value), 400);
  };

  const selectSuggestion = (result: NominatimResult) => {
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    setLocationAddress(result.display_name);
    setSearchQuery(result.display_name.split(',')[0]);
    setShowSuggestions(false);
  };

  if (!open) return null;

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, steps.length));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleActivate = async () => {
    await createHighStreet.mutateAsync({
      name,
      borough,
      status: 'Active',
      businessCount: 0,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    } as any);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg border border-gray-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <MapPin className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">High Street Activation</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Activate High Street</h3>
            <p className="text-xs text-gray-400 font-medium">Add a new high street to the ecosystem.</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold ${
                currentStep === step.id ? 'border-orange-600 bg-orange-50 text-orange-600' :
                currentStep > step.id ? 'border-orange-600 bg-orange-600 text-white' : 'border-gray-200 bg-white text-gray-400'
              }`}>
                {currentStep > step.id ? <Check className="h-3.5 w-3.5" /> : <step.icon className="h-3.5 w-3.5" />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{step.title}</span>
              {i < steps.length - 1 && <div className={`w-6 h-0.5 ${currentStep > step.id ? 'bg-orange-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 min-h-[200px]">
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">High Street Name</label>
                <input
                  type="text"
                  placeholder="e.g. Oxford Street"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all font-semibold text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Borough</label>
                <select
                  value={borough}
                  onChange={e => setBorough(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm"
                >
                  <option value="">Select borough</option>
                  {boroughNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {boroughNames.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-medium mt-1.5">No boroughs found. Create boroughs first in Borough Management.</p>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Search Location</label>
                <p className="text-[11px] text-gray-400 font-medium mb-2">Start typing an address or place name. Coordinates will be captured automatically.</p>
                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search for the high street location..."
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all font-semibold text-sm"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
                  </div>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl max-h-60 overflow-y-auto">
                      {suggestions.map((s) => (
                        <button
                          key={s.place_id}
                          onClick={() => selectSuggestion(s)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <p className="text-xs font-bold text-gray-900">{s.display_name.split(',')[0]}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.display_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {lat && lng && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3">
                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-emerald-700 font-semibold">Location captured</p>
                    <p className="text-[11px] text-emerald-600">{locationAddress}</p>
                    <p className="text-[10px] text-emerald-500 font-mono mt-0.5">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
                  </div>
                </div>
              )}
              {!lat && !lng && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                    You can skip this step — the high street will appear on the map without coordinates. You can add them later.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Check className="h-4 w-4 text-emerald-500" /> Summary
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-semibold">Name</span>
                    <span className="font-bold text-gray-950">{name || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-semibold">Borough</span>
                    <span className="font-bold text-gray-950">{borough || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-semibold">Location</span>
                    <span className="font-bold text-gray-950">{lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">Status</span>
                    <span className="font-bold text-emerald-600">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button onClick={prevStep} disabled={currentStep === 1} className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-all hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <div className="flex gap-2">
            <button onClick={() => onOpenChange(false)} className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-all">
              Cancel
            </button>
            {currentStep === steps.length ? (
              <button onClick={handleActivate} disabled={!name || !borough || createHighStreet.isPending} className="py-2.5 px-5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 shadow-lg shadow-orange-100 hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {createHighStreet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {createHighStreet.isPending ? 'Activating...' : 'Activate'}
              </button>
            ) : (
              <button onClick={nextStep} className="py-2.5 px-5 rounded-xl text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2 hover:scale-[1.01] transition-all">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
