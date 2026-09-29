export type Role = 'member' | 'lead' | 'admin';

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface NotificationPreferences {
  directMentions: boolean;
  taskStatusChanges: boolean;
  qnaReplies: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleTitle: string;
  department: string;
  pod: string;
  avatarUrl?: string;
  initials: string;
  initialsColor?: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  statusText?: string;
  location: string;
  timezone: string;
  phone?: string;
  dateOfBirth?: string;
  dateJoined?: string;
  reportingLead?: string;
  bio?: string;
  skills: string[];
  socialLinks?: SocialLinks;
  notificationPreferences?: NotificationPreferences;
  theme?: 'light' | 'dark' | 'system';
  tasksCompleted: number;
  questionsAnswered: number;
  lastActive: string;
  workspaceId?: string;
  podCode?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  teamFunction: string;
  adminId?: string;
  adminEmail: string;
  podCode: string;
  isActive: boolean;
  createdAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'figma' | 'code' | 'doc';
  url?: string;
  previewUrl?: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorAvatar?: string;
  createdAt: string;
  content: string;
}

export interface Task {
  id: string;
  projectId?: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  channel: string;
  sprint: string;
  assignee: User;
  reviewer?: User;
  dueDate: string;
  dueTime?: string;
  subtasks: Subtask[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  completedAt?: string;
}

export interface ChannelMessage {
  id: string;
  author: User;
  createdAt: string;
  content: string;
  tag?: string;
  isAi?: boolean;
  codeSnippet?: {
    filename: string;
    sha: string;
    status: string;
    code?: string;
  };
  attachment?: {
    name: string;
    size: string;
    type: 'figma' | 'image' | 'json';
    previewUrl?: string;
    description?: string;
  };
  tokenAudit?: {
    primaryColor: string;
    surfaceColor: string;
  };
  reactions: {
    emoji: string;
    count: number;
    userReacted: boolean;
  }[];
  threadRepliesCount?: number;
  lastReplyTime?: string;
  threadReplies?: {
    id: string;
    author: User;
    createdAt: string;
    content: string;
    isAi?: boolean;
  }[];
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  unreadCount: number;
  isPrivate?: boolean;
  membersCount: number;
  icon?: string;
}

export interface QuestionAnswer {
  id: string;
  author: User;
  createdAt: string;
  content: string;
  isAccepted?: boolean;
  isAiSuggested?: boolean;
  upvotes: number;
  codeBlock?: {
    filename: string;
    language: string;
    code: string;
  };
  tipBox?: {
    title: string;
    content: string;
  };
}

export interface Question {
  id: string;
  key: string;
  title: string;
  content: string;
  author: User;
  createdAt: string;
  tags: string[];
  channel: string;
  status: 'open' | 'answered' | 'resolved';
  views: number;
  upvotes: number;
  codeSnippet?: {
    filename: string;
    code: string;
  };
  answers: QuestionAnswer[];
  aiSummary?: string;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  folder: string;
  size: string;
  type: 'png' | 'pdf' | 'csv' | 'json' | 'mp4' | 'docx' | 'fig' | 'md' | string;
  uploader: User;
  uploadedAt: string;
  content?: string;
  url?: string;
  previewUrl?: string;
  dimensions?: string;
  exactBytes?: number;
  aiSummary?: string;
  tags?: string[];
  linkedTask?: string;
  linkedQuestion?: string;
  previewType?: 'blueprint' | 'pdf' | 'csv' | 'json' | 'video' | 'doc';
}

export interface StandupEntry {
  id: string;
  user: User;
  postedAt: string;
  done: string;
  doing: string;
  blocked: string;
  status: 'on_track' | 'blocked' | 'review';
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  category: 'Security' | 'Channel' | 'User' | 'Integration';
  ipAddress?: string;
}

export interface JoinRequest {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  requestedAt: string;
  avatarInitials: string;
  isElevate?: boolean;
}

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface ReviewArtifact {
  id: string;
  title: string;
  type: 'figma' | 'loom' | 'pdf' | 'spec' | 'other';
  tag: string;
  description: string;
  url: string;
  actionLabel: string;
}

export interface Review {
  id: string;
  workspaceId?: string;
  taskId: string;
  taskTitle: string;
  taskKey: string;
  reviewerId?: string;
  reviewer?: User;
  assigneeId: string;
  assignee: User;
  status: ReviewStatus;
  feedback: string;
  branch: string;
  prNumber: string;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  description?: string;
  acceptanceCriteria?: string[];
  artifacts?: ReviewArtifact[];
  pod: string;
  createdAt: string;
  reviewedAt?: string;
  turnaroundHours?: number;
  safeToMerge?: boolean;
}

export type ProjectStatus = 'on_track' | 'at_risk' | 'completed' | 'blocked';

export interface Project {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  podId: string;
  pod: string;
  status: ProjectStatus;
  statusDetail?: string;
  channelId?: string;
  channelName?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  workspaceId?: string;
  members?: User[];
}

export type ViewMode = 
  | 'home' 
  | 'tasks' 
  | 'channels' 
  | 'questions' 
  | 'files' 
  | 'ai-assistant' 
  | 'my-work' 
  | 'admin-center' 
  | 'manage-users' 
  | 'profile-settings'
  | 'waiting-approval'
  | 'auth'
  | 'reviews';

export type DeviceMode = 'desktop' | 'mobile-framed' | 'mobile-full';
