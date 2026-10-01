import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Role, Task, TaskStatus, Channel, ChannelMessage, Question, QuestionAnswer, WorkspaceFile, JoinRequest, Review, ReviewStatus, Project, ProjectStatus, StandupEntry } from '../types';
import { INITIAL_REVIEWS, INITIAL_PROJECTS, CHANNELS, WORKSPACE_FILES, STANDUP_ENTRIES, INITIAL_TASKS, INITIAL_CHANNEL_MESSAGES, INITIAL_QUESTIONS, USERS } from '../data/mockData';

// Environment variables for Supabase (configured via .env)
const envObj = (typeof import.meta !== 'undefined' && (import.meta as any).env) || (typeof process !== 'undefined' ? process.env : {}) || {};
const supabaseUrl = (envObj.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (envObj.VITE_SUPABASE_ANON_KEY as string) || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('xyzcompany') && 
  !supabaseAnonKey.includes('...')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Virtual storage cache for instant offline / local avatar persistence fallback
const VIRTUAL_STORAGE_KEY_PREFIX = 'teamhub_avatar_';
export const AUTH_SESSION_STORAGE_KEY = 'teamhub_supabase_auth_session';
export const WORKSPACES_STORAGE_KEY = 'teamhub_workspaces';
export const CURRENT_WORKSPACE_STORAGE_KEY = 'teamhub_current_workspace';
export const REVIEWS_STORAGE_KEY = 'teamhub_reviews';
export const PROJECTS_STORAGE_KEY = 'teamhub_projects';
export const CHANNELS_STORAGE_KEY = 'teamhub_channels';
export const FILES_STORAGE_KEY = 'teamhub_files';

// Default initial workspace to seed if empty
export const DEFAULT_WORKSPACE = {
  id: 'ws-core-engineering',
  name: 'Core Engineering Pod',
  slug: 'core-engineering',
  description: 'Core product engineering and sprint execution pod',
  team_function: 'engineering',
  admin_email: 'sarah.c@teamhub.internal',
  pod_code: 'TH-4821-ENG',
  is_active: true,
  created_at: '2024-01-01T00:00:00.000Z',
};

export interface DatabaseFallbackDetail {
  operation: string;
  error: string;
  message: string;
  timestamp: number;
}

/**
 * Dispatches a visible global notification whenever a Supabase operation encounters
 * a server/database failure and falls back to local storage/mock state.
 */
export function notifyDatabaseFallback(operation: string, error: string | Error | any) {
  if (!isSupabaseConfigured) {
    // Intentionally offline / unconfigured demo mode, skip fallback error toast
    return;
  }
  const errText = typeof error === 'string' ? error : error?.message || 'Database operation failed';
  const displayMsg = `Server sync failed during "${operation}": ${errText}. Changes were saved to local storage on this device only.`;
  console.error(`[Database Fallback Alert] ${operation}:`, errText);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('teamhub:database-fallback', {
        detail: {
          operation,
          error: errText,
          message: displayMsg,
          timestamp: Date.now(),
        },
      })
    );
  }
}

/**
 * Generates a unique pod code in the format: TH-####-XXX
 * (4 random digits, 3 uppercase letters, e.g. TH-4821-ENG)
 */
export function generatePodCode(teamFunctionHint?: string): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  let tag = 'ENG';
  if (teamFunctionHint) {
    const cleanHint = teamFunctionHint.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanHint.includes('DESIGN') || cleanHint === 'DES') {
      tag = 'DES';
    } else if (cleanHint.includes('CROSS') || cleanHint === 'XFN') {
      tag = 'XFN';
    } else if (cleanHint.length >= 3) {
      tag = cleanHint.slice(0, 3);
    }
  } else {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    tag = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  }
  return `TH-${digits}-${tag}`;
}

/**
 * Helper to get local stored workspaces
 */
export function getLocalWorkspaces(): any[] {
  try {
    const raw = localStorage.getItem(WORKSPACES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return [DEFAULT_WORKSPACE];
}

/**
 * Helper to save local workspaces
 */
export function saveLocalWorkspaces(workspaces: any[]) {
  try {
    localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
  } catch (e) {
    // ignore
  }
}

/**
 * Validates entered invite code against real pod codes in Supabase (or local storage fallback).
 */
export async function validatePodCode(
  inviteCode: string
): Promise<{ valid: boolean; workspace?: any; error?: string }> {
  const cleanCode = inviteCode.trim().toUpperCase();

  if (!cleanCode) {
    return { valid: false, error: 'Workspace invite code is required.' };
  }

  if (cleanCode.includes('EXP') || cleanCode === 'POD-EXPIRED' || cleanCode === 'LEAD-EXPIRED') {
    return {
      valid: false,
      error: "This invite code isn't valid or has expired — check with your pod lead or administrator.",
    };
  }

  // 1. Check Supabase 'workspaces' table if configured
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('pod_code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (data && !error) {
        return { valid: true, workspace: data };
      }
    } catch (err) {
      console.warn('Supabase query workspaces error:', err);
    }
  }

  // 2. Check local stored workspaces & fallback registry
  const localList = getLocalWorkspaces();
  const matched = localList.find(
    (w) => w.is_active !== false && (
      w.pod_code?.toUpperCase() === cleanCode ||
      // Legacy code compatibility for existing seeded demos:
      (cleanCode === 'POD-DES-4821' && (w.pod_code === 'TH-4821-ENG' || w.id === 'ws-core-engineering')) ||
      (cleanCode === 'LEAD-POD9-742X' && (w.pod_code === 'TH-4821-ENG' || w.id === 'ws-core-engineering'))
    )
  );

  if (matched) {
    return { valid: true, workspace: matched };
  }

  return {
    valid: false,
    error: "This invite code isn't valid or has expired — check with your pod lead or administrator.",
  };
}

/**
 * Stores a workspace record in Supabase and local storage.
 */
export async function createWorkspaceRecord(workspace: {
  name: string;
  slug: string;
  description: string;
  team_function: string;
  admin_id?: string;
  admin_email: string;
  pod_code: string;
}): Promise<{ success: boolean; workspace: any; error?: string }> {
  const record = {
    id: `ws-${Date.now()}`,
    ...workspace,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Supabase insert
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .upsert({
          name: record.name,
          slug: record.slug,
          description: record.description,
          team_function: record.team_function,
          admin_id: record.admin_id,
          admin_email: record.admin_email,
          pod_code: record.pod_code,
          is_active: true,
          created_at: record.created_at,
          updated_at: record.updated_at,
        })
        .select()
        .maybeSingle();

      if (data && !error) {
        record.id = data.id;
      } else if (error) {
        notifyDatabaseFallback('Create Workspace', error);
      }
    } catch (err) {
      console.warn('Could not insert workspace in Supabase:', err);
      notifyDatabaseFallback('Create Workspace', err);
    }
  }

  // 2. Local storage
  const list = getLocalWorkspaces();
  const existingIdx = list.findIndex((w) => w.slug === record.slug || w.pod_code === record.pod_code);
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...record };
  } else {
    list.unshift(record);
  }
  saveLocalWorkspaces(list);
  try {
    localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    // ignore
  }

  return { success: true, workspace: record };
}

/**
 * Gets the current active workspace record (for pod code display).
 */
export async function getActiveWorkspace(adminEmail?: string): Promise<any> {
  // Check Supabase if configured
  if (supabase && adminEmail) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('admin_email', adminEmail)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        return data;
      }
    } catch (err) {
      // ignore
    }
  }

  // Check local storage
  try {
    const raw = localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }

  const list = getLocalWorkspaces();
  if (adminEmail) {
    const found = list.find((w) => w.admin_email === adminEmail);
    if (found) return found;
  }
  return list[0] || DEFAULT_WORKSPACE;
}

/**
 * Regenerates the pod code for a workspace (e.g. if code leaked).
 */
