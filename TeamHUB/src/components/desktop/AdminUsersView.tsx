import React, { useState, useEffect } from 'react';
import { User, Role, JoinRequest } from '../../types';
import { USERS } from '../../data/mockData';
import {
  testServerSideRlsAccess,
  getActiveWorkspace,
  regenerateWorkspacePodCode,
  updateUserProfileRecord,
  fetchTeamMembersFromDb,
  fetchJoinRequestsFromDb,
} from '../../lib/supabase';

interface AdminUsersViewProps {
  currentUser?: User;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ currentUser }) => {
  const activeUser = currentUser || USERS.sarah;
  const [usersList, setUsersList] = useState<User[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [approvedToast, setApprovedToast] = useState(false);
  const [rlsTestResult, setRlsTestResult] = useState<{ allowed: boolean; message: string; statusCode: number } | null>(null);
  const [isTestingRls, setIsTestingRls] = useState(false);

  // User action dropdown state
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);

  // Close user dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = () => setOpenUserMenuId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenUserMenuId(null);
      }
    };

    if (openUserMenuId) {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [openUserMenuId]);

  // Workspace & Pod Code States
  const [workspace, setWorkspace] = useState<any>(null);
  const [currentPodCode, setCurrentPodCode] = useState<string>('TH-4821-ENG');
  const [podCodeCopied, setPodCodeCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const ws = await getActiveWorkspace(activeUser.email);
        if (isMounted && ws) {
          setWorkspace(ws);
          setCurrentPodCode(ws.pod_code || 'TH-4821-ENG');
        }

        const [usersRes, requestsRes] = await Promise.all([
          fetchTeamMembersFromDb(activeUser),
          fetchJoinRequestsFromDb(activeUser),
        ]);

        if (isMounted) {
          if (usersRes.success && usersRes.users) {
            setUsersList(usersRes.users);
          }
          if (requestsRes.data) {
            setRequests(requestsRes.data);
          }
        }
      } catch (err) {
        console.error('Failed to load admin users data:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeUser]);

  const handleCopyPodCode = () => {
    navigator.clipboard.writeText(currentPodCode);
    setPodCodeCopied(true);
    setTimeout(() => setPodCodeCopied(false), 2500);
  };

  const handleRegeneratePodCode = async () => {
    setIsRegenerating(true);
    try {
      const res = await regenerateWorkspacePodCode(workspace?.id || workspace?.slug, workspace?.team_function);
      if (res.success && res.newCode) {
        setCurrentPodCode(res.newCode);
        setWorkspace((prev: any) => ({ ...prev, pod_code: res.newCode }));
        setShowRegenConfirm(false);
        setToastMessage(`Pod invite code regenerated: ${res.newCode}. Previous code is now invalid.`);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to regenerate pod code:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleTestRls = async () => {
    setIsTestingRls(true);
    setRlsTestResult(null);
    const result = await testServerSideRlsAccess(activeUser);
    setRlsTestResult(result);
    setIsTestingRls(false);
  };

  const handleApprove = (reqId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== reqId));
    setApprovedToast(true);
    setTimeout(() => setApprovedToast(false), 2000);
  };

  const handleRoleChange = async (targetUser: User, newRole: Role) => {
    setOpenUserMenuId(null);
    try {
      const res = await updateUserProfileRecord(targetUser.id, activeUser, { role: newRole });
      if (res.success) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === targetUser.id
              ? {
                  ...u,
                  role: newRole,
                  roleTitle:
                    newRole === 'admin'
                      ? 'Workspace Administrator'
                      : newRole === 'lead'
                      ? 'Team Lead'
                      : 'Team Member',
                }
              : u
          )
        );
        const roleLabel = newRole === 'admin' ? 'Administrator' : newRole === 'lead' ? 'Team Lead' : 'Team Member';
        setToastMessage(`Updated role for ${targetUser.name} to ${roleLabel}.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage(res.error || 'Failed to update user role.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      setToastMessage(err?.message || 'Error updating user profile.');
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (deptFilter !== 'all' && !u.department.toLowerCase().includes(deptFilter.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.roleTitle.toLowerCase().includes(q);
    }
    return true;
  });

  const handleExportCsv = () => {
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Role Title', 'Department', 'Pod', 'Status', 'Last Active'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      u.role,
      `"${(u.roleTitle || '').replace(/"/g, '""')}"`,
      `"${(u.department || '').replace(/"/g, '""')}"`,
      `"${(u.pod || '').replace(/"/g, '""')}"`,
      'Active',
      `"${(u.lastActive || '').replace(/"/g, '""')}"`,
    ]);

    const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `teamhub_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">Manage Users & RLS Governance</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eaedff] text-[#006b2c]">
              Core Engineering Pod
            </span>
          </div>
          <p className="text-xs text-[#6e7b6c] mt-0.5">
            Oversee workspace members, review access tiers, permissions, and test server-side Row Level Security (RLS) enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestRls}
            disabled={isTestingRls}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7ffc97]/40 text-[#005320] font-bold text-xs hover:bg-[#7ffc97] transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Execute direct DB query on protected join_requests table to verify PostgreSQL RLS server-side enforcement"
          >
            <span className={`material-symbols-outlined text-[17px] text-[#006b2c] ${isTestingRls ? 'animate-spin' : ''}`}>
              {isTestingRls ? 'sync' : 'security'}
            </span>
            <span>{isTestingRls ? 'Verifying RLS...' : 'Test Server-Side RLS'}</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ffffff] text-xs font-semibold text-[#131b2e] border border-[#eaedff] shadow-xs hover:bg-[#f2f3ff] cursor-pointer transition-all active:scale-95"
            title="Export visible table data as CSV file"
          >
            <span className="material-symbols-outlined text-[17px] text-[#6e7b6c]">file_download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* RLS Policy Test Result Notice */}
      {rlsTestResult && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in ${
            rlsTestResult.allowed
              ? 'bg-[#7ffc97]/20 border-[#006b2c] text-[#005320]'
              : 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
            {rlsTestResult.allowed ? 'verified_user' : 'gpp_bad'}
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between font-bold text-sm mb-0.5">
              <span>
                {rlsTestResult.allowed
                  ? 'Server-Side RLS Access Granted'
                  : 'Server-Side RLS Policy Enforced (403 Forbidden)'}
              </span>
              <span className="px-2 py-0.2 rounded-full bg-white text-[10px] font-mono">
                HTTP {rlsTestResult.statusCode}
              </span>
            </div>
            <p className="leading-relaxed font-medium">{rlsTestResult.message}</p>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-[#7ffc97]/30 border border-[#006b2c] text-[#005320] text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-[#005320] hover:text-[#002109]">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Workspace Pod Invite Code Management Card */}
      <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e2e7ff] text-[#006b2c] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">vpn_key</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#131b2e]">Workspace Pod Invite Code</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7ffc97]/40 text-[#005320]">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#6e7b6c]">
                Share this pod code with incoming team members and leads. They enter it on registration to link directly to <strong className="text-[#131b2e]">{workspace?.name || 'Core Engineering Pod'}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-[#f2f3ff] rounded-xl border border-[#eaedff]">
              <span className="font-mono text-base font-bold text-[#006b2c] tracking-wider select-all">
                {currentPodCode}
              </span>
              <button
                type="button"
                onClick={handleCopyPodCode}
                className="flex items-center gap-1 text-xs font-semibold text-[#131b2e] hover:text-[#006b2c] transition-colors cursor-pointer ml-1"
                title="Copy pod code to clipboard"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {podCodeCopied ? 'check' : 'content_copy'}
                </span>
                <span>{podCodeCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowRegenConfirm(true)}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#ffffff] hover:bg-[#ffdad6] text-[#ba1a1a] border border-[#ffdad6] text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Regenerate this code if it was compromised or leaked"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRegenerating ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Regenerate</span>
            </button>
          </div>
        </div>

        {/* Regeneration Confirmation Drawer / Box */}
        {showRegenConfirm && (
          <div className="p-4 rounded-xl bg-[#fff8f6] border border-[#ffdad6] text-[#93000a] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0 mt-0.5">warning</span>
              <div>
                <span className="font-bold block text-sm">Regenerate Workspace Pod Code?</span>
                <span className="text-[#93000a]/90 leading-relaxed block mt-0.5">
                  The current code <strong className="font-mono font-bold">{currentPodCode}</strong> will immediately become invalid. Existing registered members remain unaffected, but any new members attempting to sign up with the old code will be rejected.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#eaedff] text-[#131b2e] font-semibold text-xs hover:bg-[#f2f3ff] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegeneratePodCode}
                disabled={isRegenerating}
                className="px-3.5 py-1.5 rounded-lg bg-[#ba1a1a] text-white font-semibold text-xs hover:bg-[#93000a] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isRegenerating ? 'Regenerating...' : 'Confirm & Invalidate Old Code'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6e7b6c]">Workspace Seats</span>
            <span className="material-symbols-outlined text-[18px] text-[#006b2c]">group</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#131b2e]">
              {usersList.length} <span className="text-xs font-normal text-[#6e7b6c]">/ {workspace?.seats || 30}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7ffc97] text-[#005320]">
              {Math.round((usersList.length / (workspace?.seats || 30)) * 100)}% filled
            </span>
          </div>
          <div className="w-full bg-[#eaedff] h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-[#006b2c] h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round((usersList.length / (workspace?.seats || 30)) * 100))}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6e7b6c]">Active Members</span>
            <span className="material-symbols-outlined text-[18px] text-[#006b2c]">check_circle</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#131b2e]">{usersList.length}</span>
            <span className="text-[10px] text-[#006b2c] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
              Online now ({usersList.filter((u) => u.status === 'online').length})
            </span>
          </div>
          <span className="text-[10px] text-[#6e7b6c] mt-2">Active within past 48 hours</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6e7b6c]">Pending Requests</span>
            <span className="material-symbols-outlined text-[18px] text-[#8d4b00]">pending_actions</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#131b2e]">{requests.length}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffdcc3] text-[#2f1500]">
              Needs review
            </span>
          </div>
          <span className="text-[10px] text-[#6e7b6c] mt-2">From @company domain</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6e7b6c]">Security Health</span>
            <span className="material-symbols-outlined text-[18px] text-[#006b2c]">security</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#006b2c]">100%</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7ffc97] text-[#005320]">
              2FA Active
            </span>
          </div>
          <span className="text-[10px] text-[#6e7b6c] mt-2">0 security flags recorded</span>
        </div>
      </div>

      {/* Pending Join Requests Strip */}
      {requests.length > 0 && (
        <div className="rounded-2xl bg-[#ffffff] shadow-xs border border-[#eaedff] overflow-hidden">
          <div className="px-5 py-3.5 bg-[#f2f3ff] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#8d4b00] text-[20px]">how_to_reg</span>
              <span className="text-xs font-bold text-[#131b2e]">
                Pending Requests ({requests.length})
              </span>
            </div>
            <button
              onClick={() => {
                setRequests([]);
                setApprovedToast(true);
                setTimeout(() => setApprovedToast(false), 2000);
              }}
              className="text-xs font-bold text-[#006b2c] hover:underline cursor-pointer"
            >
              Approve All
            </button>
          </div>

          <div className="divide-y divide-[#eaedff]">
            {requests.map((req) => (
              <div key={req.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-xs flex items-center justify-center">
                    {req.avatarInitials}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#131b2e]">{req.name}</span>
                    <span className="text-[11px] text-[#6e7b6c] ml-2">{req.email}</span>
                    <div className="text-[11px] text-[#3e4a3d]">
                      Role: <strong>{req.role}</strong> • {req.department} • {req.requestedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="px-3 py-1 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#ba1a1a] cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="px-3.5 py-1 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedToast && (
        <div className="p-3 rounded-xl bg-[#006b2c] text-white text-xs font-semibold flex items-center gap-2 shadow-lg animate-in fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>Teammate request successfully approved and workspace invite dispatched!</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-2xl bg-[#ffffff] shadow-xs border border-[#eaedff] flex flex-col overflow-hidden">
        {/* Controls */}
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#eaedff]">
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#6e7b6c] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or role..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#f2f3ff] border border-[#eaedff] rounded-xl focus:outline-none focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="lead">Team Lead</option>
              <option value="member">Team Member</option>
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              <option value="engineering">Engineering</option>
              <option value="design">Design</option>
              <option value="product">Product</option>
            </select>
          </div>
        </div>

        {/* Table / Empty State */}
        <div className="overflow-x-auto min-h-[360px] pb-16">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="material-symbols-outlined text-3xl animate-spin text-[#006b2c]">sync</span>
              <span className="text-xs font-medium text-[#6e7b6c]">Loading team members from database...</span>
            </div>
          ) : usersList.length === 0 ? (
            <div className="py-20 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#eaedff] flex items-center justify-center text-[#006b2c] mb-4 shadow-xs">
                <span className="material-symbols-outlined text-4xl">group_off</span>
              </div>
              <h3 className="text-base font-bold text-[#131b2e] mb-1">No team members yet</h3>
              <p className="text-xs text-[#6e7b6c] leading-relaxed mb-6">
                No team members yet — share your pod code to invite your team.
              </p>
              <div className="flex items-center gap-2 p-2 px-3.5 bg-[#f2f3ff] rounded-xl border border-[#eaedff] shadow-2xs">
                <span className="text-[11px] font-medium text-[#6e7b6c]">Pod Invite Code:</span>
                <span className="font-mono text-xs font-bold text-[#006b2c] tracking-wider select-all">
                  {currentPodCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPodCode}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#006b2c] hover:underline cursor-pointer ml-1"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {podCodeCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{podCodeCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 px-4 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">person_search</span>
              <p className="text-xs font-semibold text-[#131b2e]">No team members match your filters</p>
              <p className="text-[11px] text-[#6e7b6c] mt-0.5">Try resetting search or filter options</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f2f3ff] text-[#6e7b6c] uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department / Pod</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaedff] text-[#131b2e]">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-[#f2f3ff]/50 transition-colors ${
                      openUserMenuId === user.id ? 'relative z-20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center">
                          {user.initials}
                        </div>
                        <div>
                          <span className="font-bold text-[#131b2e] block leading-none">{user.name}</span>
                          <span className="text-[10px] text-[#6e7b6c]">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.role === 'admin'
                            ? 'bg-[#ffdcc3] text-[#2f1500]'
                            : user.role === 'lead'
                            ? 'bg-[#dbe1ff] text-[#00174b]'
                            : 'bg-[#eaedff] text-[#3e4a3d]'
                        }`}
                      >
                        {user.role === 'admin' ? 'Administrator' : user.role === 'lead' ? 'Team Lead' : 'Team Member'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#3e4a3d]">{user.pod || user.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#7ffc97]/40 text-[#005320] text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6e7b6c]">{user.lastActive}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenUserMenuId(openUserMenuId === user.id ? null : user.id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            openUserMenuId === user.id
                              ? 'bg-[#eaedff] text-[#006b2c]'
                              : 'text-[#6e7b6c] hover:bg-[#eaedff] hover:text-[#131b2e]'
                          }`}
                          title="User actions"
                        >
                          <span className="material-symbols-outlined text-[16px]">more_vert</span>
                        </button>

                        {openUserMenuId === user.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1 text-left"
                          >
                            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider border-b border-[#eaedff] mb-1">
                              User Actions
                            </div>

                            <div className="px-3 py-1 text-[11px] font-semibold text-[#6e7b6c]">
                              Change Role:
                            </div>

                            {user.role !== 'admin' && (
                              <button
                                onClick={() => handleRoleChange(user, 'admin')}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-[#8d4b00] hover:bg-[#ffdcc3]/40 transition-colors text-left font-medium cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">shield</span>
                                <span>Make Administrator</span>
                              </button>
                            )}

                            {user.role !== 'lead' && (
                              <button
                                onClick={() => handleRoleChange(user, 'lead')}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-[#0051d5] hover:bg-[#dbe1ff]/40 transition-colors text-left font-medium cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">workspace_premium</span>
                                <span>Make Team Lead</span>
                              </button>
                            )}

                            {user.role !== 'member' && (
                              <button
                                onClick={() => handleRoleChange(user, 'member')}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-[#006b2c] hover:bg-[#7ffc97]/30 transition-colors text-left font-medium cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">person</span>
                                <span>Make Team Member</span>
                              </button>
                            )}

                            <div className="h-px bg-[#eaedff] my-1"></div>

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(user.email);
                                setOpenUserMenuId(null);
                                setToastMessage(`Copied email for ${user.name}!`);
                                setTimeout(() => setToastMessage(null), 3000);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e] transition-colors text-left font-medium cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px] text-[#6e7b6c]">mail</span>
                              <span>Copy Email</span>
                            </button>

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(user.id);
                                setOpenUserMenuId(null);
                                setToastMessage(`Copied user ID for ${user.name}!`);
                                setTimeout(() => setToastMessage(null), 3000);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#f2f3ff] hover:text-[#131b2e] transition-colors text-left font-medium cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px] text-[#6e7b6c]">badge</span>
                              <span>Copy User ID</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
