import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code, Puzzle, X, Plus, KeyRound, Trash2, RefreshCw, Copy, CheckCircle2, Ban } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData } from '../../context/AdminDataContext';

export default function IntegrationPanel() {
  const [tab, setTab] = useState<'api' | 'integrations'>('api');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        <button onClick={() => setTab('api')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'api' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><Code className="w-4 h-4" />API Keys</button>
        <button onClick={() => setTab('integrations')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'integrations' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><Puzzle className="w-4 h-4" />Integrations</button>
      </div>
      {tab === 'api' ? <ApiKeysPanel /> : <IntegrationsPanel />}
    </div>
  );
}

function ApiKeysPanel() {
  const { apiKeys, addApiKey, updateApiKey } = useAdminData();
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500 font-medium">{apiKeys.length} API keys configured</p>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"><Plus className="w-4 h-4" /> Generate Key</button>
      </div>
      <div className="space-y-4">
        {apiKeys.map(key => (
          <div key={key.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">{key.name}</h3><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", key.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{key.status}</span></div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-gray-50 px-3 py-1.5 rounded-lg font-mono text-gray-600">{key.key}</code>
                  <button onClick={() => { navigator.clipboard.writeText(key.key); setCopiedId(key.id); setTimeout(() => setCopiedId(null), 2000); }} className="p-1.5 text-gray-400 hover:text-brand-blue">
                    {copiedId === key.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                {key.status === 'Active' ? (
                  <button onClick={() => updateApiKey(key.id, { status: 'Revoked' })} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Ban className="w-3.5 h-3.5 text-gray-400" /></button>
                ) : (
                  <button onClick={() => updateApiKey(key.id, { status: 'Active' })} className="p-2 bg-gray-50 rounded-lg hover:bg-green-50 hover:text-green-500 transition-all"><CheckCircle2 className="w-3.5 h-3.5 text-gray-400" /></button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Permissions: <span className="font-bold text-gray-600">{key.permissions.join(', ')}</span></span>
              <span>Last used: {key.lastUsed}</span>
              <span>Created: {key.createdAt}</span>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h4 className="text-lg font-bold">Generate API Key</h4><button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
              <AddApiKeyForm onSave={(data) => { addApiKey(data); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddApiKeyForm({ onSave, onCancel }: any) {
  const [form, setForm] = useState({ name: '', permissions: ['Read'], status: 'Active' as const, key: `mcom_${Math.random().toString(36).substring(2, 14)}`, lastUsed: 'Never', createdAt: new Date().toISOString().split('T')[0] });
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Key Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Permissions</label>
        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">
          {['Read', 'Write', 'Admin'].map(p => (
            <button key={p} type="button" onClick={() => setForm({ ...form, permissions: form.permissions.includes(p) ? form.permissions.filter(x => x !== p) : [...form.permissions, p] })}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", form.permissions.includes(p) ? "bg-brand-blue text-white" : "bg-white text-gray-500 hover:bg-gray-100")}>{p}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
        <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">Generate</button>
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  const { integrations, updateIntegration } = useAdminData();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {integrations.map(int => (
        <div key={int.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900">{int.name}</h3>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{int.type}</span>
            </div>
            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", int.status === 'Connected' ? 'bg-green-50 text-green-700' : int.status === 'Disconnected' ? 'bg-gray-50 text-gray-600' : 'bg-red-50 text-red-700')}>{int.status}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Last sync: <span className="font-bold text-gray-600">{int.lastSync}</span></span>
            <div className="flex gap-1.5">
              {int.status === 'Connected' ? (
                <button onClick={() => updateIntegration(int.id, { status: 'Disconnected' })} className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">Disable</button>
              ) : int.status === 'Disconnected' ? (
                <button onClick={() => updateIntegration(int.id, { status: 'Connected' })} className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-green-50 hover:text-green-600 transition-all">Enable</button>
              ) : (
                <button onClick={() => updateIntegration(int.id, { status: 'Disconnected' })} className="px-3 py-1.5 bg-red-50 rounded-lg text-[10px] font-bold text-red-600 hover:bg-red-100 transition-all">Disconnect</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
