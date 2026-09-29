import React, { useState, useEffect, useMemo } from 'react';
import { User, Role } from '../../types';
import { updateUserProfileRecord, supabase } from '../../lib/supabase';

interface ProfileSettingsViewProps {
  currentUser: User;
  onOpenPhotoModal: () => void;
  onUpdateUser: (updated: Partial<User>) => void;
  onRemovePhoto: () => void;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  currentUser,
  onOpenPhotoModal,
  onUpdateUser,
  onRemovePhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'work' | 'skills' | 'preferences' | 'security'>('personal');

  // Form states initialized with currentUser data
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(currentUser.dateOfBirth || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [timezone, setTimezone] = useState(currentUser.timezone || 'UTC-7 (Pacific)');
  
  // Work & Role states
  const [roleTitle, setRoleTitle] = useState(currentUser.roleTitle || '');
  const [department, setDepartment] = useState(currentUser.department || '');
  const [role, setRole] = useState<Role>(currentUser.role);

  // About & Skills states
  const [bio, setBio] = useState(currentUser.bio || '');
  const [skills, setSkills] = useState<string[]>(currentUser.skills || []);
  const [newSkillInput, setNewSkillInput] = useState('');

  // Social Links states
  const [github, setGithub] = useState(currentUser.socialLinks?.github || '');
  const [linkedin, setLinkedin] = useState(currentUser.socialLinks?.linkedin || '');
  const [portfolio, setPortfolio] = useState(currentUser.socialLinks?.portfolio || '');

  // Preferences & Theme states
  const [notifMentions, setNotifMentions] = useState(currentUser.notificationPreferences?.directMentions ?? true);
  const [notifTasks, setNotifTasks] = useState(currentUser.notificationPreferences?.taskStatusChanges ?? true);
  const [notifQna, setNotifQna] = useState(currentUser.notificationPreferences?.qnaReplies ?? false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(currentUser.theme || 'light');
  const [focusStatus, setFocusStatus] = useState(currentUser.status);

  // Status & Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [rlsError, setRlsError] = useState<string | null>(null);

  // Change Password Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessToast, setPasswordSuccessToast] = useState(false);
  const [passwordServerMessage, setPasswordServerMessage] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!currentPassword) {
      errs.current = 'Current password is required.';
    } else if (currentPassword.length < 6) {
      errs.current = 'Current password must be at least 6 characters.';
    }

    if (!newPassword) {
      errs.new = 'New password is required.';
    } else if (newPassword.length < 6) {
      errs.new = 'New password must be at least 6 characters.';
    } else if (newPassword === currentPassword) {
      errs.new = 'New password cannot be the same as your current password.';
    }

    if (!confirmPassword) {
      errs.confirm = 'Please confirm your new password.';
    } else if (confirmPassword !== newPassword) {
      errs.confirm = 'Passwords do not match.';
    }

    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsUpdatingPassword(true);
    setPasswordServerMessage(null);

    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          setPasswordServerMessage(`Supabase Auth error: ${error.message}`);
          setIsUpdatingPassword(false);
          return;
        }
      }

      // Success
      setPasswordSuccessToast(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccessToast(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1400);
    } catch (err: any) {
      setPasswordServerMessage(err.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Sync state whenever currentUser changes (e.g. persona switch)
  useEffect(() => {
    setName(currentUser.name);
    setPhone(currentUser.phone || '');
    setDateOfBirth(currentUser.dateOfBirth || '');
    setLocation(currentUser.location || '');
    setTimezone(currentUser.timezone || 'UTC-7 (Pacific)');
    setRoleTitle(currentUser.roleTitle || '');
    setDepartment(currentUser.department || '');
    setRole(currentUser.role);
    setBio(currentUser.bio || '');
    setSkills(currentUser.skills || []);
    setGithub(currentUser.socialLinks?.github || '');
    setLinkedin(currentUser.socialLinks?.linkedin || '');
    setPortfolio(currentUser.socialLinks?.portfolio || '');
    setNotifMentions(currentUser.notificationPreferences?.directMentions ?? true);
    setNotifTasks(currentUser.notificationPreferences?.taskStatusChanges ?? true);
    setNotifQna(currentUser.notificationPreferences?.qnaReplies ?? false);
    setTheme(currentUser.theme || 'light');
    setFocusStatus(currentUser.status);
    setRlsError(null);
  }, [currentUser]);

  // Form Validation Errors
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Full name is required.';
    } else if (name.trim().length < 2) {
      errs.name = 'Full name must be at least 2 characters.';
    }

    if (bio.length > 200) {
      errs.bio = 'Bio cannot exceed 200 characters.';
    }

    if (phone && !/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(phone)) {
      errs.phone = 'Please enter a valid phone number.';
    }

    if (github && !github.includes('github.com') && !/^[a-zA-Z0-9_-]+$/.test(github)) {
      errs.github = 'Enter a valid GitHub username or URL.';
    }

    if (linkedin && !linkedin.includes('linkedin.com') && !/^[a-zA-Z0-9_-]+$/.test(linkedin)) {
      errs.linkedin = 'Enter a valid LinkedIn username or URL.';
    }

    if (portfolio && !portfolio.startsWith('http://') && !portfolio.startsWith('https://') && !portfolio.includes('.')) {
      errs.portfolio = 'Enter a valid URL (e.g. https://myportfolio.com).';
    }

    return errs;
  }, [name, bio, phone, github, linkedin, portfolio]);

  const hasErrors = Object.keys(errors).length > 0;

  // Check if form is dirty (has changes from currentUser)
  const isDirty = useMemo(() => {
    if (name !== currentUser.name) return true;
    if ((phone || '') !== (currentUser.phone || '')) return true;
    if ((dateOfBirth || '') !== (currentUser.dateOfBirth || '')) return true;
    if ((location || '') !== (currentUser.location || '')) return true;
    if ((timezone || '') !== (currentUser.timezone || '')) return true;
    if ((roleTitle || '') !== (currentUser.roleTitle || '')) return true;
    if ((department || '') !== (currentUser.department || '')) return true;
    if (role !== currentUser.role) return true;
    if ((bio || '') !== (currentUser.bio || '')) return true;
    if (JSON.stringify(skills) !== JSON.stringify(currentUser.skills || [])) return true;
    if ((github || '') !== (currentUser.socialLinks?.github || '')) return true;
    if ((linkedin || '') !== (currentUser.socialLinks?.linkedin || '')) return true;
    if ((portfolio || '') !== (currentUser.socialLinks?.portfolio || '')) return true;
    if (notifMentions !== (currentUser.notificationPreferences?.directMentions ?? true)) return true;
    if (notifTasks !== (currentUser.notificationPreferences?.taskStatusChanges ?? true)) return true;
    if (notifQna !== (currentUser.notificationPreferences?.qnaReplies ?? false)) return true;
    if (theme !== (currentUser.theme || 'light')) return true;
    if (focusStatus !== currentUser.status) return true;

    return false;
  }, [
    name,
    phone,
    dateOfBirth,
    location,
    timezone,
    roleTitle,
    department,
    role,
    bio,
    skills,
    github,
    linkedin,
    portfolio,
    notifMentions,
    notifTasks,
    notifQna,
    theme,
    focusStatus,
    currentUser,
  ]);

  const handleAddSkill = () => {
    const val = newSkillInput.trim();
    if (!val || skills.includes(val)) return;
    setSkills([...skills, val]);
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSave = async () => {
    if (hasErrors || !isDirty) return;

    setIsSaving(true);
    setRlsError(null);

    const updates: Partial<User> = {
      name: name.trim(),
      phone: phone.trim(),
      dateOfBirth: dateOfBirth.trim(),
      location: location.trim(),
      timezone,
      roleTitle: roleTitle.trim(),
      department: department.trim(),
      bio: bio.trim(),
      skills,
      socialLinks: {
        github: github.trim(),
        linkedin: linkedin.trim(),
        portfolio: portfolio.trim(),
      },
      notificationPreferences: {
        directMentions: notifMentions,
        taskStatusChanges: notifTasks,
        qnaReplies: notifQna,
      },
      theme,
      status: focusStatus,
      ...(currentUser.role === 'admin' ? { role } : {}),
    };

    // 1. Enforce Row Level Security (RLS) via service layer
    const rlsResult = await updateUserProfileRecord(currentUser.id, currentUser, updates);

    if (!rlsResult.success) {
      setRlsError(rlsResult.error || 'Row Level Security policy rejected this update.');
      setIsSaving(false);
      return;
    }

    // 2. Propagate changes immediately to the entire app shell
    onUpdateUser(updates);

    setIsSaving(false);
    setSaveSuccessToast(true);
    setTimeout(() => {
      setSaveSuccessToast(false);
    }, 2500);
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col gap-1 pb-4 border-b border-[#eaedff]">
        <div className="flex items-center gap-2 text-xs text-[#6e7b6c]">
          <span>Workspace</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span>Settings</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#006b2c] font-semibold">My Profile</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">
              My Profile & Account Settings
            </h1>
            <p className="text-xs text-[#6e7b6c]">
              Manage your public team profile, pod details, work preferences, and security settings.
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <span className="px-2.5 py-1 rounded-full bg-[#eaedff] text-xs font-semibold text-[#006b2c] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
              Pod Sync: Active
            </span>
          </div>
        </div>
      </div>

      {/* Security alert banner if RLS error occurs */}
      {rlsError && (
        <div className="p-4 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs border border-[#ba1a1a]/30 flex items-start gap-2.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0 mt-0.5">security</span>
          <div>
            <span className="font-bold block">Security Policy Rejection</span>
            <p className="mt-0.5 leading-relaxed">{rlsError}</p>
          </div>
        </div>
      )}

      {/* Main 2-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Profile Identity Card (4 cols)                  */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] shadow-xs p-6 flex flex-col relative overflow-hidden">
            <div className="flex flex-col items-center text-center">
              {/* Circular Avatar with Presence Ring or Initials Fallback */}
              <div className="relative group">
                <div className="w-28 h-28 rounded-full overflow-hidden p-1 bg-[#ffffff] border border-[#eaedff] shadow-sm flex items-center justify-center">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#7ffc97] text-[#002109] flex items-center justify-center font-bold text-3xl">
                      {currentUser.initials}
                    </div>
                  )}
                </div>
                {/* Online status indicator */}
                <span className="absolute bottom-1 right-1.5 w-6 h-6 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs">
                  <span
                    className={`w-4 h-4 rounded-full ${
                      focusStatus === 'online'
                        ? 'bg-[#006b2c]'
                        : focusStatus === 'busy'
                        ? 'bg-[#ba1a1a]'
                        : focusStatus === 'away'
                        ? 'bg-[#8d4b00]'
                        : 'bg-[#6e7b6c]'
                    }`}
                  ></span>
                </span>
              </div>

              {/* Avatar Actions */}
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenPhotoModal}
                  className="px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#eaedff] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#006b2c]">upload</span>
                  <span>Upload photo</span>
                </button>
                {currentUser.avatarUrl && (
                  <button
                    type="button"
                    onClick={onRemovePhoto}
                    className="px-2.5 py-1.5 rounded-xl text-[#6e7b6c] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20 text-xs transition-colors cursor-pointer font-medium"
                    title="Remove custom photo and reset to initials fallback"
                  >
                    Remove
                  </button>
                )}
              </div>
              <span className="text-[11px] text-[#6e7b6c] mt-1.5">
                JPG or PNG only · Max 2MB (Supabase Storage)
              </span>

              {/* Name & Role Identity */}
              <div className="mt-4 flex flex-col items-center">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xl font-bold text-[#131b2e]">{currentUser.name}</h2>
                  <span
                    className="material-symbols-outlined text-[#006b2c] text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    title="Verified workspace member"
                  >
                    verified
                  </span>
                </div>
                <p className="text-xs text-[#6e7b6c] mt-0.5">{currentUser.roleTitle}</p>
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#7ffc97]/40 text-[#005320] text-[11px] font-semibold">
                    Core Pod Member
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#f2f3ff] text-[#3e4a3d] text-[11px]">
                    {currentUser.department}
                  </span>
                </div>
              </div>

              {/* Focus Status Dropdown Selector */}
              <div className="w-full mt-4 text-left">
                <label className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-bold block mb-1">
                  Focus Status
                </label>
                <select
                  value={focusStatus}
                  onChange={(e) => setFocusStatus(e.target.value as any)}
                  className="w-full py-2 px-3 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="online">🟢 Available for syncs</option>
                  <option value="busy">🔴 Deep Focus (Busy)</option>
                  <option value="away">🟡 Away / Stepped out</option>
                  <option value="offline">⚪ Async only</option>
                </select>
              </div>
            </div>

            {/* Impact Metrics Summary */}
            <div className="mt-5 pt-4 border-t border-[#eaedff] space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[#3e4a3d]">
                <span className="flex items-center gap-1.5 text-[#6e7b6c]">
                  <span className="material-symbols-outlined text-[16px] text-[#006b2c]">task_alt</span>
                  Tasks completed
                </span>
                <span className="font-bold text-[#131b2e]">{currentUser.tasksCompleted}</span>
              </div>
              <div className="flex items-center justify-between text-[#3e4a3d]">
                <span className="flex items-center gap-1.5 text-[#6e7b6c]">
                  <span className="material-symbols-outlined text-[16px] text-[#0051d5]">forum</span>
                  Questions answered
                </span>
                <span className="font-bold text-[#131b2e]">{currentUser.questionsAnswered}</span>
              </div>
            </div>

            {/* Primary Workspace Details */}
            <div className="mt-4 p-3 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-left text-xs">
              <span className="text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block">
                Primary Workspace
              </span>
              <p className="font-bold text-[#131b2e] mt-0.5">Core Experience Pod</p>
              <p className="text-[11px] text-[#6e7b6c] mt-0.5 leading-relaxed">
                Cross-functional team leading Design Tokens, DS Components, and App Shell parity.
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Tabbed Multi-Section Form Stage (8 cols)       */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Navigation Tabs */}
          <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-1.5 flex items-center gap-1 shadow-xs overflow-x-auto no-scrollbar">
            {(['personal', 'work', 'skills', 'preferences', 'security'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize shrink-0 transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#006b2c] text-white shadow-xs'
                    : 'text-[#3e4a3d] hover:bg-[#f2f3ff]'
                }`}
              >
                {tab === 'skills' ? 'About & Skills' : tab}
              </button>
            ))}
          </div>

          {/* TAB 1: PERSONAL DETAILS */}
          {activeTab === 'personal' && (
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-6 shadow-xs flex flex-col gap-5">
              <div className="border-b border-[#eaedff] pb-3">
                <h2 className="text-sm font-bold text-[#131b2e]">Personal Details</h2>
                <p className="text-xs text-[#6e7b6c]">Information visible to teammates across TeamHub.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Full Legal Name */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#131b2e] mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First and last name"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs text-[#131b2e] focus:outline-none ${
                      errors.name ? 'border-[#ba1a1a] bg-[#ffdad6]/20' : 'bg-[#f2f3ff] border-[#eaedff] focus:bg-white'
                    }`}
                  />
                  {errors.name && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium mt-1 block">
                      {errors.name}
                    </span>
                  )}
                </div>

                {/* Work Email Address (READ-ONLY) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#131b2e]">Work Email Address</label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6e7b6c] bg-[#eaedff] px-2 py-0.5 rounded-full">
                      <span className="material-symbols-outlined text-[13px]">lock</span>
                      Read-only • Managed by Org
                    </span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#6e7b6c]">
                      mail
                    </span>
                    <input
                      type="email"
                      value={currentUser.email}
                      readOnly
                      className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#f2f3ff]/90 text-[#6e7b6c] border border-[#eaedff] cursor-not-allowed select-all"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold text-[#006b2c] bg-[#7ffc97]/50 px-2 py-0.5 rounded">
                      Primary SSO
                    </span>
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Phone Number</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#6e7b6c]">
                      phone
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 382-9014"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs text-[#131b2e] focus:outline-none ${
                        errors.phone ? 'border-[#ba1a1a] bg-[#ffdad6]/20' : 'bg-[#f2f3ff] border-[#eaedff] focus:bg-white'
                      }`}
                    />
                  </div>
                  {errors.phone && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium mt-1 block">{errors.phone}</span>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Date of Birth</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#6e7b6c]">
                      cake
                    </span>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Primary Location</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#6e7b6c]">
                      location_on
                    </span>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="San Francisco, CA (HQ)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                {/* Time Zone */}
                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Time Zone</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#6e7b6c]">
                      schedule
                    </span>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white cursor-pointer"
                    >
                      <option value="UTC-7 (Pacific)">Pacific Time (UTC-7 PDT)</option>
                      <option value="UTC-4 (EDT)">Eastern Time (UTC-4 EDT)</option>
                      <option value="UTC-5 (CDT)">Central Time (UTC-5 CDT)</option>
                      <option value="UTC+1 (BST)">British Summer Time (UTC+1 BST)</option>
                      <option value="UTC+2 (CEST)">Central European Time (UTC+2 CEST)</option>
                      <option value="UTC+5:30 (IST)">India Standard Time (UTC+5:30 IST)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[18px] text-[#6e7b6c] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORK & ROLE */}
          {activeTab === 'work' && (
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-6 shadow-xs flex flex-col gap-5 text-xs">
              <div className="border-b border-[#eaedff] pb-3">
                <h2 className="text-sm font-bold text-[#131b2e]">Work & Pod Alignment</h2>
                <p className="text-xs text-[#6e7b6c]">Internal organizational mapping and reporting structure.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Official Job Title */}
                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Official Designation</label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. Senior Product Designer"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block font-semibold text-[#131b2e] mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Core Engineering"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white"
                  />
                </div>

                {/* Role Tier (ADMINISTRATOR EDITABLE ONLY) */}
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-[#131b2e]">Role Tier & Permission Level</label>
                    {isAdmin ? (
                      <span className="text-[10px] font-bold text-[#006b2c] bg-[#7ffc97]/50 px-2 py-0.5 rounded">
                        Administrator Access Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6e7b6c] bg-[#eaedff] px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">lock</span>
                        Role is editable only by an Administrator
                      </span>
                    )}
                  </div>

                  {isAdmin ? (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(['member', 'lead', 'admin'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2 px-3 rounded-xl font-bold capitalize text-xs transition-all cursor-pointer ${
                            role === r
                              ? 'bg-[#006b2c] text-white shadow-xs'
                              : 'bg-white text-[#3e4a3d] hover:bg-[#eaedff] border border-[#eaedff]'
                          }`}
                        >
                          {r === 'admin' ? 'Administrator' : r === 'lead' ? 'Team Lead' : 'Team Member'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-sm capitalize text-[#131b2e]">
                        {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'lead' ? 'Team Lead' : 'Team Member'}
                      </span>
                      <span className="text-[11px] text-[#6e7b6c]">
                        Contact workspace admin to elevate permissions
                      </span>
                    </div>
                  )}
                </div>

                {/* Read-Only: Date Joined */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#131b2e]">Date Joined</label>
                    <span className="text-[10px] text-[#6e7b6c] font-bold">Read-only</span>
                  </div>
                  <input
                    type="text"
                    value={currentUser.dateJoined || 'October 12, 2021'}
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff]/90 text-[#6e7b6c] border border-[#eaedff] cursor-not-allowed"
                  />
                </div>

                {/* Read-Only: Reporting Lead */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#131b2e]">Reporting Lead</label>
                    <span className="text-[10px] text-[#6e7b6c] font-bold">Read-only</span>
                  </div>
                  <input
                    type="text"
                    value={currentUser.reportingLead || 'David Kim (Staff Engineering Lead)'}
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff]/90 text-[#6e7b6c] border border-[#eaedff] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT & SKILLS */}
          {activeTab === 'skills' && (
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-6 shadow-xs flex flex-col gap-5 text-xs">
              <div className="border-b border-[#eaedff] pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#131b2e]">About & Core Proficiencies</h2>
                  <p className="text-xs text-[#6e7b6c]">
                    Summarize your background (max 200 characters) and tag specializations.
                  </p>
                </div>
                <span
                  className={`text-xs font-bold ${
                    bio.length > 200 ? 'text-[#ba1a1a]' : 'text-[#6e7b6c]'
                  }`}
                >
                  {bio.length} / 200
                </span>
              </div>

              {/* Bio Field */}
              <div>
                <label className="block font-semibold text-[#131b2e] mb-1">Short Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell teammates what you focus on and what questions to route to you..."
                  className={`w-full p-3.5 rounded-xl border text-xs text-[#131b2e] focus:outline-none resize-none leading-relaxed ${
                    errors.bio ? 'border-[#ba1a1a] bg-[#ffdad6]/20' : 'bg-[#f2f3ff] border-[#eaedff] focus:bg-white'
                  }`}
                />
                {errors.bio && (
                  <span className="text-[11px] text-[#ba1a1a] font-medium mt-1 block">{errors.bio}</span>
                )}
              </div>

              {/* Skills Tags Cloud */}
              <div>
                <label className="block font-semibold text-[#131b2e] mb-1.5">Skills & Specializations</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7ffc97]/30 text-[#005320] text-xs font-semibold border border-[#7ffc97]"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-[#ba1a1a] cursor-pointer"
                        title="Remove skill"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 max-w-sm">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Add a skill (e.g. Tailwind, A11y, GraphQL)..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3.5 py-2 bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Social Links Section */}
              <div className="pt-3 border-t border-[#eaedff] space-y-3">
                <span className="text-xs font-bold text-[#131b2e] block">Social & Connected Links</span>

                <div>
                  <label className="block text-[11px] font-semibold text-[#6e7b6c] mb-1">GitHub</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2 text-[17px] text-[#6e7b6c]">
                      code
                    </span>
                    <input
                      type="text"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      placeholder="github.com/username"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs focus:outline-none focus:bg-white"
                    />
                  </div>
                  {errors.github && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium mt-0.5 block">{errors.github}</span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#6e7b6c] mb-1">LinkedIn</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2 text-[17px] text-[#6e7b6c]">
                      work
                    </span>
                    <input
                      type="text"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs focus:outline-none focus:bg-white"
                    />
                  </div>
                  {errors.linkedin && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium mt-0.5 block">{errors.linkedin}</span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#6e7b6c] mb-1">Portfolio / Personal Website</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2 text-[17px] text-[#6e7b6c]">
                      language
                    </span>
                    <input
                      type="url"
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      placeholder="https://mywebsite.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs focus:outline-none focus:bg-white"
                    />
                  </div>
                  {errors.portfolio && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium mt-0.5 block">{errors.portfolio}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PREFERENCES & THEME */}
          {activeTab === 'preferences' && (
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-6 shadow-xs flex flex-col gap-5 text-xs">
              <div className="border-b border-[#eaedff] pb-3">
                <h2 className="text-sm font-bold text-[#131b2e]">Notification Preferences & Theme</h2>
                <p className="text-xs text-[#6e7b6c]">Customize trigger alerts and appearance mode.</p>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-3">
                <span className="font-bold text-xs text-[#131b2e] block">Notification Triggers</span>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
                  <div>
                    <span className="font-bold text-xs text-[#131b2e] block">Direct Mentions & Pod Tags</span>
                    <span className="text-[11px] text-[#6e7b6c]">Receive alerts whenever someone @mentions you.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifMentions}
                    onChange={(e) => setNotifMentions(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#006b2c] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
                  <div>
                    <span className="font-bold text-xs text-[#131b2e] block">Task Status Changes</span>
                    <span className="text-[11px] text-[#6e7b6c]">Alert me when tasks I authored or review transition state.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifTasks}
                    onChange={(e) => setNotifTasks(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#006b2c] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
                  <div>
                    <span className="font-bold text-xs text-[#131b2e] block">Q&A Knowledge Replies</span>
                    <span className="text-[11px] text-[#6e7b6c]">Notify when answers are proposed to questions in followed tags.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifQna}
                    onChange={(e) => setNotifQna(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#006b2c] cursor-pointer"
                  />
                </div>
              </div>

              {/* Theme Mode Selector */}
              <div className="pt-3 border-t border-[#eaedff]">
                <span className="font-bold text-xs text-[#131b2e] block mb-2">Theme Mode</span>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-[#006b2c] bg-[#ffffff] shadow-xs text-[#006b2c] font-bold'
                        : 'border-[#eaedff] bg-[#f2f3ff] text-[#6e7b6c] hover:bg-[#eaedff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">light_mode</span>
                    <span>Calm Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-[#006b2c] bg-[#ffffff] shadow-xs text-[#006b2c] font-bold'
                        : 'border-[#eaedff] bg-[#f2f3ff] text-[#6e7b6c] hover:bg-[#eaedff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">dark_mode</span>
                    <span>Midnight</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      theme === 'system'
                        ? 'border-[#006b2c] bg-[#ffffff] shadow-xs text-[#006b2c] font-bold'
                        : 'border-[#eaedff] bg-[#f2f3ff] text-[#6e7b6c] hover:bg-[#eaedff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">desktop_windows</span>
                    <span>System Match</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY */}
          {activeTab === 'security' && (
            <div className="bg-[#ffffff] rounded-2xl border border-[#eaedff] p-6 shadow-xs flex flex-col gap-4 text-xs">
              <div className="border-b border-[#eaedff] pb-3">
                <h2 className="text-sm font-bold text-[#131b2e]">Security & Authentication</h2>
                <p className="text-xs text-[#6e7b6c]">Control active devices, session keys, and authentication methods.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#7ffc97]/20 border border-[#7ffc97]/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-[24px] text-[#006b2c]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    security
                  </span>
                  <div>
                    <span className="font-bold text-[#131b2e] block text-xs">Two-Factor Authentication (2FA)</span>
                    <span className="text-[11px] text-[#005320]">FIDO2 Hardware Key + Authenticator App verified</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#006b2c] text-white font-bold text-[10px]">
                  Active
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#f2f3ff] flex items-center justify-between border border-[#eaedff]">
                <div>
                  <span className="font-bold text-[#131b2e] block">Master Password</span>
                  <span className="text-[11px] text-[#6e7b6c]">Last updated 45 days ago</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setPasswordErrors({});
                    setPasswordServerMessage(null);
                    setPasswordSuccessToast(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#eaedff] text-xs font-semibold text-[#131b2e] hover:bg-[#eaedff] cursor-pointer transition-colors shadow-2xs"
                >
                  Change Password
                </button>
              </div>
            </div>
          )}

          {/* STICKY SAVE CHANGES FOOTER BAR */}
          <div className="sticky bottom-6 z-20 bg-[#ffffff]/95 backdrop-blur-md border border-[#eaedff] rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  hasErrors ? 'bg-[#ba1a1a]' : isDirty ? 'bg-[#b15f00] animate-pulse' : 'bg-[#006b2c]'
                }`}
              ></span>
              <span className="text-[#3e4a3d]">
                {hasErrors
                  ? 'Please resolve inline validation errors'
                  : isDirty
                  ? 'You have unsaved changes'
                  : 'All changes synchronized'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setName(currentUser.name);
                  setPhone(currentUser.phone || '');
                  setDateOfBirth(currentUser.dateOfBirth || '');
                  setLocation(currentUser.location || '');
                  setTimezone(currentUser.timezone || 'UTC-7 (Pacific)');
                  setRoleTitle(currentUser.roleTitle || '');
                  setDepartment(currentUser.department || '');
                  setRole(currentUser.role);
                  setBio(currentUser.bio || '');
                  setSkills(currentUser.skills || []);
                  setGithub(currentUser.socialLinks?.github || '');
                  setLinkedin(currentUser.socialLinks?.linkedin || '');
                  setPortfolio(currentUser.socialLinks?.portfolio || '');
                  setFocusStatus(currentUser.status);
                }}
                disabled={!isDirty || isSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e7b6c] hover:bg-[#f2f3ff] transition-colors cursor-pointer disabled:opacity-40"
              >
                Discard
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || hasErrors || isSaving}
                className="px-5 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  !isDirty
                    ? 'No changes to save'
                    : hasErrors
                    ? 'Fix form validation errors to save'
                    : 'Save changes to Supabase'
                }
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isSaving ? 'sync' : 'check'}
                </span>
                <span>{isSaving ? 'Saving changes...' : 'Save changes'}</span>
              </button>
            </div>
          </div>

          {/* Success Toast */}
          {saveSuccessToast && (
            <div className="p-3.5 rounded-2xl bg-[#006b2c] text-white text-xs font-semibold flex items-center gap-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Profile updated successfully! Name and photo are now synced across all channels, tasks, and boards.</span>
            </div>
          )}

          {/* Change Password Modal */}
          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#eaedff] relative">
                <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#006b2c] text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#131b2e]">Change Master Password</h2>
                      <p className="text-[11px] text-[#6e7b6c]">Powered by Supabase Auth</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="p-1 rounded-lg text-[#6e7b6c] hover:bg-[#f2f3ff] hover:text-[#131b2e] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {passwordSuccessToast ? (
                  <div className="py-8 text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-[#7ffc97] text-[#002109] flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[28px]">check_circle</span>
                    </div>
                    <span className="text-sm font-bold text-[#131b2e]">Password Updated Successfully</span>
                    <p className="text-xs text-[#6e7b6c] mt-1">Your new credentials have been updated via Supabase Auth.</p>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3.5 text-xs">
                    {passwordServerMessage && (
                      <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                        {passwordServerMessage}
                      </div>
                    )}

                    <div>
                      <label className="block font-semibold text-[#131b2e] mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white focus:border-[#006b2c]"
                      />
                      {passwordErrors.current && (
                        <span className="text-[11px] text-[#ba1a1a] mt-0.5 block">{passwordErrors.current}</span>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#131b2e] mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white focus:border-[#006b2c]"
                      />
                      {passwordErrors.new && (
                        <span className="text-[11px] text-[#ba1a1a] mt-0.5 block">{passwordErrors.new}</span>
                      )}
                      <span className="text-[10px] text-[#6e7b6c] mt-0.5 block">Minimum 6 characters</span>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#131b2e] mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white focus:border-[#006b2c]"
                      />
                      {passwordErrors.confirm && (
                        <span className="text-[11px] text-[#ba1a1a] mt-0.5 block">{passwordErrors.confirm}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(false)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6e7b6c] hover:bg-[#f2f3ff] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="px-4 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isUpdatingPassword ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                            <span>Updating...</span>
                          </>
                        ) : (
                          <span>Update Password</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