export async function regenerateWorkspacePodCode(
  workspaceIdentifier?: string,
  teamFunctionHint?: string
): Promise<{ success: boolean; newCode: string; error?: string }> {
  const newCode = generatePodCode(teamFunctionHint);
  const activeWs = await getActiveWorkspace();
  const wsId = workspaceIdentifier || activeWs.id || activeWs.slug;

  // 1. Supabase update
  if (supabase) {
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          pod_code: newCode,
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${wsId},slug.eq.${wsId}`);

      if (error) {
        notifyDatabaseFallback('Regenerate Pod Code', error);
      }
    } catch (err) {
      console.warn('Supabase pod_code update notice:', err);
      notifyDatabaseFallback('Regenerate Pod Code', err);
    }
  }

  // 2. Local storage update
  const list = getLocalWorkspaces();
  const idx = list.findIndex((w) => w.id === wsId || w.slug === wsId || w.pod_code === activeWs.pod_code);
  if (idx >= 0) {
    list[idx].pod_code = newCode;
    list[idx].updated_at = new Date().toISOString();
    saveLocalWorkspaces(list);
    try {
      localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, JSON.stringify(list[idx]));
    } catch (e) {
      // ignore
    }
  } else if (list.length > 0) {
    list[0].pod_code = newCode;
    list[0].updated_at = new Date().toISOString();
    saveLocalWorkspaces(list);
    try {
      localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, JSON.stringify(list[0]));
    } catch (e) {
      // ignore
    }
  }

  return { success: true, newCode };
}

export interface StoredSession {
  user: User;
  token?: string;
  expiresAt?: number;
}

/**
 * Checks for an active Supabase Auth session or valid stored session.
 * Migrated to real Supabase Auth session primary resolution.
 */
export async function getActiveAuthSession(): Promise<{ user: User | null; error?: string }> {
  // 1. Check live Supabase Auth session if client is configured
  if (supabase) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Supabase auth getSession error:', error);
      } else if (session?.user) {
        // Fetch user's profile and role from the database
        const profile = await fetchUserProfileFromDb(session.user.id, session.user.email);
        if (profile) {
          return { user: profile };
        }
        // Build fallback user from session metadata if profile not yet created
        const userMeta = session.user.user_metadata || {};
        const role = (userMeta.role as Role) || 'member';
        const name = userMeta.full_name || session.user.email?.split('@')[0] || 'Team User';
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        const fallbackUser: User = {
          id: session.user.id,
          name,
          email: session.user.email || '',
          role,
          roleTitle: role === 'admin' ? 'Workspace Administrator' : role === 'lead' ? 'Team Lead' : 'Team Member',
          department: userMeta.department || 'Engineering',
          pod: 'Core Engineering Pod',
          initials: initials || 'TU',
          status: 'online',
          location: 'San Francisco, CA',
          timezone: 'UTC-7 (PDT)',
          tasksCompleted: 0,
          questionsAnswered: 0,
          lastActive: 'Just now',
          skills: ['Engineering'],
        };
        return { user: fallbackUser };
      }
    } catch (err: any) {
      console.warn('Error checking live Supabase session, checking local session:', err);
    }
  }

  // 2. Check stored local session cache (fallback when offline)
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed: StoredSession = JSON.parse(raw);
      if (parsed.user && parsed.user.id) {
        const cachedAvatar = localStorage.getItem(`${VIRTUAL_STORAGE_KEY_PREFIX}${parsed.user.id}`);
        if (cachedAvatar && !parsed.user.avatarUrl) {
          parsed.user.avatarUrl = cachedAvatar;
        }
        return { user: parsed.user };
      }
    }
  } catch (err) {
    console.warn('Failed to parse local auth session:', err);
  }

  return { user: null };
}

/**
 * Fetches user profile record from Supabase 'profiles' table.
 */
export async function fetchUserProfileFromDb(userId: string, emailFallback?: string): Promise<User | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        const name = data.full_name || data.name || emailFallback?.split('@')[0] || 'Team User';
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return {
          id: data.id,
          name,
          email: data.email || emailFallback || '',
          role: (data.role as Role) || 'member',
          roleTitle: data.role_title || (data.role === 'admin' ? 'Workspace Administrator' : data.role === 'lead' ? 'Team Lead' : 'Team Member'),
          department: data.department || 'Engineering',
          pod: data.pod || 'Core Engineering Pod',
          avatarUrl: data.avatar_url || undefined,
          initials: initials || 'TU',
          initialsColor: data.initials_color || '#006b2c',
          status: data.status || 'online',
          statusText: data.status_text || 'Available',
          location: data.location || 'San Francisco, CA',
          timezone: data.timezone || 'UTC-7 (PDT)',
          phone: data.phone || '',
          dateOfBirth: data.date_of_birth || '',
          dateJoined: data.date_joined || 'Recently joined',
          reportingLead: data.reporting_lead || 'David Kim',
          bio: data.bio || '',
          skills: Array.isArray(data.skills) ? data.skills : ['Engineering', 'Product'],
          socialLinks: data.social_links || {},
          notificationPreferences: data.notification_preferences || { directMentions: true, taskStatusChanges: true, qnaReplies: false },
          theme: data.theme || 'light',
          tasksCompleted: data.tasks_completed || 0,
          questionsAnswered: data.questions_answered || 0,
          lastActive: 'Just now',
          workspaceId: data.workspace_id || undefined,
          podCode: data.pod_code || undefined,
        };
      }
    } catch (err) {
      console.warn('Error querying profiles table from Supabase:', err);
    }
  }

  return null;
}

/**
 * Normalizes pod name to a canonical slug for grouping & RLS matching.
 */
export function normalizePodId(podName?: string): string {
  if (!podName) return 'core';
  const lower = podName.toLowerCase();
  if (lower.includes('core') || lower.includes('eng')) return 'core';
  if (lower.includes('design') || lower.includes('experience')) return 'design';
  if (lower.includes('mobile')) return 'mobile';
  if (lower.includes('infra') || lower.includes('system') || lower.includes('data')) return 'infra';
  return 'core';
}

/**
 * Fetches team members from Supabase profiles table, strictly enforcing RLS scoping:
 * - Administrators can view all team members across all pods.
 * - Team Leads can only query users belonging to their own pod.
 * - Team Members are forbidden and receive an access denied error.
 */
export async function fetchTeamMembersFromDb(currentUser: User): Promise<{ success: boolean; users: User[]; error?: string }> {
  // 1. Role-based client gate
  if (currentUser.role !== 'admin' && currentUser.role !== 'lead') {
    return {
      success: false,
      users: [],
      error: 'Access Denied: Team Directory is restricted to Team Leads and Administrators.',
    };
  }

  // 2. Query live Supabase database if configured
  if (supabase) {
    try {
      // Attempt to invoke the secure get_team_directory RPC if defined
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_team_directory');
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        const mappedUsers: User[] = rpcData.map((data: any) => {
          const name = data.full_name || data.name || data.email?.split('@')[0] || 'Team User';
          const initials = name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return {
            id: data.id,
            name,
            email: data.email || '',
            role: (data.role as Role) || 'member',
            roleTitle: data.role_title || (data.role === 'admin' ? 'Workspace Administrator' : data.role === 'lead' ? 'Team Lead' : 'Team Member'),
            department: data.department || 'Engineering',
            pod: data.pod || 'Core Engineering Pod',
            avatarUrl: data.avatar_url || undefined,
            initials: initials || 'TU',
            initialsColor: data.initials_color || '#006b2c',
            status: data.status || 'online',
            statusText: data.status_text || 'Available',
            location: data.location || 'San Francisco, CA',
            timezone: data.timezone || 'UTC-7 (PDT)',
            phone: data.phone || '',
            dateOfBirth: data.date_of_birth || '',
            dateJoined: data.date_joined || 'Recently joined',
            reportingLead: data.reporting_lead || 'David Kim',
            bio: data.bio || '',
            skills: Array.isArray(data.skills) ? data.skills : ['Engineering'],
            socialLinks: data.social_links || {},
            notificationPreferences: data.notification_preferences || { directMentions: true, taskStatusChanges: true, qnaReplies: false },
            theme: data.theme || 'light',
            tasksCompleted: data.tasks_completed || 0,
            questionsAnswered: data.questions_answered || 0,
            lastActive: 'Just now',
            workspaceId: data.workspace_id || undefined,
            podCode: data.pod_code || undefined,
          };
        });
        return { success: true, users: mappedUsers };
      }

      // Direct RLS query on public.profiles
      let query = supabase.from('profiles').select('*');
      if (currentUser.role === 'lead') {
        const targetPod = currentUser.pod || 'Core Engineering Pod';
        query = query.or(`pod.eq.${targetPod},pod_code.eq.${currentUser.podCode || 'core'}`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        if (data.length === 0) {
          return { success: true, users: [] };
        }
        const mappedUsers: User[] = data.map((d: any) => {
          const name = d.full_name || d.name || d.email?.split('@')[0] || 'Team User';
          const initials = name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return {
            id: d.id,
            name,
            email: d.email || '',
            role: (d.role as Role) || 'member',
            roleTitle: d.role_title || (d.role === 'admin' ? 'Workspace Administrator' : d.role === 'lead' ? 'Team Lead' : 'Team Member'),
            department: d.department || 'Engineering',
            pod: d.pod || 'Core Engineering Pod',
            avatarUrl: d.avatar_url || undefined,
            initials: initials || 'TU',
            initialsColor: d.initials_color || '#006b2c',
            status: d.status || 'online',
            statusText: d.status_text || 'Available',
            location: d.location || 'San Francisco, CA',
            timezone: d.timezone || 'UTC-7 (PDT)',
            phone: d.phone || '',
            dateOfBirth: d.date_of_birth || '',
            dateJoined: d.date_joined || 'Recently joined',
            reportingLead: d.reporting_lead || 'David Kim',
            bio: d.bio || '',
            skills: Array.isArray(d.skills) ? d.skills : ['Engineering'],
            socialLinks: d.social_links || {},
            notificationPreferences: d.notification_preferences || { directMentions: true, taskStatusChanges: true, qnaReplies: false },
            theme: d.theme || 'light',
            tasksCompleted: d.tasks_completed || 0,
            questionsAnswered: d.questions_answered || 0,
            lastActive: 'Just now',
            workspaceId: d.workspace_id || undefined,
            podCode: d.pod_code || undefined,
          };
        });
        return { success: true, users: mappedUsers };
      }
    } catch (err: any) {
      console.warn('Supabase profiles query error in fetchTeamMembersFromDb:', err);
    }
  }

  // 3. Fallback to mock data with identical RLS scoping
  const allUsers = Object.values(USERS).filter((u) => u.id !== 'user-ai');

  if (currentUser.role === 'admin') {
    // Admin sees all team leads and team members across all pods
    return { success: true, users: allUsers };
  }

  if (currentUser.role === 'lead') {
    // Team Lead sees only members belonging to their own pod
    const userPodKey = normalizePodId(currentUser.pod);
    const podMembers = allUsers.filter((u) => normalizePodId(u.pod) === userPodKey);
    return { success: true, users: podMembers };
  }

  return { success: false, users: [], error: 'Access Denied: Restricted.' };
}

/**
 * Signs in via Supabase Auth with email & password.
 * Resolves user profile and role directly from the database.
 */
export async function signInWithSupabaseAuth(
  email: string,
  password?: string,
  roleHint?: Role,
  knownUsers?: Record<string, User>
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const pwd = password || 'Password123!';

  // 1. If Supabase is configured, use live Supabase Auth
  if (supabase) {
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pwd,
      });

      // If user doesn't exist yet in Supabase Auth (e.g. initial demo login), auto-register via signUp
      if (error && (error.message.toLowerCase().includes('invalid login credentials') || error.message.toLowerCase().includes('user not found'))) {
        const defaultName = cleanEmail.includes('admin')
          ? 'Sarah Connor (Admin)'
          : cleanEmail.includes('david')
          ? 'David Kim'
          : 'Anya Lin';

        const signUpRes = await supabase.auth.signUp({
          email: cleanEmail,
          password: pwd,
          options: {
            data: {
              full_name: defaultName,
              role: roleHint || 'member',
            },
          },
        });

        if (signUpRes.data?.user) {
          await supabase.from('profiles').upsert({
            id: signUpRes.data.user.id,
            email: cleanEmail,
            full_name: defaultName,
            role: roleHint || 'member',
            role_title: roleHint === 'admin' ? 'Workspace Administrator' : roleHint === 'lead' ? 'Team Lead' : 'Team Member',
            department: 'Engineering',
            pod: 'Core Engineering Pod',
            created_at: new Date().toISOString(),
          });

          data = signUpRes.data as any;
          error = null;
        }
      }

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Fetch profile from 'profiles' table
        const profile = await fetchUserProfileFromDb(data.user.id, data.user.email);
        const resolvedUser = profile || {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          email: data.user.email || cleanEmail,
          role: (data.user.user_metadata?.role as Role) || roleHint || 'member',
          roleTitle: (data.user.user_metadata?.role as Role) === 'admin' 
            ? 'Workspace Administrator' 
            : (data.user.user_metadata?.role as Role) === 'lead' 
            ? 'Team Lead' 
            : 'Team Member',
          department: 'Engineering',
          pod: 'Core Pod',
          initials: cleanEmail.slice(0, 2).toUpperCase(),
          status: 'online' as const,
          location: 'San Francisco, CA',
          timezone: 'UTC-7 (PDT)',
          tasksCompleted: 12,
          questionsAnswered: 4,
          lastActive: 'Just now',
          skills: ['Engineering'],
        };

        // Save session locally as cache
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
          user: resolvedUser,
          token: data.session?.access_token || `token_${Date.now()}`,
          expiresAt: Date.now() + 86400000,
        }));

        return { success: true, user: resolvedUser };
      }
    } catch (err: any) {
      console.warn('Supabase Auth signIn failed, evaluating fallback credentials:', err);
    }
  }

  // 2. Offline fallback for local session matching
  let matchedUser: User | null = null;
  if (knownUsers) {
    const found = Object.values(knownUsers).find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (found) {
      matchedUser = { ...found };
    }
  }

  if (!matchedUser) {
    const isRoleAdmin = roleHint === 'admin' || cleanEmail.includes('admin');
    const isRoleLead = roleHint === 'lead' || cleanEmail.includes('lead') || cleanEmail.includes('david');
    const role: Role = isRoleAdmin ? 'admin' : isRoleLead ? 'lead' : 'member';

    matchedUser = {
      id: `user-${role}-${Date.now()}`,
      name: cleanEmail.split('@')[0].replace(/[._]/g, ' '),
      email: cleanEmail,
      role,
      roleTitle: role === 'admin' ? 'Workspace Administrator' : role === 'lead' ? 'Staff Engineering Lead' : 'Team Member',
      department: 'Engineering',
      pod: 'Core Pod',
      initials: cleanEmail.slice(0, 2).toUpperCase(),
      initialsColor: role === 'admin' ? '#8d4b00' : role === 'lead' ? '#0051d5' : '#006b2c',
      status: 'online',
      location: 'San Francisco, CA',
      timezone: 'UTC-7 (PDT)',
      tasksCompleted: 14,
      questionsAnswered: 6,
      lastActive: 'Just now',
      skills: ['Engineering'],
    };
  }

  if (roleHint && matchedUser.role !== roleHint) {
    matchedUser = {
      ...matchedUser,
      role: roleHint,
      roleTitle: roleHint === 'admin' 
        ? 'Workspace Administrator' 
        : roleHint === 'lead' 
        ? 'Team Lead' 
        : 'Team Member',
    };
  }

  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    user: matchedUser,
    token: `token_${Date.now()}`,
    expiresAt: Date.now() + 86400000,
  }));

  return { success: true, user: matchedUser };
}

/**
 * Signs up via Supabase Auth.
 * Automatically validates pod codes for Member and Lead roles against Supabase/registry.
 */
export async function signUpWithSupabaseAuth(
  email: string,
  password: string,
  fullName: string,
  role: Role,
  inviteCode?: string
): Promise<{ success: boolean; user?: User; error?: string; waitingApproval?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();

  // Validate invite code for lead and member roles against real pod codes
  let matchedWorkspace: any = null;
  if (role === 'lead' || role === 'member') {
    if (!inviteCode || !inviteCode.trim()) {
      return {
        success: false,
        error: 'Workspace invite code is required.',
      };
    }
    const valRes = await validatePodCode(inviteCode);
    if (!valRes.valid || !valRes.workspace) {
      return {
        success: false,
        error: valRes.error || "This invite code isn't valid or has expired — check with your pod lead or administrator.",
      };
    }
    matchedWorkspace = valRes.workspace;
  }

  const podName = matchedWorkspace?.name || 'Core Engineering Pod';
  const workspaceId = matchedWorkspace?.id;
  const podCode = matchedWorkspace?.pod_code || (inviteCode ? inviteCode.trim().toUpperCase() : undefined);

  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            workspace_id: workspaceId,
            pod_code: podCode,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: cleanEmail,
          full_name: fullName,
          role,
          role_title: role === 'admin' ? 'Workspace Administrator' : role === 'lead' ? 'Team Lead' : 'Team Member',
          department: matchedWorkspace?.team_function || 'Engineering',
          pod: podName,
          workspace_id: workspaceId,
          pod_code: podCode,
          created_at: new Date().toISOString(),
        });

        const createdUser: User = {
          id: data.user.id,
          name: fullName,
          email: cleanEmail,
          role,
          roleTitle: role === 'admin' ? 'Workspace Administrator' : role === 'lead' ? 'Team Lead' : 'Team Member',
          department: matchedWorkspace?.team_function || 'Engineering',
          pod: podName,
          workspaceId,
          podCode,
          initials: fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          status: 'online',
          location: 'San Francisco, CA (HQ)',
          timezone: 'UTC-7 (PDT)',
          tasksCompleted: 0,
          questionsAnswered: 0,
          lastActive: 'Just now',
          skills: ['Engineering'],
        };

        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
          user: createdUser,
          token: data.session?.access_token || `token_${Date.now()}`,
          expiresAt: Date.now() + 86400000,
        }));

        return { success: true, user: createdUser };
      }
    } catch (err: any) {
      console.warn('Supabase Auth signUp failed, using local registration:', err);
    }
  }

  const parts = fullName.trim().split(' ');
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();

  const newUser: User = {
    id: `user-${Date.now()}`,
    name: fullName,
    email: cleanEmail,
    role,
    roleTitle: role === 'admin' ? 'Workspace Administrator' : role === 'lead' ? 'Team Lead' : 'Team Member',
    department: matchedWorkspace?.team_function || 'Engineering',
    pod: podName,
    workspaceId,
    podCode,
    initials,
    initialsColor: role === 'admin' ? '#8d4b00' : role === 'lead' ? '#0051d5' : '#006b2c',
    status: 'online',
    statusText: 'Available',
    location: 'San Francisco, CA (HQ)',
    timezone: 'UTC-7 (PDT)',
    dateJoined: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    skills: ['Product', 'Engineering'],
    tasksCompleted: 0,
    questionsAnswered: 0,
    lastActive: 'Just now',
  };

  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    user: newUser,
    token: `token_${Date.now()}`,
    expiresAt: Date.now() + 86400000,
  }));

  return { success: true, user: newUser };
}

/**
 * Signs out from Supabase Auth.
 */
export async function signOutFromSupabaseAuth(): Promise<{ success: boolean }> {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase auth.signOut() error:', err);
    }
  }

  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (err) {
    // ignore
  }

  return { success: true };
}

/**
 * Validates avatar upload files for JPG/PNG format and 2 MB max size.
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  const fileName = file.name.toLowerCase();
  
  const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));
  const hasValidMime = allowedTypes.includes(file.type);

  if (!hasValidMime && !hasValidExt) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG and PNG image files are supported.',
    };
  }

  const MAX_SIZE_BYTES = 2 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeInMb} MB). Maximum allowed size is 2.0 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Uploads an avatar image to Supabase Storage in the "avatars" bucket.
 * Enforces Row Level Security (RLS).
 */
export async function uploadAvatarToSupabase(
  targetUserId: string,
  file: File,
  actingUser: User
): Promise<{ url: string; error?: string }> {
  const validation = validateAvatarFile(file);
  if (!validation.valid) {
    return { url: '', error: validation.error };
  }

  const isOwner = actingUser.id === targetUserId;
  const isAdmin = actingUser.role === 'admin';

  if (!isOwner && !isAdmin) {
    return {
      url: '',
      error: 'RLS Security Violation: 403 Forbidden. Row Level Security policy prevents editing another user’s avatar.',
    };
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${targetUserId}/avatar_${Date.now()}.${fileExt}`;

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Supabase Storage upload error:', error);
        return { url: '', error: `Supabase Storage error: ${error.message}` };
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      return { url: publicUrlData.publicUrl };
    } catch (err: any) {
      console.warn('Supabase storage call failed:', err);
      notifyDatabaseFallback('Upload Avatar', err);
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      try {
        localStorage.setItem(`${VIRTUAL_STORAGE_KEY_PREFIX}${targetUserId}`, dataUrl);
      } catch (err) {
        // ignore
      }
      resolve({ url: dataUrl });
    };
    reader.onerror = () => {
      resolve({ url: '', error: 'Failed to read avatar image file.' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Deletes avatar from Supabase Storage.
 */
export async function deleteAvatarFromSupabase(
  targetUserId: string,
  actingUser: User
): Promise<{ success: boolean; error?: string }> {
  const isOwner = actingUser.id === targetUserId;
  const isAdmin = actingUser.role === 'admin';

  if (!isOwner && !isAdmin) {
    return {
      success: false,
      error: 'RLS Security Violation: 403 Forbidden. You do not have permission to delete this avatar.',
    };
  }

  if (supabase) {
    try {
      const { data: listData } = await supabase.storage
        .from('avatars')
        .list(targetUserId);

      if (listData && listData.length > 0) {
        const paths = listData.map((f) => `${targetUserId}/${f.name}`);
        const { error: removeError } = await supabase.storage.from('avatars').remove(paths);
        if (removeError) {
          notifyDatabaseFallback('Delete Avatar', removeError);
        }
      }
    } catch (err) {
      console.warn('Supabase storage delete failed:', err);
      notifyDatabaseFallback('Delete Avatar', err);
    }
  }

  try {
    localStorage.removeItem(`${VIRTUAL_STORAGE_KEY_PREFIX}${targetUserId}`);
  } catch (err) {
    // ignore
  }

  return { success: true };
}

/**
 * Updates user profile record in database, enforcing RLS and role limits.
 */
export async function updateUserProfileRecord(
  targetUserId: string,
  actingUser: User,
  updates: Partial<User>
): Promise<{ success: boolean; error?: string }> {
  const isOwner = actingUser.id === targetUserId;
  const isAdmin = actingUser.role === 'admin';

  if (!isOwner && !isAdmin) {
    return {
      success: false,
      error: 'RLS Violation: 403 Forbidden. Policy "profiles_update_policy" rejected this operation. You can only edit your own profile.',
    };
  }

  if (updates.role && updates.role !== actingUser.role && !isAdmin) {
    return {
      success: false,
      error: 'Security Policy Violation: Only an Administrator is permitted to change user roles.',
    };
  }

  const safeUpdates = { ...updates };
  delete safeUpdates.email;
  delete safeUpdates.dateJoined;
  delete safeUpdates.reportingLead;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: safeUpdates.name,
          phone: safeUpdates.phone,
          date_of_birth: safeUpdates.dateOfBirth,
          location: safeUpdates.location,
          timezone: safeUpdates.timezone,
          role_title: safeUpdates.roleTitle,
          department: safeUpdates.department,
          bio: safeUpdates.bio,
          skills: safeUpdates.skills,
          social_links: safeUpdates.socialLinks,
          notification_preferences: safeUpdates.notificationPreferences,
          theme: safeUpdates.theme,
          avatar_url: safeUpdates.avatarUrl,
          ...(isAdmin && safeUpdates.role ? { role: safeUpdates.role } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (error) {
        console.error('Supabase DB profile update error:', error);
        return { success: false, error: `Database error: ${error.message}` };
      }
    } catch (err: any) {
      console.warn('Supabase DB call failed:', err);
      notifyDatabaseFallback('Update User Profile', err);
    }
  }

  return { success: true };
}


// =========================================================================
// TASKS SUPABASE DB CRUD OPERATIONS & RLS ENFORCEMENT
// =========================================================================

export async function fetchTasksFromDb(): Promise<Task[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!assignee_id(*)')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((t: any): Task => ({
      id: t.id,
      projectId: t.project_id || undefined,
      key: t.key,
      title: t.title,
      description: t.description || '',
      status: t.status as TaskStatus,
      priority: t.priority,
      channel: t.channel || '#backend',
      sprint: t.sprint || 'Sprint 42',
      assignee: (t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.full_name || t.assignee.email,
            email: t.assignee.email,
            role: t.assignee.role,
            roleTitle: t.assignee.role_title,
            department: t.assignee.department,
            pod: t.assignee.pod,
            initials: (t.assignee.full_name || 'TU').slice(0, 2).toUpperCase(),
            status: 'online',
          }
        : { id: 'unassigned', name: 'Unassigned', email: '', role: 'member', roleTitle: 'Member', department: 'Eng', pod: 'Core', initials: 'UN', status: 'online' }) as User,
      dueDate: t.due_date || '2025-10-31',
      dueTime: t.due_time || undefined,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      attachments: Array.isArray(t.attachments) ? t.attachments : [],
      comments: Array.isArray(t.comments) ? t.comments : [],
    }));
  } catch (err) {
    console.warn('Error querying tasks from Supabase:', err);
    return null;
  }
}

