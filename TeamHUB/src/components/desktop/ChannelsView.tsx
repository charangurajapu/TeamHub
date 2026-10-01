import React, { useState, useRef, useEffect } from 'react';
import { User, Channel, ChannelMessage } from '../../types';
import { CHANNELS, INITIAL_CHANNEL_MESSAGES, USERS } from '../../data/mockData';
import { TeammateProfilePopover } from '../common/TeammateProfilePopover';
import {
  getLocalChannels,
  fetchChannelsFromDb,
  createChannelInDb,
  deleteChannelInDb,
  fetchMessagesFromDb,
  createMessageInDb,
  saveLocalMessageForChannel,
  supabase,
  isSupabaseConfigured,
} from '../../lib/supabase';

interface ChannelsViewProps {
  currentUser: User;
  onOpenAiDrawer: () => void;
  onViewTasksForUser: (user: User) => void;
  onOpenSpecDoc: () => void;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({
  currentUser,
  onOpenAiDrawer,
  onViewTasksForUser,
  onOpenSpecDoc,
}) => {
  const initialChannels = getLocalChannels();
  const initialGeneral = initialChannels.find((c) => c.slug === 'general' || c.name === 'general') || initialChannels[0];
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [activeChannelId, setActiveChannelId] = useState(initialGeneral?.id || 'general');
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [popoverUser, setPopoverUser] = useState<User>(USERS.david);
  const [inputMessage, setInputMessage] = useState('');
  const [threadInput, setThreadInput] = useState('');

  // Helper to detect if a channel is the default/protected general channel
  const isChannelGeneral = (c?: Channel | null): boolean => {
    if (!c) return false;
    return c.slug === 'general' || c.name.toLowerCase() === 'general' || Boolean(c.isProtected);
  };

  // Channel creation & management state (restricted to lead and admin)
  const canManageChannels = currentUser.role === 'admin' || currentUser.role === 'lead';
  const canCreateChannel = canManageChannels;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Channel deletion state
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showChannelMenu, setShowChannelMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync channels from Supabase on mount
  useEffect(() => {
    async function loadChannels() {
      const fetched = await fetchChannelsFromDb();
      if (fetched && fetched.length > 0) {
        setChannels(fetched);
        // If current activeChannelId matches by id, slug, or name, keep it / update to UUID
        const currentActive = fetched.find(
          (c) => c.id === activeChannelId || c.slug === activeChannelId || c.name === activeChannelId
        );
        if (currentActive) {
          setActiveChannelId(currentActive.id);
        } else {
          const gen = fetched.find(isChannelGeneral) || fetched[0];
          if (gen) {
            setActiveChannelId(gen.id);
          }
        }
      }
    }
    loadChannels();
  }, []);

  // Fetch isolated messages when activeChannelId changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMessages(true);

    async function loadChannelMessages() {
      try {
        const msgs = await fetchMessagesFromDb(activeChannelId);
        if (isMounted) {
          setMessages(msgs || []);
        }
      } catch (err) {
        console.warn('Failed to load channel messages:', err);
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    }

    loadChannelMessages();

    return () => {
      isMounted = false;
    };
  }, [activeChannelId]);

