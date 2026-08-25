import { useState } from 'react';
import { Plus, X, Trash2, Edit3, KeyRound, Plug, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAdminApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  useAdminIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
} from '../../services/admin/hooks';

export default function IntegrationPanel() {
  const [tab, setTab] = useState<'api' | 'integrations'>('api');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        <button onClick={() => setTab('api')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'api' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><KeyRound className="w-4 h-4" />API Keys</button>
        <button onClick={() => setTab('integrations')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'integrations' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><Plug className="w-4 h-4" />Integrations</button>
      </div>
      {tab === 'api' ? <ApiKeysPanel /> : <IntegrationsPanel />}
    </div>
  );
}

function ApiKeysPanel() {
  const { data: res, isLoading } = useAdminApiKeys();
  const createApiKey = useCreateApiKey();
  const updateApiKey = useUpdateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const keys = (res?.data ?? []) as any[];

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', permissions: '' });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const handleCreate = async () => {
    const permissions = form.permissions.split(',').map(s => s.trim()).filter(Boolean);
    const result = await createApiKey.mutateAsync({ name: form.name, permissions });
    setNewKey(result?.data?.key ?? null);
    setShowCreate(false);
    setForm({ name: '', permissions: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">API Keys</h3>
          <p className="text-xs text-gray-400">Manage access keys for MCOM platform integrations.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-colors"><Plus className="w-3.5 h-3.5" /> Create Key</button>
      </div>

      {newKey && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> API key created</p>
              <p className="text-xs text-emerald-600 mt-1">Store this key securely — it will not be shown again.</p>
              <code className="block mt-2 px-3 py-2 bg-white rounded-lg border border-emerald-200 text-xs font-mono text-gray-800 break-all">{newKey}</code>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigator.clipboard?.writeText(newKey)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"><Copy className="w-3 h-3" /> Copy</button>
              <button onClick={() => setNewKey(null)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"><X className="w-3 h-3" /> Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-brand-blue" /></div>
      ) : keys.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-2xl bg-white border border-gray-100"><p className="text-sm text-gray-400 font-medium">No API keys configured yet.</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {keys.map((k: any) => (
            <div key={k.id} className="flex items-center gap-4 p-4">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><KeyRound className="w-4 h-4 text-brand-blue" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm truncate">{k.name}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", k.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>{k.status}</span>
                </div>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{k.key || '••••'}</p>
                {k.permissions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {k.permissions.map((p: string) => <span key={p} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500">{p}</span>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(k)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-blue transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete(k)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateApiKeyModal
          form={form}
          setForm={setForm}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          isSubmitting={createApiKey.isPending}
        />
      )}

      {editing && (
        <EditApiKeyModal
          keyItem={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await updateApiKey.mutateAsync({ id: editing.id, data });
            setEditing(null);
          }}
          isSubmitting={updateApiKey.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete API Key"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          isSubmitting={deleteApiKey.isPending}
          onConfirm={async () => {
            await deleteApiKey.mutate(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function CreateApiKeyModal({ form, setForm, onClose, onSave, isSubmitting }: any) {
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><KeyRound className="w-5 h-5 text-brand-blue" /></div>
        <div><h3 className="font-bold text-gray-900">Create API Key</h3><p className="text-xs text-gray-400">Generate a new access key.</p></div>
      </div>
      <label className="block text-xs font-bold text-gray-600 mb-1">Name</label>
      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Production Mall Key" className="w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <label className="block text-xs font-bold text-gray-600 mb-1">Permissions (comma separated)</label>
      <input value={form.permissions} onChange={e => setForm({ ...form, permissions: e.target.value })} placeholder="mall:read, rewards:write" className="w-full mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">Cancel</button>
        <button onClick={onSave} disabled={!form.name || isSubmitting} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}Create</button>
      </div>
    </ModalShell>
  );
}

function EditApiKeyModal({ keyItem, onClose, onSave, isSubmitting }: any) {
  const [name, setName] = useState(keyItem.name);
  const [permissions, setPermissions] = useState((keyItem.permissions ?? []).join(', '));
  const [status, setStatus] = useState(keyItem.status || 'Active');
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><KeyRound className="w-5 h-5 text-brand-blue" /></div>
        <div><h3 className="font-bold text-gray-900">Edit API Key</h3><p className="text-xs text-gray-400">{keyItem.name}</p></div>
      </div>
      <label className="block text-xs font-bold text-gray-600 mb-1">Name</label>
      <input value={name} onChange={e => setName(e.target.value)} className="w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <label className="block text-xs font-bold text-gray-600 mb-1">Permissions (comma separated)</label>
      <input value={permissions} onChange={e => setPermissions(e.target.value)} className="w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
      <select value={status} onChange={e => setStatus(e.target.value)} className="w-full mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
        <option value="Active">Active</option>
        <option value="Revoked">Revoked</option>
      </select>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">Cancel</button>
        <button onClick={() => onSave({ name, permissions: permissions.split(',').map(s => s.trim()).filter(Boolean), status })} disabled={!name || isSubmitting} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}Save</button>
      </div>
    </ModalShell>
  );
}

function IntegrationsPanel() {
  const { data: res, isLoading } = useAdminIntegrations();
  const createIntegration = useCreateIntegration();
  const updateIntegration = useUpdateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const integrations = (res?.data ?? []) as any[];

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Integrations</h3>
          <p className="text-xs text-gray-400">Configure third-party service connections.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-colors"><Plus className="w-3.5 h-3.5" /> Add Integration</button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-brand-blue" /></div>
      ) : integrations.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-2xl bg-white border border-gray-100"><p className="text-sm text-gray-400 font-medium">No integrations configured yet.</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {integrations.map((it: any) => (
            <div key={it.id} className="flex items-center gap-4 p-4">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0"><Plug className="w-4 h-4 text-purple-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm truncate">{it.name}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", it.status === 'Connected' ? 'bg-green-50 text-green-700' : it.status === 'Error' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500')}>{it.status}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span className="font-bold text-gray-500">{it.type}</span>
                  {it.lastSync && <span>Last sync: {new Date(it.lastSync).toLocaleString()}</span>}
                  {it.connectedDate && <span>Connected: {new Date(it.connectedDate).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(it)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-blue transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete(it)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <IntegrationModal
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            await createIntegration.mutateAsync(data);
            setShowCreate(false);
          }}
          isSubmitting={createIntegration.isPending}
        />
      )}

      {editing && (
        <IntegrationModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await updateIntegration.mutateAsync({ id: editing.id, data });
            setEditing(null);
          }}
          isSubmitting={updateIntegration.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Integration"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          isSubmitting={deleteIntegration.isPending}
          onConfirm={async () => {
            await deleteIntegration.mutate(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function IntegrationModal({ initial, onClose, onSave, isSubmitting }: any) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'Disconnected');
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Plug className="w-5 h-5 text-purple-600" /></div>
        <div><h3 className="font-bold text-gray-900">{initial ? 'Edit Integration' : 'Add Integration'}</h3><p className="text-xs text-gray-400">Configure a third-party service.</p></div>
      </div>
      <label className="block text-xs font-bold text-gray-600 mb-1">Name</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Stripe Payments" className="w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <label className="block text-xs font-bold text-gray-600 mb-1">Type</label>
      <input value={type} onChange={e => setType(e.target.value)} placeholder="e.g. payment" className="w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
      <select value={status} onChange={e => setStatus(e.target.value)} className="w-full mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
        <option value="Connected">Connected</option>
        <option value="Disconnected">Disconnected</option>
        <option value="Error">Error</option>
      </select>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">Cancel</button>
        <button onClick={() => onSave({ name, type, status })} disabled={!name || !type || isSubmitting} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}Save</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, isSubmitting, onConfirm, onClose }: any) {
  return (
    <ModalShell onClose={onClose}>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">Cancel</button>
        <button onClick={onConfirm} disabled={isSubmitting} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}{confirmLabel}</button>
      </div>
    </ModalShell>
  );
}