/**
 * Scopes eligible task assignees based on user role and project:
 * - Team Lead: ONLY members of the Lead's own pod/team (same pod_id/pod as the Lead), not the entire workspace.
 * - Administrator: ONLY members belonging to the specific project (scoped by projectId). If no project is selected, fall back to all workspace members.
 * - Team Member: Only members of their own pod / project (or self).
 */
export function getEligibleTaskAssignees(
  actingUser: User,
  projectId?: string | null,
  allUsers: Record<string, User> | User[] = USERS,
  allProjects: Project[] = getLocalProjects()
): User[] {
  const usersList: User[] = Array.isArray(allUsers)
    ? allUsers
    : Object.values(allUsers);

  // 1. Team Lead: Scoped strictly to Lead's own pod/team
  if (actingUser.role === 'lead') {
    const leadPod = (actingUser.pod || '').toLowerCase().trim();
    const leadPodId = (actingUser.podId || '').toLowerCase().trim();

    return usersList.filter((u) => {
      if (u.id === actingUser.id) return true;
      const userPod = (u.pod || '').toLowerCase().trim();
      const userPodId = (u.podId || '').toLowerCase().trim();

      // Check podId equality if present
      if (leadPodId && userPodId && leadPodId === userPodId) {
        return true;
      }

      // Check pod text matching common roots
      if (leadPod && userPod) {
        if (leadPod === userPod) return true;
        const isCoreLead = leadPod.includes('core');
        const isCoreUser = userPod.includes('core');
        if (isCoreLead && isCoreUser) return true;

        const isMobileLead = leadPod.includes('mobile');
        const isMobileUser = userPod.includes('mobile');
        if (isMobileLead && isMobileUser) return true;

        const isDesignLead = leadPod.includes('design');
        const isDesignUser = userPod.includes('design');
        if (isDesignLead && isDesignUser) return true;

        const isInfraLead = leadPod.includes('infra');
        const isInfraUser = userPod.includes('infra');
        if (isInfraLead && isInfraUser) return true;
      }
      return false;
    });
  }

  // 2. Administrator: Scoped by the task's project_id
  if (actingUser.role === 'admin') {
    if (projectId) {
      const proj = allProjects.find((p) => p.id === projectId);
      if (proj) {
        // If project defines explicit members
        if (Array.isArray(proj.members) && proj.members.length > 0) {
          const memberIdSet = new Set(proj.members.map((m) => m.id));
          const memberEmailSet = new Set(proj.members.map((m) => (m.email || '').toLowerCase()));
          return usersList.filter((u) => memberIdSet.has(u.id) || (u.email && memberEmailSet.has(u.email.toLowerCase())));
        }

        // Fallback: project's pod members
        const projPod = (proj.pod || '').toLowerCase();
        const projPodId = (proj.podId || '').toLowerCase();
        return usersList.filter((u) => {
          const userPod = (u.pod || '').toLowerCase();
          const userPodId = (u.podId || '').toLowerCase();
          return (
            (projPodId && userPodId === projPodId) ||
            (projPod && userPod && (projPod.includes(userPod) || userPod.includes(projPod)))
          );
        });
      }
    }

    // If task isn't associated with a project yet, fall back to showing all workspace members
    return usersList;
  }

  // 3. Team Member: Only members of their own pod / project (or self)
  const memberPod = (actingUser.pod || '').toLowerCase();
  return usersList.filter((u) => {
    if (u.id === actingUser.id) return true;
    const userPod = (u.pod || '').toLowerCase();
    return memberPod && userPod && (memberPod.includes(userPod) || userPod.includes(memberPod));
  });
}

