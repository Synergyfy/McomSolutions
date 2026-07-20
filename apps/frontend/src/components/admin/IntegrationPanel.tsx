import { useState } from 'react';
import { Code, Puzzle } from 'lucide-react';
import { cn } from '../../lib/utils';

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
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-gray-400 font-medium">No API keys configured yet. API key management will be available soon.</p>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-gray-400 font-medium">No integrations configured yet. Integration management will be available soon.</p>
    </div>
  );
}
