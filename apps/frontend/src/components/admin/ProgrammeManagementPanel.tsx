import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket, Settings, Users, BarChart3, Shield, Crown,
  Plus, Trash2, Save, RefreshCw, Search, Filter,
  PauseCircle, PlayCircle, FastForward, SkipForward,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Edit3, Copy, Eye,
  User, HeadphonesIcon, Briefcase, ToggleLeft,
  GripVertical, ArrowUpDown, Download, Upload,
  FileText, Calendar, Target, Check, X, Lock,
  ChevronLeft
} from 'lucide-react';
import { PROGRAMME_PHASES, getPhaseForDay, getProgressForDay, getTotalMissions } from '../../lib/programmeData';
import type { ProgrammePhase, ProgrammeMission } from '../../lib/programmeData';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────

interface ReadinessGate {
  id: string;
  name: string;
  minProgressPercent: number;
  isEnabled: boolean;
}

interface BusinessProgrammeRecord {
  id: string;
  businessName: string;
  sector: string;
  currentDay: number;
  status: 'active' | 'paused' | 'completed' | 'extended';
  agentId: string | null;
  agentName: string;
  accountManagerId: string | null;
  accountManagerName: string;
  consultantId: string | null;
  consultantName: string;
  completedMissions: string[];
  startedAt: string;
  extendedBy: number;
}

interface SupportAgent {
  id: string;
  name: string;
  role: 'agent' | 'account_manager' | 'consultant';
  email: string;
}

type SubTab = 'config' | 'businesses' | 'monitoring';

const DEFAULT_GATES: ReadinessGate[] = [
  { id: 'gate-audit', name: 'Audit Access', minProgressPercent: 80, isEnabled: true },
  { id: 'gate-expo', name: 'Expo Publishing', minProgressPercent: 60, isEnabled: true },
  { id: 'gate-campaign', name: 'Campaign Creation', minProgressPercent: 40, isEnabled: true },
  { id: 'gate-advanced', name: 'Advanced Tools', minProgressPercent: 20, isEnabled: true },
];

const MOCK_SUPPORT: SupportAgent[] = [
  { id: 'agent-1', name: 'John Smith', role: 'agent', email: 'john@mcom.com' },
  { id: 'agent-2', name: 'Sarah Jones', role: 'agent', email: 'sarah@mcom.com' },
  { id: 'am-1', name: 'Emily Davis', role: 'account_manager', email: 'emily@mcom.com' },
  { id: 'am-2', name: 'Michael Brown', role: 'account_manager', email: 'michael@mcom.com' },
  { id: 'con-1', name: 'David Wilson', role: 'consultant', email: 'david@mcom.com' },
  { id: 'con-2', name: 'Lisa Taylor', role: 'consultant', email: 'lisa@mcom.com' },
];

const MOCK_BUSINESSES: BusinessProgrammeRecord[] = [
  { id: 'b1', businessName: 'Toby Barbers', sector: 'Hospitality', currentDay: 17, status: 'active', agentId: 'agent-1', agentName: 'John Smith', accountManagerId: 'am-1', accountManagerName: 'Emily Davis', consultantId: null, consultantName: '', completedMissions: [], startedAt: '2026-06-20', extendedBy: 0 },
  { id: 'b2', businessName: 'Jane\'s Café', sector: 'Food & Beverage', currentDay: 4, status: 'paused', agentId: 'agent-2', agentName: 'Sarah Jones', accountManagerId: null, accountManagerName: '', consultantId: null, consultantName: '', completedMissions: [], startedAt: '2026-07-03', extendedBy: 0 },
  { id: 'b3', businessName: 'Green Grocers', sector: 'Retail', currentDay: 8, status: 'active', agentId: 'agent-1', agentName: 'John Smith', accountManagerId: 'am-2', accountManagerName: 'Michael Brown', consultantId: 'con-1', consultantName: 'David Wilson', completedMissions: [], startedAt: '2026-06-28', extendedBy: 5 },
  { id: 'b4', businessName: 'TechFix Ltd', sector: 'Technology', currentDay: 45, status: 'active', agentId: 'agent-2', agentName: 'Sarah Jones', accountManagerId: 'am-1', accountManagerName: 'Emily Davis', consultantId: 'con-2', consultantName: 'Lisa Taylor', completedMissions: [], startedAt: '2026-05-15', extendedBy: 0 },
  { id: 'b5', businessName: 'Bright Smiles Dental', sector: 'Health & Wellness', currentDay: 90, status: 'completed', agentId: 'agent-1', agentName: 'John Smith', accountManagerId: null, accountManagerName: '', consultantId: null, consultantName: '', completedMissions: [], startedAt: '2026-03-01', extendedBy: 0 },
];