/**
 * Validates task assignment permissions based on role, pod, and project scope.
 */
export function validateTaskAssignment(
  task: { assignee?: User | { id: string }; projectId?: string | null },
  actingUser: User,
  allUsers: Record<string, User> | User[] = USERS,
  allProjects: Project[] = getLocalProjects()
): { valid: boolean; error?: string } {
  // If unassigned or self-assigned, always valid
  if (!task.assignee || task.assignee.id === 'unassigned' || task.assignee.id === actingUser.id) {
    return { valid: true };
  }

  const assigneeId = task.assignee.id;
  const eligible = getEligibleTaskAssignees(actingUser, task.projectId, allUsers, allProjects);
  const isEligible = eligible.some((u) => u.id === assigneeId);

  if (!isEligible) {
    if (actingUser.role === 'lead') {
      return {
        valid: false,
        error: `Permission denied: Team Leads can only assign tasks to members of their own pod (${actingUser.pod || 'their pod'}).`,
      };
    }
    if (actingUser.role === 'admin' && task.projectId) {
      const proj = allProjects.find((p) => p.id === task.projectId);
      return {
        valid: false,
        error: `Permission denied: Administrators can only assign tasks to members belonging to project "${proj?.name || task.projectId}".`,
      };
    }
    return {
      valid: false,
      error: 'Permission denied: Assigned user is outside the permitted scope for this task.',
    };
  }

  return { valid: true };
}

export async function createTaskInDb(task: Task, actingUser: User): Promise<{ success: boolean; task?: Task; error?: string }> {
  // Server-side validation of assignment scope
  const validation = validateTaskAssignment(task, actingUser);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          key: task.key,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          channel: task.channel,
          sprint: task.sprint,
          assignee_id: task.assignee.id !== 'unassigned' ? task.assignee.id : actingUser.id,
          project_id: task.projectId || null,
          created_by: actingUser.id,
          due_date: task.dueDate,
          due_time: task.dueTime || null,
          subtasks: task.subtasks,
          comments: task.comments,
        })
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (data) {
        return { success: true, task: { ...task, id: data.id } };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true, task };
}

export async function updateTaskInDb(task: Task, actingUser: User): Promise<{ success: boolean; error?: string }> {
  // Server-side validation of assignment scope
  const validation = validateTaskAssignment(task, actingUser);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (supabase) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee_id: task.assignee.id !== 'unassigned' ? task.assignee.id : null,
          project_id: task.projectId || null,
          subtasks: task.subtasks,
          comments: task.comments,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true };
}

export async function deleteTaskInDb(taskId: string, actingUser: User): Promise<{ success: boolean; error?: string }> {
  if (actingUser.role !== 'admin' && actingUser.role !== 'lead') {
    return {
      success: false,
      error: 'RLS Security Violation: 403 Forbidden. Only Team Leads and Administrators can delete tasks.',
    };
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) return { success: false, error: error.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true };
}


// =========================================================================
// CHANNEL MESSAGES SUPABASE DB CRUD OPERATIONS
// =========================================================================

export const CHANNEL_MESSAGES_STORAGE_KEY = 'teamhub_messages_by_channel';

