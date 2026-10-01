import React, { useState } from 'react';
import { Role, User } from '../../types';
import { 
  signInWithSupabaseAuth, 
  signUpWithSupabaseAuth, 
  isSupabaseConfigured, 
  supabase,
  generatePodCode,
  validatePodCode,
  createWorkspaceRecord
} from '../../lib/supabase';

interface AuthViewProps {
  onSuccess: (user: User) => void;
  onWaitingApproval: () => void;
  knownUsers?: Record<string, User>;
}

interface DefaultChannel {
  id: string;
  name: string;
  desc: string;
  tag?: string;
  isMandatory?: boolean;
}

const INITIAL_ADMIN_CHANNELS: DefaultChannel[] = [
  {
    id: 'general',
    name: 'general',
    desc: 'Company-wide announcements and team chat',
    tag: 'Mandatory',
    isMandatory: true,
  },
];

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, onWaitingApproval, knownUsers }) => {
  // Global auth mode & role
  const [isSignUp, setIsSignUp] = useState(false); // Default to login screen
  const [selectedRole, setSelectedRole] = useState<Role>('member');

  // Standard Login fields
  const [loginEmail, setLoginEmail] = useState('sarah.c@teamhub.internal');
  const [loginPassword, setLoginPassword] = useState('Password123!');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ==========================================
  // Team Member Sign-Up Form States
  // ==========================================
  const [memberName, setMemberName] = useState('Alex Morgan');
  const [memberEmail, setMemberEmail] = useState('alex.morgan@company.com');
  const [memberPassword, setMemberPassword] = useState('Password123!');
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [memberInviteCode, setMemberInviteCode] = useState('POD-DES-4821');
  const [memberInviteError, setMemberInviteError] = useState<string | null>(null);

  // ==========================================
  // Administrator Sign-Up 3-Step Wizard States
  // ==========================================
  const [adminStep, setAdminStep] = useState<1 | 2 | 3 | 4>(1);
  const [adminName, setAdminName] = useState('Alex Morgan');
  const [adminEmail, setAdminEmail] = useState('alex.morgan@acme.corp');
  const [adminPassword, setAdminPassword] = useState('K9#mQx!v89L$wR');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [generatedPodCode, setGeneratedPodCode] = useState('');
  const [podCodeCopied, setPodCodeCopied] = useState(false);
  const [finalAdminUser, setFinalAdminUser] = useState<User | null>(null);

  // Step 2: Workspace Identity
  const [wsName, setWsName] = useState('Acme Engineering');
  const [wsTeamFunction, setWsTeamFunction] = useState<'engineering' | 'design' | 'cross-functional'>('engineering');
  const [wsDesc, setWsDesc] = useState(
    'Core product engineering, platform infrastructure, and weekly sprint planning space for the distributed Acme technology division.'
  );
  const [slugCopied, setSlugCopied] = useState(false);

  // Step 3: Default Channels
  const [channels, setChannels] = useState<DefaultChannel[]>(INITIAL_ADMIN_CHANNELS);
  const [newChannelInput, setNewChannelInput] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [createdAdminUser, setCreatedAdminUser] = useState<User | null>(null);

  // ==========================================
  // Team Lead Sign-Up Form States
  // ==========================================
  const [leadName, setLeadName] = useState('Taylor Brooks');
  const [leadEmail, setLeadEmail] = useState('taylor.brooks@layerstack.io');
  const [leadPassword, setLeadPassword] = useState('SecurePassword123!');
  const [showLeadPassword, setShowLeadPassword] = useState(false);
  const [leadInviteCode, setLeadInviteCode] = useState('LEAD-POD9-742X');
  const [leadInviteError, setLeadInviteError] = useState<string | null>(null);

  // Calculate live workspace slug
  const wsSlug = wsName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace-name';

  // Handle role tab change on login / regular signup
  const handleRoleTabChange = (role: Role) => {
    setSelectedRole(role);
    setErrorMessage(null);
    setMemberInviteError(null);
    setLeadInviteError(null);

    if (!isSignUp) {
      if (role === 'admin') {
        setLoginEmail('admin@teamhub.internal');
      } else if (role === 'lead') {
        setLoginEmail('david.k@teamhub.internal');
      } else {
        setLoginEmail('sarah.c@teamhub.internal');
      }
    } else if (role === 'admin') {
      setAdminStep(1);
    } else if (role === 'lead') {
      setLeadName('Taylor Brooks');
      setLeadEmail('taylor.brooks@layerstack.io');
      setLeadPassword('SecurePassword123!');
      setLeadInviteCode('LEAD-POD9-742X');
    } else if (role === 'member') {
      setMemberName('Alex Morgan');
      setMemberEmail('alex.morgan@company.com');
      setMemberPassword('Password123!');
      setMemberInviteCode('POD-DES-4821');
    }
  };

  // Sign In submit handler
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await signInWithSupabaseAuth(loginEmail, loginPassword, selectedRole, knownUsers);

      if (!result.success || !result.user) {
        setErrorMessage(result.error || 'Invalid email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      onSuccess(result.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your connection.');
      setIsLoading(false);
    }
  };

  // Team Member sign up submit handler
  const handleMemberSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMemberInviteError(null);

    const trimmedCode = memberInviteCode.trim().toUpperCase();

    // Invite code required validation
    if (!trimmedCode) {
      setMemberInviteError('Workspace invite code is required.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Validate entered invite code against real pod codes in Supabase
      const valResult = await validatePodCode(trimmedCode);
      if (!valResult.valid) {
        setMemberInviteError(valResult.error || "This invite code isn't valid or has expired — check with your pod lead or administrator.");
        setIsLoading(false);
        return;
      }

      // 2. Real Supabase Auth signUp() call with validated pod code & workspace
      const result = await signUpWithSupabaseAuth(
        memberEmail.trim(),
        memberPassword,
        memberName.trim() || 'Alex Morgan',
        'member', // Role correctly set to "member"
        trimmedCode
      );

      if (result.waitingApproval) {
        onWaitingApproval();
        return;
      }

      if (!result.success || !result.user) {
        setMemberInviteError(result.error || 'Failed to validate invite code or create account.');
        setIsLoading(false);
        return;
      }

      onSuccess(result.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Team Member account creation failed.');
      setIsLoading(false);
    }
  };

  // Team Lead sign up submit handler
  const handleLeadSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLeadInviteError(null);

    const trimmedCode = leadInviteCode.trim().toUpperCase();

    // Invite code required validation
    if (!trimmedCode) {
      setLeadInviteError('Workspace invite code is required.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Validate entered invite code against real pod codes in Supabase
      const valResult = await validatePodCode(trimmedCode);
      if (!valResult.valid) {
        setLeadInviteError(valResult.error || "This invite code isn't valid or has expired — check with your workspace administrator.");
        setIsLoading(false);
        return;
      }

      // 2. Real Supabase Auth signUp() call with validated pod code & workspace
      const result = await signUpWithSupabaseAuth(
        leadEmail.trim(),
        leadPassword,
        leadName.trim() || 'Taylor Brooks',
        'lead', // Role correctly set to "lead"
        trimmedCode
      );

      if (result.waitingApproval) {
        onWaitingApproval();
        return;
      }

      if (!result.success || !result.user) {
        setLeadInviteError(result.error || 'Failed to validate invite code or create account.');
        setIsLoading(false);
        return;
      }

      onSuccess(result.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Team Lead account creation failed.');
      setIsLoading(false);
    }
  };

  // Google SSO helper
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const googleEmail =
      selectedRole === 'admin'
        ? 'admin@teamhub.internal'
        : selectedRole === 'lead'
        ? 'david.k@teamhub.internal'
        : 'sarah.c@teamhub.internal';

    const result = await signInWithSupabaseAuth(googleEmail, 'GoogleAuthToken', selectedRole, knownUsers);
    if (result.success && result.user) {
      onSuccess(result.user);
    } else {
      setErrorMessage('Google SSO sign in failed');
      setIsLoading(false);
    }
  };

  // ==========================================
  // Admin Wizard Step Transitions & Logic
  // ==========================================
  const handleAdminStep1Continue = async () => {
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setErrorMessage('Please enter your full name, work email, and master password.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await signUpWithSupabaseAuth(
        adminEmail,
        adminPassword,
        adminName,
        'admin'
      );

      if (!result.success || !result.user) {
        setErrorMessage(result.error || 'Failed to create administrator account.');
        setIsLoading(false);
        return;
      }

      setCreatedAdminUser(result.user);
      setIsLoading(false);
      setAdminStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to proceed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  const handleAdminStep2Continue = async () => {
    if (!wsName.trim()) {
      setErrorMessage('Please enter a workspace name.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (supabase) {
        try {
          await supabase.from('workspaces').upsert({
            name: wsName.trim(),
            slug: wsSlug,
            description: wsDesc,
            team_function: wsTeamFunction,
            admin_email: adminEmail,
            created_at: new Date().toISOString(),
          });
        } catch (wsErr) {
          console.info('Supabase workspace table record notice:', wsErr);
        }
      }

      try {
        localStorage.setItem(
          'teamhub_workspace',
          JSON.stringify({
            name: wsName.trim(),
            slug: wsSlug,
            description: wsDesc,
            teamFunction: wsTeamFunction,
            adminEmail,
          })
        );
      } catch (storageErr) {
        // ignore
      }

      setIsLoading(false);
      setAdminStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save workspace details.');
      setIsLoading(false);
    }
  };

  const handleAdminStep3Launch = async () => {
    setErrorMessage(null);
    setIsLaunching(true);

    try {
      // 1. Automatically generate a unique pod code in format TH-####-XXX
      const code = generatePodCode(wsTeamFunction);

      // 2. Store workspace record linked with the pod code in Supabase & local storage
      await createWorkspaceRecord({
        name: wsName.trim(),
        slug: wsSlug,
        description: wsDesc,
        team_function: wsTeamFunction,
        admin_id: createdAdminUser?.id,
        admin_email: adminEmail,
        pod_code: code,
      });

      // 3. Store initial channels
      if (supabase) {
        try {
          const channelRows = channels.map((ch) => ({
            name: ch.name,
            slug: ch.name,
            description: ch.desc,
            is_mandatory: ch.isMandatory || false,
            is_protected: ch.name === 'general',
            created_at: new Date().toISOString(),
          }));
          await supabase.from('channels').upsert(channelRows, { onConflict: 'workspace_id,slug' });
        } catch (chErr) {
          console.info('Supabase channels table record notice:', chErr);
        }
      }

      try {
        const formattedChannels = channels.map((c) => ({
          id: c.name,
          name: c.name,
          description: c.desc || 'Team discussion channel',
          unreadCount: 0,
          membersCount: 1,
          icon: c.name === 'general' ? 'campaign' : 'tag',
        }));
        localStorage.setItem('teamhub_channels', JSON.stringify(formattedChannels));
      } catch (storageErr) {
        // ignore
      }

      const activeUser: User = createdAdminUser
        ? {
            ...createdAdminUser,
            pod: wsName.trim(),
            podCode: code,
          }
        : {
            id: `user-${Date.now()}`,
            name: adminName,
            email: adminEmail,
            role: 'admin',
            roleTitle: 'Workspace Administrator',
            department: wsTeamFunction,
            pod: wsName.trim(),
            podCode: code,
            initials: adminName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2),
            status: 'online',
            location: 'San Francisco, CA (HQ)',
            timezone: 'UTC-7 (PDT)',
            tasksCompleted: 0,
            questionsAnswered: 0,
            lastActive: 'Just now',
            skills: ['Administration', 'Governance'],
          };

      setGeneratedPodCode(code);
      setFinalAdminUser(activeUser);
      setIsLaunching(false);
      // Advance to confirmation screen
      setAdminStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to finalize workspace launch.');
      setIsLaunching(false);
    }
  };

  const handleAddCustomChannel = () => {
    let clean = newChannelInput.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
    if (!clean) return;
    if (channels.some((c) => c.name === clean)) {
      setNewChannelInput('');
      return;
    }
    setChannels((prev) => [
      ...prev,
      {
        id: clean,
        name: clean,
        desc: 'Custom team discussion',
      },
    ]);
    setNewChannelInput('');
  };

  const handleRemoveChannel = (id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCopySlug = () => {
    const text = `https://teamhub.internal/${wsSlug}`;
    navigator.clipboard.writeText(text);
    setSlugCopied(true);
    setTimeout(() => setSlugCopied(false), 2000);
  };

  // ==========================================
  // VIEW: ADMINISTRATOR 3-STEP SIGN-UP WIZARD
  // ==========================================
  if (isSignUp && selectedRole === 'admin') {
    return (
      <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col justify-between selection:bg-[#7ffc97] selection:text-[#002109] relative overflow-x-hidden">
        <main className="w-full flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-8">
          <div className="flex flex-col w-full items-center justify-center py-4 relative">
            <div className="absolute w-[540px] h-[540px] bg-[#006b2c]/5 rounded-full blur-3xl pointer-events-none -top-12 -z-10"></div>
            <div className="absolute w-[400px] h-[400px] bg-[#dbe1ff]/30 rounded-full blur-2xl pointer-events-none -bottom-8 -z-10"></div>

            <div className="w-full max-w-2xl flex flex-col items-center">
              <div className="flex flex-col items-center text-center mb-6 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-[#006b2c] text-white flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[24px]">hub</span>
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-[#131b2e]">TeamHub</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7ffc97]/30 text-[#005320] text-xs font-semibold mb-2">
                  <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    shield_person
                  </span>
                  <span>Workspace Administrator Setup</span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#131b2e] mt-1 mb-1">
                  Create your TeamHub workspace
                </h1>
                <p className="text-sm text-[#3e4a3d] max-w-md">
                  Set up your admin credentials, workspace identity, and starting channels.
                </p>

                <div className="mt-3 flex items-center gap-2 text-xs text-[#6e7b6c]">
                  <span>Want to register as a teammate instead?</span>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('member')}
                    className="text-[#006b2c] font-semibold hover:underline cursor-pointer"
                  >
                    Member sign-up
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('lead')}
                    className="text-[#0051d5] font-semibold hover:underline cursor-pointer"
                  >
                    Team Lead sign-up
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 shadow-xs">
                  <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">error</span>
                  <div className="flex-1">
                    <span className="font-semibold block">Notice</span>
                    <span className="text-[11px] leading-snug">{errorMessage}</span>
                  </div>
                  <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}

              <div className="w-full bg-[#ffffff] rounded-2xl shadow-xl shadow-[#d2d9f4]/40 border border-[#eaedff] overflow-hidden">
                <div className="bg-[#f2f3ff] px-6 pt-6 pb-4 border-b border-[#eaedff]">
                  <div className="flex items-center justify-between gap-1.5 bg-[#ffffff] p-1 rounded-xl shadow-xs mb-3 border border-[#eaedff]">
                    <button
                      type="button"
                      onClick={() => setAdminStep(1)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        adminStep === 1
                          ? 'bg-[#006b2c] text-white shadow-xs'
                          : 'text-[#3e4a3d] hover:bg-[#eaedff]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          adminStep === 1 ? 'bg-white/20 text-white' : 'bg-[#dae2fd] text-[#3e4a3d]'
                        }`}
                      >
                        1
                      </span>
                      <span className="hidden sm:inline">Account</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (createdAdminUser || (adminName && adminEmail && adminPassword)) {
                          setAdminStep(2);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        adminStep === 2
                          ? 'bg-[#006b2c] text-white shadow-xs'
                          : 'text-[#3e4a3d] hover:bg-[#eaedff]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          adminStep === 2 ? 'bg-white/20 text-white' : 'bg-[#dae2fd] text-[#3e4a3d]'
                        }`}
                      >
                        2
                      </span>
                      <span className="hidden sm:inline">Workspace</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (wsName) {
                          setAdminStep(3);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        adminStep === 3
                          ? 'bg-[#006b2c] text-white shadow-xs'
                          : 'text-[#3e4a3d] hover:bg-[#eaedff]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          adminStep === 3 ? 'bg-white/20 text-white' : 'bg-[#dae2fd] text-[#3e4a3d]'
                        }`}
                      >
                        3
                      </span>
                      <span className="hidden sm:inline">Channels</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#3e4a3d] mb-1.5 px-0.5">
                    <span className="font-semibold text-[#131b2e]">
                      {adminStep === 1
                        ? 'Step 1 of 3: Account'
                        : adminStep === 2
                        ? 'Step 2 of 3: Workspace'
                        : adminStep === 3
                        ? 'Step 3 of 3: Channels'
                        : 'Onboarding Complete: Share Pod Code'}
                    </span>
                    <span className="text-[#006b2c] font-semibold">
                      {adminStep === 1 ? '33% Complete' : adminStep === 2 ? '66% Complete' : '100% Ready'}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-[#dae2fd] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#006b2c] transition-all duration-300 rounded-full"
                      style={{
                        width: adminStep === 1 ? '33.33%' : adminStep === 2 ? '66.66%' : '100%',
                      }}
                    ></div>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  {/* Step 1 */}
                  {adminStep === 1 && (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#006b2c]">
                              Step 1 of 3
                            </span>
                            <span className="text-[#3e4a3d] text-xs">•</span>
                            <span className="text-xs text-[#3e4a3d] font-medium">Account Details</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#006b2c]/10 text-[#006b2c] text-[11px] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              verified_user
                            </span>
                            Root Admin Role
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-[#131b2e]">Create your administrator profile</h2>
                        <p className="text-xs text-[#3e4a3d]">
                          Create your master administrator account with full governance, security controls, and workspace ownership.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] flex items-start gap-3">
                        <span
                          className="material-symbols-outlined text-[#006b2c] text-[20px] mt-0.5"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          info
                        </span>
                        <div className="flex-1 text-xs">
                          <p className="font-semibold text-[#131b2e]">No invite code required</p>
                          <p className="text-[#3e4a3d] mt-0.5">
                            As a workspace founder and root administrator, you are creating the instance directly.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[#131b2e] flex items-center justify-between" htmlFor="admin-name">
                            <span>Full Name</span>
                            <span className="text-[#6e7b6c] text-[11px] font-normal">Primary contact</span>
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[20px]">
                              badge
                            </span>
                            <input
                              id="admin-name"
                              type="text"
                              required
                              value={adminName}
                              onChange={(e) => setAdminName(e.target.value)}
                              placeholder="e.g. Alex Morgan"
                              className="w-full bg-[#ffffff] text-[#131b2e] text-xs pl-10 pr-4 py-2.5 rounded-xl shadow-xs border border-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[#131b2e] flex items-center justify-between" htmlFor="admin-email">
                            <span>Corporate Work Email</span>
                            <span className="inline-flex items-center gap-1 text-[#006b2c] text-[11px] font-medium">
                              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                check_circle
                              </span>
                              Verified Domain
                            </span>
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[20px]">
                              mail
                            </span>
                            <input
                              id="admin-email"
                              type="email"
                              required
                              value={adminEmail}
                              onChange={(e) => setAdminEmail(e.target.value)}
                              placeholder="name@company.com"
                              className="w-full bg-[#ffffff] text-[#131b2e] text-xs pl-10 pr-4 py-2.5 rounded-xl shadow-xs border border-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-[#131b2e]" htmlFor="admin-password">
                              Master Password
                            </label>
                            <span className="text-[11px] text-[#006b2c] font-semibold">Strong Password</span>
                          </div>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[20px]">
                              lock
                            </span>
                            <input
                              id="admin-password"
                              type={showAdminPassword ? 'text' : 'password'}
                              required
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              placeholder="Enter robust master password"
                              className="w-full bg-[#ffffff] text-[#131b2e] text-xs pl-10 pr-11 py-2.5 rounded-xl shadow-xs border border-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              title="Show or hide password"
                              className="absolute right-3 text-[#6e7b6c] hover:text-[#131b2e] transition-colors p-1"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {showAdminPassword ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          </div>

                          <div className="mt-1 flex flex-col gap-2">
                            <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                              <div className="bg-[#006b2c] rounded-full h-full"></div>
                              <div className="bg-[#006b2c] rounded-full h-full"></div>
                              <div className="bg-[#006b2c] rounded-full h-full"></div>
                              <div className="bg-[#006b2c] rounded-full h-full"></div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#3e4a3d]">
                              <span className="flex items-center gap-1 text-[#006b2c]">
                                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  check
                                </span>{' '}
                                12+ characters
                              </span>
                              <span className="flex items-center gap-1 text-[#006b2c]">
                                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  check
                                </span>{' '}
                                Upper &amp; lowercase
                              </span>
                              <span className="flex items-center gap-1 text-[#006b2c]">
                                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  check
                                </span>{' '}
                                Special symbol
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignUp(false);
                            setErrorMessage(null);
                          }}
                          className="text-xs text-[#3e4a3d] hover:text-[#131b2e] transition-colors order-2 sm:order-1 cursor-pointer"
                        >
                          Already have an account? <span className="text-[#006b2c] font-semibold">Log in</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAdminStep1Continue}
                          disabled={isLoading}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#006b2c] text-white font-semibold text-xs hover:bg-[#00873a] shadow-md flex items-center justify-center gap-2 transition-all order-1 sm:order-2 cursor-pointer disabled:opacity-60"
                        >
                          {isLoading ? (
                            <>
                              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                              <span>Creating Account...</span>
                            </>
                          ) : (
                            <>
                              <span>Continue to Workspace Setup</span>
                              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2 */}
                  {adminStep === 2 && (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#006b2c]">
                              Step 2 of 3
                            </span>
                            <span className="text-[#3e4a3d] text-xs">•</span>
                            <span className="text-xs text-[#3e4a3d] font-medium">Workspace Identity</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#dbe1ff]/60 text-[#00174b] text-[11px] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">domain</span>
                            Domain Architecture
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-[#131b2e]">Set up your workspace</h2>
                        <p className="text-xs text-[#3e4a3d]">
                          Name your organization hub and configure how members identify and join your space.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[#131b2e] flex items-center justify-between" htmlFor="ws-name">
                            <span>Workspace or Organization Name</span>
                            <span className="text-[#6e7b6c] text-[11px] font-normal">Public facing</span>
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[20px]">
                              corporate_fare
                            </span>
                            <input
                              id="ws-name"
                              type="text"
                              required
                              value={wsName}
                              onChange={(e) => setWsName(e.target.value)}
                              placeholder="e.g. Acme Engineering or Layerstack"
                              className="w-full bg-[#ffffff] text-[#131b2e] text-xs pl-10 pr-4 py-2.5 rounded-xl shadow-xs border border-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]"
                            />
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] flex flex-col gap-1.5">
                          <span className="text-[10px] text-[#6e7b6c] font-bold uppercase tracking-wider">
                            Internal Workspace Address
                          </span>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-[#131b2e]">
                              <span className="text-[#6e7b6c]">https://</span>
                              <span>teamhub.internal/</span>
                              <span className="font-semibold text-[#006b2c] bg-[#7ffc97]/40 px-2 py-0.5 rounded font-mono">
                                {wsSlug}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#006b2c] bg-[#ffffff] px-2 py-1 rounded-md shadow-xs border border-[#eaedff]">
                                <span className="material-symbols-outlined text-[14px]">lock</span> TLS Encrypted
                              </span>
                              <button
                                type="button"
                                onClick={handleCopySlug}
                                title="Copy URL"
                                className="p-1 text-[#6e7b6c] hover:text-[#131b2e] transition-colors cursor-pointer relative"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {slugCopied ? 'check' : 'content_copy'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-[#131b2e]">Primary Team Function</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setWsTeamFunction('engineering')}
                              className={`p-3 rounded-xl text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                wsTeamFunction === 'engineering'
                                  ? 'bg-[#006b2c] text-white shadow-xs'
                                  : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] border border-[#eaedff]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">code</span>
                              <span className="text-xs font-semibold">Engineering</span>
                              <span className={`text-[11px] ${wsTeamFunction === 'engineering' ? 'opacity-80' : 'text-[#6e7b6c]'}`}>
                                Pods &amp; codebases
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setWsTeamFunction('design')}
                              className={`p-3 rounded-xl text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                wsTeamFunction === 'design'
                                  ? 'bg-[#006b2c] text-white shadow-xs'
                                  : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] border border-[#eaedff]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">palette</span>
                              <span className="text-xs font-semibold">Design &amp; Creative</span>
                              <span className={`text-[11px] ${wsTeamFunction === 'design' ? 'opacity-80' : 'text-[#6e7b6c]'}`}>
                                Studios &amp; brand
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setWsTeamFunction('cross-functional')}
                              className={`p-3 rounded-xl text-left transition-all flex flex-col gap-1 cursor-pointer ${
                                wsTeamFunction === 'cross-functional'
                                  ? 'bg-[#006b2c] text-white shadow-xs'
                                  : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] border border-[#eaedff]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">hub</span>
                              <span className="text-xs font-semibold">Cross-functional</span>
                              <span className={`text-[11px] ${wsTeamFunction === 'cross-functional' ? 'opacity-80' : 'text-[#6e7b6c]'}`}>
                                Company wide
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-[#131b2e]" htmlFor="ws-desc">
                              Workspace Description
                            </label>
                            <span className="text-[#6e7b6c] text-[11px]">Optional</span>
                          </div>
                          <textarea
                            id="ws-desc"
                            rows={2}
                            value={wsDesc}
                            onChange={(e) => setWsDesc(e.target.value)}
                            placeholder="Tell members the mission, purpose, or operational guidelines for this workspace..."
                            className="w-full bg-[#ffffff] text-[#131b2e] text-xs p-3 rounded-xl shadow-xs border border-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c] resize-none"
                          />
                          <span className="text-[11px] text-[#6e7b6c]">
                            This description will be displayed on the workspace welcome splash.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setAdminStep(1)}
                          className="px-5 py-2.5 rounded-xl bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#eaedff] cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAdminStep2Continue}
                          disabled={isLoading}
                          className="px-6 py-3 rounded-xl bg-[#006b2c] text-white font-semibold text-xs hover:bg-[#00873a] shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isLoading ? (
                            <>
                              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                              <span>Saving Workspace...</span>
                            </>
                          ) : (
                            <>
                              <span>Continue to Channels</span>
                              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3 */}
                  {adminStep === 3 && (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#006b2c]">
                              Step 3 of 3
                            </span>
                            <span className="text-[#3e4a3d] text-xs">•</span>
                            <span className="text-xs text-[#3e4a3d] font-medium">Default Channels</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#ffdcc3]/60 text-[#2f1500] text-[11px] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">tag</span>
                            Topic Structure
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-[#131b2e]">Create your first channels</h2>
                        <p className="text-xs text-[#3e4a3d]">
                          Channels organize team discussions by topic. We've added a few recommended defaults, or you can tailor them now.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-[#131b2e]">Starting Channels</label>
                        <div className="flex flex-col gap-2">
                          {channels.map((ch) => (
                            <div
                              key={ch.id}
                              className="p-3 rounded-xl bg-[#f2f3ff] flex items-center justify-between gap-3 transition-colors hover:bg-[#eaedff] border border-[#eaedff]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#ffffff] text-[#006b2c] flex items-center justify-center font-bold text-sm shadow-xs shrink-0 border border-[#eaedff]">
                                  #
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-xs text-[#131b2e] truncate">{ch.name}</span>
                                  <span className="text-[11px] text-[#6e7b6c] truncate">{ch.desc}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {ch.tag && (
                                  <span className="px-2 py-0.5 rounded bg-[#dae2fd] text-[#3e4a3d] text-[10px] font-semibold hidden sm:inline">
                                    {ch.tag}
                                  </span>
                                )}
                                {!ch.isMandatory && channels.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveChannel(ch.id)}
                                    title="Remove channel"
                                    className="text-[#6e7b6c] hover:text-[#ba1a1a] p-1 rounded transition-colors cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <div className="relative flex-1 flex items-center">
                            <span className="absolute left-3.5 text-[#6e7b6c] font-bold text-sm">#</span>
                            <input
                              type="text"
                              value={newChannelInput}
                              onChange={(e) => setNewChannelInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomChannel();
                                }
                              }}
                              placeholder="channel-name (e.g. engineering-sync)"
                              className="w-full bg-[#ffffff] text-[#131b2e] text-xs pl-8 pr-4 py-2 rounded-xl shadow-xs border border-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAddCustomChannel}
                            className="px-4 py-2 rounded-xl bg-[#e2e7ff] hover:bg-[#dae2fd] text-[#131b2e] text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            <span>Add channel</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-[#6e7b6c] mt-1">
                          You can create private channels, customize user roles, and bulk invite teammates anytime from the Workspace Settings console.
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setAdminStep(2)}
                          disabled={isLaunching}
                          className="px-5 py-2.5 rounded-xl bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] text-xs font-semibold transition-colors flex items-center gap-1.5 border border-[#eaedff] cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAdminStep3Launch}
                          disabled={isLaunching}
                          className="px-6 py-3 rounded-xl bg-[#006b2c] text-white font-semibold text-xs hover:bg-[#00873a] shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isLaunching ? (
                            <>
                              <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                              <span>Provisioning Workspace...</span>
                            </>
                          ) : (
                            <>
                              <span
                                className="material-symbols-outlined text-[18px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                rocket_launch
                              </span>
                              <span>Create workspace &amp; Launch</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: CONFIRMATION SCREEN (FINAL ONBOARDING SCREEN) */}
                  {adminStep === 4 && (
                    <div className="p-6 md:p-8 flex flex-col gap-6 text-center animate-in fade-in">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-2xl bg-[#7ffc97]/30 text-[#006b2c] flex items-center justify-center shadow-xs mb-1">
                          <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            celebration
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7ffc97]/30 text-[#005320] text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                          <span>Workspace Provisioned Successfully</span>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] mt-1">
                          Your workspace is ready!
                        </h2>
                        <p className="text-xs text-[#3e4a3d] max-w-md mx-auto">
                          Share this code with your team:
                        </p>
                      </div>

                      {/* Pod Code Display Card with Copy-to-Clipboard */}
                      <div className="p-6 rounded-2xl bg-[#f2f3ff] border border-[#eaedff] flex flex-col items-center gap-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e7b6c]">
                          Workspace Pod Invite Code
                        </span>
                        <div className="flex items-center justify-center gap-3 w-full flex-wrap sm:flex-nowrap">
                          <div className="px-6 py-3.5 bg-[#ffffff] rounded-xl border border-[#eaedff] shadow-xs font-mono text-2xl font-bold tracking-widest text-[#006b2c] selection:bg-[#7ffc97]">
                            {generatedPodCode}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedPodCode);
                              setPodCodeCopied(true);
                              setTimeout(() => setPodCodeCopied(false), 2500);
                            }}
                            className={`flex items-center gap-1.5 px-5 py-3.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-xs ${
                              podCodeCopied
                                ? 'bg-[#006b2c] text-white'
                                : 'bg-[#ffffff] text-[#131b2e] border border-[#eaedff] hover:bg-[#eaedff]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {podCodeCopied ? 'check' : 'content_copy'}
                            </span>
                            <span>{podCodeCopied ? 'Copied!' : 'Copy Code'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-[#6e7b6c] mt-1">
                          <span className="material-symbols-outlined text-[16px] text-[#006b2c]">verified</span>
                          <span>Team Leads &amp; Members enter this code to join {wsName}</span>
                        </div>
                      </div>

                      {/* Summary details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[#eaedff]">
                          <span className="text-[10px] text-[#6e7b6c] block uppercase font-medium">Workspace</span>
                          <span className="text-xs font-semibold text-[#131b2e] truncate block">{wsName}</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[#eaedff]">
                          <span className="text-[10px] text-[#6e7b6c] block uppercase font-medium">Admin Account</span>
                          <span className="text-xs font-semibold text-[#131b2e] truncate block">{adminEmail}</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[#eaedff]">
                          <span className="text-[10px] text-[#6e7b6c] block uppercase font-medium">Channels Created</span>
                          <span className="text-xs font-semibold text-[#006b2c] block">{channels.length} channels ready</span>
                        </div>
                      </div>

                      {/* Final Onboarding Action -> Dashboard */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (finalAdminUser) {
                              onSuccess(finalAdminUser);
                            }
                          }}
                          className="w-full py-3.5 px-6 rounded-xl bg-[#006b2c] text-white font-semibold text-sm hover:bg-[#00873a] shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <span>Enter Workspace Dashboard</span>
                          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-[#6e7b6c] text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="material-symbols-outlined text-[16px] text-[#006b2c]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                  <span>SOC2 Type II Certified</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="material-symbols-outlined text-[16px] text-[#006b2c]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    lock
                  </span>
                  <span>End-to-end TLS 1.3 Strict</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="material-symbols-outlined text-[16px] text-[#006b2c]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    admin_panel_settings
                  </span>
                  <span>Root Admin RBAC</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full py-4 bg-transparent border-t border-[#eaedff]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6e7b6c]">
            <p className="text-center sm:text-left">© 2024 TeamHub Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-[#131b2e] transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-[#131b2e] transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-[#131b2e] transition-colors">
                Help Center
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW: TEAM LEAD SIGN-UP SCREEN
  // ==========================================
  if (isSignUp && selectedRole === 'lead') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-[#faf8ff] via-[#faf8ff] to-[#f2f3ff] text-[#131b2e]">
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full">
          <main className="w-full flex items-center justify-center">
            <div className="flex flex-col w-full max-w-xl mx-auto py-2 sm:py-4 items-center">
              <div className="w-full bg-[#ffffff] rounded-xl shadow-xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden border border-[#eaedff]">
                
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-1.5">
                  <div className="flex items-center gap-2">
                    <img
                      alt="TeamHub"
                      className="h-8 w-auto object-contain"
                      src="https://lh3.googleusercontent.com/aida/AEtjO1X-k3PCRzudIr3tLqU2fKpp0OPFWHZamMuFNM8rBxHVPHRXy6RABsssqmY9lU4lB4hAWBCqVT3HQyuI1nxal7heZMbxVt_Bzi9kGeZ1ReoudEaTnx4L-jPsn7c2hiYD9_KNBJOTlSuuBietaV4-y9EGBVO04HeHh0MqcbZZZjSAKhUre5Raqtfcha4tt0YIYBfGvq7Zqmr4TAslkFUhwYTEpfuKzqftSHHfDQdzsLQXlbZakCqxZkyKzgwz"
                    />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eaedff] text-[#006b2c] text-[11px] font-semibold mt-1 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                    Team Lead Registration
                  </div>
                  <h1 className="text-2xl text-[#131b2e] mt-1 font-semibold tracking-tight">
                    Lead your pod with clarity and calm
                  </h1>
                  <p className="text-sm text-[#3e4a3d] max-w-md">
                    Coordinate sprints, review team deliverables, and guide async discussions without friction.
                  </p>
                </div>

                {/* Role Segmented Control */}
                <div className="w-full bg-[#e2e7ff] p-1 rounded-lg flex items-center justify-between gap-1 select-none">
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('member')}
                    className="flex-1 py-2 px-3 rounded-md text-center text-xs font-medium text-[#3e4a3d] hover:text-[#131b2e] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    <span>Member</span>
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 rounded-md text-center text-xs bg-[#ffffff] text-[#006b2c] shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-default"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      shield_person
                    </span>
                    <span className="font-semibold text-[#131b2e]">Team Lead</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('admin')}
                    className="flex-1 py-2 px-3 rounded-md text-center text-xs font-medium text-[#3e4a3d] hover:text-[#131b2e] transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                      <span>Admin</span>
                    </span>
                    <span className="text-[10px] text-[#6e7b6c] hidden sm:inline">(org-level)</span>
                  </button>
                </div>

                {/* Soft Emerald Info Banner */}
                <div className="w-full rounded-lg bg-[#f2f3ff] p-4 flex items-start gap-2.5 border border-[#eaedff]">
                  <span
                    className="material-symbols-outlined text-[#006b2c] text-[20px] flex-shrink-0 mt-0.5"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <div className="flex flex-col gap-0.5 text-left">
                    <p className="font-semibold text-xs text-[#006b2c]">
                      Team Leads can assign tasks, review work, and manage their team's channels.
                    </p>
                    <p className="text-xs text-[#3e4a3d]">
                      Lead accounts coordinate sprint boards, approve milestone deliverables, and unlock pod analytics.
                    </p>
                  </div>
                </div>

                {/* Global Error Banner */}
                {errorMessage && (
                  <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">error</span>
                    <div className="flex-1 leading-snug">{errorMessage}</div>
                    <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}

                {/* Sign-Up Form */}
                <form onSubmit={handleLeadSignUp} className="flex flex-col gap-4 w-full">
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-medium text-[#131b2e]" htmlFor="leadFullName">
                      Full Name
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[18px] pointer-events-none">
                        account_circle
                      </span>
                      <input
                        id="leadFullName"
                        name="fullName"
                        type="text"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="e.g. Taylor Brooks"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] placeholder:text-[#6e7b6c] text-xs focus:bg-[#ffffff] focus:outline-none focus:shadow-[0_0_0_2px_#006b2c] border border-[#eaedff] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#131b2e]" htmlFor="leadWorkEmail">
                        Work Email
                      </label>
                      <span className="text-[11px] text-[#006b2c] flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[14px]">domain_verification</span>
                        Domain matched
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[18px] pointer-events-none">
                        mail
                      </span>
                      <input
                        id="leadWorkEmail"
                        name="email"
                        type="email"
                        required
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="taylor@company.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] placeholder:text-[#6e7b6c] text-xs focus:bg-[#ffffff] focus:outline-none focus:shadow-[0_0_0_2px_#006b2c] border border-[#eaedff] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#131b2e]" htmlFor="leadPassword">
                        Password
                      </label>
                      <span className="text-[11px] text-[#3e4a3d]">Min. 8 characters</span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[18px] pointer-events-none">
                        lock
                      </span>
                      <input
                        id="leadPassword"
                        name="password"
                        type={showLeadPassword ? 'text' : 'password'}
                        required
                        value={leadPassword}
                        onChange={(e) => setLeadPassword(e.target.value)}
                        placeholder="Create password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] placeholder:text-[#6e7b6c] text-xs focus:bg-[#ffffff] focus:outline-none focus:shadow-[0_0_0_2px_#006b2c] border border-[#eaedff] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLeadPassword(!showLeadPassword)}
                        title="Toggle visibility"
                        className="absolute right-3.5 text-[#6e7b6c] hover:text-[#131b2e] flex items-center justify-center p-0.5 focus:outline-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showLeadPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#131b2e] flex items-center gap-1.5" htmlFor="leadInviteCode">
                        <span>Workspace Invite Code</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#e2e7ff] text-[#3e4a3d] text-[10px] font-semibold uppercase">
                          Required
                        </span>
                      </label>
                      {!leadInviteError && leadInviteCode.length > 3 && (
                        <span className="text-[11px] text-[#006b2c] flex items-center gap-0.5 font-medium">
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          Valid Pod Code
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[18px] pointer-events-none">
                        vpn_key
                      </span>
                      <input
                        id="leadInviteCode"
                        name="inviteCode"
                        type="text"
                        required
                        value={leadInviteCode}
                        onChange={(e) => {
                          setLeadInviteCode(e.target.value);
                          if (leadInviteError) setLeadInviteError(null);
                        }}
                        placeholder="e.g. LEAD-XXXX-XXXX"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-lg font-mono text-[13px] tracking-wider text-[#131b2e] placeholder:text-[#6e7b6c] transition-all border ${
                          leadInviteError
                            ? 'bg-red-50 border-red-300 focus:shadow-[0_0_0_2px_#ba1a1a]'
                            : 'bg-[#f2f3ff] border-[#eaedff] focus:bg-[#ffffff] focus:shadow-[0_0_0_2px_#006b2c]'
                        }`}
                      />
                      {!leadInviteError && leadInviteCode.length > 3 && (
                        <span className="material-symbols-outlined absolute right-3.5 text-[#006b2c] text-[18px] pointer-events-none">
                          check_circle
                        </span>
                      )}
                      {leadInviteError && (
                        <span className="material-symbols-outlined absolute right-3.5 text-red-600 text-[18px] pointer-events-none">
                          error
                        </span>
                      )}
                    </div>

                    {leadInviteError && (
                      <div className="flex items-start gap-1.5 text-red-600 text-xs mt-0.5">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                        <span>{leadInviteError}</span>
                      </div>
                    )}

                    <p className="text-[11px] text-[#6e7b6c]">
                      Ask your Administrator for your pod's unique Team Lead delegation token.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-lg bg-[#006b2c] text-white font-semibold text-xs shadow-md hover:bg-[#00873a] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        <span>Creating Team Lead Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Team Lead Account</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex items-center justify-center my-1">
                    <div className="w-full bg-[#eaedff] h-[1px]"></div>
                    <span className="absolute bg-[#ffffff] px-3 text-[11px] text-[#6e7b6c] uppercase tracking-wider">
                      Or continue with
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#ffffff] text-[#131b2e] text-xs font-semibold shadow-xs hover:bg-[#f2f3ff] border border-[#eaedff] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                        fill="#4285F4"
                      ></path>
                      <path
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                        fill="#34A853"
                      ></path>
                      <path
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        fill="#FBBC05"
                      ></path>
                      <path
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        fill="#EA4335"
                      ></path>
                    </svg>
                    <span>Sign up with Google Workspace</span>
                  </button>

                  <div className="text-center mt-1 text-xs text-[#3e4a3d]">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setErrorMessage(null);
                        setLeadInviteError(null);
                      }}
                      className="text-[#006b2c] font-semibold hover:underline transition-all cursor-pointer ml-1"
                    >
                      Sign in
                    </button>
                  </div>
                </form>

                <div className="w-full pt-4 bg-gradient-to-t from-[#f2f3ff]/40 to-transparent flex flex-wrap items-center justify-center gap-y-2 gap-x-4 text-[#6e7b6c] text-[11px] border-t border-[#eaedff]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified_user
                    </span>
                    <span>SOC2 Type II Certified</span>
                  </div>
                  <span className="hidden sm:inline opacity-30">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      lock
                    </span>
                    <span>TLS 1.3 Strict</span>
                  </div>
                  <span className="hidden sm:inline opacity-30">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      security
                    </span>
                    <span>Lead RBAC Enforced</span>
                  </div>
                </div>

              </div>
            </div>
          </main>
        </div>

        <footer className="w-full py-4 px-4 border-t border-[#eaedff]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center text-[#6e7b6c] text-xs">
            <div className="flex items-center gap-6">
              <a className="hover:text-[#006b2c] transition-colors" href="#">
                Privacy Policy
              </a>
              <a className="hover:text-[#006b2c] transition-colors" href="#">
                Terms of Service
              </a>
              <a className="hover:text-[#006b2c] transition-colors" href="#">
                Help Center
              </a>
            </div>
            <p className="text-[#6e7b6c]">© 2024 TeamHub. All rights reserved.</p>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW: TEAM MEMBER SIGN-UP SCREEN
  // ==========================================
  if (isSignUp && selectedRole === 'member') {
    return (
      <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between selection:bg-[#7ffc97] selection:text-[#002109]">
        <div className="flex-1 flex flex-col justify-center items-center py-8 px-4 w-full">
          <main className="w-full flex justify-center">
            <div className="flex flex-col w-full items-center justify-center">
              <div className="w-full max-w-[540px] bg-[#ffffff] rounded-xl shadow-xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden border border-[#eaedff]">
                
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex items-center justify-center mb-1">
                    <img
                      alt="TeamHub"
                      className="h-8 w-auto object-contain"
                      src="https://lh3.googleusercontent.com/aida/AEtjO1X-k3PCRzudIr3tLqU2fKpp0OPFWHZamMuFNM8rBxHVPHRXy6RABsssqmY9lU4lB4hAWBCqVT3HQyuI1nxal7heZMbxVt_Bzi9kGeZ1ReoudEaTnx4L-jPsn7c2hiYD9_KNBJOTlSuuBietaV4-y9EGBVO04HeHh0MqcbZZZjSAKhUre5Raqtfcha4tt0YIYBfGvq7Zqmr4TAslkFUhwYTEpfuKzqftSHHfDQdzsLQXlbZakCqxZkyKzgwz"
                    />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7ffc97]/30 text-[#006b2c] text-[11px] font-semibold uppercase tracking-wider">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                    Team Member Registration
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <h1 className="text-2xl font-bold tracking-tight text-[#131b2e]">Connect with your pod calmly</h1>
                    <p className="text-sm text-[#3e4a3d] max-w-sm mx-auto">
                      Share progress, async updates, and collaborate without the frantic noise.
                    </p>
                  </div>
                </div>

                {/* Role Segmented Control */}
                <div className="p-1 rounded-lg bg-[#f2f3ff] grid grid-cols-3 gap-1 border border-[#eaedff]">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-[#ffffff] text-[#006b2c] shadow-xs text-xs font-semibold transition-all cursor-default"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('lead')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-[#3e4a3d] hover:text-[#131b2e] text-xs font-medium transition-all cursor-pointer"
                  >
                    Team Lead
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('admin')}
                    className="flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[#3e4a3d] hover:text-[#131b2e] text-xs font-medium transition-all cursor-pointer"
                  >
                    <span>Admin</span>
                    <span className="text-[10px] text-[#3e4a3d]/70">(direct)</span>
                  </button>
                </div>

                {/* Soft Emerald Info Banner */}
                <div className="flex items-start gap-2.5 p-4 rounded-lg bg-[#f2f3ff] text-[#3e4a3d] border border-[#eaedff]">
                  <span className="material-symbols-outlined text-[#006b2c] text-[20px] mt-0.5 shrink-0">info</span>
                  <p className="text-xs text-[#3e4a3d] leading-relaxed">
                    Joining as a <strong className="font-semibold text-[#131b2e]">Team Member</strong>. Enter the unique invite code provided by your pod lead or administrator to join your team's workspace.
                  </p>
                </div>

                {/* Global Error Banner */}
                {errorMessage && (
                  <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">error</span>
                    <div className="flex-1 leading-snug">{errorMessage}</div>
                    <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleMemberSignUp} className="flex flex-col gap-4">
                  {/* Full Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[#131b2e] flex items-center justify-between" htmlFor="memberFullName">
                      Full Name
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#3e4a3d] text-[20px] pointer-events-none">
                        person
                      </span>
                      <input
                        id="memberFullName"
                        type="text"
                        required
                        value={memberName}
                        onChange={(e) => setMemberName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-xs focus:bg-[#ffffff] focus:shadow-md outline-none transition-all placeholder:text-[#6e7b6c] border border-[#eaedff]"
                      />
                    </div>
                  </div>

                  {/* Work Email */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#131b2e]" htmlFor="memberWorkEmail">
                        Work Email
                      </label>
                      <span className="text-[11px] text-[#006b2c] flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[14px]">domain_verification</span>
                        Company domain
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#3e4a3d] text-[20px] pointer-events-none">
                        mail
                      </span>
                      <input
                        id="memberWorkEmail"
                        type="email"
                        required
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="alex.morgan@company.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-xs focus:bg-[#ffffff] focus:shadow-md outline-none transition-all placeholder:text-[#6e7b6c] border border-[#eaedff]"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[#131b2e]" htmlFor="memberPassword">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#3e4a3d] text-[20px] pointer-events-none">
                        lock
                      </span>
                      <input
                        id="memberPassword"
                        type={showMemberPassword ? 'text' : 'password'}
                        required
                        value={memberPassword}
                        onChange={(e) => setMemberPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-xs focus:bg-[#ffffff] focus:shadow-md outline-none transition-all placeholder:text-[#6e7b6c] border border-[#eaedff]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMemberPassword(!showMemberPassword)}
                        className="absolute right-3.5 text-[#3e4a3d] hover:text-[#131b2e] flex items-center justify-center p-1 cursor-pointer"
                        title="Toggle visibility"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showMemberPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Workspace Invite Code */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#131b2e] flex items-center gap-1.5" htmlFor="memberInviteCode">
                        <span>Workspace Invite Code</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] text-[10px] tracking-wide font-semibold">
                          REQUIRED
                        </span>
                      </label>
                      {!memberInviteError && memberInviteCode.length > 3 && (
                        <span className="material-symbols-outlined text-[#006b2c] text-[18px]">verified</span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#3e4a3d] text-[20px] pointer-events-none">
                        key
                      </span>
                      <input
                        id="memberInviteCode"
                        type="text"
                        required
                        value={memberInviteCode}
                        onChange={(e) => {
                          setMemberInviteCode(e.target.value);
                          if (memberInviteError) setMemberInviteError(null);
                        }}
                        placeholder="e.g. POD-DES-4821"
                        className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide outline-none transition-all uppercase border ${
                          memberInviteError
                            ? 'bg-red-50 border-red-300 focus:shadow-[0_0_0_2px_#ba1a1a] text-red-900'
                            : 'bg-[#f2f3ff] border-[#eaedff] text-[#131b2e] focus:bg-[#ffffff] focus:shadow-md'
                        }`}
                      />
                    </div>

                    {memberInviteError && (
                      <div className="flex items-start gap-1.5 text-red-600 text-xs mt-0.5">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                        <span>{memberInviteError}</span>
                      </div>
                    )}

                    <span className="text-xs text-[#6e7b6c] flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">help</span>
                      Ask your Team Lead or Administrator for your workspace invite code
                    </span>
                  </div>

                  {/* Submit Action */}
                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          <span>Creating Member Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Member Account</span>
                          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </>
                      )}
                    </button>

                    <div className="relative flex items-center justify-center my-1">
                      <div className="w-full h-px bg-[#eaedff]"></div>
                      <span className="bg-[#ffffff] px-3 text-[11px] text-[#6e7b6c] uppercase tracking-wider absolute">
                        or continue with
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-xs font-semibold flex items-center justify-center gap-3 transition-all border border-[#eaedff] cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                          fill="#4285F4"
                        ></path>
                        <path
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                          fill="#34A853"
                        ></path>
                        <path
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                          fill="#FBBC05"
                        ></path>
                        <path
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                          fill="#EA4335"
                        ></path>
                      </svg>
                      Sign up with Google Workspace
                    </button>
                  </div>
                </form>

                {/* Login Redirect */}
                <div className="text-center">
                  <p className="text-xs text-[#3e4a3d]">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setErrorMessage(null);
                        setMemberInviteError(null);
                      }}
                      className="font-semibold text-[#006b2c] hover:underline ml-1 cursor-pointer"
                    >
                      Sign in
                    </button>
                  </p>
                </div>

                {/* Trust Badges Bottom Strip */}
                <div className="pt-4 mt-1 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-[#6e7b6c] text-[11px] bg-[#f2f3ff]/50 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-4 border-t border-[#eaedff]">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified_user
                    </span>
                    <span>SOC2 Type II Certified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      lock
                    </span>
                    <span>TLS 1.3 Strict</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006b2c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      shield
                    </span>
                    <span>Member RBAC</span>
                  </div>
                </div>

              </div>
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="w-full py-4 border-t border-[#eaedff]">
          <div className="max-w-md mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6e7b6c]">
            <div className="flex items-center gap-1.5 text-[#6e7b6c]/80">
              <span>© 2024 TeamHub</span>
              <span className="inline-block w-1 h-1 rounded-full bg-[#bdcaba]"></span>
              <span>Focus &amp; Align</span>
            </div>
            <div className="flex items-center gap-4">
              <a className="text-[#6e7b6c] hover:text-[#006b2c] transition-colors" href="#">
                Privacy Policy
              </a>
              <a className="text-[#6e7b6c] hover:text-[#006b2c] transition-colors" href="#">
                Terms of Service
              </a>
              <a className="text-[#6e7b6c] hover:text-[#006b2c] transition-colors" href="#">
                Help Center
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW: REGULAR LOGIN SCREEN (!isSignUp)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col items-center justify-center p-4 text-[#131b2e]">
      <div className="w-full max-w-[460px] bg-[#ffffff] rounded-3xl shadow-sm border border-[#eaedff] p-8 sm:p-9 flex flex-col items-center relative overflow-hidden">
        {/* Supabase status badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#f2f3ff] text-[#3e4a3d] border border-[#eaedff]">
          <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-[#00873a] animate-pulse' : 'bg-[#006b2c]'}`}></span>
          <span>{isSupabaseConfigured ? 'Supabase Auth Connected' : 'Supabase Auth Ready'}</span>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-5 mt-2">
          <div className="w-9 h-9 rounded-xl bg-[#006b2c] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            TH
          </div>
          <span className="text-xl font-bold tracking-tight">TeamHub</span>
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e]">Welcome back</h1>
          <p className="text-xs text-[#6e7b6c] mt-1">
            Sign in with Supabase Auth to access your team dashboard.
          </p>
        </div>

        {/* Role Portal Selector Tabs */}
        <div className="w-full mb-5">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#3e4a3d]">
              Select Portal &amp; Role
            </label>
            <span className="text-[10px] text-[#6e7b6c]">
              {selectedRole === 'admin' ? 'Full RBAC Access' : selectedRole === 'lead' ? 'Sprint & Approvals' : 'Sprint Tasks & Chat'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f2f3ff] rounded-2xl border border-[#eaedff]">
            {/* Member Tab */}
            <button
              type="button"
              onClick={() => handleRoleTabChange('member')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedRole === 'member'
                  ? 'bg-[#006b2c] text-white shadow-xs'
                  : 'text-[#6e7b6c] hover:text-[#131b2e] hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span className="leading-tight">Member</span>
              </div>
              <span className={`text-[9px] mt-0.5 ${selectedRole === 'member' ? 'text-white/80' : 'text-[#6e7b6c]'}`}>
                Individual
              </span>
            </button>

            {/* Team Lead Tab */}
            <button
              type="button"
              onClick={() => handleRoleTabChange('lead')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedRole === 'lead'
                  ? 'bg-[#0051d5] text-white shadow-xs'
                  : 'text-[#6e7b6c] hover:text-[#131b2e] hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span className="leading-tight">Team Lead</span>
              </div>
              <span className={`text-[9px] mt-0.5 ${selectedRole === 'lead' ? 'text-white/80' : 'text-[#6e7b6c]'}`}>
                Sprint Lead
              </span>
            </button>

            {/* Administrator Tab */}
            <button
              type="button"
              onClick={() => handleRoleTabChange('admin')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-[#8d4b00] text-white shadow-xs'
                  : 'text-[#6e7b6c] hover:text-[#131b2e] hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">shield</span>
                <span className="leading-tight">Admin</span>
              </div>
              <span className={`text-[9px] mt-0.5 ${selectedRole === 'admin' ? 'text-white/80' : 'text-[#6e7b6c]'}`}>
                Governance
              </span>
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">error</span>
            <div className="flex-1">
              <span className="font-semibold block">Authentication Error</span>
              <span className="text-[11px] leading-snug">{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSignInSubmit} className="w-full space-y-3.5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-[#131b2e]">Email address</label>
              <span className="text-[10px] text-[#6e7b6c]">Supabase Auth</span>
            </div>
            <input
              type="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white focus:border-[#006b2c] transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-[#131b2e]">Password</label>
              <button
                type="button"
                onClick={() => alert('Password reset link sent to your registered email.')}
                className="text-[10px] text-[#006b2c] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white focus:border-[#006b2c] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e7b6c] hover:text-[#131b2e] cursor-pointer"
                title="Toggle password"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showLoginPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 text-white rounded-xl font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 mt-2 ${
              selectedRole === 'admin'
                ? 'bg-[#8d4b00] hover:bg-[#a65800]'
                : selectedRole === 'lead'
                ? 'bg-[#0051d5] hover:bg-[#0041ab]'
                : 'bg-[#006b2c] hover:bg-[#00873a]'
            } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span>Connecting to Supabase...</span>
              </>
            ) : (
              <>
                <span>
                  Sign in as {selectedRole === 'admin' ? 'Administrator' : selectedRole === 'lead' ? 'Team Lead' : 'Team Member'}
                </span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <div className="w-full my-4 flex items-center">
          <div className="flex-1 h-px bg-[#eaedff]"></div>
          <span className="px-3 text-[10px] text-[#6e7b6c] uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[#eaedff]"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          type="button"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#eaedff]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"></path>
            <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" fill="#34A853"></path>
            <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" fill="#FBBC05"></path>
            <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"></path>
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Quick Demo Credentials Switcher */}
        <div className="w-full mt-4 p-2.5 rounded-xl bg-[#f2f3ff]/60 border border-[#eaedff] text-[11px] text-[#3e4a3d]">
          <div className="flex items-center justify-between mb-1.5 font-semibold text-[#131b2e]">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-[#006b2c]">key</span>
              <span>Quick Login Credentials:</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('member');
                setLoginEmail('sarah.c@teamhub.internal');
                setLoginPassword('Password123!');
              }}
              className="px-1.5 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#eaedff] text-[10px] text-center font-medium truncate cursor-pointer transition-colors"
              title="Click to fill Member login"
            >
              👤 Member
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRole('lead');
                setLoginEmail('david.k@teamhub.internal');
                setLoginPassword('Password123!');
              }}
              className="px-1.5 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#eaedff] text-[10px] text-center font-medium truncate cursor-pointer transition-colors"
              title="Click to fill Team Lead login"
            >
              ⭐ Team Lead
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRole('admin');
                setLoginEmail('admin@teamhub.internal');
                setLoginPassword('Password123!');
              }}
              className="px-1.5 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#eaedff] text-[10px] text-center font-medium truncate cursor-pointer transition-colors"
              title="Click to fill Admin login"
            >
              🛡️ Admin
            </button>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-[#6e7b6c]">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorMessage(null);
            }}
            className="text-[#006b2c] font-bold hover:underline cursor-pointer"
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
};
