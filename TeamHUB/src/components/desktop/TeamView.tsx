import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, ViewMode } from '../../types';
import { fetchTeamMembersFromDb, normalizePodId } from '../../lib/supabase';
import { TeammateProfilePopover } from '../common/TeammateProfilePopover';
import { STANDUP_ENTRIES, INITIAL_TASKS } from '../../data/mockData';

interface TeamViewProps {
  currentUser: User;
  onNavigate: (view: ViewMode, itemId?: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({ currentUser, onNavigate }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Selected member for Profile Popover
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // View Layout mode for Admin (Grid vs Table)
  const [adminViewMode, setAdminViewMode] = useState<'grid' | 'table'>('grid');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPodFilter, setSelectedPodFilter] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedAvailabilityFilter, setSelectedAvailabilityFilter] = useState('all');
  const [selectedSort, setSelectedSort] = useState('name-asc');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const isLead = currentUser.role === 'lead';

  // 1. Fetch team members enforcing RLS scoping
  useEffect(() => {
    let isMounted = true;
    async function loadMembers() {
      setIsLoading(true);
      setAccessError(null);

      // Client-side block if regular member
      if (currentUser.role !== 'admin' && currentUser.role !== 'lead') {
        if (isMounted) {
          setAccessError('Access Denied: Team Directory is restricted to Team Leads and Administrators.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await fetchTeamMembersFromDb(currentUser);
        if (isMounted) {
          if (res.success && res.users) {
            setMembers(res.users);
          } else {
            setAccessError(res.error || 'Failed to query team members under current RLS policy.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setAccessError(err?.message || 'Unexpected error fetching team directory.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMembers();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Derived user pod info
  const leadPodName = useMemo(() => {
    if (currentUser.pod) return currentUser.pod;
    return 'Core Engineering';
  }, [currentUser.pod]);

  // Filtered & Sorted Members
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Pod filter (Admin view only)
      if (isAdmin && selectedPodFilter !== 'all') {
        const memberPodSlug = normalizePodId(member.pod);
        if (memberPodSlug !== selectedPodFilter) return false;
      }

      // Role filter (Admin view only)
      if (isAdmin && selectedRoleFilter !== 'all') {
        if (selectedRoleFilter === 'lead' && member.role !== 'lead') return false;
        if (selectedRoleFilter === 'member' && member.role !== 'member') return false;
      }

      // Availability filter
      if (selectedAvailabilityFilter !== 'all') {
        if (selectedAvailabilityFilter === 'active' && member.status !== 'online') return false;
        if (selectedAvailabilityFilter === 'away' && member.status !== 'busy' && member.status !== 'away') return false;
        if (selectedAvailabilityFilter === 'offline' && member.status !== 'offline') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = member.name.toLowerCase().includes(q);
        const matchesTitle = member.roleTitle?.toLowerCase().includes(q);
        const matchesPod = member.pod?.toLowerCase().includes(q);
        const matchesSkills = member.skills?.some((s) => s.toLowerCase().includes(q));
        const matchesEmail = member.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesTitle && !matchesPod && !matchesSkills && !matchesEmail) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (selectedSort === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (selectedSort === 'tasks-desc') {
        return (b.tasksCompleted || 0) - (a.tasksCompleted || 0);
      }
      if (selectedSort === 'active-first') {
        const order = { online: 0, busy: 1, away: 2, offline: 3 };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
      }
      return 0;
    });
  }, [members, isAdmin, selectedPodFilter, selectedRoleFilter, selectedAvailabilityFilter, searchQuery, selectedSort]);

  // Key stats
  const activeNowCount = useMemo(() => {
    return members.filter((m) => m.status === 'online').length;
  }, [members]);

  const awayFocusCount = useMemo(() => {
    return members.filter((m) => m.status === 'busy' || m.status === 'away').length;
  }, [members]);

  const offlineCount = useMemo(() => {
    return members.filter((m) => m.status === 'offline').length;
  }, [members]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Role Title', 'Pod', 'Status', 'Tasks Delivered'];
    const rows = filteredMembers.map((m) => [
      `"${m.id}"`,
      `"${m.name}"`,
      `"${m.email}"`,
      `"${m.role}"`,
      `"${m.roleTitle || ''}"`,
      `"${m.pod || ''}"`,
      `"${m.status}"`,
      `"${m.tasksCompleted || 0}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${isAdmin ? 'workspace-team-directory' : 'pod-members'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage('Team directory CSV successfully exported.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper for Pod Badge Icon & Styling
  const getPodBadgeInfo = (podName?: string) => {
    const slug = normalizePodId(podName);
    switch (slug) {
      case 'core':
        return { icon: 'hub', label: 'Core Eng', textClass: 'text-[#006b2c]', bgClass: 'bg-[#7ffc97]/20' };
      case 'design':
        return { icon: 'palette', label: 'Design Sys', textClass: 'text-[#0051d5]', bgClass: 'bg-[#dbe1ff]' };
      case 'mobile':
        return { icon: 'smartphone', label: 'Mobile Plat', textClass: 'text-[#8d4b00]', bgClass: 'bg-[#ffdcc3]' };
      case 'infra':
        return { icon: 'cloud_queue', label: 'Infrastructure', textClass: 'text-[#006b2c]', bgClass: 'bg-[#eaedff]' };
      default:
        return { icon: 'groups', label: podName || 'Pod', textClass: 'text-[#3e4a3d]', bgClass: 'bg-[#eaedff]' };
    }
  };

  // Helper for member standup snippet
  const getMemberStandup = (userId: string) => {
    const entry = STANDUP_ENTRIES.find((s) => s.user.id === userId);
    if (entry) {
      return {
        done: entry.done || 'Sprint tasks in progress',
        doing: entry.doing || 'Continuing active backlog items',
        block: entry.blocked || 'None',
      };
    }
    return {
      done: 'Sprint tasks delivered & reviewed.',
      doing: 'Continuing feature implementation.',
      block: 'None',
    };
  };

  // -------------------------------------------------------------
  // GUARD: If a Team Member accesses this route, show blocked view
  // -------------------------------------------------------------
  if (accessError || (!isAdmin && !isLead)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#ffffff] rounded-2xl border border-[#eaedff] shadow-xs text-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[32px]">shield_person</span>
        </div>
        <h2 className="text-lg font-bold text-[#131b2e] mb-2">Restricted Access</h2>
        <p className="text-xs text-[#6e7b6c] leading-relaxed mb-6">
          {accessError ||
            'The Team tab and workspace directory are restricted to Team Leads and Administrators. Access is guarded by PostgreSQL Row Level Security.'}
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="px-4 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          Return to Home Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-12 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 rounded-xl bg-[#006b2c] text-white text-xs font-semibold flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/80 hover:text-white">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. ADMINISTRATOR DIRECTORY VIEW                                */}
      {/* ============================================================ */}
      {isAdmin ? (
        <>
          {/* Top Hero & Stats Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaedff] text-[#006b2c] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                  Directory Oversight
                </span>
                <span className="text-[11px] text-[#6e7b6c]">Updated live • PostgreSQL RLS</span>
              </div>
              <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">Team Directory</h1>
              <p className="text-xs text-[#3e4a3d] max-w-2xl leading-relaxed">
                Manage all {members.length} engineering &amp; design specialists across active pods, review leadership
                structures, monitor workload balance, and view real-time availability.
              </p>
            </div>

            {/* Top Action Buttons & View Mode */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <div className="flex items-center bg-[#f2f3ff] p-1 rounded-xl border border-[#eaedff]">
                <button
                  onClick={() => setAdminViewMode('grid')}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    adminViewMode === 'grid'
                      ? 'bg-[#ffffff] text-[#006b2c] shadow-xs'
                      : 'text-[#6e7b6c] hover:text-[#131b2e]'
                  }`}
                  title="Grid View"
                >
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>
                </button>
                <button
                  onClick={() => setAdminViewMode('table')}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    adminViewMode === 'table'
                      ? 'bg-[#ffffff] text-[#006b2c] shadow-xs'
                      : 'text-[#6e7b6c] hover:text-[#131b2e]'
                  }`}
                  title="Table View"
                >
                  <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                </button>
              </div>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ffffff] text-[#131b2e] text-xs font-semibold border border-[#eaedff] hover:bg-[#f2f3ff] transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px] text-[#6e7b6c]">download</span>
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => onNavigate('manage-users')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">person_add</span>
                <span>Manage Users</span>
              </button>
            </div>
          </div>

          {/* Key Metrics Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#eaedff] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Total Headcount</span>
                <span className="text-xl font-bold text-[#131b2e] mt-0.5">{members.length}</span>
                <span className="text-[11px] text-[#006b2c] font-semibold mt-1">100% verified</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#f2f3ff] flex items-center justify-center text-[#006b2c]">
                <span className="material-symbols-outlined text-[22px]">group</span>
              </div>
            </div>

            <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#eaedff] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Active Now</span>
                <span className="text-xl font-bold text-[#131b2e] mt-0.5">{activeNowCount}</span>
                <span className="text-[11px] text-[#6e7b6c] mt-1">
                  {members.length > 0 ? Math.round((activeNowCount / members.length) * 100) : 0}% of workspace
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#f2f3ff] flex items-center justify-center text-[#006b2c]">
                <span className="material-symbols-outlined text-[22px]">fiber_smart_record</span>
              </div>
            </div>

            <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#eaedff] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Active Pods</span>
                <span className="text-xl font-bold text-[#131b2e] mt-0.5">4</span>
                <span className="text-[11px] text-[#6e7b6c] mt-1">Core, Design, Mobile, Infra</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#f2f3ff] flex items-center justify-center text-[#0051d5]">
                <span className="material-symbols-outlined text-[22px]">lan</span>
              </div>
            </div>

            <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#eaedff] shadow-xs flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Active Reviews</span>
                <span className="text-xl font-bold text-[#131b2e] mt-0.5">38</span>
                <span className="text-[11px] text-[#8d4b00] font-semibold mt-1">9 awaiting sync</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#ffdcc3]/30 flex items-center justify-center text-[#8d4b00]">
                <span className="material-symbols-outlined text-[22px]">rate_review</span>
              </div>
            </div>
          </div>

          {/* Filter & Controls Toolbar */}
          <div className="bg-[#ffffff] p-4 rounded-2xl border border-[#eaedff] shadow-xs mb-6 flex flex-col gap-4">
            {/* Row 1: Search & Dropdown Filters */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#6e7b6c] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search teammates by name, title, pod, or skill tags..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] border border-[#eaedff] focus:outline-none focus:bg-white transition-all"
                />
              </div>

              {/* Filters Group */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Pod Selector */}
                <div className="relative">
                  <select
                    value={selectedPodFilter}
                    onChange={(e) => setSelectedPodFilter(e.target.value)}
                    className="appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Pods</option>
                    <option value="core">Core Engineering</option>
                    <option value="design">Design Systems</option>
                    <option value="mobile">Mobile Platform</option>
                    <option value="infra">Infrastructure</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#6e7b6c] pointer-events-none">
                    expand_more
                  </span>
                </div>

                {/* Role Selector */}
                <div className="relative">
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="lead">Team Leads</option>
                    <option value="member">Team Members</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#6e7b6c] pointer-events-none">
                    expand_more
                  </span>
                </div>

                {/* Sort */}
                <div className="relative">
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
                  >
                    <option value="name-asc">Sort: Name (A-Z)</option>
                    <option value="active-first">Sort: Availability</option>
                    <option value="tasks-desc">Sort: Tasks Delivered</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#6e7b6c] pointer-events-none">
                    sort
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Availability Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c] mr-2 shrink-0">
                Availability:
              </span>
              <button
                onClick={() => setSelectedAvailabilityFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                  selectedAvailabilityFilter === 'all'
                    ? 'bg-[#eaedff] text-[#006b2c]'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                All Statuses <span className="text-[#6e7b6c] ml-1">{members.length}</span>
              </button>
              <button
                onClick={() => setSelectedAvailabilityFilter('active')}
                className={`px-3 py-1 rounded-full text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selectedAvailabilityFilter === 'active'
                    ? 'bg-[#eaedff] text-[#006b2c] font-semibold'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>
                <span>Active Now</span>
                <span className="font-semibold text-[#006b2c]">{activeNowCount}</span>
              </button>
              <button
                onClick={() => setSelectedAvailabilityFilter('away')}
                className={`px-3 py-1 rounded-full text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selectedAvailabilityFilter === 'away'
                    ? 'bg-[#eaedff] text-[#8d4b00] font-semibold'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#8d4b00]"></span>
                <span>In Meetings / Away</span>
                <span className="font-semibold text-[#8d4b00]">{awayFocusCount}</span>
              </button>
              <button
                onClick={() => setSelectedAvailabilityFilter('offline')}
                className={`px-3 py-1 rounded-full text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selectedAvailabilityFilter === 'offline'
                    ? 'bg-[#eaedff] text-[#6e7b6c] font-semibold'
                    : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#6e7b6c]"></span>
                <span>Offline / PTO</span>
                <span className="font-semibold text-[#6e7b6c]">{offlineCount}</span>
              </button>
            </div>
          </div>

          {/* Directory Content (Grid vs Table) */}
          {filteredMembers.length === 0 ? (
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-12 text-center shadow-xs">
              <span className="material-symbols-outlined text-[36px] text-[#6e7b6c] mb-2">person_search</span>
              <h3 className="text-sm font-bold text-[#131b2e] mb-1">No teammates matched filters</h3>
              <p className="text-xs text-[#6e7b6c]">Try clearing your search query or broadening pod and role filters.</p>
            </div>
          ) : adminViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMembers.map((member) => {
                const podBadge = getPodBadgeInfo(member.pod);
                const isOnline = member.status === 'online';
                const isBusy = member.status === 'busy';
                const isAway = member.status === 'away';

                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedUser(member)}
                    className="relative bg-[#ffffff] rounded-2xl border border-[#eaedff] shadow-xs hover:shadow-md p-5 flex flex-col justify-between transition-all group cursor-pointer hover:border-[#006b2c]/40"
                  >
                    <div>
                      {/* Top Row: Presence status chip & more button */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 bg-[#f2f3ff] px-2.5 py-0.5 rounded-full">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline ? 'bg-[#006b2c]' : isBusy || isAway ? 'bg-[#8d4b00]' : 'bg-[#6e7b6c]'
                            }`}
                          ></span>
                          <span
                            className={`text-[10px] font-medium ${
                              isOnline ? 'text-[#006b2c]' : isBusy || isAway ? 'text-[#8d4b00]' : 'text-[#6e7b6c]'
                            }`}
                          >
                            {isOnline ? 'Active now' : isBusy ? 'In sync meeting' : isAway ? 'Away' : 'Offline • PTO'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(member);
                          }}
                          className="text-[#6e7b6c] hover:text-[#131b2e] p-1 rounded-lg hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                          title="View Profile"
                        >
                          <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                        </button>
                      </div>

                      {/* Center Profile */}
                      <div className="flex flex-col items-center text-center">
                        <div className="relative mb-3">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg ring-2 ring-[#eaedff]"
                            style={{
                              backgroundColor: member.initialsColor ? `${member.initialsColor}20` : '#eaedff',
                              color: member.initialsColor || '#006b2c',
                            }}
                          >
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              member.initials
                            )}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                              isOnline ? 'bg-[#006b2c]' : isBusy || isAway ? 'bg-[#8d4b00]' : 'bg-[#6e7b6c]'
                            }`}
                          ></span>
                        </div>

                        <h3 className="text-sm font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors leading-tight">
                          {member.name}
                        </h3>
                        <p className="text-[11px] text-[#6e7b6c] mt-0.5 line-clamp-1">{member.roleTitle}</p>

                        {/* Badges */}
                        <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              member.role === 'lead'
                                ? 'bg-[#dbe1ff] text-[#00174b]'
                                : member.role === 'admin'
                                ? 'bg-[#ffdcc3] text-[#2f1500]'
                                : 'bg-[#eaedff] text-[#3e4a3d]'
                            }`}
                          >
                            {member.role === 'lead' ? 'Team Lead' : member.role === 'admin' ? 'Admin' : 'Team Member'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${podBadge.bgClass} ${podBadge.textClass}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">{podBadge.icon}</span>
                            <span>{podBadge.label}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-3 border-t border-[#eaedff] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#6e7b6c] text-[11px]">
                        <span className="material-symbols-outlined text-[15px] text-[#006b2c]">task_alt</span>
                        <span>{member.tasksCompleted || 4} active tasks</span>
                      </div>
                      <span className="text-[11px] text-[#006b2c] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        Profile
                        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f2f3ff] text-[#6e7b6c] uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">Teammate</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Pod / Team</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaedff] text-[#131b2e]">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedUser(member)}
                      className="hover:bg-[#f2f3ff]/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center">
                            {member.initials}
                          </div>
                          <div>
                            <span className="font-bold text-[#131b2e] block leading-none">{member.name}</span>
                            <span className="text-[10px] text-[#6e7b6c]">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            member.role === 'lead'
                              ? 'bg-[#dbe1ff] text-[#00174b]'
                              : member.role === 'admin'
                              ? 'bg-[#ffdcc3] text-[#2f1500]'
                              : 'bg-[#eaedff] text-[#3e4a3d]'
                          }`}
                        >
                          {member.role === 'lead' ? 'Team Lead' : member.role === 'admin' ? 'Admin' : 'Team Member'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#3e4a3d] font-medium">{member.pod}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#7ffc97]/30 text-[#005320] text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                          {member.status === 'online' ? 'Active' : member.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6e7b6c]">{member.location}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(member);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#006b2c] cursor-pointer"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Directory Footer Info */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#ffffff] rounded-2xl border border-[#eaedff] shadow-xs text-xs text-[#6e7b6c]">
            <div>
              Showing <strong className="text-[#131b2e]">{filteredMembers.length}</strong> of{' '}
              <strong className="text-[#131b2e]">{members.length}</strong> workspace members
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#3e4a3d]">PostgreSQL RLS Scoped Directory</span>
            </div>
          </div>
        </>
      ) : (
        /* ============================================================ */
        /* 2. TEAM LEAD POD VIEW                                        */
        /* ============================================================ */
        <>
          {/* Team Lead Pod Header Area */}
          <div className="flex flex-col gap-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-[#7ffc97]/30 text-[#005320] uppercase tracking-wider font-semibold">
                    Pod View
                  </span>
                  <span className="text-xs text-[#6e7b6c]">• Sprint 34 (Day 7 of 10)</span>
                </div>
                <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">Team Pod — {leadPodName}</h1>
                <p className="text-xs text-[#3e4a3d] max-w-2xl leading-relaxed">
                  Daily member availability, active sprint contributions, and latest standup updates for your pod.
                </p>
              </div>

              {/* Quick Lead Action Buttons */}
              <div className="flex items-center gap-2.5 self-start lg:self-center">
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ffffff] text-[#131b2e] border border-[#eaedff] shadow-xs hover:bg-[#f2f3ff] transition-all text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[17px] text-[#6e7b6c]">file_download</span>
                  <span>Export Pod Summary</span>
                </button>
                <button
                  onClick={() => onNavigate('channels')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ffffff] text-[#131b2e] border border-[#eaedff] shadow-xs hover:bg-[#f2f3ff] transition-all text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[17px] text-[#0051d5]">forum</span>
                  <span>Quick 1:1</span>
                </button>
                <button
                  onClick={() => {
                    setToastMessage('Pod sync session initialized! Room dispatched to team members.');
                    setTimeout(() => setToastMessage(null), 3500);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#006b2c] text-white shadow-xs hover:bg-[#00873a] transition-all text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  <span>Start Pod Sync</span>
                </button>
              </div>
            </div>

            {/* Top Summary Bento / Metric Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Pod Members */}
              <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Pod Members</span>
                  <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#006b2c]">
                    <span className="material-symbols-outlined text-[18px]">groups</span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#131b2e]">{members.length}</span>
                  <span className="text-xs text-[#6e7b6c] font-medium">active members</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#006b2c] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>
                  <span>
                    {activeNowCount} Active Now • {awayFocusCount + offlineCount} Away / Focus
                  </span>
                </div>
              </div>

              {/* Card 2: Sprint Capacity */}
              <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Sprint Capacity</span>
                  <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#0051d5]">
                    <span className="material-symbols-outlined text-[18px]">speed</span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#131b2e]">84%</span>
                  <span className="text-xs text-[#6e7b6c]">28 / 32 story pts</span>
                </div>
                <div className="mt-2.5 w-full h-1.5 rounded-full bg-[#eaedff] overflow-hidden">
                  <div className="h-full rounded-full bg-[#006b2c]" style={{ width: '84%' }}></div>
                </div>
              </div>

              {/* Card 3: Tasks in Flight */}
              <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Tasks in Flight</span>
                  <div className="w-8 h-8 rounded-lg bg-[#ffdcc3]/40 flex items-center justify-center text-[#8d4b00]">
                    <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#131b2e]">11</span>
                  <span className="text-xs text-[#6e7b6c]">active tasks</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#8d4b00] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#8d4b00]"></span>
                  <span>3 in code/design review</span>
                </div>
              </div>

              {/* Card 4: Standup Sync */}
              <div className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7b6c]">Standup Sync</span>
                  <div className="w-8 h-8 rounded-lg bg-[#7ffc97]/30 flex items-center justify-center text-[#005320]">
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#006b2c]">{members.length} of {members.length}</span>
                  <span className="text-xs text-[#6e7b6c]">submitted today</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#006b2c] font-medium">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  <span>100% on-time submission rate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Controls Toolbar (NO role filter as all are pod members) */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e7b6c] text-[18px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pod members by name or skill..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#ffffff] border border-[#eaedff] shadow-xs text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:ring-1 focus:ring-[#006b2c]"
              />
            </div>

            {/* Filter chips & Sort */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center bg-[#ffffff] p-1 rounded-xl border border-[#eaedff] shadow-xs">
                <button
                  onClick={() => setSelectedAvailabilityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedAvailabilityFilter === 'all'
                      ? 'bg-[#eaedff] text-[#006b2c]'
                      : 'text-[#6e7b6c] hover:text-[#131b2e]'
                  }`}
                >
                  All ({members.length})
                </button>
                <button
                  onClick={() => setSelectedAvailabilityFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedAvailabilityFilter === 'active'
                      ? 'bg-[#eaedff] text-[#006b2c] font-semibold'
                      : 'text-[#6e7b6c] hover:text-[#131b2e]'
                  }`}
                >
                  Active Now ({activeNowCount})
                </button>
                <button
                  onClick={() => setSelectedAvailabilityFilter('away')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedAvailabilityFilter === 'away'
                      ? 'bg-[#eaedff] text-[#8d4b00] font-semibold'
                      : 'text-[#6e7b6c] hover:text-[#131b2e]'
                  }`}
                >
                  In Focus / Away ({awayFocusCount + offlineCount})
                </button>
              </div>

              <div className="relative">
                <select
                  value={selectedSort}
                  onChange={(e) => setSelectedSort(e.target.value)}
                  className="appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-[#ffffff] border border-[#eaedff] shadow-xs text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
                >
                  <option value="name-asc">Sort: Name (A-Z)</option>
                  <option value="active-first">Sort: Most active</option>
                  <option value="tasks-desc">Sort: Sprint progress</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#6e7b6c] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Member Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => {
              const standup = getMemberStandup(member.id);
              const isOnline = member.status === 'online';
              const isBusy = member.status === 'busy';
              const isAway = member.status === 'away';

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedUser(member)}
                  className="flex flex-col justify-between p-6 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <div>
                    {/* Top row: Avatar + Identity + Status */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base"
                            style={{
                              backgroundColor: member.initialsColor ? `${member.initialsColor}20` : '#eaedff',
                              color: member.initialsColor || '#006b2c',
                            }}
                          >
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              member.initials
                            )}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                              isOnline ? 'bg-[#006b2c]' : isBusy || isAway ? 'bg-[#8d4b00]' : 'bg-[#6e7b6c]'
                            }`}
                          ></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors">
                            {member.name}
                          </span>
                          <span className="text-xs text-[#6e7b6c]">{member.roleTitle}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          isOnline
                            ? 'bg-[#7ffc97]/30 text-[#005320]'
                            : isBusy || isAway
                            ? 'bg-[#ffdcc3] text-[#8d4b00]'
                            : 'bg-[#eaedff] text-[#3e4a3d]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-[#006b2c]' : isBusy || isAway ? 'bg-[#8d4b00]' : 'bg-[#6e7b6c]'
                          }`}
                        ></span>
                        {isOnline ? 'Active now' : isBusy ? 'In Meetings' : isAway ? 'In Focus' : 'Offline • PTO'}
                      </span>
                    </div>

                    {/* Sprint Task Metric */}
                    <div className="mb-4 p-3 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[#3e4a3d] font-medium">Tasks this sprint</span>
                        <span className="text-[11px] font-semibold text-[#006b2c]">
                          {member.tasksCompleted > 0 ? `${Math.min(member.tasksCompleted, 4)} of 5` : '3 of 4'} completed
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#eaedff] overflow-hidden">
                        <div className="h-full rounded-full bg-[#006b2c]" style={{ width: '80%' }}></div>
                      </div>
                    </div>

                    {/* Latest Standup Snippet */}
                    <div className="mb-5 flex flex-col gap-2">
                      <div className="flex items-center gap-1 text-[#6e7b6c] text-[10px] uppercase tracking-wider font-semibold">
                        <span className="material-symbols-outlined text-[15px] text-[#006b2c]">update</span>
                        <span>Latest Standup Today</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#f2f3ff] text-xs flex flex-col gap-1.5 border border-[#eaedff]">
                        <div className="flex items-start gap-1.5">
                          <span className="text-[10px] text-[#006b2c] font-bold min-w-[44px]">DONE</span>
                          <span className="text-[#131b2e] text-[11px] leading-tight line-clamp-1">{standup.done}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[10px] text-[#0051d5] font-bold min-w-[44px]">DOING</span>
                          <span className="text-[#131b2e] text-[11px] leading-tight line-clamp-1">{standup.doing}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[10px] text-[#6e7b6c] font-bold min-w-[44px]">BLOCK</span>
                          <span className="text-[#6e7b6c] text-[11px] leading-tight line-clamp-1">{standup.block}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-[#eaedff]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('channels');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#f2f3ff] text-[#131b2e] text-xs font-semibold hover:bg-[#eaedff] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#0051d5]">chat_bubble</span>
                      <span>Message</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('tasks');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#f2f3ff] text-[#131b2e] text-xs font-semibold hover:bg-[#eaedff] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#006b2c]">checklist</span>
                      <span>View Tasks</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* 3. REUSED TEAMMATE PROFILE POPOVER MODAL                     */}
      {/* ============================================================ */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="relative w-full max-w-[420px]"
            onClick={(e) => e.stopPropagation()}
          >
            <TeammateProfilePopover
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onDirectMessage={() => {
                setSelectedUser(null);
                onNavigate('channels');
              }}
              onViewTasks={() => {
                setSelectedUser(null);
                onNavigate('tasks');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