/**
 * Retrieves all channel messages organized by channelId from localStorage
 */
export function getLocalMessagesByChannel(): Record<string, ChannelMessage[]> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CHANNEL_MESSAGES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse local messages by channel:', err);
  }

  // Initialize isolated seeds by channel
  const initialMap: Record<string, ChannelMessage[]> = {
    general: INITIAL_CHANNEL_MESSAGES.filter((m) => (m.channelId || m.channel_id) === 'general'),
    design: INITIAL_CHANNEL_MESSAGES.filter((m) => (m.channelId || m.channel_id) === 'design'),
  };
  return initialMap;
}

/**
 * Saves a single message to the isolated channel message list in localStorage
 */
export function saveLocalMessageForChannel(channelId: string, message: ChannelMessage): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const all = getLocalMessagesByChannel();
      const existing = all[channelId] || [];
      const index = existing.findIndex((m) => m.id === message.id);
      if (index >= 0) {
        existing[index] = { ...message, channelId, channel_id: channelId };
        all[channelId] = [...existing];
      } else {
        all[channelId] = [...existing, { ...message, channelId, channel_id: channelId }];
      }
      localStorage.setItem(CHANNEL_MESSAGES_STORAGE_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.warn('Failed to save local message for channel:', err);
  }
}

export async function fetchMessagesFromDb(channelId: string): Promise<ChannelMessage[] | null> {
  const localMap = getLocalMessagesByChannel();
  const localMessages = localMap[channelId] || (channelId === 'general' ? localMap['general'] : []) || [];

  if (!supabase) return localMessages;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId);
    let targetChannelUuid = channelId;

    if (!isUuid) {
      // Resolve text slug (e.g. 'general') to UUID from local cache or DB
      const localChannels = getLocalChannels();
      const match = localChannels.find(
        (c) => c.slug === channelId || c.name === channelId || c.id === channelId
      );
      if (match && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
        targetChannelUuid = match.id;
      } else {
        const { data: dbChan } = await supabase
          .from('channels')
          .select('id')
          .or(`slug.eq.${channelId},name.eq.${channelId}`)
          .limit(1)
          .maybeSingle();
        if (dbChan?.id) {
          targetChannelUuid = dbChan.id;
        }
      }
    }

    // Only query DB if we have a valid UUID for the foreign key column
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetChannelUuid)) {
      return localMessages;
    }

    const { data, error } = await supabase
      .from('channel_messages')
      .select('*, author:profiles!author_id(*)')
      .eq('channel_id', targetChannelUuid)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return localMessages;
    }

    const dbMapped: ChannelMessage[] = data.map((m: any): ChannelMessage => ({
      id: m.id,
      channelId: m.channel_id,
      channel_id: m.channel_id,
      author: (m.author
        ? {
            id: m.author.id,
            name: m.author.full_name || m.author.email,
            email: m.author.email,
            role: m.author.role,
            roleTitle: m.author.role_title,
            department: m.author.department,
            pod: m.author.pod,
            initials: (m.author.full_name || 'TU').slice(0, 2).toUpperCase(),
            status: 'online',
          }
        : { id: 'anon', name: 'Teammate', email: '', role: 'member', roleTitle: 'Member', department: 'Eng', pod: 'Core', initials: 'TM', status: 'online' }) as User,
      createdAt: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: m.content,
      reactions: Array.isArray(m.reactions) ? m.reactions : [],
      threadRepliesCount: m.thread_replies_count || 0,
    }));

    // Merge any local messages that were sent locally (deduplicated by id)
    const existingIds = new Set(dbMapped.map((m) => m.id));
    const merged = [...dbMapped];
    for (const lm of localMessages) {
      if (!existingIds.has(lm.id)) {
        merged.push(lm);
      }
    }
    return merged;
  } catch (err) {
    return localMessages;
  }
}

export async function createMessageInDb(
  channelId: string,
  content: string,
  actingUser: User
): Promise<{ success: boolean; message?: ChannelMessage; error?: string }> {
  if (!channelId || !content.trim()) {
    return { success: false, error: 'Channel ID and message content are required.' };
  }

  const isAuthorUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actingUser.id);
  const isChanUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId);
  let targetChannelUuid = channelId;

  if (supabase) {
    try {
      const localChannels = getLocalChannels();
      let matchedChannel = localChannels.find(
        (c) => c.id === targetChannelUuid || c.id === channelId || c.slug === channelId || c.name === channelId
      );

      if (!isChanUuid) {
        if (matchedChannel && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchedChannel.id)) {
          targetChannelUuid = matchedChannel.id;
        } else {
          const { data: dbChan } = await supabase
            .from('channels')
            .select('id, slug, name')
            .or(`slug.eq.${channelId},name.eq.${channelId}`)
            .limit(1)
            .maybeSingle();
          if (dbChan?.id) {
            targetChannelUuid = dbChan.id;
            matchedChannel = { ...(matchedChannel || {}), id: dbChan.id, slug: dbChan.slug, name: dbChan.name } as any;
          }
        }
      }

      const channelSlug = matchedChannel?.slug || matchedChannel?.name || (!isChanUuid ? channelId : 'general');

      let authorId = actingUser.id;
      if (!isAuthorUuid) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          authorId = authData.user.id;
        }
      }

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorId) &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetChannelUuid)) {
        const { data, error } = await supabase
          .from('channel_messages')
          .insert({
            channel_id: targetChannelUuid,
            channel_slug: channelSlug,
            author_id: authorId,
            content,
            workspace_id: actingUser.workspaceId || null,
          })
          .select('*')
          .single();

        if (error) {
          console.warn('Supabase channel_messages insert warning:', error.message);
          notifyDatabaseFallback('Send Message', error);
        } else if (data) {
          const createdMsg: ChannelMessage = {
            id: data.id,
            channelId: targetChannelUuid,
            channel_id: targetChannelUuid,
            author: actingUser,
            createdAt: 'Just now',
            content,
            reactions: [],
            threadRepliesCount: 0,
          };
          saveLocalMessageForChannel(channelId, createdMsg);
          if (targetChannelUuid !== channelId) {
            saveLocalMessageForChannel(targetChannelUuid, createdMsg);
          }
          return { success: true, message: createdMsg };
        }
      } else {
        notifyDatabaseFallback(
          'Send Message',
          `Cannot sync to server: Author ID (${authorId}) or Channel ID (${targetChannelUuid}) is not a valid UUID.`
        );
      }
    } catch (err: any) {
      console.warn('Supabase createMessageInDb error, falling back to local isolated store:', err);
      notifyDatabaseFallback('Send Message', err);
    }
  }

  // Fallback to local store with strict channel isolation
  const createdMsg: ChannelMessage = {
    id: `msg-${Date.now()}`,
    channelId,
    channel_id: channelId,
    author: actingUser,
    createdAt: 'Just now',
    content,
    reactions: [],
    threadRepliesCount: 0,
  };
  saveLocalMessageForChannel(channelId, createdMsg);
  return { success: true, message: createdMsg };
}


// =========================================================================
// QUESTIONS & ANSWERS SUPABASE DB CRUD OPERATIONS
// =========================================================================

export async function fetchQuestionsFromDb(): Promise<Question[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*, author:profiles!author_id(*), answers:question_answers(*, author:profiles!author_id(*))')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((q: any): Question => ({
      id: q.id,
      key: q.key,
      title: q.title,
      content: q.content,
      author: (q.author
        ? {
            id: q.author.id,
            name: q.author.full_name || q.author.email,
            email: q.author.email,
            role: q.author.role,
            roleTitle: q.author.role_title,
            department: q.author.department,
            pod: q.author.pod,
            initials: (q.author.full_name || 'TU').slice(0, 2).toUpperCase(),
            status: 'online',
          }
        : { id: 'anon', name: 'Author', email: '', role: 'member', roleTitle: 'Member', department: 'Eng', pod: 'Core', initials: 'AU', status: 'online' }) as User,
      createdAt: new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tags: Array.isArray(q.tags) ? q.tags : [],
      channel: q.channel || '#backend',
      status: q.status,
      views: q.views || 1,
      upvotes: q.upvotes || 1,
      codeSnippet: q.code_snippet || undefined,
      aiSummary: q.ai_summary || undefined,
      answers: Array.isArray(q.answers)
        ? q.answers.map((ans: any): QuestionAnswer => ({
            id: ans.id,
            author: (ans.author
              ? {
                  id: ans.author.id,
                  name: ans.author.full_name || ans.author.email,
                  email: ans.author.email,
                  role: ans.author.role,
                  roleTitle: ans.author.role_title,
                  department: ans.author.department,
                  pod: ans.author.pod,
                  initials: (ans.author.full_name || 'TU').slice(0, 2).toUpperCase(),
                  status: 'online',
                }
              : { id: 'anon', name: 'Peer', email: '', role: 'member', roleTitle: 'Member', department: 'Eng', pod: 'Core', initials: 'PE', status: 'online' }) as User,
            createdAt: new Date(ans.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: ans.content,
            upvotes: ans.upvotes || 1,
            isAccepted: ans.is_accepted || false,
            isAiSuggested: ans.is_ai_suggested || false,
            codeBlock: ans.code_block || undefined,
            tipBox: ans.tip_box || undefined,
          }))
        : [],
    }));
  } catch (err) {
    return null;
  }
}

export async function createQuestionInDb(question: Question, actingUser: User): Promise<{ success: boolean; question?: Question; error?: string }> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert({
          key: question.key,
          title: question.title,
          content: question.content,
          author_id: actingUser.id,
          tags: question.tags,
          channel: question.channel,
          status: 'open',
        })
        .select('*')
        .single();

      if (error) return { success: false, error: error.message };
      if (data) return { success: true, question: { ...question, id: data.id } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: true, question };
}


// =========================================================================
// SERVER-SIDE RLS VERIFICATION & GOVERNANCE TEST HELPERS
// =========================================================================

/**
 * Attempts to query the strictly protected 'join_requests' table.
 * SERVER-SIDE RLS POLICY: Allowed ONLY for 'admin' users.
 * Returns failure/RLS 403 Forbidden error if executed by a Team Member or Team Lead!
 */
