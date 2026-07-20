import { useState } from 'react';
import { Shield, CheckCircle2, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminPermissions, useUpdatePermissionRole } from '../../services/admin/hooks';

const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'launch', 'manage', 'configure'] as const;

export default function PermissionPanel() {
  const { data: permRes, isLoading } = useAdminPermissions();
  const permissionRoles = permRes?.data ?? [];
  const updatePerm = useUpdatePermissionRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 font-medium mb-6">{permissionRoles.length} roles configured in the permission matrix</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
              {PERMISSION_ACTIONS.map(action => (
                <th key={action} className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{action}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {permissionRoles.map((role: any) => (
                <tr key={role.role} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-5 font-bold text-sm text-gray-900">{role.role}</td>
                  {PERMISSION_ACTIONS.map(action => (
                    <td key={action} className="px-4 py-5 text-center">
                      <button
                        onClick={() => updatePerm.mutate({ role: role.role, data: { permissions: { ...role.permissions, [action]: !role.permissions[action] } } })}
                        className={cn("p-2 rounded-xl transition-all", role.permissions[action] ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-50 text-gray-300 hover:bg-gray-100")}
                      >
                        {role.permissions[action] ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
