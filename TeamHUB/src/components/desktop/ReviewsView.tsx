import React, { useState, useEffect, useMemo } from 'react';
import { User, Review, ReviewStatus, Task } from '../../types';
import { fetchReviewsFromDb, submitReviewDecision, exportReviewsAuditCsv } from '../../lib/supabase';
import { INITIAL_REVIEWS } from '../../data/mockData';

interface ReviewsViewProps {
  currentUser: User;
  onNavigate?: (view: any, itemId?: string) => void;
  onTaskUpdated?: (updatedTask: Task) => void;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({
  currentUser,
  onNavigate,
  onTaskUpdated,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'changes'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showingEmptyState, setShowingEmptyState] = useState(false);
  
  // Admin Filter States
  const [selectedPodFilter, setSelectedPodFilter] = useState('All Pods');
  const [selectedLeadFilter, setSelectedLeadFilter] = useState('All Team Leads');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('30d');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Drawer & Review Action States
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);

  // Load reviews from Supabase or local storage on mount
  useEffect(() => {
    let isMounted = true;
    async function loadReviews() {
      try {
        const data = await fetchReviewsFromDb(currentUser);
        if (isMounted && data) {
          setReviews(data);
        }
      } catch (e) {
        console.warn('Could not load reviews:', e);
      }
    }
    loadReviews();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Show Toast helper
  const showToast = (text: string, isSuccess = true) => {
    setToastMessage({ text, isSuccess });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Open Review Detail Drawer
  const handleOpenReview = (rev: Review) => {
    setSelectedReview(rev);
    setFeedbackText(rev.feedback || '');
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedReview(null), 250);
  };

  // Quick feedback template chip handler
  const handleAddFeedbackChip = (chipText: string) => {
    if (feedbackText.trim().length > 0) {
      setFeedbackText((prev) => `${prev}\n- ${chipText}`);
    } else {
      setFeedbackText(chipText);
    }
  };

  // Submit Decision
  const handleDecision = async (status: ReviewStatus) => {
    if (!selectedReview) return;

    if (status === 'changes_requested' && !feedbackText.trim()) {
      showToast('Please provide notes explaining required revisions.', false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitReviewDecision(
        selectedReview.id,
        status,
        feedbackText.trim(),
        currentUser
      );

      if (res.success && res.review) {
        // Update local review state
        setReviews((prev) =>
          prev.map((r) => (r.id === res.review!.id ? res.review! : r))
        );

        if (status === 'approved') {
          showToast(`Deliverable approved! Team notified in #reviews-feed.`);
        } else if (status === 'changes_requested') {
          showToast(`Changes requested. Sent to ${selectedReview.assignee.name}.`);
        } else {
          showToast(`Review marked as Rejected.`, false);
        }

        setTimeout(() => {
          handleCloseDrawer();
        }, 800);
      } else {
        showToast(res.error || 'Failed to submit review decision.', false);
      }
    } catch (err: any) {
      showToast(err.message || 'Error submitting review decision', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Approve Safe Handler
  const handleQuickApproveSafe = async () => {
    const safeReview = reviews.find((r) => r.status === 'pending' && r.safeToMerge);
    if (!safeReview) {
      showToast('No safe-to-merge deliverable found pending.', false);
      return;
    }
    await submitReviewDecision(safeReview.id, 'approved', 'Auto-approved safe deliverable.', currentUser);
    setReviews((prev) =>
      prev.map((r) =>
        r.id === safeReview.id ? { ...r, status: 'approved', reviewedAt: 'Just now' } : r
      )
    );
    showToast(`Quick approved: ${safeReview.taskTitle}!`);
  };

  // Export CSV handler for Admin
  const handleExportCsv = () => {
    const csvContent = exportReviewsAuditCsv(reviews);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `teamhub-reviews-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit log exported successfully (CSV)!');
  };

  // Calculated Counts for Team Lead
  const pendingReviews = useMemo(() => reviews.filter((r) => r.status === 'pending'), [reviews]);
  const approvedReviews = useMemo(() => reviews.filter((r) => r.status === 'approved'), [reviews]);
  const changesReviews = useMemo(() => reviews.filter((r) => r.status === 'changes_requested'), [reviews]);

  // Filtered List for Team Lead
  const displayedLeadReviews = useMemo(() => {
    let list = reviews;
    if (activeTab === 'pending') {
      list = list.filter((r) => r.status === 'pending');
    } else if (activeTab === 'approved') {
      list = list.filter((r) => r.status === 'approved');
    } else if (activeTab === 'changes') {
      list = list.filter((r) => r.status === 'changes_requested');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.taskTitle.toLowerCase().includes(q) ||
          r.assignee.name.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          r.prNumber.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'oldest') {
      return [...list].reverse();
    }
    return list;
  }, [reviews, activeTab, searchQuery, sortOrder]);

  // Admin Filtered Reviews
  const displayedAdminReviews = useMemo(() => {
    let list = reviews;

    // Status filter
    if (selectedStatusFilter === 'Ready for Review') {
      list = list.filter((r) => r.status === 'pending');
    } else if (selectedStatusFilter === 'Approved') {
      list = list.filter((r) => r.status === 'approved');
    } else if (selectedStatusFilter === 'Changes Requested') {
      list = list.filter((r) => r.status === 'changes_requested');
    }

    // Pod filter
    if (selectedPodFilter !== 'All Pods' && selectedPodFilter !== 'All Pods (4)') {
      list = list.filter((r) => r.pod.toLowerCase().includes(selectedPodFilter.toLowerCase().replace(' pod', '')));
    }

    // Lead filter
    if (selectedLeadFilter !== 'All Team Leads' && selectedLeadFilter !== 'All Team Leads (6)') {
      const cleanLead = selectedLeadFilter.split('(')[0].trim().toLowerCase();
      list = list.filter((r) => (r.reviewer?.name || '').toLowerCase().includes(cleanLead));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.taskTitle.toLowerCase().includes(q) ||
          r.assignee.name.toLowerCase().includes(q) ||
          r.prNumber.toLowerCase().includes(q) ||
          r.pod.toLowerCase().includes(q)
      );
    }

    return list;
  }, [reviews, selectedStatusFilter, selectedPodFilter, selectedLeadFilter, searchQuery]);

  // Admin Pagination
  const totalPages = Math.max(1, Math.ceil(displayedAdminReviews.length / itemsPerPage));
  const paginatedAdminReviews = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayedAdminReviews.slice(start, start + itemsPerPage);
  }, [displayedAdminReviews, currentPage]);

  const isAdmin = currentUser.role === 'admin';

  // Computed dynamic stats for Admin Overview & Team Lead Ribbons
  const totalDeliverables = reviews.length;
  const approvedCount = reviews.filter((r) => r.status === 'approved').length;
  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const changesCount = reviews.filter((r) => r.status === 'changes_requested').length;

  const reviewsWithTurnaround = reviews.filter((r) => typeof r.turnaroundHours === 'number');
  const avgTurnaroundVal =
    reviewsWithTurnaround.length > 0
      ? (
          reviewsWithTurnaround.reduce((acc, r) => acc + (r.turnaroundHours || 0), 0) /
          reviewsWithTurnaround.length
        ).toFixed(1)
      : null;
  const avgTurnaroundStr = avgTurnaroundVal ? `${avgTurnaroundVal} hrs` : (totalDeliverables === 0 ? '0 hrs' : 'N/A');

  const activeReviewerNames = Array.from(
    new Set(reviews.map((r) => r.reviewer?.name || r.reviewerName).filter(Boolean) as string[])
  );
  const leadsCount = activeReviewerNames.length;

  const metSlaCount = reviews.filter((r) => (r.turnaroundHours ?? 0) <= 24).length;
  const slaPercentage = totalDeliverables > 0 ? ((metSlaCount / totalDeliverables) * 100).toFixed(1) + '%' : '100%';

  return (
    <div className="flex flex-col w-full relative min-h-screen text-[#131b2e] animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. ADMINISTRATOR REVIEWS OVERVIEW (READ-ONLY GOVERNANCE)                   */}
      {/* ========================================================================= */}
      {isAdmin ? (
        <div className="flex flex-col w-full">
          {/* Top Section: Header & Mode Context */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-[#131b2e]">Reviews Overview</h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                  <span>Live Governance</span>
                </div>
              </div>
              <p className="text-sm text-[#3e4a3d]">
                Auditing and visibility across all engineering &amp; design pods, team leads, and active submission queues.
              </p>
            </div>

            {/* Right utility: Audit export & Refresh sync indicator */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#131b2e] hover:bg-[#eaedff] transition-colors shadow-xs text-xs font-semibold cursor-pointer border border-[#eaedff]"
              >
                <span className="material-symbols-outlined text-[18px] text-[#6e7b6c]">download</span>
                <span>Export Audit Log (CSV)</span>
              </button>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#eaedff] text-[#3e4a3d] text-xs font-medium border border-[#bdcaba]/40">
                <span className="material-symbols-outlined text-[16px] text-[#006b2c]">verified_user</span>
                <span>Read-Only Oversight</span>
              </div>
            </div>
          </div>

          {/* Executive Summary Metrics: 4 Bento Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Metric 1: Total Deliverables */}
            <div className="flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#6e7b6c] uppercase tracking-wider font-semibold">Total Deliverables</span>
                <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#006b2c]">
                  <span className="material-symbols-outlined text-[18px]">rule_folder</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-[#131b2e]">{totalDeliverables}</span>
                <span className="text-[11px] text-[#6e7b6c]">this sprint</span>
              </div>
              <div className="flex items-center gap-2 pt-2 bg-[#f2f3ff]/60 px-2 py-1.5 rounded-lg text-[11px] text-[#6e7b6c]">
                <span className="flex items-center gap-1 text-[#006b2c] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>{approvedCount} Approved
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[#b15f00] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b15f00]"></span>{pendingCount} Pending
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[#ba1a1a]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>{changesCount} Changes
                </span>
              </div>
            </div>

            {/* Metric 2: Avg Turnaround Time */}
            <div className="flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#6e7b6c] uppercase tracking-wider font-semibold">Avg Turnaround Time</span>
                <div className="w-8 h-8 rounded-lg bg-[#7ffc97]/30 flex items-center justify-center text-[#006b2c]">
                  <span className="material-symbols-outlined text-[18px]">timer</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-[#131b2e]">{avgTurnaroundStr}</span>
                <span className="text-[11px] text-[#006b2c] font-semibold">
                  {totalDeliverables === 0 ? 'No reviews recorded' : 'Target < 6h'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="w-full bg-[#eaedff] rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#006b2c] h-1.5 rounded-full" style={{ width: totalDeliverables === 0 ? '0%' : '63%' }}></div>
                </div>
                <span className="text-[11px] text-[#6e7b6c] ml-2 whitespace-nowrap">Target &lt; 6h</span>
              </div>
            </div>

            {/* Metric 3: Active Team Leads */}
            <div className="flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#6e7b6c] uppercase tracking-wider font-semibold">Active Team Leads</span>
                <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#0051d5]">
                  <span className="material-symbols-outlined text-[18px]">supervised_user_circle</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-[#131b2e]">{leadsCount} Lead{leadsCount === 1 ? '' : 's'}</span>
                <span className="text-[11px] text-[#6e7b6c]">{leadsCount > 0 ? 'assigned' : 'in workspace'}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {leadsCount > 0 ? (
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {activeReviewerNames.slice(0, 4).map((name, i) => (
                      <div key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#dbe1ff] text-[#00174b] text-[10px] font-bold ring-2 ring-white">
                        {name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-[#6e7b6c]">No active reviewer assignments</span>
                )}
              </div>
            </div>

            {/* Metric 4: SLA Compliance */}
            <div className="flex flex-col justify-between p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#6e7b6c] uppercase tracking-wider font-semibold">SLA Compliance (&lt;24h)</span>
                <div className="w-8 h-8 rounded-lg bg-[#7ffc97]/30 flex items-center justify-center text-[#006b2c]">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-[#006b2c]">{slaPercentage}</span>
                <span className="text-[11px] text-[#6e7b6c]">{metSlaCount} of {totalDeliverables} met</span>
              </div>
              <div className="flex items-center justify-between text-[#6e7b6c] text-[11px] pt-1">
                <span className="text-[#006b2c] font-medium">{reviews.filter((r) => (r.turnaroundHours ?? 0) > 24).length} Breached</span>
                <span>{pendingCount} Pending Gate</span>
              </div>
            </div>
          </div>

          {/* Filter & Audit Controls Card */}
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs mb-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[280px]">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e7b6c] text-[18px] pointer-events-none">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search deliverable title, assignee, or PR..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#f2f3ff] text-[#131b2e] text-sm placeholder:text-[#6e7b6c] focus:outline-none focus:ring-2 focus:ring-[#006b2c]/20 transition-all border border-transparent focus:border-[#006b2c]"
                />
              </div>

              {/* Dropdown Selectors Group */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Pod Selector */}
                <div className="relative">
                  <select
                    value={selectedPodFilter}
                    onChange={(e) => {
                      setSelectedPodFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-[#f2f3ff] text-xs font-semibold text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer focus:outline-none border border-[#eaedff]"
                  >
                    <option>All Pods</option>
                    <option>Core Engineering</option>
                    <option>Design Systems</option>
                    <option>Mobile Platform</option>
                    <option>Infrastructure</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#6e7b6c] text-[16px] pointer-events-none">expand_more</span>
                </div>

                {/* Team Lead Selector */}
                <div className="relative">
                  <select
                    value={selectedLeadFilter}
                    onChange={(e) => {
                      setSelectedLeadFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-[#f2f3ff] text-xs font-semibold text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer focus:outline-none border border-[#eaedff]"
                  >
                    <option>All Team Leads</option>
                    <option>Taylor Brooks (Core Eng)</option>
                    <option>Marcus Chen (Mobile)</option>
                    <option>Sarah Lin (Design Systems)</option>
                    <option>Priya Sharma (Infra)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#6e7b6c] text-[16px] pointer-events-none">expand_more</span>
                </div>

                {/* Date Range Filter */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f2f3ff] text-xs font-semibold text-[#131b2e] border border-[#eaedff]">
                  <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">calendar_today</span>
                  <span>Last 30 Days (Oct 1 - Oct 31, 2024)</span>
                </div>
              </div>
            </div>

            {/* Status Tabs / Pills Bar */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto">
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold mr-1">Status:</span>
              {(['All', 'Ready for Review', 'Approved', 'Changes Requested'] as const).map((statusName) => (
                <button
                  key={statusName}
                  onClick={() => {
                    setSelectedStatusFilter(statusName);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedStatusFilter === statusName
                      ? 'bg-[#eaedff] text-[#006b2c] shadow-2xs font-bold border border-[#006b2c]/20'
                      : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                  }`}
                >
                  {statusName}
                  {statusName === 'All' && ` (${reviews.length})`}
                  {statusName === 'Ready for Review' && ` (${pendingReviews.length})`}
                  {statusName === 'Approved' && ` (${approvedReviews.length})`}
                  {statusName === 'Changes Requested' && ` (${changesReviews.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Read-Only Audit Table Container */}
          <div className="w-full rounded-2xl bg-white border border-[#eaedff] shadow-xs overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f2f3ff]/70 text-[#6e7b6c] text-[11px] uppercase tracking-wider select-none border-b border-[#eaedff]">
                    <th className="py-3.5 px-4 font-semibold">Task / Deliverable</th>
                    <th className="py-3.5 px-4 font-semibold">Assignee</th>
                    <th className="py-3.5 px-4 font-semibold">Reviewing Lead</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Submitted Date</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Turnaround / Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaedff]/60 text-sm">
                  {paginatedAdminReviews.length > 0 ? (
                    paginatedAdminReviews.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => handleOpenReview(r)}
                        className="hover:bg-[#f2f3ff]/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[#131b2e] group-hover:text-[#006b2c] transition-colors leading-snug">
                              {r.taskTitle}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-[#6e7b6c]">
                              <span className="px-2 py-0.5 rounded bg-[#eaedff] font-mono font-medium text-[#131b2e]">
                                {r.prNumber}
                              </span>
                              <span>•</span>
                              <span>pod/{r.pod.toLowerCase().replace(/\s+/g, '-')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#dbe1ff] text-[#00174b] flex items-center justify-center text-xs font-bold shrink-0">
                              {r.assignee.initials || 'MP'}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[#131b2e] leading-tight truncate">
                                {r.assignee.name}
                              </span>
                              <span className="text-[11px] text-[#6e7b6c]">{r.assignee.roleTitle || r.pod}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#ffdcc3] text-[#2f1500] flex items-center justify-center text-xs font-bold shrink-0">
                              {r.reviewer?.initials || 'TB'}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[#131b2e] leading-tight truncate">
                                {r.reviewer?.name || 'Taylor Brooks'}
                              </span>
                              <span className="text-[11px] text-[#6e7b6c]">Lead • {r.pod}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {r.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffdcc3]/60 text-[#2f1500] text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#8d4b00]"></span>
                              Ready for Review
                            </span>
                          )}
                          {r.status === 'approved' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7ffc97]/50 text-[#005320] text-[11px] font-semibold">
                              <span className="material-symbols-outlined text-[14px] text-[#006b2c]">check_circle</span>
                              Approved
                            </span>
                          )}
                          {r.status === 'changes_requested' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-semibold">
                              <span className="material-symbols-outlined text-[14px] text-[#ba1a1a]">priority_high</span>
                              Changes Requested
                            </span>
                          )}
                          {r.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-semibold">
                              <span className="material-symbols-outlined text-[14px] text-[#ba1a1a]">close</span>
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs text-[#131b2e] font-medium">{r.createdAt}</span>
                            <span className="text-[10px] text-[#6e7b6c]">{r.reviewedAt ? `Reviewed: ${r.reviewedAt}` : 'Pending Lead'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            r.status === 'approved'
                              ? 'bg-[#7ffc97]/30 text-[#005320]'
                              : 'bg-[#eaedff] text-[#3e4a3d]'
                          }`}>
                            {r.status === 'approved'
                              ? `Turnaround: ${r.turnaroundHours || 2.1}h`
                              : `Open for ${r.turnaroundHours || 2.2}h`}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#6e7b6c]">
                        No review audit deliverables match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination */}
            <div className="px-4 py-3.5 bg-[#f2f3ff]/50 border-t border-[#eaedff] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6e7b6c]">
                  Showing {displayedAdminReviews.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(currentPage * itemsPerPage, displayedAdminReviews.length)} of {displayedAdminReviews.length} reviews
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#eaedff] text-[11px] text-[#6e7b6c]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                  Auditor Mode • Syncing real-time
                </span>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                      currentPage === pg
                        ? 'bg-[#006b2c] text-white shadow-xs'
                        : 'text-[#6e7b6c] hover:bg-[#eaedff]'
                    }`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Context Banner / Pod Audit Health Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#006b2c] shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">security_update_good</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#131b2e]">
                  {pendingCount === 0 ? 'Zero Pending Security Gates' : `${pendingCount} Pending Security Gate${pendingCount === 1 ? '' : 's'}`}
                </span>
                <span className="text-xs text-[#3e4a3d] mt-0.5">
                  {totalDeliverables === 0
                    ? 'No deliverables in pipeline. Dual-reviewer gates will activate on submission.'
                    : `${approvedCount} approved, ${pendingCount} pending reviewer action.`}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#0051d5] shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">speed</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#131b2e]">Pod Turnaround Response</span>
                <span className="text-xs text-[#3e4a3d] mt-0.5">
                  {totalDeliverables === 0
                    ? 'No reviews logged yet. Turnaround metrics compute automatically as reviews conclude.'
                    : `Average turnaround is ${avgTurnaroundStr} with ${slaPercentage} SLA compliance.`}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#eaedff] shadow-xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#8d4b00] shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">history_edu</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#131b2e]">Immutable Audit Trail</span>
                <span className="text-xs text-[#3e4a3d] mt-0.5">
                  {totalDeliverables === 0
                    ? '0 review transactions recorded. Supabase audit ledger is live and verified.'
                    : `${totalDeliverables} review transaction${totalDeliverables === 1 ? '' : 's'} cryptographically timestamped and synced.`}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. TEAM LEAD REVIEWS LIST VIEW                                            */
        /* ========================================================================= */
        <div className="flex flex-col w-full">
          {/* Team Lead Contextual Banner & Metrics Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7ffc97]/50 text-[#005320] text-[11px] font-bold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                Team Lead View • Pod Velocity &amp; Quality Gate
              </span>
              <span className="text-xs text-[#6e7b6c]">• Sprint 42 Cycle</span>
            </div>

            {/* Mini Pod Velocity Spark Pill */}
            <div className="flex items-center gap-4 bg-white border border-[#eaedff] px-4 py-1.5 rounded-full shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6e7b6c] uppercase tracking-wider font-semibold">Median Turnaround</span>
                <span className="text-sm font-bold text-[#006b2c]">{avgTurnaroundVal ? `${avgTurnaroundVal}h` : '0h'}</span>
              </div>
              <div className="h-3 w-px bg-[#eaedff]"></div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6e7b6c] uppercase tracking-wider font-semibold">Pass Rate</span>
                <span className="text-sm font-bold text-[#131b2e]">
                  {totalDeliverables > 0 ? ((approvedCount / totalDeliverables) * 100).toFixed(1) + '%' : '100%'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Header & Global Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#eaedff]">
            <div className="flex flex-col gap-1 max-w-2xl">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-bold text-[#131b2e] tracking-tight">Reviews</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#7ffc97]/50 text-[#005320]">
                  {pendingReviews.length} pending
                </span>
              </div>
              <p className="text-sm text-[#3e4a3d] leading-relaxed">
                Review team deliverables, inspect code &amp; design artifacts, and provide async feedback to maintain pod momentum.
              </p>
            </div>

            {/* Quick Actions & Toggle Simulation */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowingEmptyState((prev) => !prev)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#eaedff] text-[#131b2e] hover:bg-[#eaedff] transition-all shadow-xs text-xs font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#6e7b6c]">
                  {showingEmptyState ? 'format_list_bulleted' : 'inbox'}
                </span>
                <span>{showingEmptyState ? 'View Active Reviews' : 'Preview Empty State'}</span>
              </button>
              <button
                onClick={handleQuickApproveSafe}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#006b2c] text-white hover:bg-[#00873a] transition-all shadow-xs text-xs font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Approve all safe ({reviews.filter((r) => r.status === 'pending' && r.safeToMerge).length})</span>
              </button>
            </div>
          </div>

          {/* Filter & Tab Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#f2f3ff] rounded-xl border border-[#eaedff]">
              <button
                onClick={() => {
                  setActiveTab('pending');
                  setShowingEmptyState(false);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-white text-[#006b2c] shadow-xs font-bold'
                    : 'text-[#6e7b6c] hover:text-[#131b2e]'
                }`}
              >
                <span>Pending</span>
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#7ffc97] text-[#002109] text-[10px] font-bold">
                  {pendingReviews.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('approved');
                  setShowingEmptyState(false);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === 'approved'
                    ? 'bg-white text-[#006b2c] shadow-xs font-bold'
                    : 'text-[#6e7b6c] hover:text-[#131b2e]'
                }`}
              >
                <span>Approved</span>
                <span className="text-[11px] opacity-75 font-semibold">{approvedReviews.length}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('changes');
                  setShowingEmptyState(false);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === 'changes'
                    ? 'bg-white text-[#006b2c] shadow-xs font-bold'
                    : 'text-[#6e7b6c] hover:text-[#131b2e]'
                }`}
              >
                <span>Changes Requested</span>
                <span className="text-[11px] opacity-75 font-semibold">{changesReviews.length}</span>
              </button>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-3">
              <div className="relative min-w-[260px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6e7b6c] text-[18px] pointer-events-none">filter_list</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter deliverables by task, assignee..."
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-white border border-[#eaedff] text-[#131b2e] placeholder:text-[#6e7b6c] text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-[#006b2c]/20 transition-all"
                />
              </div>

              <div
                onClick={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#eaedff] rounded-xl shadow-xs text-[#131b2e] text-xs cursor-pointer hover:bg-[#eaedff] transition-colors select-none"
              >
                <span className="text-[#6e7b6c]">Sort:</span>
                <span className="font-semibold">{sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}</span>
                <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">swap_vert</span>
              </div>
            </div>
          </div>

          {/* MAIN LIST CONTAINER OR EMPTY STATE */}
          {showingEmptyState || displayedLeadReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 lg:p-16 rounded-2xl bg-white border border-[#eaedff] text-center shadow-xs">
              <div className="relative w-44 h-44 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#7ffc97]/30 filter blur-xl transform scale-90"></div>
                <img
                  alt="Inbox zero checklist illustration"
                  className="relative z-10 w-full h-full object-contain drop-shadow-xs"
                  src="https://lh3.googleusercontent.com/aida/AEtjO1UfjbjCRdQml_bzda_NKvC_CptPUekqtHmBHVLAsWkZaZRrABqOLjYv63Ge3nQ-XXACDg3cTvvYcpmZMwvL0ANXSXRAnUi1V4oQ6-UC-p55mpGi_f8jEGbea5eyos8kXWIqc3sVA8IxNAG0Fh2e0T0YpGAmqN1bfWjwNRwULwO-BVlZUnaTGBzrMSKO_lnhoMtGluJcJN8YyDf1vzuCLk2ZSSpOzmRkHFQksJxdxDUuk_JL8EcE70jQm1vD"
                />
              </div>
              <h2 className="text-xl font-bold text-[#131b2e] mb-2">
                All caught up! Nothing to review right now.
              </h2>
              <p className="text-sm text-[#3e4a3d] max-w-md mb-8 leading-relaxed">
                Your team is executing smoothly. New submissions from pod members will appear here automatically.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('approved')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] transition-colors text-xs font-semibold shadow-xs cursor-pointer border border-[#eaedff]"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#6e7b6c]">task_alt</span>
                  <span>View Completed Tasks</span>
                </button>
                <button
                  onClick={() => onNavigate && onNavigate('tasks')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006b2c] text-white hover:bg-[#00873a] transition-all text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                  <span>Check Sprint Board</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {displayedLeadReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="flex flex-col p-6 rounded-2xl bg-white border border-[#eaedff] shadow-xs hover:shadow-md transition-all duration-150 group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Assignee & Task Context */}
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-[#dbe1ff] flex items-center justify-center text-xs font-bold text-[#00174b] ring-2 ring-white shadow-xs">
                          {rev.assignee.initials || 'MP'}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#006b2c] rounded-full ring-2 ring-white" title="Online"></span>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            onClick={() => handleOpenReview(rev)}
                            className="text-base font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors cursor-pointer"
                          >
                            {rev.taskTitle}
                          </span>

                          {rev.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-[#7ffc97]/50 text-[#005320] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                              Ready for Review
                            </span>
                          )}

                          {rev.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-[#7ffc97]/60 text-[#005320] font-semibold">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Approved
                            </span>
                          )}

                          {rev.status === 'changes_requested' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-[#ffdad6] text-[#ba1a1a] font-semibold">
                              <span className="material-symbols-outlined text-[14px]">priority_high</span>
                              Changes Requested
                            </span>
                          )}

                          {rev.safeToMerge && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#eaedff] text-[#0051d5] font-semibold">
                              Safe to Merge
                            </span>
                          )}
                        </div>

                        {/* Meta info: Branch, Changes, Assignee */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-2.5 text-xs text-[#6e7b6c]">
                          <span className="font-semibold text-[#131b2e]">{rev.assignee.name}</span>
                          <span>•</span>
                          <span>{rev.assignee.roleTitle || 'Engineer'}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#f2f3ff] text-[#131b2e]">
                            <span className="material-symbols-outlined text-[13px]">alt_route</span>
                            {rev.branch}
                          </span>
                          <span>•</span>
                          <span className="text-[#006b2c] font-semibold">+{rev.linesAdded}</span>
                          <span className="text-[#ba1a1a] font-semibold">-{rev.linesRemoved}</span>
                          <span>({rev.filesChanged} files)</span>
                          <span>•</span>
                          <span className="text-[#6e7b6c]">{rev.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action cluster */}
                    <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                      {rev.status === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedReview(rev);
                              setFeedbackText('Can you provide test coverage details on the PR?');
                              setIsDrawerOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[#3e4a3d] hover:text-[#131b2e] hover:bg-[#eaedff] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Request Info
                          </button>
                          <button
                            onClick={async () => {
                              await submitReviewDecision(rev.id, 'approved', 'Quick approved by Lead.', currentUser);
                              setReviews((prev) =>
                                prev.map((r) =>
                                  r.id === rev.id ? { ...r, status: 'approved', reviewedAt: 'Just now' } : r
                                )
                              );
                              showToast(`Approved ${rev.taskTitle}!`);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[#006b2c] hover:bg-[#7ffc97]/40 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Quick Approve
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleOpenReview(rev)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006b2c] text-white hover:bg-[#00873a] text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        <span>Review</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>

                  {/* Artifact Pills and Deep Context */}
                  <div className="mt-4 pt-4 border-t border-[#eaedff] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {rev.artifacts && rev.artifacts.length > 0 ? (
                        rev.artifacts.map((art) => (
                          <button
                            key={art.id}
                            onClick={() => handleOpenReview(rev)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eaedff] text-[#131b2e] hover:bg-[#dbe1ff] transition-colors text-xs font-medium cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px] text-[#0051d5]">
                              {art.type === 'figma' ? 'design_services' : art.type === 'loom' ? 'smart_display' : 'description'}
                            </span>
                            <span>{art.title}</span>
                            <span className="material-symbols-outlined text-[13px] text-[#6e7b6c]">open_in_new</span>
                          </button>
                        ))
                      ) : (
                        <a
                          href="#"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eaedff] text-[#131b2e] text-xs font-medium"
                        >
                          <span className="material-symbols-outlined text-[15px] text-[#0051d5]">commit</span>
                          <span>{rev.prNumber}</span>
                        </a>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f2f3ff] text-[#6e7b6c] text-xs font-medium">
                        <span className="material-symbols-outlined text-[14px]">shield</span>
                        All automated tests passing
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[#6e7b6c] text-xs">
                      <span>Requested by: <strong className="text-[#131b2e]">{rev.pod}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-[#006b2c] font-semibold">
                        <span className="material-symbols-outlined text-[14px]">speed</span> Fast-path reviewable
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. REVIEW DETAIL SLIDE-OUT PANEL (DRAWER)                                 */}
      {/* ========================================================================= */}
      {isDrawerOpen && selectedReview && (
        <>
          {/* Dimmed Backdrop Scrim */}
          <div
            onClick={handleCloseDrawer}
            className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-50 transition-opacity duration-200"
          />

          {/* Drawer Body Container */}
          <aside className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-white border-l border-[#eaedff] shadow-2xl z-50 flex flex-col justify-between transition-transform duration-300 ease-out animate-in slide-in-from-right">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {/* Drawer Header Area */}
              <div className="p-6 pb-5 bg-[#f2f3ff]/60 border-b border-[#eaedff]">
                {/* Breadcrumb / Badge + Dismiss Controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#6e7b6c]">
                    <span className="uppercase tracking-wider font-semibold">Review Request</span>
                    <span>•</span>
                    <span className="uppercase tracking-wider font-semibold">Sprint 42</span>
                    <span className={`ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      selectedReview.status === 'approved'
                        ? 'bg-[#7ffc97] text-[#002109]'
                        : selectedReview.status === 'changes_requested'
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : 'bg-[#7ffc97]/50 text-[#005320]'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                      {selectedReview.status === 'approved' ? 'Approved' : selectedReview.status === 'changes_requested' ? 'Changes Requested' : 'Ready for Review'}
                    </span>
                  </div>

                  {/* Esc / Close Action */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#6e7b6c] bg-white border border-[#eaedff] px-1.5 py-0.5 rounded font-mono">ESC</span>
                    <button
                      onClick={handleCloseDrawer}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-[#eaedff]"
                      title="Close review detail"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                </div>

                {/* Deliverable Headline */}
                <h2 className="text-xl font-bold text-[#131b2e] tracking-tight leading-snug">
                  {selectedReview.taskTitle}
                </h2>

                {/* Context Meta Badges & Assignee Details */}
                <div className="mt-4 pt-3 border-t border-[#eaedff]/70 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#dbe1ff] text-[#00174b] flex items-center justify-center text-xs font-bold">
                      {selectedReview.assignee.initials || 'MP'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#131b2e] leading-none">{selectedReview.assignee.name}</span>
                      <span className="text-[10px] text-[#6e7b6c] mt-0.5">{selectedReview.assignee.roleTitle || 'Engineer'}</span>
                    </div>
                  </div>

                  <div className="h-4 w-px bg-[#eaedff] hidden sm:block"></div>

                  <div className="flex items-center gap-1 text-[#6e7b6c] text-xs">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    <span>{selectedReview.createdAt}</span>
                  </div>

                  <a
                    href="#"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#eaedff] text-[#131b2e] text-[11px] font-semibold hover:bg-[#eaedff] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px] text-[#006b2c]">merge</span>
                    <span>{selectedReview.prNumber}</span>
                    <span className="text-[#6e7b6c]">•</span>
                    <span className="font-mono text-[#6e7b6c]">{selectedReview.branch}</span>
                  </a>

                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7ffc97]/50 text-[#005320] text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>18/18 checks passed</span>
                  </div>
                </div>
              </div>

              {/* Main Drawer Section Body */}
              <div className="p-6 space-y-6">
                {/* SECTION 1: Description & Scope */}
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6e7b6c]">Description &amp; Scope</span>
                    <span className="text-[11px] text-[#006b2c] font-bold">Spec v2.4 Compliant</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#f2f3ff] text-[#131b2e] text-sm leading-relaxed border border-[#eaedff]">
                    {selectedReview.description || 'Replaced legacy checkout components with modernized and verified architecture specs.'}
                  </div>

                  {/* Acceptance Criteria Checklist Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    {(selectedReview.acceptanceCriteria || [
                      '3DS Fallback verified',
                      'Zero layout shift',
                      'WCAG AA contrast',
                    ]).map((crit, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-[#eaedff] shadow-2xs">
                        <span className="material-symbols-outlined text-[16px] text-[#006b2c] font-bold">check</span>
                        <span className="text-xs font-semibold text-[#131b2e] truncate">{crit}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SECTION 2: Attached Deliverables & Artifacts */}
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6e7b6c]">
                      Attached Deliverables &amp; Artifacts ({selectedReview.artifacts?.length || 3})
                    </span>
                    <span className="text-[11px] text-[#6e7b6c]">All sandboxed</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Item 1: Figma Prototype */}
                    <div className="p-3.5 rounded-xl bg-white border border-[#eaedff] shadow-xs flex items-center justify-between group hover:border-[#006b2c]/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#dbe1ff] flex items-center justify-center text-[#0051d5]">
                          <span className="material-symbols-outlined text-[22px]">design_services</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors">
                              Stripe-Elements-Checkout-v2.fig
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#dbe1ff] text-[#00174b] uppercase tracking-wider font-bold">
                              Figma
                            </span>
                          </div>
                          <span className="text-xs text-[#6e7b6c]">Interactive Prototype • 24 artboards • Mobile &amp; Desktop</span>
                        </div>
                      </div>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          showToast('Opened Figma Prototype workspace tab.');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f2f3ff] text-[#006b2c] text-xs font-semibold hover:bg-[#eaedff] transition-colors border border-[#eaedff]"
                      >
                        <span>Open in Figma</span>
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                    </div>

                    {/* Item 2: Screen Recording / Loom Preview */}
                    <div className="p-3.5 rounded-xl bg-white border border-[#eaedff] shadow-xs flex items-center justify-between group hover:border-[#006b2c]/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#ffdcc3] flex items-center justify-center text-[#8d4b00]">
                          <span className="material-symbols-outlined text-[22px]">smart_display</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors">
                              checkout-payment-flow-demo.mp4
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#ffdcc3] text-[#2f1500] uppercase tracking-wider font-bold">
                              Loom Video
                            </span>
                          </div>
                          <span className="text-xs text-[#6e7b6c]">14.2 MB • Recorded with Loom • 02:45 walkthrough</span>
                        </div>
                      </div>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          showToast('Launching video preview player.');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-xs font-semibold hover:bg-[#eaedff] transition-colors border border-[#eaedff]"
                      >
                        <span>Watch Preview</span>
                        <span className="material-symbols-outlined text-[14px]">play_circle</span>
                      </a>
                    </div>

                    {/* Item 3: Test Benchmark PDF */}
                    <div className="p-3.5 rounded-xl bg-white border border-[#eaedff] shadow-xs flex items-center justify-between group hover:border-[#006b2c]/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#6e7b6c]">
                          <span className="material-symbols-outlined text-[22px]">description</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors">
                              benchmark-elements-mount.pdf
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#eaedff] text-[#131b2e] uppercase tracking-wider font-bold">
                              Telemetry
                            </span>
                          </div>
                          <span className="text-xs text-[#6e7b6c]">840 KB • Lighthouse 98/100 • DOM Render &lt; 42ms</span>
                        </div>
                      </div>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          showToast('Opening Telemetry PDF inspection.');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-xs font-semibold hover:bg-[#eaedff] transition-colors border border-[#eaedff]"
                      >
                        <span>Inspect PDF</span>
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                      </a>
                    </div>
                  </div>
                </section>

                {/* SECTION 3: Lead Reviewer Feedback Form */}
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6e7b6c]">
                      Lead Review Feedback
                    </span>
                    <span className="text-[11px] text-[#006b2c] font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">edit_note</span>
                      Markdown supported
                    </span>
                  </div>

                  {/* Quick feedback template chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddFeedbackChip('LGTM! Smooth flow')}
                      className="px-2.5 py-1 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#3e4a3d] hover:text-[#131b2e] text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-[#eaedff]"
                    >
                      <span className="material-symbols-outlined text-[13px] text-[#006b2c]">add</span>
                      <span>LGTM! Smooth flow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddFeedbackChip('Verify mobile Safari touch target')}
                      className="px-2.5 py-1 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#3e4a3d] hover:text-[#131b2e] text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-[#eaedff]"
                    >
                      <span className="material-symbols-outlined text-[13px] text-[#006b2c]">add</span>
                      <span>Verify mobile Safari touch target</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddFeedbackChip('Check 3DS timeout error handling')}
                      className="px-2.5 py-1 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#3e4a3d] hover:text-[#131b2e] text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-[#eaedff]"
                    >
                      <span className="material-symbols-outlined text-[13px] text-[#006b2c]">add</span>
                      <span>Check 3DS timeout error handling</span>
                    </button>
                  </div>

                  {/* Feedback Box Container */}
                  <div className="rounded-xl bg-[#f2f3ff] p-2 focus-within:ring-2 focus-within:ring-[#006b2c]/20 transition-all border border-[#eaedff]">
                    {/* Mini Formatting Utility Toolbar */}
                    <div className="flex items-center justify-between px-2 pb-2 text-[#6e7b6c]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFeedbackText((prev) => `${prev} **bold**`)}
                          className="p-1 rounded hover:bg-[#eaedff] transition-colors cursor-pointer"
                          title="Bold"
                        >
                          <span className="material-symbols-outlined text-[18px]">format_bold</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedbackText((prev) => `${prev} \`code\``)}
                          className="p-1 rounded hover:bg-[#eaedff] transition-colors cursor-pointer"
                          title="Code snippet"
                        >
                          <span className="material-symbols-outlined text-[18px]">code</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedbackText((prev) => `${prev}\n- `)}
                          className="p-1 rounded hover:bg-[#eaedff] transition-colors cursor-pointer"
                          title="Bullet list"
                        >
                          <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                        </button>
                        <div className="w-px h-3.5 bg-[#bdcaba]/40 mx-1"></div>
                        <button
                          type="button"
                          onClick={() => setFeedbackText((prev) => `${prev} @${selectedReview.assignee.name} `)}
                          className="px-2 py-0.5 rounded hover:bg-[#eaedff] text-[11px] font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="text-[#006b2c] font-bold">@</span>
                          <span>{selectedReview.assignee.name.split(' ')[0]}</span>
                        </button>
                      </div>
                      <span className="text-[11px] text-[#6e7b6c]">Auto-saved draft</span>
                    </div>

                    {/* The Textarea */}
                    <textarea
                      rows={4}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={`Provide actionable feedback, suggest revisions, or leave approval notes for ${selectedReview.assignee.name}...`}
                      className="w-full p-3 rounded-lg bg-white text-sm text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none resize-none transition-all shadow-xs border border-[#eaedff]"
                    ></textarea>
                  </div>
                </section>
              </div>
            </div>

            {/* SECTION 4: Sticky Action Decision Footer */}
            <div className="p-4 bg-white border-t border-[#eaedff] shadow-xl flex flex-col gap-2 z-10">
              {/* Action Decision Controls Row */}
              <div className="grid grid-cols-12 gap-2">
                {/* Primary Green: Approve Deliverable */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('approved')}
                  className="col-span-6 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#006b2c] text-white text-xs font-bold hover:bg-[#00873a] active:scale-[0.98] transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
                  <span>Approve Deliverable</span>
                </button>

                {/* Amber: Request Changes */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('changes_requested')}
                  className="col-span-4 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#b15f00] text-white text-xs font-bold hover:opacity-95 active:scale-[0.98] transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">published_with_changes</span>
                  <span>Request Changes</span>
                </button>

                {/* Muted Ghost Red: Reject */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('rejected')}
                  className="col-span-2 flex items-center justify-center py-2.5 px-2 rounded-xl text-[#ba1a1a] bg-[#ffdad6] hover:bg-[#ba1a1a] hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  title="Reject Review"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  <span className="ml-1 hidden xl:inline">Reject</span>
                </button>
              </div>

              {/* Audit & Notification Dispatch Helper Message */}
              <div className="flex items-center justify-between text-[#6e7b6c] text-[11px] pt-1 px-1">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#006b2c]">send</span>
                  <span>
                    Dispatches async notice to <strong className="text-[#131b2e]">#reviews-feed</strong> &amp; {selectedReview.assignee.name} via DM.
                  </span>
                </span>
                <span className="font-mono text-[#6e7b6c]">{selectedReview.id.toUpperCase()}</span>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Floating Status Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#131b2e] text-white shadow-2xl text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <span className={`material-symbols-outlined text-[20px] ${toastMessage.isSuccess ? 'text-[#7ffc97]' : 'text-[#ffb77d]'}`}>
            {toastMessage.isSuccess ? 'check_circle' : 'info'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