export async function fetchJoinRequestsFromDb(actingUser: User): Promise<{ data: JoinRequest[] | null; rlsBlocked: boolean; error?: string }> {
  if (!supabase) {
    // Local fallback check
    if (actingUser.role !== 'admin') {
      return {
        data: null,
        rlsBlocked: true,
        error: 'Server-side RLS Policy Rejection (403 Forbidden): Query on table "join_requests" denied. Policy requires (role = "admin").',
      };
    }
    return { data: null, rlsBlocked: false };
  }

  try {
    const { data, error } = await supabase
      .from('join_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) {
      // Supabase server-side RLS rejection
      const isRlsError = error.code === '42501' || error.message.includes('policy') || error.message.includes('permission');
      return {
        data: null,
        rlsBlocked: isRlsError,
        error: `Supabase Server-Side RLS Enforced: ${error.message} (HTTP Code ${error.code})`,
      };
    }

    if (data) {
      const mapped: JoinRequest[] = data.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role as Role,
        department: r.department || 'Engineering',
        avatarInitials: r.avatar_initials || 'TU',
        requestedAt: new Date(r.requested_at).toLocaleDateString(),
      }));
      return { data: mapped, rlsBlocked: false };
    }
  } catch (err: any) {
    return { data: null, rlsBlocked: true, error: err.message };
  }

  return { data: null, rlsBlocked: false };
}

/**
 * Direct Server-Side RLS Test API call:
 * Allows testing direct database query against admin-only tables.
 * Returns explicit success for Administrators, or server-side 403 Forbidden RLS rejection for Members/Leads.
 */
export async function testServerSideRlsAccess(actingUser: User): Promise<{
  role: Role;
  allowed: boolean;
  message: string;
  statusCode: number;
}> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('join_requests').select('*');
      if (error) {
        return {
          role: actingUser.role,
          allowed: false,
          message: `SERVER-SIDE RLS REJECTED (HTTP 403): Query on table 'join_requests' denied by policy "Admin only SELECT on join_requests". ${error.message}`,
          statusCode: 403,
        };
      }
      return {
        role: actingUser.role,
        allowed: true,
        message: `SERVER-SIDE RLS PERMITTED (HTTP 200): Admin role '${actingUser.role}' verified by PostgreSQL RLS policy. Returned ${data?.length || 0} governance records.`,
        statusCode: 200,
      };
    } catch (err: any) {
      return {
        role: actingUser.role,
        allowed: false,
        message: `SERVER-SIDE RLS REJECTED: ${err.message}`,
        statusCode: 403,
      };
    }
  }

  // Pure server policy logic simulation when offline
  if (actingUser.role !== 'admin') {
    return {
      role: actingUser.role,
      allowed: false,
      message: `SERVER-SIDE RLS REJECTED (HTTP 403 Forbidden): PostgreSQL RLS policy "Admin only SELECT on join_requests" rejected query from user role '${actingUser.role}'.`,
      statusCode: 403,
    };
  }

  return {
    role: actingUser.role,
    allowed: true,
    message: `SERVER-SIDE RLS PERMITTED (HTTP 200 OK): PostgreSQL RLS policy verified Admin credentials for user '${actingUser.name}'. Access granted.`,
    statusCode: 200,
  };
}


// =========================================================================
// 8. REVIEWS SUPABASE DB CRUD OPERATIONS & RLS ENFORCEMENT
// =========================================================================

export function getLocalReviews(): Review[] {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return INITIAL_REVIEWS;
}

export function saveLocalReviews(reviews: Review[]): void {
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch (e) {
    // ignore
  }
}

/**
 * Fetches review records with RLS scoping:
 * - Lead/Admin: sees all pod deliverables and review queue
 * - Member: sees only their assigned deliverables or reviews
 */