  // Realtime subscription strictly filtered by activeChannelId + cross-tab BroadcastChannel
  useEffect(() => {
    if (!activeChannelId) return;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeChannelId);
    let supabaseSub: any = null;
    if (supabase && isUuid) {
      try {
        const filterStr = `channel_id=eq.${activeChannelId}`;
        const channelName = `channel_messages:${activeChannelId}`;
        console.log(`[Realtime Debug] Subscribing to Supabase channel "${channelName}" with filter "${filterStr}". activeChannelId is:`, activeChannelId);

        supabaseSub = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'channel_messages',
              filter: filterStr,
            },
            (payload: any) => {
              console.log('[Realtime Debug] postgres_changes event received:', payload);
              const newRow = payload.new;
              if (newRow && (newRow.channel_id === activeChannelId || newRow.channelId === activeChannelId)) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newRow.id)) return prev;
                  const incoming: ChannelMessage = {
                    id: newRow.id,
                    channelId: newRow.channel_id,
                    channel_id: newRow.channel_id,
                    author: (newRow.author_id === currentUser.id ? currentUser : {
                      id: newRow.author_id || 'teammate',
                      name: 'Teammate',
                      email: '',
                      role: 'member',
                      roleTitle: 'Member',
                      department: 'Engineering',
                      pod: 'Core',
                      initials: 'TM',
                      status: 'online',
                    }) as User,
                    createdAt: new Date(newRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    content: newRow.content,
                    reactions: Array.isArray(newRow.reactions) ? newRow.reactions : [],
                    threadRepliesCount: newRow.thread_replies_count || 0,
                  };
                  return [...prev, incoming];
                });
              }
            }
          )
          .subscribe((status, err) => {
            console.log('Realtime subscription status:', status, err || '');
          });
      } catch (err) {
        console.warn('Realtime subscription error:', err);
      }
    } else {
      console.log(`[Realtime Debug] Skipped Supabase Realtime subscription: supabase client is ${Boolean(supabase)}, activeChannelId is "${activeChannelId}" (isUuid: ${isUuid})`);
    }

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('teamhub_channel_messages_bus');
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || data.type !== 'NEW_CHANNEL_MESSAGE') return;
        // Strictly isolated: only append if this message belongs to the current active channel
        if ((data.channelId === activeChannelId || data.channel_id === activeChannelId) && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      };
    } catch {
      // BroadcastChannel unsupported
    }

    return () => {
      console.log(`[Realtime Debug] Cleaning up subscription for channel "${activeChannelId}"`);
      if (supabase && supabaseSub) {
        supabase.removeChannel(supabaseSub);
      }
      if (bc) {
        bc.close();
      }
    };
  }, [activeChannelId, currentUser]);

  const inputRef = useRef<HTMLInputElement>(null);

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const input = inputRef.current;
    if (!input) {
      setInputMessage((prev) => prev + `${prefix}text${suffix}`);
      return;
    }

    const start = input.selectionStart ?? inputMessage.length;
    const end = input.selectionEnd ?? inputMessage.length;
    const selectedText = inputMessage.substring(start, end);

    const replacement = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}text${suffix}`;
    const newText = inputMessage.substring(0, start) + replacement + inputMessage.substring(end);
    setInputMessage(newText);

    setTimeout(() => {
      input.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = selectedText ? cursorStart + selectedText.length : cursorStart + 4;
      input.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  };

  // Thread replies state
  const [threadReplies, setThreadReplies] = useState([
    {
      id: 'tr-1',
      author: USERS.ai,
      createdAt: '10:16 AM',
      isAi: true,
      content: 'I ran an automated contrast check for #surface-dim against #1e293b — ratio is 5.8:1, passing AA standards.',
    },
    {
      id: 'tr-2',
      author: USERS.marcus,
      createdAt: '10:20 AM',
      content: 'Looks great on the Figma mocks too! We verified with Sarah earlier.',
    },
    {
      id: 'tr-3',
      author: USERS.david,
      createdAt: '10:25 AM',
      content: 'Confirmed on device testbed. Low-brightness OLED clipping is negligible.',
    },
  ]);

  const DEFAULT_CHANNEL: Channel = {
    id: 'general',
    name: 'general',
    slug: 'general',
    description: 'Company-wide announcements and team updates',
    unreadCount: 0,
    membersCount: 24,
    icon: 'campaign',
    isProtected: true,
    isMandatory: true,
  };

  const activeChannel =
    channels.find((c) => c.id === activeChannelId || c.slug === activeChannelId || c.name === activeChannelId) ||
    channels.find(isChannelGeneral) ||
    channels[0] ||
    DEFAULT_CHANNEL;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed) return;
    if (!activeChannelId) {
      alert('Please select a channel first.');
      return;
    }

    setInputMessage('');

    const res = await createMessageInDb(activeChannelId, trimmed, currentUser);
    if (res.success && res.message) {
      const newMsg = res.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Broadcast to other open browser tabs/sessions with channel identity
      try {
        const bc = new BroadcastChannel('teamhub_channel_messages_bus');
        bc.postMessage({
          type: 'NEW_CHANNEL_MESSAGE',
          channelId: activeChannelId,
          message: newMsg,
        });
        bc.close();
      } catch {
        // ignore
      }
    }
  };

  const handleSendThreadReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInput.trim()) return;

    setThreadReplies((prev) => [
      ...prev,
      {
        id: `tr-${Date.now()}`,
        author: currentUser,
        createdAt: 'Just now',
        content: threadInput.trim(),
      },
    ]);
    setThreadInput('');
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const existing = msg.reactions?.find((r) => r.emoji === emoji);
          let updatedReactions;
          if (existing) {
            const userReacted = !existing.userReacted;
            const count = existing.count + (userReacted ? 1 : -1);
            updatedReactions = msg.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count, userReacted } : r
            );
          } else {
            updatedReactions = [...(msg.reactions || []), { emoji, count: 1, userReacted: true }];
          }
          const updatedMsg = { ...msg, reactions: updatedReactions };
          saveLocalMessageForChannel(activeChannelId, updatedMsg);
          return updatedMsg;
        }
        return msg;
      })
    );
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'admin' && currentUser.role !== 'lead') {
      setCreateError('Permission denied: Only Team Leads and Administrators can create channels.');
      return;
    }
    const cleanName = newChannelName.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
    if (!cleanName) return;

    setIsCreating(true);
    setCreateError(null);

    const result = await createChannelInDb(
      {
        name: cleanName,
        slug: cleanName,
        description: newChannelDesc.trim() || 'Workstream channel',
      },
      currentUser
    );

    setIsCreating(false);

    if (!result.success) {
      setCreateError(result.error || 'Failed to create channel.');
      return;
    }

    if (result.channel) {
      setChannels((prev) => [...prev.filter((c) => c.id !== result.channel!.id && c.slug !== result.channel!.slug), result.channel!]);
      setActiveChannelId(result.channel.id);
    }
    setShowCreateModal(false);
    setNewChannelName('');
    setNewChannelDesc('');
  };

  const handleConfirmDelete = async () => {
    if (!channelToDelete) return;
    if (!canManageChannels) {
      setDeleteError('Permission denied: Only Team Leads and Administrators can delete channels.');
      return;
    }
    if (isChannelGeneral(channelToDelete)) {
      setDeleteError('The #general channel is protected and cannot be deleted.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteChannelInDb(channelToDelete.id, channelToDelete.name, currentUser);
    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete channel.');
      return;
    }

    // Immediately remove channel from state
    const updatedChannels = channels.filter(
      (c) => c.id !== channelToDelete.id && c.name !== channelToDelete.name
    );
    setChannels(updatedChannels);

    // If active channel was deleted, redirect immediately to #general or first channel
    if (activeChannelId === channelToDelete.id || activeChannelId === channelToDelete.name) {
      const genChan = updatedChannels.find(isChannelGeneral) || updatedChannels[0];
      if (genChan) {
        setActiveChannelId(genChan.id);
      }
    }

    // Inject audit message into messages feed (visible in #general)
    if (result.auditMessage) {
      setMessages((prev) => [...prev, result.auditMessage!]);
    }

    setToastMessage(`Channel #${channelToDelete.name} deleted. Audit trail logged to #general.`);
    setChannelToDelete(null);
    setShowChannelMenu(false);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="flex w-full h-[calc(100vh-5rem)] -m-8 overflow-hidden bg-[#faf8ff] relative">
      {/* 1. SECONDARY CHANNEL NAVIGATOR SIDEBAR */}
      <aside className="w-64 flex-shrink-0 bg-[#f2f3ff] flex flex-col justify-between select-none border-r border-[#eaedff] z-20">
        <div className="flex flex-col flex-1 overflow-y-auto p-3">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-2 mb-1">
            <div className="flex items-center gap-1.5 text-[#3e4a3d]">
              <span className="material-symbols-outlined text-[18px]">folder_special</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">Channels</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Only Team Lead and Administrator roles can create channels */}
              {canCreateChannel && (
                <button
                  type="button"
                  onClick={() => {
                    setCreateError(null);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                  title="Create new channel"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  <span>New</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowEmptyState(!showEmptyState)}
                className="p-1 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors cursor-pointer"
                title="Toggle Empty Channel Demo"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showEmptyState ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Channel list */}
          <nav className="flex flex-col gap-0.5">
            {channels.map((ch) => {
              const isActive = ch.id === activeChannelId || ch.slug === activeChannelId || ch.name === activeChannelId;
              const isChGeneral = isChannelGeneral(ch);
              return (
                <div
                  key={ch.id}
                  className={`group relative flex items-center justify-between rounded-xl transition-all ${
                    isActive
                      ? 'bg-[#eaedff] text-[#006b2c] font-bold shadow-2xs'
                      : 'text-[#3e4a3d] hover:bg-[#eaedff]/60 hover:text-[#131b2e]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChannelId(ch.id);
                      setShowEmptyState(false);
                      setShowChannelMenu(false);
                    }}
                    className="flex-1 flex items-center justify-between px-3 py-2 text-xs text-left cursor-pointer min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">
                        {ch.icon || (isChGeneral ? 'campaign' : 'tag')}
                      </span>
                      <span className="truncate">{ch.name}</span>
                      {isChGeneral && (
                        <span className="material-symbols-outlined text-[13px] text-[#6e7b6c]" title="Protected channel">
                          lock
                        </span>
                      )}
                    </div>
                    {ch.unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#006b2c] text-white font-bold">
                        {ch.unreadCount}
                      </span>
                    )}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c]"></span>}
                  </button>

                  {/* Quick Delete button in channel row for lead/admin (never for #general) */}
                  {canManageChannels && !isChGeneral && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setChannelToDelete(ch);
                      }}
                      className="hidden group-hover:flex items-center justify-center p-1.5 mr-1.5 rounded-lg text-[#6e7b6c] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      title={`Delete #${ch.name}`}
                      aria-label={`Delete #${ch.name}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Direct messages */}
          <div className="flex items-center justify-between px-2 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6e7b6c]">
            <span>Direct Messages</span>
            <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-[#131b2e]">add</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              onClick={onOpenAiDrawer}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#7ffc97] text-[#002109] font-bold text-[10px] flex items-center justify-center">
                  AI
                </div>
                <span className="font-semibold text-[#131b2e]">TeamHub AI</span>
              </div>
              <span className="text-[10px] bg-[#7ffc97]/50 text-[#005320] px-1.5 py-0.2 rounded font-bold">
                AI
              </span>
            </button>

            <button
              onClick={() => {
                setPopoverUser(USERS.david);
                setShowProfilePopover(true);
              }}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-[10px] flex items-center justify-center">
                  DK
                </div>
                <span>David Kim</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#006b2c]"></span>
            </button>

            <button
              onClick={() => {
                setPopoverUser(USERS.anya);
                setShowProfilePopover(true);
              }}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#ffdcc3] text-[#2f1500] font-bold text-[10px] flex items-center justify-center">
                  AL
                </div>
                <span>Anya Lin</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#bdcaba]"></span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#eaedff]/60 border-t border-[#eaedff] flex items-center justify-between text-xs text-[#3e4a3d]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#006b2c] animate-pulse"></span>
            <span className="text-[11px] font-medium">Design Pod • 8 Active</span>
          </div>
          <button
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="text-[10px] font-semibold text-[#006b2c] hover:underline cursor-pointer"
          >
            {showEmptyState ? 'Show Stream' : 'Empty Demo'}
          </button>
        </div>
      </aside>

      {/* 2. MAIN CHANNEL STAGE */}
      <section className="flex-1 flex flex-col bg-[#ffffff] overflow-hidden relative min-w-0">
        {/* Channel Top Header Bar */}
        <div className="h-16 px-6 border-b border-[#eaedff] flex items-center justify-between bg-[#ffffff] z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#f2f3ff] flex items-center justify-center text-[#006b2c]">
              <span className="material-symbols-outlined text-[20px]">tag</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#131b2e]">#{activeChannel.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[11px] text-[#3e4a3d] font-semibold">
                  Core Pod
                </span>
                {isChannelGeneral(activeChannel) && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f2f3ff] text-[10px] text-[#006b2c] font-semibold border border-[#eaedff]" title="Protected channel cannot be deleted">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    Protected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6e7b6c] truncate">
                {activeChannel.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center -space-x-1.5 mr-2">
              <div className="w-7 h-7 rounded-full bg-[#f2f3ff] text-[#131b2e] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                SC
              </div>
              <div className="w-7 h-7 rounded-full bg-[#7ffc97] text-[#002109] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                DK
              </div>
              <div className="w-7 h-7 rounded-full bg-[#ffdcc3] text-[#2f1500] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                ML
              </div>
              <div className="w-7 h-7 rounded-full bg-[#eaedff] text-[#3e4a3d] flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                +8
              </div>
            </div>

            <button
              onClick={() => setShowThreadPanel(!showThreadPanel)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">forum</span>
              <span>Threads ({threadReplies.length})</span>
            </button>

            <button
              onClick={onOpenSpecDoc}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">push_pin</span>
              <span>Pinned (4)</span>
            </button>

            {/* Delete Channel Option (Visible ONLY to Team Lead and Administrator, and NEVER for #general) */}
            {canManageChannels && !isChannelGeneral(activeChannel) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setChannelToDelete(activeChannel);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70 text-xs font-semibold transition-colors cursor-pointer"
                  title={`Delete #${activeChannel.name}`}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span className="hidden sm:inline">Delete</span>
                </button>

                {/* Overflow menu for channel options */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowChannelMenu(!showChannelMenu)}
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-[#3e4a3d] hover:text-[#131b2e] transition-colors cursor-pointer"
                    title="Channel options"
                    aria-label="Channel options"
                  >
                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                  </button>

                  {showChannelMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[#ffffff] dark:bg-[#1a2333] border border-[#eaedff] dark:border-[#2a364f] shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6e7b6c]">
                        Channel Settings
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(window.location.href);
                          setShowChannelMenu(false);
                          setToastMessage(`Copied link to #${activeChannel.name}`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#131b2e] dark:text-[#eaedff] hover:bg-[#f2f3ff] dark:hover:bg-[#25324d] transition-colors text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">link</span>
                        <span>Copy Channel Link</span>
                      </button>
                      <div className="my-1 border-t border-[#eaedff] dark:border-[#2a364f]" />
                      <button
                        type="button"
                        onClick={() => {
                          setShowChannelMenu(false);
                          setDeleteError(null);
                          setChannelToDelete(activeChannel);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete Channel</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pinned Topic Banner */}
        <div className="px-6 py-2 bg-[#f2f3ff] border-b border-[#eaedff] flex items-center justify-between text-xs text-[#131b2e] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[16px] text-[#8d4b00]">push_pin</span>
            <span className="font-semibold truncate">
              Sprint 42 Design Specs & Figma Token Guidelines v2.4
            </span>
            <span className="text-[#6e7b6c] hidden md:inline">• Sarah Connor • Oct 24</span>
          </div>
          <button
            onClick={onOpenSpecDoc}
            className="text-[#006b2c] font-semibold hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>View Doc</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </button>
        </div>

        {/* CONVERSATION STREAM OR EMPTY STATE (STRICTLY SCOPED TO ACTIVE CHANNEL) */}
        {(() => {
          const channelMessages = messages.filter(
            (m) => (m.channelId || m.channel_id) === activeChannelId
          );

          if (showEmptyState || channelMessages.length === 0) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <div className="absolute w-72 h-72 rounded-full bg-[#7ffc97]/25 blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col items-center max-w-md">
                  <div className="w-32 h-32 rounded-full bg-[#f2f3ff] dark:bg-[#1a2333] flex items-center justify-center mb-6 shadow-inner">
                    <svg className="w-16 h-16 text-[#006b2c] dark:text-[#7ffc97]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-[#131b2e] dark:text-[#eaedff] mb-1.5">Welcome to #{activeChannel.name}</h2>
                  <p className="text-xs text-[#6e7b6c] dark:text-[#8e9bb5] mb-6 leading-relaxed">
                    This is the start of the #{activeChannel.name} channel for team discussions, wireframes, and project collaboration.
                  </p>
                  <button
                    onClick={() => inputRef.current?.focus()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    <span>Send first message</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Day Divider */}
              <div className="flex items-center justify-center gap-4 my-1">
                <div className="h-px bg-[#eaedff] dark:bg-[#25324d] flex-1"></div>
                <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] dark:text-[#8e9bb5] px-3 py-1 rounded-full bg-[#f2f3ff] dark:bg-[#1a2333] font-semibold">
                  #{activeChannel.name}
                </span>
                <div className="h-px bg-[#eaedff] dark:bg-[#25324d] flex-1"></div>
              </div>

              {channelMessages.map((msg) => {
                const isAuditMessage = msg.content.includes('deleted #') || msg.content.startsWith('📢');
                if (isAuditMessage) {
                  return (
                    <div
                      key={msg.id}
                      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs my-1 animate-in fade-in shadow-2xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">history_edu</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Channel Audit Trail
                          </span>
                          <span className="text-[10px] text-amber-600/80 dark:text-amber-400/70">{msg.createdAt}</span>
                        </div>
                        <p className="font-medium text-xs leading-relaxed">{msg.content.replace(/^📢\s*/, '')}</p>
                      </div>
                    </div>
                  );
                }

                if (msg.isAi || msg.author.id === 'ai') {
                  return (
                    <div key={msg.id} className="flex items-start gap-3.5 group rounded-xl p-2.5 -mx-2 hover:bg-[#faf8ff] dark:hover:bg-[#1f2a3d] transition-colors">
                      <div className="w-9 h-9 rounded-full bg-[#7ffc97] text-[#006b2c] shrink-0 flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[#006b2c] dark:text-[#7ffc97]">TeamHub AI</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-[#7ffc97] text-[#005320] text-[10px] font-bold">
                            Automated
                          </span>
                          <span className="text-[10px] text-[#6e7b6c] dark:text-[#8e9bb5]">{msg.createdAt}</span>
                        </div>
                        <p className="text-[13px] text-[#131b2e] dark:text-[#eaedff] leading-relaxed">{msg.content}</p>
                        {msg.tokenAudit && (
                          <div className="mt-2 p-2.5 rounded-xl bg-[#f2f3ff] dark:bg-[#1a2333] border border-[#eaedff] dark:border-[#25324d] flex items-center gap-3 text-xs">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: msg.tokenAudit.primaryColor }}></span>
                            <span className="text-[11px] text-[#3e4a3d] dark:text-[#8e9bb5]">Primary: {msg.tokenAudit.primaryColor} • Surface: {msg.tokenAudit.surfaceColor}</span>
                          </div>
                        )}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            {msg.reactions.map((r, i) => (
                              <button
                                key={i}
                                onClick={() => toggleReaction(msg.id, r.emoji)}
                                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-[#f2f3ff] dark:bg-[#1a2333] text-[#3e4a3d] dark:text-[#8e9bb5] hover:bg-[#eaedff] cursor-pointer"
                              >
                                <span>{r.emoji}</span>
                                <span className="font-semibold">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3.5 rounded-2xl p-3 -mx-2 transition-colors ${
                      msg.codeSnippet || msg.attachment
                        ? 'bg-[#ffffff] dark:bg-[#172133] shadow-xs border border-[#eaedff] dark:border-[#25324d]'
                        : 'hover:bg-[#faf8ff] dark:hover:bg-[#1f2a3d]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#eaedff] dark:bg-[#25324d] text-[#006b2c] dark:text-[#7ffc97] font-bold text-xs shrink-0 flex items-center justify-center">
                      {msg.author.initials || 'TU'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => {
                            setPopoverUser(msg.author);
                            setShowProfilePopover(true);
                          }}
                          className="text-xs font-bold text-[#131b2e] dark:text-[#eaedff] hover:text-[#006b2c] dark:hover:text-[#7ffc97] cursor-pointer"
                        >
                          {msg.author.name}
                        </button>
                        {msg.author.role === 'lead' && (
                          <span
                            className="material-symbols-outlined text-[15px] text-[#006b2c] dark:text-[#7ffc97]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                            title="Team Lead"
                          >
                            verified
                          </span>
                        )}
                        <span className="text-[10px] text-[#6e7b6c] dark:text-[#8e9bb5]">{msg.createdAt}</span>
                        {msg.tag && (
                          <span className="px-2 py-0.2 rounded-full bg-[#eaedff] dark:bg-[#25324d] text-[10px] text-[#006b2c] dark:text-[#7ffc97] font-semibold">
                            {msg.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#131b2e] dark:text-[#eaedff] leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                      {/* Code Snippet Attachment if present */}
                      {msg.codeSnippet && (
                        <div className="mt-3 p-3 rounded-xl bg-[#f2f3ff] dark:bg-[#1a2333] font-mono text-[12px] text-[#3e4a3d] dark:text-[#8e9bb5] flex items-center justify-between border border-[#eaedff] dark:border-[#25324d]">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#006b2c] dark:text-[#7ffc97]">data_object</span>
                            <span>{msg.codeSnippet.filename} • {msg.codeSnippet.sha}</span>
                          </div>
                          <span className="text-[11px] text-[#006b2c] dark:text-[#7ffc97] font-bold">{msg.codeSnippet.status}</span>
                        </div>
                      )}

                      {/* Attachment if present */}
                      {msg.attachment && (
                        <div className="mt-3 p-3 rounded-xl bg-[#f2f3ff] dark:bg-[#1a2333] text-xs text-[#3e4a3d] dark:text-[#8e9bb5] flex items-center justify-between border border-[#eaedff] dark:border-[#25324d]">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#006b2c] dark:text-[#7ffc97]">attach_file</span>
                            <span className="font-semibold text-[#131b2e] dark:text-[#eaedff]">{msg.attachment.name}</span>
                            <span className="text-[10px] text-[#6e7b6c]">({msg.attachment.size})</span>
                          </div>
                        </div>
                      )}

                      {/* Reactions & Thread Trigger */}
                      <div className="flex items-center gap-3 mt-2.5">
                        {msg.reactions && msg.reactions.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => toggleReaction(msg.id, r.emoji)}
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                              r.userReacted
                                ? 'bg-[#dbe1ff] dark:bg-[#25324d] text-[#006b2c] dark:text-[#7ffc97] font-bold'
                                : 'bg-[#f2f3ff] dark:bg-[#1a2333] text-[#3e4a3d] dark:text-[#8e9bb5] hover:bg-[#eaedff]'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="font-semibold">{r.count}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => toggleReaction(msg.id, '👍')}
                          className="text-xs text-[#6e7b6c] hover:text-[#131b2e] dark:hover:text-[#eaedff] cursor-pointer"
                          title="Add thumbs up"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => toggleReaction(msg.id, '🚀')}
                          className="text-xs text-[#6e7b6c] hover:text-[#131b2e] dark:hover:text-[#eaedff] cursor-pointer"
                          title="Add rocket"
                        >
                          🚀
                        </button>
                        <button
                          onClick={() => setShowThreadPanel(true)}
                          className="flex items-center gap-1 text-xs font-semibold text-[#006b2c] dark:text-[#7ffc97] hover:underline cursor-pointer ml-2"
                        >
                          <span className="material-symbols-outlined text-[15px]">reply</span>
                          <span>Reply in thread ({msg.threadRepliesCount ?? 0})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Bottom Chat Input Bar */}
        <div className="sticky bottom-0 p-4 bg-[#ffffff] border-t border-[#eaedff] z-10 shrink-0">
          <form
            onSubmit={handleSendMessage}
            className="rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-sm flex flex-col focus-within:ring-2 focus-within:ring-[#006b2c]/20"
          >
            {/* Formatting Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#f2f3ff]/70 border-b border-[#eaedff]/60 rounded-t-2xl text-[#6e7b6c] text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyFormatting('**')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Bold (**text**)"
                >
                  <span className="material-symbols-outlined text-[16px]">format_bold</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('*')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Italic (*text*)"
                >
                  <span className="material-symbols-outlined text-[16px]">format_italic</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('`')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Code snippet (`code`)"
                >
                  <span className="material-symbols-outlined text-[16px]">code</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('[', '](https://)')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Insert link ([label](url))"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                </button>
                <div className="w-px h-3 bg-[#eaedff] mx-1"></div>
                <button
                  type="button"
                  onClick={() => applyFormatting('\n- ', '')}
                  className="p-1 hover:text-[#131b2e] hover:bg-[#eaedff] rounded cursor-pointer"
                  title="Bullet list (- item)"
                >
                  <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                </button>
              </div>
              <span className="text-[10px] text-[#6e7b6c]">Markdown supported</span>
            </div>

            {/* Input Row */}
            <div className="p-2.5 flex items-center gap-3">
              <button
                type="button"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                title="Attach file"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message #design or mention @David Kim..."
                className="flex-1 bg-transparent text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none"
              />

              <div className="flex items-center gap-1 text-[#6e7b6c]">
                <button
                  type="button"
                  onClick={() => setInputMessage((p) => p + ' 👍 ')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[19px]">sentiment_satisfied</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMessage((p) => p + ' @David Kim ')}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[19px]">alternate_email</span>
                </button>
                <button
                  type="submit"
                  className="w-8 h-8 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* 3. SIDE-BY-SIDE THREAD PANEL (Screen 15) */}
      {showThreadPanel && (
        <aside className="w-[390px] shrink-0 bg-[#ffffff] border-l border-[#eaedff] flex flex-col h-full z-20 shadow-lg animate-in slide-in-from-right duration-200">
          <div className="h-16 px-4 border-b border-[#eaedff] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#131b2e]">Thread</span>
              <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[11px] font-semibold text-[#006b2c]">
                #{activeChannel.name}
              </span>
            </div>
            <button
              onClick={() => setShowThreadPanel(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Original Message Card */}
            <div className="p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-xs flex items-center justify-center">
                    ER
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#131b2e]">Elena Rostova</span>
                    <span className="text-[10px] text-[#6e7b6c] ml-1.5">10:14 AM</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">push_pin</span>
              </div>
              <p className="text-xs text-[#131b2e] leading-relaxed">
                Hey team! I'm reviewing the contrast on the new dark mode token set for OLED displays. Has anyone checked if the{' '}
                <code className="px-1 py-0.5 rounded bg-[#eaedff] text-[#006b2c] font-mono text-[11px]">
                  #surface-dim
                </code>{' '}
                complies with WCAG AA on low brightness?
              </p>
            </div>

            {/* Replies Divider */}
            <div className="flex items-center justify-center my-2">
              <span className="text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider px-3 py-0.5 rounded-full bg-[#f2f3ff]">
                {threadReplies.length} replies
              </span>
            </div>

            {/* Thread Replies List */}
            <div className="space-y-3">
              {threadReplies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#f2f3ff] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {reply.author.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-[#131b2e]">{reply.author.name}</span>
                      <span className="text-[10px] text-[#6e7b6c]">{reply.createdAt}</span>
                    </div>
                    <p className="text-xs text-[#131b2e] mt-0.5 leading-relaxed">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thread Composer */}
          <div className="p-3 border-t border-[#eaedff] bg-[#ffffff] shrink-0">
            <form onSubmit={handleSendThreadReply} className="flex flex-col gap-2">
              <textarea
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                placeholder="Reply in thread..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#006b2c] border border-[#eaedff] resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[#6e7b6c]">
                  <button type="button" className="p-1 rounded hover:bg-[#f2f3ff] text-[16px]">
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  </button>
                  <button type="button" className="p-1 rounded hover:bg-[#f2f3ff] text-[16px]">
                    <span className="material-symbols-outlined text-[16px]">sentiment_satisfied</span>
                  </button>
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  Reply
                </button>
              </div>
            </form>
          </div>
        </aside>
      )}

      {/* Create Channel Modal (Visible ONLY to Leads and Admins) */}
      {showCreateModal && canCreateChannel && (
        <div className="fixed inset-0 bg-[#131b2e]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#ffffff] dark:bg-[#171f33] rounded-2xl shadow-2xl border border-[#eaedff] dark:border-[#2a364f] w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#7ffc97]/30 text-[#005320] flex items-center justify-center font-bold text-sm">
                  #
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#131b2e] dark:text-[#eaedff]">Create a new channel</h3>
                  <p className="text-xs text-[#6e7b6c]">Only Team Leads and Administrators can create channels</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] dark:hover:text-[#eaedff]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#131b2e] dark:text-[#eaedff] block mb-1">
                  Channel Name
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#6e7b6c] font-bold text-sm">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. qa-regression"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#f2f3ff] dark:bg-[#131b2e] border border-[#eaedff] dark:border-[#2a364f] text-xs text-[#131b2e] dark:text-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#131b2e] dark:text-[#eaedff] block mb-1">
                  Description <span className="text-[#6e7b6c] font-normal">(optional)</span>
                </label>
                <textarea
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-[#f2f3ff] dark:bg-[#131b2e] border border-[#eaedff] dark:border-[#2a364f] text-xs text-[#131b2e] dark:text-[#eaedff] focus:outline-none focus:ring-2 focus:ring-[#006b2c]/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff] dark:border-[#2a364f]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#3e4a3d] dark:text-[#bcc7de] hover:bg-[#f2f3ff] dark:hover:bg-[#1e283d] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newChannelName.trim()}
                  className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isCreating ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Channel Confirmation Modal (Visible ONLY to Leads and Admins, and NEVER for #general) */}
      {channelToDelete && (
        <div className="fixed inset-0 bg-[#131b2e]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#ffffff] dark:bg-[#171f33] rounded-2xl shadow-2xl border border-[#eaedff] dark:border-[#2a364f] w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#131b2e] dark:text-[#eaedff]">
                  Delete #{channelToDelete.name}?
                </h3>
                <p className="text-xs text-[#6e7b6c] dark:text-[#a0acc0] mt-1">
                  Delete #{channelToDelete.name}? This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChannelToDelete(null);
                  setDeleteError(null);
                }}
                className="p-1 rounded-lg text-[#6e7b6c] hover:text-[#131b2e] dark:hover:text-[#eaedff] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                info
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">Visible Audit Trail Notice</span>
                <span className="text-[#6e7b6c] dark:text-amber-200/80 leading-relaxed">
                  The channel will be archived and removed from all members' sidebars immediately. An audit record announcing who deleted the channel will be posted to #general.
                </span>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff] dark:border-[#2a364f]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setChannelToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#3e4a3d] dark:text-[#bcc7de] hover:bg-[#f2f3ff] dark:hover:bg-[#1e283d] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete Channel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#131b2e] text-white text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[18px] text-[#7ffc97]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