// ─── Sub-Components ───────────────────────────────────────

function ConfigSection() {
  const [phases, setPhases] = useState<ProgrammePhase[]>(() => {
    const saved = localStorage.getItem('adminProgrammePhases');
    return saved ? JSON.parse(saved) : PROGRAMME_PHASES;
  });
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingMission, setEditingMission] = useState<string | null>(null);
  const [gates, setGates] = useState<ReadinessGate[]>(() => {
    const saved = localStorage.getItem('adminReadinessGates');
    return saved ? JSON.parse(saved) : DEFAULT_GATES;
  });

  useEffect(() => {
    localStorage.setItem('adminProgrammePhases', JSON.stringify(phases));
  }, [phases]);

  useEffect(() => {
    localStorage.setItem('adminReadinessGates', JSON.stringify(gates));
  }, [gates]);

  const totalMissions = phases.reduce((s, p) => s + p.missions.length, 0);

  const updatePhase = (id: string, field: string, value: any) => {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updateMission = (phaseId: string, missionId: string, field: string, value: any) => {
    setPhases(prev => prev.map(p => p.id === phaseId ? {
      ...p,
      missions: p.missions.map(m => m.id === missionId ? { ...m, [field]: value } : m),
    } : p));
  };

  const addPhase = () => {
    const newPhase: ProgrammePhase = {
      id: `phase-${Date.now()}`,
      name: 'New Phase',
      dayStart: 1,
      dayEnd: 14,
      description: 'Describe this phase',
      icon: Rocket,
      color: 'gray',
      missions: [],
    };
    setPhases(prev => [...prev, newPhase]);
    setEditingPhase(newPhase.id);
  };

  const removePhase = (id: string) => {
    if (phases.length <= 1) return;
    setPhases(prev => prev.filter(p => p.id !== id));
  };

  const addMission = (phaseId: string) => {
    const newMission: ProgrammeMission = {
      id: `mission-${Date.now()}`,
      title: 'New Task',
      description: 'Describe this task',
      estimatedMinutes: 10,
      reward: '+50 points',
    };
    setPhases(prev => prev.map(p => p.id === phaseId ? {
      ...p,
      missions: [...p.missions, newMission],
    } : p));
    setEditingMission(newMission.id);
  };

  const removeMission = (phaseId: string, missionId: string) => {
    setPhases(prev => prev.map(p => p.id === phaseId ? {
      ...p,
      missions: p.missions.filter(m => m.id !== missionId),
    } : p));
  };

  const movePhase = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;
    const newPhases = [...phases];
    [newPhases[index], newPhases[newIndex]] = [newPhases[newIndex], newPhases[index]];
    setPhases(newPhases);
  };

  const updateGate = (id: string, field: string, value: any) => {
    setGates(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const resetToDefault = () => {
    setPhases(PROGRAMME_PHASES);
    setGates(DEFAULT_GATES);
  };

  return (
    <div className="space-y-8">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Phases</p>
          <p className="text-2xl font-black text-brand-dark mt-1">{phases.length}</p>
        </div>
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Tasks</p>
          <p className="text-2xl font-black text-brand-dark mt-1">{totalMissions}</p>
        </div>
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Duration</p>
          <p className="text-2xl font-black text-brand-dark mt-1">
            {phases.length > 0 ? `${phases[0].dayStart}–${phases[phases.length-1].dayEnd} days` : '—'}
          </p>
        </div>
        <div className="bg-brand-dark/5 rounded-xl p-4 border border-brand-dark/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gates</p>
          <p className="text-2xl font-black text-brand-dark mt-1">{gates.filter(g => g.isEnabled).length} active</p>
        </div>
      </div>

      {/* Phase Editor */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Phases & Tasks</h3>
          <div className="flex items-center gap-2">
            <button onClick={resetToDefault} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Reset Default
            </button>
            <button onClick={addPhase} className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-xs hover:bg-brand-dark transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Phase
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {phases.map((phase, pi) => (
            <motion.div key={phase.id} layout className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Phase Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50/80 border-b border-gray-100">
                <div className="flex flex-col gap-0.5 text-gray-300">
                  <button onClick={() => movePhase(pi, 'up')} disabled={pi === 0} className="disabled:opacity-30 hover:text-brand-blue"><ChevronLeft className="w-3 h-3 rotate-90" /></button>
                  <button onClick={() => movePhase(pi, 'down')} disabled={pi === phases.length - 1} className="disabled:opacity-30 hover:text-brand-blue"><ChevronLeft className="w-3 h-3 -rotate-90" /></button>
                </div>

                <div className="flex-1 min-w-0">
                  {editingPhase === phase.id ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      <input value={phase.name} onChange={e => updatePhase(phase.id, 'name', e.target.value)} className="px-2 py-1 text-sm font-bold rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white" />
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span>Days</span>
                        <input type="number" value={phase.dayStart} onChange={e => updatePhase(phase.id, 'dayStart', parseInt(e.target.value) || 1)} className="w-14 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white text-center" />
                        <span>–</span>
                        <input type="number" value={phase.dayEnd} onChange={e => updatePhase(phase.id, 'dayEnd', parseInt(e.target.value) || 1)} className="w-14 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white text-center" />
                      </div>
                      <input value={phase.description} onChange={e => updatePhase(phase.id, 'description', e.target.value)} className="px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white flex-1 min-w-[200px]" />
                      <button onClick={() => setEditingPhase(null)} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 text-sm">{phase.name}</span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Days {phase.dayStart}–{phase.dayEnd}</span>
                      <span className="text-xs text-gray-400 truncate hidden sm:block">{phase.description}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingPhase(editingPhase === phase.id ? null : phase.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-brand-blue transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!editingPhase && (
                    <button onClick={() => addMission(phase.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-green-600 transition-colors" title="Add task">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => removePhase(phase.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30" disabled={phases.length <= 1}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Missions List */}
              <div className="divide-y divide-gray-50">
                {phase.missions.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-gray-400 font-medium">No tasks yet. Click <Plus className="w-3 h-3 inline" /> to add one.</p>
                  </div>
                )}
                {phase.missions.map((mission, mi) => (
                  <div key={mission.id} className="flex items-center gap-3 p-3 pl-8 hover:bg-gray-50/50 group">
                    {editingMission === mission.id ? (
                      <div className="flex flex-wrap gap-2 items-center w-full">
                        <input value={mission.title} onChange={e => updateMission(phase.id, mission.id, 'title', e.target.value)} className="px-2 py-1 text-sm font-semibold rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white flex-1 min-w-[150px]" placeholder="Task title" />
                        <input value={mission.description} onChange={e => updateMission(phase.id, mission.id, 'description', e.target.value)} className="px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white flex-1 min-w-[150px]" placeholder="Description" />
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <input type="number" value={mission.estimatedMinutes} onChange={e => updateMission(phase.id, mission.id, 'estimatedMinutes', parseInt(e.target.value) || 1)} className="w-14 px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white text-center" />
                          <span>min</span>
                        </div>
                        <input value={mission.reward} onChange={e => updateMission(phase.id, mission.id, 'reward', e.target.value)} className="w-24 px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white" placeholder="+50 points" />
                        <button onClick={() => setEditingMission(null)} className="p-1 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"><Check className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">{mi + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">{mission.title}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {mission.estimatedMinutes} min</span>
                            <span className="text-[10px] text-amber-600 font-semibold">{mission.reward}</span>
                            {mission.system && <span className="text-[10px] text-sky-600 font-semibold">{mission.system}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingMission(editingMission === mission.id ? null : mission.id)} className="p-1 rounded hover:bg-white text-gray-400 hover:text-brand-blue"><Edit3 className="w-3 h-3" /></button>
                          <button onClick={() => removeMission(phase.id, mission.id)} className="p-1 rounded hover:bg-white text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Readiness Gates */}
      <div>
        <h3 className="font-bold text-gray-900 mb-4">Readiness Gates</h3>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {gates.map(gate => (
            <div key={gate.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{gate.name}</p>
                <p className="text-xs text-gray-400">Min progress: <strong>{gate.minProgressPercent}%</strong></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <input type="number" value={gate.minProgressPercent} onChange={e => updateGate(gate.id, 'minProgressPercent', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-center" min="0" max="100" />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <button onClick={() => updateGate(gate.id, 'isEnabled', !gate.isEnabled)} className={cn("relative w-10 h-5 rounded-full transition-colors", gate.isEnabled ? 'bg-green-500' : 'bg-gray-300')}>
                  <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", gate.isEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BusinessesSection() {
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>(() => {
    const saved = localStorage.getItem('adminBusinessProgrammes');
    return saved ? JSON.parse(saved) : MOCK_BUSINESSES;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessProgrammeRecord | null>(null);
  const [showOverridePanel, setShowOverridePanel] = useState(false);

  useEffect(() => {
    localStorage.setItem('adminBusinessProgrammes', JSON.stringify(businesses));
  }, [businesses]);

  const filtered = businesses.filter(b =>
    b.businessName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateBusiness = (id: string, updates: Partial<BusinessProgrammeRecord>) => {
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const togglePause = (b: BusinessProgrammeRecord) => {
    updateBusiness(b.id, { status: b.status === 'paused' ? 'active' : 'paused' });
  };

  const fastTrack = (b: BusinessProgrammeRecord) => {
    const day = prompt(`Fast-track ${b.businessName} to which day? (90 = complete)`, '90');
    if (day) {
      const num = parseInt(day);
      if (num >= 1 && num <= 90) {
        const totalMissions = getTotalMissions();
        const allMissionIds: string[] = [];
        PROGRAMME_PHASES.forEach(p => p.missions.forEach(m => allMissionIds.push(m.id)));
        const completedCount = Math.round((num / 90) * allMissionIds.length);
        updateBusiness(b.id, {
          currentDay: num,
          completedMissions: allMissionIds.slice(0, completedCount),
          status: num >= 90 ? 'completed' : 'active',
        });
      }
    }
  };

  const extendProgramme = (b: BusinessProgrammeRecord) => {
    const days = prompt(`Extend ${b.businessName} beyond 90 days by how many?`, '30');
    if (days) {
      const num = parseInt(days);
      if (num > 0) {
        updateBusiness(b.id, { extendedBy: (b.extendedBy || 0) + num, status: 'extended' });
      }
    }
  };

  const skipPhase = (b: BusinessProgrammeRecord) => {
    const currentPhase = getPhaseForDay(b.currentDay);
    if (!currentPhase) return;
    const nextPhaseDay = PROGRAMME_PHASES.find(p => p.dayStart > currentPhase.dayStart)?.dayStart || 90;
    updateBusiness(b.id, { currentDay: nextPhaseDay });
  };

  const resetBusiness = (b: BusinessProgrammeRecord) => {
    if (confirm(`Reset ${b.businessName}'s programme to Day 1?`)) {
      updateBusiness(b.id, { currentDay: 1, status: 'active', completedMissions: [], extendedBy: 0 });
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'active': return <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><PlayCircle className="w-3.5 h-3.5" /> Active</span>;
      case 'paused': return <span className="flex items-center gap-1 text-amber-600 text-xs font-bold"><PauseCircle className="w-3.5 h-3.5" /> Paused</span>;
      case 'completed': return <span className="flex items-center gap-1 text-blue-600 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>;
      case 'extended': return <span className="flex items-center gap-1 text-purple-600 text-xs font-bold"><Clock className="w-3.5 h-3.5" /> Extended</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search businesses..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-sm"
        />
      </div>

      {/* Override Panel */}
      {showOverridePanel && selectedBusiness && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-brand-blue/20 shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 bg-brand-blue/5 border-b border-brand-blue/10">
            <div>
              <h3 className="font-bold text-gray-900">{selectedBusiness.businessName}</h3>
              <p className="text-xs text-gray-500">Day {selectedBusiness.currentDay} of {90 + (selectedBusiness.extendedBy || 0)} · {selectedBusiness.sector}</p>
            </div>
            <button onClick={() => { setShowOverridePanel(false); setSelectedBusiness(null); }} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={() => togglePause(selectedBusiness)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors group">
                {selectedBusiness.status === 'paused' ? <PlayCircle className="w-6 h-6 text-green-500" /> : <PauseCircle className="w-6 h-6 text-amber-500" />}
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">{selectedBusiness.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>
              <button onClick={() => fastTrack(selectedBusiness)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group">
                <FastForward className="w-6 h-6 text-blue-500" />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">Fast-Track</span>
              </button>
              <button onClick={() => skipPhase(selectedBusiness)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors group">
                <SkipForward className="w-6 h-6 text-purple-500" />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">Skip Phase</span>
              </button>
              <button onClick={() => extendProgramme(selectedBusiness)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group">
                <Clock className="w-6 h-6 text-orange-500" />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900">Extend</span>
              </button>
            </div>

            {/* Day Override */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Current Day</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={selectedBusiness.currentDay}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      updateBusiness(selectedBusiness.id, { currentDay: val });
                      setSelectedBusiness({ ...selectedBusiness, currentDay: val });
                    }}
                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    min="1" max="120"
                  />
                  <span className="text-xs text-gray-400">of {90 + (selectedBusiness.extendedBy || 0)}</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Progress</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(selectedBusiness.currentDay)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{getProgressForDay(selectedBusiness.currentDay)}%</span>
                </div>
              </div>
              <button onClick={() => resetBusiness(selectedBusiness)} className="self-end px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                Reset
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Business Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No businesses found</p>
          </div>
        )}
        {filtered.map(b => (
          <motion.div
            key={b.id}
            layout
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => { setSelectedBusiness(b); setShowOverridePanel(true); }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-dark/10 flex items-center justify-center font-bold text-brand-dark shrink-0">
                {b.businessName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{b.businessName}</p>
                <p className="text-xs text-gray-400">{b.sector} · Day {b.currentDay}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-gray-400">Progress</span>
                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(b.currentDay)}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-500">{getProgressForDay(b.currentDay)}%</span>
              </div>
              <div className="w-24 text-right">{statusIcon(b.status)}</div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SupportSection() {
  const [businesses, setBusinesses] = useState<BusinessProgrammeRecord[]>(() => {
    const saved = localStorage.getItem('adminBusinessProgrammes');
    return saved ? JSON.parse(saved) : MOCK_BUSINESSES;
  });
  const [selectedBiz, setSelectedBiz] = useState<string | null>(null);

  const agents = MOCK_SUPPORT.filter(a => a.role === 'agent');
  const accountManagers = MOCK_SUPPORT.filter(a => a.role === 'account_manager');
  const consultants = MOCK_SUPPORT.filter(a => a.role === 'consultant');

  const assign = (bId: string, field: 'agentId' | 'accountManagerId' | 'consultantId', agent: SupportAgent | null) => {
    setBusinesses(prev => prev.map(b => {
      if (b.id !== bId) return b;
      const updates: any = {};
      if (field === 'agentId') {
        updates.agentId = agent?.id || null;
        updates.agentName = agent?.name || '';
      } else if (field === 'accountManagerId') {
        updates.accountManagerId = agent?.id || null;
        updates.accountManagerName = agent?.name || '';
      } else if (field === 'consultantId') {
        updates.consultantId = agent?.id || null;
        updates.consultantName = agent?.name || '';
      }
      return { ...b, ...updates };
    }));
    localStorage.setItem('adminBusinessProgrammes', JSON.stringify(businesses));
  };

  const getAssignedName = (b: BusinessProgrammeRecord, field: 'agentId' | 'accountManagerId' | 'consultantId', nameField: 'agentName' | 'accountManagerName' | 'consultantName') => {
    return b[field] ? b[nameField] : '—';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Assign support personnel to businesses on the 90-day programme.</p>
      <div className="space-y-3">
        {businesses.map(b => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setSelectedBiz(selectedBiz === b.id ? null : b.id)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors text-left">
              <div className="w-10 h-10 rounded-xl bg-brand-dark/10 flex items-center justify-center font-bold text-brand-dark shrink-0">{b.businessName.slice(0, 2).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{b.businessName}</p>
                <p className="text-xs text-gray-400">{b.sector}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500">
                <span>Agent: <strong className="text-gray-700">{getAssignedName(b, 'agentId', 'agentName')}</strong></span>
                <span>AM: <strong className="text-gray-700">{getAssignedName(b, 'accountManagerId', 'accountManagerName')}</strong></span>
                <span>Con: <strong className="text-gray-700">{getAssignedName(b, 'consultantId', 'consultantName')}</strong></span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-gray-300 transition-transform", selectedBiz === b.id && "rotate-180")} />
            </button>
            <AnimatePresence>
              {selectedBiz === b.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50/50">
                    {/* Agent */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><User className="w-3.5 h-3.5" /> Assigned Agent</label>
                      <select value={b.agentId || ''} onChange={e => assign(b.id, 'agentId', e.target.value ? agents.find(a => a.id === e.target.value) || null : null)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
                        <option value="">— None —</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    {/* Account Manager */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><HeadphonesIcon className="w-3.5 h-3.5" /> Account Manager</label>
                      <select value={b.accountManagerId || ''} onChange={e => assign(b.id, 'accountManagerId', e.target.value ? accountManagers.find(a => a.id === e.target.value) || null : null)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
                        <option value="">— None —</option>
                        {accountManagers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    {/* Consultant */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600"><Briefcase className="w-3.5 h-3.5" /> Consultant</label>
                      <select value={b.consultantId || ''} onChange={e => assign(b.id, 'consultantId', e.target.value ? consultants.find(a => a.id === e.target.value) || null : null)} className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
                        <option value="">— None —</option>
                        {consultants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitoringSection() {
  const [businesses] = useState<BusinessProgrammeRecord[]>(() => {
    const saved = localStorage.getItem('adminBusinessProgrammes');
    return saved ? JSON.parse(saved) : MOCK_BUSINESSES;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = businesses.filter(b => {
    const matchesSearch = b.businessName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(b => b.id));
    }
  };

  const bulkAction = (action: string) => {
    if (selectedIds.length === 0) return;
    const msg = `${action} ${selectedIds.length} business(es)?`;
    if (confirm(msg)) {
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search business..." className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/30">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="extended">Extended</option>
        </select>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 bg-brand-blue/5 rounded-xl border border-brand-blue/20">
          <span className="text-sm font-bold text-brand-blue">{selectedIds.length} selected</span>
          <button onClick={() => bulkAction('Pause')} className="px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Pause</button>
          <button onClick={() => bulkAction('Resume')} className="px-3 py-1.5 text-xs font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Resume</button>
          <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Clear</button>
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="p-4 text-left w-10">
                  <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Business</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Day / Progress</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Phase</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Agent</th>
                <th className="p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(b => {
                const phase = getPhaseForDay(b.currentDay);
                return (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggleSelect(b.id)} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-dark/10 flex items-center justify-center text-[10px] font-bold text-brand-dark shrink-0">{b.businessName.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{b.businessName}</p>
                          <p className="text-[10px] text-gray-400">{b.sector}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-900 text-sm">Day {b.currentDay}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-blue rounded-full" style={{ width: `${getProgressForDay(b.currentDay)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{getProgressForDay(b.currentDay)}%</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-gray-700 font-medium">{phase?.name || '—'}</span>
                    </td>
                    <td className="p-4">
                      {b.status === 'active' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold"><PlayCircle className="w-3 h-3" /> Active</span>}
                      {b.status === 'paused' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold"><PauseCircle className="w-3 h-3" /> Paused</span>}
                      {b.status === 'completed' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> Done</span>}
                      {b.status === 'extended' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold"><Clock className="w-3 h-3" /> Extended</span>}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{b.agentName || '—'}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{b.startedAt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No businesses match your filters</p>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{filtered.length} business{filtered.length !== 1 ? 'es' : ''} found</span>
        <span>{businesses.filter(b => b.status === 'active').length} active · {businesses.filter(b => b.status === 'paused').length} paused · {businesses.filter(b => b.status === 'completed').length} completed</span>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────

const SUB_TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'config', label: 'Programme Config', icon: Settings },
  { id: 'businesses', label: 'Business Override', icon: Users },
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
];

export default function ProgrammeManagementPanel() {
  const [subTab, setSubTab] = useState<SubTab>(() => {
    return (localStorage.getItem('adminProgrammeSubTab') as SubTab) || 'config';
  });

  useEffect(() => {
    localStorage.setItem('adminProgrammeSubTab', subTab);
  }, [subTab]);

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-br from-brand-blue to-brand-dark rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-5 h-5 text-white/80" />
            <h2 className="text-lg font-black">90-Day Programme Control Center</h2>
          </div>
          <p className="text-sm text-white/70 max-w-2xl">
            Configure programme phases and tasks, override individual business progress, assign support personnel, and monitor all businesses in the programme.
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all",
              subTab === tab.id
                ? "bg-white text-brand-blue shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {subTab === 'config' && <ConfigSection />}
          {subTab === 'businesses' && <BusinessesSection />}
          {subTab === 'monitoring' && <MonitoringSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