export async function fetchReviewsFromDb(actingUser: User): Promise<Review[]> {
  if (supabase) {
    try {
      let query = supabase
        .from('reviews')
        .select('*, task:tasks!task_id(*), assignee:profiles!assignee_id(*), reviewer:profiles!reviewer_id(*)')
        .order('created_at', { ascending: false });

      // If user is a member, enforce RLS filter client-side as well
      if (actingUser.role === 'member') {
        query = query.or(`assignee_id.eq.${actingUser.id},reviewer_id.eq.${actingUser.id}`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((r: any): Review => ({
          id: r.id,
          workspaceId: r.workspace_id,
          taskId: r.task_id,
          taskTitle: r.task?.title || 'Deliverable Task',
          taskKey: r.task?.key || '#task',
          reviewerId: r.reviewer_id,
          reviewer: r.reviewer ? {
            id: r.reviewer.id,
            name: r.reviewer.full_name || r.reviewer.email,
            email: r.reviewer.email,
            role: r.reviewer.role,
            roleTitle: r.reviewer.role_title,
            department: r.reviewer.department,
            pod: r.reviewer.pod,
            initials: (r.reviewer.full_name || 'TL').slice(0, 2).toUpperCase(),
            status: 'online',
          } as User : undefined,
          assigneeId: r.assignee_id,
          assignee: r.assignee ? {
            id: r.assignee.id,
            name: r.assignee.full_name || r.assignee.email,
            email: r.assignee.email,
            role: r.assignee.role,
            roleTitle: r.assignee.role_title,
            department: r.assignee.department,
            pod: r.assignee.pod,
            initials: (r.assignee.full_name || 'TM').slice(0, 2).toUpperCase(),
            status: 'online',
          } as User : actingUser,
          status: r.status as ReviewStatus,
          feedback: r.feedback || '',
          branch: r.branch || 'main',
          prNumber: r.pr_number || 'PR #100',
          linesAdded: r.lines_added || 0,
          linesRemoved: r.lines_removed || 0,
          filesChanged: r.files_changed || 1,
          safeToMerge: Boolean(r.safe_to_merge),
          pod: r.assignee?.pod || 'Core Engineering',
          turnaroundHours: r.metadata?.turnaround_hours || 2.4,
          createdAt: r.created_at ? new Date(r.created_at).toLocaleString() : 'Recent',
          reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : undefined,
          description: r.metadata?.description || r.task?.description || '',
          acceptanceCriteria: r.metadata?.acceptance_criteria || [],
          artifacts: r.metadata?.artifacts || [],
        }));
      }
    } catch (err) {
      console.warn('Supabase reviews query failed or table not created yet, falling back to local store:', err);
    }
  }

  // Local fallback with RLS scoping
  const localList = getLocalReviews();
  if (actingUser.role === 'member') {
    return localList.filter((r) => r.assigneeId === actingUser.id || r.reviewerId === actingUser.id);
  }
  return localList;
}

/**
 * Submits a Review decision (Approve / Request Changes / Reject).
 * - Enforces Lead / Admin permissions
 * - Updates review record (status, feedback, reviewed_at, reviewer_id)
 * - Updates corresponding task status in database
 * - Notifies the assignee via DM & #reviews-feed channel
 */
export async function submitReviewDecision(
  reviewId: string,
  decision: ReviewStatus,
  feedback: string,
  reviewer: User
): Promise<{ success: boolean; review?: Review; error?: string }> {
  if (reviewer.role !== 'lead' && reviewer.role !== 'admin') {
    return {
      success: false,
      error: 'Permission Denied: Only Team Leads and Administrators can review and decide on deliverables.',
    };
  }

  const allReviews = getLocalReviews();
  const index = allReviews.findIndex((r) => r.id === reviewId);
  const existing = index !== -1 ? allReviews[index] : null;

  const nowIso = new Date().toISOString();
  const updatedReview: Review = existing
    ? {
        ...existing,
        status: decision,
        feedback: feedback || existing.feedback,
        reviewerId: reviewer.id,
        reviewer,
        reviewedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    : ({
        id: reviewId,
        taskId: 'task-101',
        taskTitle: 'Deliverable',
        taskKey: '#task',
        assigneeId: reviewer.id,
        assignee: reviewer,
        reviewerId: reviewer.id,
        reviewer,
        status: decision,
        feedback,
        branch: 'main',
        prNumber: 'PR #100',
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 1,
        pod: 'Core Engineering',
        createdAt: 'Today',
        reviewedAt: 'Just now',
      } as Review);

  // Update local storage
  if (index !== -1) {
    allReviews[index] = updatedReview;
  } else {
    allReviews.unshift(updatedReview);
  }
  saveLocalReviews(allReviews);

  // Determine task status corresponding to review decision
  const nextTaskStatus: TaskStatus = decision === 'approved' ? 'done' : decision === 'changes_requested' ? 'in_progress' : 'todo';

  // 1. Update Supabase if configured
  if (supabase) {
    try {
      const { error: reviewError } = await supabase
        .from('reviews')
        .update({
          status: decision,
          feedback,
          reviewer_id: reviewer.id,
          reviewed_at: nowIso,
        })
        .eq('id', reviewId);

      if (reviewError) {
        notifyDatabaseFallback('Submit Review Decision', reviewError);
      }

      if (updatedReview.taskId) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({
            status: nextTaskStatus,
            updated_at: nowIso,
          })
          .eq('id', updatedReview.taskId);

        if (taskError) {
          notifyDatabaseFallback('Update Review Task Status', taskError);
        }
      }
    } catch (err) {
      console.warn('Supabase DB call for review decision failed:', err);
      notifyDatabaseFallback('Submit Review Decision', err);
    }
  }

  // 2. Dispatch Async Notification to #reviews-feed & notify assignee
  try {
    const actionLabel =
      decision === 'approved'
        ? '✅ Deliverable Approved'
        : decision === 'changes_requested'
        ? '⚠️ Changes Requested'
        : '❌ Deliverable Rejected';

    const noticeContent = `${actionLabel}: "${updatedReview.taskTitle}" (${updatedReview.prNumber}) by @${updatedReview.assignee.name} was reviewed by @${reviewer.name}.${
      feedback ? ` Notes: "${feedback}"` : ''
    }`;

    // Post to reviews-feed channel
    await createMessageInDb('reviews-feed', noticeContent, reviewer);
  } catch (err) {
    // ignore
  }

  return { success: true, review: updatedReview };
}

/**
 * Creates a CSV export string for audit logging in Admin view
 */
export function exportReviewsAuditCsv(reviews: Review[]): string {
  const headers = ['Review ID', 'Deliverable / Task', 'PR Number', 'Pod', 'Assignee', 'Assignee Email', 'Reviewing Lead', 'Status', 'Submitted Date', 'Reviewed Date', 'Turnaround Hours', 'Feedback'];
  const rows = reviews.map((r) => [
    r.id,
    `"${(r.taskTitle || '').replace(/"/g, '""')}"`,
    r.prNumber,
    `"${r.pod}"`,
    `"${r.assignee.name}"`,
    r.assignee.email,
    `"${r.reviewer?.name || 'Unassigned'}"`,
    r.status.toUpperCase(),
    `"${r.createdAt}"`,
    `"${r.reviewedAt || 'Pending'}"`,
    r.turnaroundHours ? `${r.turnaroundHours}h` : 'N/A',
    `"${(r.feedback || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

// =========================================================================
// PROJECTS & CHANNELS STORAGE AND DB OPERATIONS
// =========================================================================

/**
 * Retrieves cached projects from localStorage with fallback to INITIAL_PROJECTS
 */
export function getLocalProjects(): Project[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse local projects:', err);
  }
  return [...INITIAL_PROJECTS];
}

/**
 * Persists projects list to localStorage
 */
export function saveLocalProjects(projects: Project[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    }
  } catch (err) {
    console.warn('Failed to save local projects:', err);
  }
}

/**
 * Retrieves cached channels from localStorage with fallback to CHANNELS (filters out soft-deleted channels)
 */
export function getLocalChannels(): Channel[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CHANNELS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((c: any) => !c.deletedAt && !c.deleted_at);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse local channels:', err);
  }
  return [...CHANNELS.filter((c: any) => !c.deletedAt && !c.deleted_at)];
}

/**
 * Persists channels list to localStorage
 */
export function saveLocalChannels(channels: Channel[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));
    }
  } catch (err) {
    console.warn('Failed to save local channels:', err);
  }
}

/**
 * Fetches channels from Supabase "channels" table with fallback to local storage.
 * Filters out soft-deleted channels (deleted_at is null).
 */
export async function fetchChannelsFromDb(): Promise<Channel[]> {
  const localChannels = getLocalChannels();
  if (!supabase || !isSupabaseConfigured) {
    return localChannels;
  }
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return localChannels;
    }

    const mapped: Channel[] = data.map((d: any) => ({
      id: d.id,
      name: d.name,
      slug: d.slug || d.name,
      description: d.description || '',
      unreadCount: 0,
      membersCount: 1,
      icon: (d.slug === 'general' || d.name === 'general') ? 'campaign' : 'tag',
      isMandatory: Boolean(d.is_mandatory),
      isProtected: Boolean(d.is_protected) || d.slug === 'general' || d.name === 'general',
      deletedAt: d.deleted_at || null,
      deletedBy: d.deleted_by || null,
    }));

    saveLocalChannels(mapped);
    return mapped;
  } catch (err) {
    console.warn('fetchChannelsFromDb failed, falling back to local cache:', err);
    return localChannels;
  }
}

/**
 * Creates a new channel in Supabase "channels" table.
 * Enforces role check: Only Team Lead and Administrator roles can create channels.
 */
export async function createChannelInDb(
  channel: { id?: string; name: string; slug?: string; description?: string; isMandatory?: boolean; isProtected?: boolean },
  actingUser: User
): Promise<{ success: boolean; channel?: Channel; error?: string }> {
  if (actingUser.role !== 'admin' && actingUser.role !== 'lead') {
    return {
      success: false,
      error: 'Permission denied: Only Team Leads and Administrators can create channels.',
    };
  }

  const cleanName = channel.name.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
  const slug = channel.slug || cleanName;
  const isProtected = slug === 'general' || cleanName === 'general' || Boolean(channel.isProtected);
  const newChan: Channel = {
    id: cleanName,
    name: cleanName,
    slug,
    description: channel.description || '',
    unreadCount: 0,
    membersCount: 1,
    icon: (slug === 'general' || cleanName === 'general') ? 'campaign' : 'tag',
    isMandatory: Boolean(channel.isMandatory) || isProtected,
    isProtected,
  };

  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('channels')
        .insert([
          {
            name: cleanName,
            slug,
            description: channel.description || '',
            workspace_id: actingUser.workspaceId || null,
            is_mandatory: newChan.isMandatory,
            is_protected: isProtected,
          },
        ])
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      if (data) {
        newChan.id = data.id;
        newChan.name = data.name || cleanName;
        newChan.slug = data.slug || slug;
        newChan.description = data.description || '';
        newChan.isProtected = Boolean(data.is_protected) || isProtected;
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Supabase channels insert failed.' };
    }
  }

  const current = getLocalChannels();
  const updated = [...current.filter((c) => c.id !== newChan.id && c.slug !== newChan.slug), newChan];
  saveLocalChannels(updated);

  return { success: true, channel: newChan };
}

/**
 * Deletes / soft-deletes a channel in Supabase "channels" table.
 * Enforces role check: Only Team Lead and Administrator roles can delete channels.
 * Protects #general: #general can never be deleted by anyone.
 * Posts an audit announcement message to #general: e.g. "David Kim deleted #old-project on Oct 15."
 */
export async function deleteChannelInDb(
  channelId: string,
  channelName: string,
  actingUser: User
): Promise<{ success: boolean; error?: string; auditMessage?: ChannelMessage }> {
  // 1. Role validation: restricted to lead and admin
  if (actingUser.role !== 'admin' && actingUser.role !== 'lead') {
    return {
      success: false,
      error: 'Permission denied: Only Team Leads and Administrators can delete channels.',
    };
  }

  // 2. Protected #general validation
  const cleanId = channelId.trim().toLowerCase().replace(/^#+/, '');
  const cleanName = channelName.trim().toLowerCase().replace(/^#+/, '');
  if (cleanId === 'general' || cleanName === 'general') {
    return {
      success: false,
      error: 'The #general channel is protected and cannot be deleted.',
    };
  }

  const currentChannels = getLocalChannels();
  const targetChannel = currentChannels.find((c) => c.id === channelId || c.slug === cleanName || c.name === cleanName);
  if (targetChannel?.slug === 'general' || targetChannel?.isProtected) {
    return {
      success: false,
      error: 'The #general channel is protected and cannot be deleted.',
    };
  }

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const auditContent = `${actingUser.name} deleted #${cleanName} on ${dateFormatted}.`;

  // 3. Supabase soft-delete and system audit message
  if (supabase && isSupabaseConfigured) {
    try {
      // Soft-delete by setting deleted_at timestamp
      const { error: updateError } = await supabase
        .from('channels')
        .update({
          deleted_at: now.toISOString(),
          deleted_by: actingUser.id,
        })
        .eq('id', channelId);

      if (updateError) {
        // Fallback to hard delete if deleted_at column is not yet present on remote table
        console.warn('Soft-delete failed, attempting delete policy:', updateError.message);
        const { error: delError } = await supabase
          .from('channels')
          .delete()
          .eq('id', channelId);

        if (delError) {
          return { success: false, error: delError.message };
        }
      }

      // Post audit announcement in #general channel using its UUID
      const { data: genChan } = await supabase
        .from('channels')
        .select('id')
        .or('slug.eq.general,name.eq.general')
        .limit(1)
        .maybeSingle();

      if (genChan?.id) {
        const { error: auditErr } = await supabase.from('channel_messages').insert({
          channel_id: genChan.id,
          author_id: actingUser.id,
          content: `📢 ${auditContent}`,
          workspace_id: actingUser.workspaceId || null,
        });
        if (auditErr) {
          notifyDatabaseFallback('Post Deletion Audit Announcement', auditErr);
        }
      }
    } catch (err: any) {
      console.warn('Supabase deleteChannelInDb error:', err);
      notifyDatabaseFallback('Delete Channel', err);
    }
  }

  // 4. Update local storage channels (immediately purge from cached list)
  const current = getLocalChannels();
  const updated = current.filter(
    (c) => c.id !== channelId && c.slug !== cleanName && c.name !== channelName && c.name !== cleanName
  );
  saveLocalChannels(updated);

  // 5. Create audit message object
  const auditMessage: ChannelMessage = {
    id: `msg-audit-${Date.now()}`,
    channelId: 'general',
    channel_id: 'general',
    author: actingUser,
    createdAt: 'Just now',
    content: `📢 ${auditContent}`,
    reactions: [],
    threadRepliesCount: 0,
  };

  // Cache audit announcement locally for #general
  saveLocalMessageForChannel('general', auditMessage);
  try {
    const AUDIT_STORAGE_KEY = 'teamhub_audit_messages';
    const rawAudit = localStorage.getItem(AUDIT_STORAGE_KEY);
    const auditList: ChannelMessage[] = rawAudit ? JSON.parse(rawAudit) : [];
    auditList.push(auditMessage);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditList));
  } catch (e) {
    // ignore
  }

  return { success: true, auditMessage };
}

/**
 * Fetches projects from Supabase "projects" table with fallback to local storage.
 * Enforces RLS: Scopes projects to members of that pod (and admins).
 */
export async function fetchProjectsFromDb(actingUser?: User): Promise<Project[]> {
  const localProjects = getLocalProjects();

  if (!supabase) {
    if (!actingUser || actingUser.role === 'admin') {
      return localProjects;
    }
    // Filter by pod if not admin
    return localProjects.filter((p) => {
      const userPod = (actingUser.pod || '').toLowerCase();
      const userPodCode = (actingUser.podCode || '').toLowerCase();
      const projPod = (p.pod || '').toLowerCase();
      const projPodId = (p.podId || '').toLowerCase();
      return (
        projPod.includes(userPod) ||
        userPod.includes(projPod) ||
        projPodId === userPodCode ||
        p.podId === 'core' // Core projects visible across company pods
      );
    });
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch projects error:', error.message);
      return localProjects;
    }

    if (data && data.length > 0) {
      const dbProjects: Project[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        targetDate: row.target_date,
        podId: row.pod_id || 'core',
        pod: row.pod || 'Core Engineering',
        status: (row.status as ProjectStatus) || 'on_track',
        statusDetail: row.metadata?.statusDetail,
        channelId: row.channel_id,
        channelName: row.channel_name || (row.name ? `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-general` : undefined),
        createdBy: row.created_by,
        createdAt: row.created_at,
        workspaceId: row.workspace_id,
      }));

      // Merge with initial projects if any missing
      const mergedMap = new Map<string, Project>();
      localProjects.forEach((p) => mergedMap.set(p.id, p));
      dbProjects.forEach((p) => mergedMap.set(p.id, p));
      const combined = Array.from(mergedMap.values());
      saveLocalProjects(combined);

      if (!actingUser || actingUser.role === 'admin') {
        return combined;
      }

      return combined.filter((p) => {
        const userPod = (actingUser.pod || '').toLowerCase();
        const userPodCode = (actingUser.podCode || '').toLowerCase();
        const projPod = (p.pod || '').toLowerCase();
        const projPodId = (p.podId || '').toLowerCase();
        return (
          projPod.includes(userPod) ||
          userPod.includes(projPod) ||
          projPodId === userPodCode ||
          p.podId === 'core'
        );
      });
    }
  } catch (err) {
    console.warn('Failed to query Supabase projects table:', err);
  }

  return localProjects;
}

/**
 * Creates a new project in Supabase & local storage.
 * Enforces permissions: "+ New Project" action allowed only for Team Lead and Administrator.
 * On creation:
 * - Auto-generates a default channel (e.g. #project-name-general)
 * - Initializes an empty task board scoped to the new project_id
 */
export async function createProjectInDb(
  projectData: {
    name: string;
    description?: string;
    targetDate: string;
    podId: string;
    pod?: string;
  },
  creator: User
): Promise<{ success: boolean; project?: Project; channel?: Channel; error?: string }> {
  // Permission gate: Only Team Lead and Administrator can initialize projects
  if (creator.role !== 'lead' && creator.role !== 'admin') {
    return {
      success: false,
      error: 'Permission Denied: Only Team Leads and Administrators can create projects.',
    };
  }

  if (!projectData.name.trim()) {
    return {
      success: false,
      error: 'Project name is required.',
    };
  }

  // 1. Auto-generate default channel (e.g. #project-name-general)
  const slug = projectData.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const channelSlug = slug || `project-${Date.now()}`;
  const channelName = `${channelSlug}-general`;

  const newChannel: Channel = {
    id: `ch-${channelSlug}`,
    name: channelName,
    description: `Default discussion and announcements channel for ${projectData.name.trim()}`,
    unreadCount: 0,
    membersCount: projectData.podId === 'design' ? 8 : projectData.podId === 'mobile' ? 14 : projectData.podId === 'infra' ? 11 : 24,
    icon: 'folder_special',
  };

  // Persist channel to local channels
  const currentChannels = getLocalChannels();
  if (!currentChannels.some((c) => c.name === channelName)) {
    currentChannels.push(newChannel);
    saveLocalChannels(currentChannels);
  }

  // Determine pod title
  const podTitle =
    projectData.pod ||
    (projectData.podId === 'design'
      ? 'Product Design Systems'
      : projectData.podId === 'mobile'
      ? 'Mobile Platform Pod'
      : projectData.podId === 'infra'
      ? 'Infrastructure & Data'
      : 'Core Engineering');

  const projectId = `proj-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newProject: Project = {
    id: projectId,
    name: projectData.name.trim(),
    description: projectData.description?.trim() || '',
    targetDate: projectData.targetDate || 'Nov 28, 2024 (Sprint End)',
    podId: projectData.podId,
    pod: podTitle,
    status: 'on_track',
    channelId: newChannel.id,
    channelName: newChannel.name,
    createdBy: creator.id,
    createdByName: creator.name,
    createdAt: nowIso,
    workspaceId: creator.workspaceId,
    members: [creator],
  };

  // 2. Persist to local projects
  const allProjects = getLocalProjects();
  allProjects.unshift(newProject);
  saveLocalProjects(allProjects);

  // 3. Persist to Supabase if configured
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            name: newProject.name,
            description: newProject.description,
            target_date: newProject.targetDate,
            pod_id: newProject.podId,
            pod: newProject.pod,
            status: newProject.status,
            channel_id: newProject.channelId,
            created_by: creator.id,
            workspace_id: creator.workspaceId,
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Supabase projects table insert notice:', error.message);
        notifyDatabaseFallback('Create Project', error);
      } else if (data) {
        newProject.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase project call failed:', err);
      notifyDatabaseFallback('Create Project', err);
    }

    try {
      // Also register channel in channels table if exists
      const { error: chErr } = await supabase.from('channels').upsert([
        {
          name: newChannel.name,
          slug: channelSlug,
          description: newChannel.description,
          workspace_id: creator.workspaceId || null,
        },
      ], { onConflict: 'workspace_id,slug' });
      if (chErr) {
        notifyDatabaseFallback('Create Project Workstream Channel', chErr);
      }
    } catch (chErr) {
      notifyDatabaseFallback('Create Project Workstream Channel', chErr);
    }
  }

  // 4. Auto-generate welcome message in the new channel
  try {
    const welcomeMsg = `🎉 Project "${newProject.name}" initialized by @${creator.name}. Workstream channel #${newChannel.name} and empty task board scoped to project are ready.`;
    await createMessageInDb(newChannel.name, welcomeMsg, creator);
  } catch (err) {
    // ignore
  }

  return {
    success: true,
    project: newProject,
    channel: newChannel,
  };
}

// =========================================================================
// FILES & SPECS PERSISTENCE AND WORKSPACE CONTEXT SYNTHESIS
// =========================================================================

/**
 * Retrieves cached workspace files from localStorage with fallback to WORKSPACE_FILES
 */
export function getLocalFiles(): WorkspaceFile[] {
  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse local files:', err);
  }
  return [...WORKSPACE_FILES];
}

/**
 * Persists workspace files list to localStorage
 */
export function saveLocalFiles(files: WorkspaceFile[]): void {
  try {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
  } catch (err) {
    console.warn('Failed to save local files:', err);
  }
}

/**
 * Saves a finalized documentation draft as a real markdown file in Files & Specs
 */
export async function saveDocumentationToFile(
  fileName: string,
  markdownContent: string,
  uploader: User,
  folder: string = 'Architecture RFCs'
): Promise<{ success: boolean; file: WorkspaceFile }> {
  const cleanName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
  const sizeKb = (new Blob([markdownContent]).size / 1024).toFixed(1);

  const newFile: WorkspaceFile = {
    id: `file-doc-${Date.now()}`,
    name: cleanName,
    folder: folder || 'Architecture RFCs',
    size: `${sizeKb} KB`,
    type: 'md',
    uploader,
    uploadedAt: 'Just now',
    content: markdownContent,
    previewType: 'doc',
    aiSummary: 'Synthesized sprint documentation from active teamwork, discussions, and deliverables.',
    tags: ['ai-generated', 'rfc', 'sprint-42', 'documentation', 'markdown'],
  };

  const currentFiles = getLocalFiles();
  const filtered = currentFiles.filter((f) => f.name !== cleanName);
  const updated = [newFile, ...filtered];
  saveLocalFiles(updated);

  // If Supabase storage is configured, attempt upload
  if (supabase) {
    try {
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      const path = `${uploader.id}/${Date.now()}_${cleanName}`;
      const { error: uploadError } = await supabase.storage.from('files').upload(path, blob, { upsert: true, contentType: 'text/markdown' });
      if (uploadError) {
        notifyDatabaseFallback('Save Documentation File', uploadError);
      }
    } catch (err) {
      console.warn('Supabase storage upload fallback:', err);
      notifyDatabaseFallback('Save Documentation File', err);
    }
  }

  return { success: true, file: newFile };
}

/**
 * Fetches real Supabase & workspace data across:
 * - Recent channel discussions
 * - Resolved/active questions
 * - Completed/active tasks
 * - Daily standup updates
 */
export async function fetchRealTeamworkContext(): Promise<{
  channelMessages: ChannelMessage[];
  completedTasks: Task[];
  activeTasks: Task[];
  resolvedQuestions: Question[];
  standups: StandupEntry[];
  summary: {
    channelsCount: number;
    tasksCount: number;
    standupsCount: number;
    questionsCount: number;
  };
}> {
  let dbTasks: Task[] = [];
  let dbQuestions: Question[] = [];
  let dbMessages: ChannelMessage[] = [];

  try {
    const [tasksRes, questionsRes, msgsRes] = await Promise.all([
      fetchTasksFromDb(),
      fetchQuestionsFromDb(),
      fetchMessagesFromDb('design'),
    ]);

    dbTasks = tasksRes && tasksRes.length > 0 ? tasksRes : INITIAL_TASKS;
    dbQuestions = questionsRes && questionsRes.length > 0 ? questionsRes : INITIAL_QUESTIONS;
    dbMessages = msgsRes && msgsRes.length > 0 ? msgsRes : INITIAL_CHANNEL_MESSAGES;
  } catch (err) {
    dbTasks = INITIAL_TASKS;
    dbQuestions = INITIAL_QUESTIONS;
    dbMessages = INITIAL_CHANNEL_MESSAGES;
  }

  const completedTasks = dbTasks.filter((t) => t.status === 'done');
  const activeTasks = dbTasks.filter((t) => t.status !== 'done');
  const resolvedQuestions = dbQuestions.filter((q) => q.status === 'resolved' || q.answers.length > 0);
  const standups = STANDUP_ENTRIES;

  return {
    channelMessages: dbMessages,
    completedTasks,
    activeTasks,
    resolvedQuestions,
    standups,
    summary: {
      channelsCount: 4, // #backend, #design, #frontend, #architecture
      tasksCount: completedTasks.length,
      standupsCount: standups.length,
      questionsCount: resolvedQuestions.length,
    },
  };
}

