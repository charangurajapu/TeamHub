import React, { useState, useEffect } from 'react';
import { Question, QuestionAnswer, User } from '../../types';
import { fetchQuestionsFromDb, createQuestionInDb, createAnswerInDb, supabase } from '../../lib/supabase';

interface QuestionsViewProps {
  currentUser: User;
  onOpenAiDrawer: () => void;
  selectedQuestionId?: string;
}

export const QuestionsView: React.FC<QuestionsViewProps> = ({
  currentUser,
  onOpenAiDrawer,
  selectedQuestionId,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  // Load questions from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    async function loadQuestions() {
      try {
        const data = await fetchQuestionsFromDb();
        if (isMounted && data !== null) {
          setQuestions(data);
          if (data.length > 0) {
            const initialActive = selectedQuestionId
              ? data.find((q) => q.id === selectedQuestionId || q.key.toLowerCase() === selectedQuestionId.toLowerCase()) || data[0]
              : data[0];
            setActiveQuestion(initialActive);
          } else {
            setActiveQuestion(null);
          }
        }
      } catch (err) {
        console.warn('Could not load questions from DB:', err);
      }
    }
    loadQuestions();
    return () => {
      isMounted = false;
    };
  }, [selectedQuestionId]);

  const [activeTab, setActiveTab] = useState<'open' | 'answered' | 'resolved' | 'my'>('open');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Most Recent');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Interactive state for Bookmark / Follow / Share
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(['q-1']);
  const [followingIds, setFollowingIds] = useState<string[]>(['q-1']);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleToggleBookmark = (qId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleToggleFollow = (qId: string) => {
    setFollowingIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleShareQuestion = (q: Question) => {
    const url = `${window.location.origin}/#qa-${q.key || q.id}`;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Sync selected question when navigated to from notifications
  useEffect(() => {
    if (selectedQuestionId) {
      const found = questions.find(
        (q) => q.id === selectedQuestionId || q.key.toLowerCase() === selectedQuestionId.toLowerCase()
      );
      if (found) {
        setActiveQuestion(found);
        if (found.status === 'resolved') {
          setActiveTab('resolved');
        } else if (found.status === 'answered') {
          setActiveTab('answered');
        } else {
          setActiveTab('open');
        }
      }
    }
  }, [selectedQuestionId, questions]);

  // New question form state
  const [newTitle, setNewTitle] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newTag, setNewTag] = useState('#backend');

  // Reply state
  const [replyInput, setReplyInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleUpvoteQuestion = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, upvotes: q.upvotes + 1 } : q))
    );
    if (activeQuestion && activeQuestion.id === qId) {
      setActiveQuestion({ ...activeQuestion, upvotes: activeQuestion.upvotes + 1 });
    }
  };

  // Realtime & Cross-tab QA Bus
  useEffect(() => {
    let supabaseSub: any = null;
    if (supabase) {
      try {
        supabaseSub = supabase
          .channel('realtime_qa_feed')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'questions' },
            async () => {
              const fresh = await fetchQuestionsFromDb();
              if (fresh) setQuestions(fresh);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'question_answers' },
            async () => {
              const fresh = await fetchQuestionsFromDb();
              if (fresh) {
                setQuestions(fresh);
                if (activeQuestion) {
                  const updatedActive = fresh.find((q) => q.id === activeQuestion.id);
                  if (updatedActive) setActiveQuestion(updatedActive);
                }
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime QA subscription error:', e);
      }
    }

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('teamhub_qa_bus');
      bc.onmessage = async (evt) => {
        if (evt.data?.type === 'QA_MUTATED') {
          const fresh = await fetchQuestionsFromDb();
          if (fresh) {
            setQuestions(fresh);
            if (activeQuestion) {
              const updatedActive = fresh.find((q) => q.id === activeQuestion.id);
              if (updatedActive) setActiveQuestion(updatedActive);
            }
          }
        }
      };
    } catch (e) {}

    return () => {
      if (supabaseSub && supabase) supabase.removeChannel(supabaseSub);
      if (bc) bc.close();
    };
  }, [activeQuestion]);

  const handlePostAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeQuestion) return;

    const answerContent = replyInput.trim();
    setReplyInput('');

    const newAns: QuestionAnswer = {
      id: `ans-${Date.now()}`,
      author: currentUser,
      createdAt: 'Just now',
      content: answerContent,
      upvotes: 1,
    };

    const updatedQ = {
      ...activeQuestion,
      answers: [...activeQuestion.answers, newAns],
      status: 'answered' as const,
    };

    setActiveQuestion(updatedQ);
    setQuestions((prev) => prev.map((q) => (q.id === activeQuestion.id ? updatedQ : q)));

    // Persist to Supabase database
    const dbRes = await createAnswerInDb(activeQuestion.id, newAns, currentUser);
    if (dbRes.success && dbRes.answer) {
      const persistedAns = dbRes.answer;
      setActiveQuestion((prev) =>
        prev && prev.id === activeQuestion.id
          ? {
              ...prev,
              answers: prev.answers.map((a) => (a.id === newAns.id ? persistedAns : a)),
            }
          : prev
      );
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeQuestion.id
            ? {
                ...q,
                answers: q.answers.map((a) => (a.id === newAns.id ? persistedAns : a)),
              }
            : q
        )
      );

      // Broadcast to other tabs
      try {
        const bc = new BroadcastChannel('teamhub_qa_bus');
        bc.postMessage({ type: 'QA_MUTATED', questionId: activeQuestion.id });
        bc.close();
      } catch (e) {}
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const title = newTitle.trim();
    const content = newContext.trim() || 'Shared with Core Engineering Pod.';
    const tag = newTag;

    setNewTitle('');
    setNewContext('');
    setShowAskModal(false);
    setShowEmptyState(false);

    const created: Question = {
      id: `q-${Date.now()}`,
      key: `Q-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      content,
      author: currentUser,
      createdAt: 'Just now',
      tags: [tag.replace('#', ''), 'engineering'],
      channel: tag,
      status: 'open',
      views: 1,
      upvotes: 1,
      answers: [],
    };

    setQuestions((prev) => [created, ...prev]);

    // Persist to Supabase database
    const dbRes = await createQuestionInDb(created, currentUser);
    if (dbRes.success && dbRes.question) {
      const persistedQ = dbRes.question;
      setQuestions((prev) => prev.map((q) => (q.id === created.id ? persistedQ : q)));

      // Broadcast to other tabs
      try {
        const bc = new BroadcastChannel('teamhub_qa_bus');
        bc.postMessage({ type: 'QA_MUTATED', questionId: persistedQ.id });
        bc.close();
      } catch (e) {}
    }
  };

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (activeTab === 'my' && q.author.id !== currentUser.id) return false;
    if (activeTab === 'open' && q.status !== 'open') return false;
    if (activeTab === 'answered' && q.status !== 'answered') return false;
    if (activeTab === 'resolved' && q.status !== 'resolved') return false;
    if (unansweredOnly && q.answers.length > 0) return false;
    if (selectedTopic !== 'all' && !q.tags.includes(selectedTopic.replace('#', ''))) return false;
    if (searchQuery) {
      const qVal = searchQuery.toLowerCase();
      return (
        q.title.toLowerCase().includes(qVal) ||
        q.tags.some((t) => t.includes(qVal)) ||
        q.content.toLowerCase().includes(qVal)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full gap-6">
      {/* ============================================================ */}
      {/* DETAIL VIEW: Question Detail (Screen 10)                     */}
      {/* ============================================================ */}
      {activeQuestion ? (
        <div className="flex flex-col gap-6">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#6e7b6c]">
              <button
                onClick={() => setActiveQuestion(null)}
                className="flex items-center gap-1 text-[#006b2c] font-semibold hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>All Questions</span>
              </button>
              <span>/</span>
              <span>{activeQuestion.channel}</span>
              <span>/</span>
              <span className="font-semibold text-[#131b2e] truncate max-w-sm">
                {activeQuestion.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShareQuestion(activeQuestion)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ffffff] border border-[#eaedff] text-xs font-semibold text-[#131b2e] shadow-xs hover:bg-[#f2f3ff] cursor-pointer transition-all active:scale-95"
                title="Copy shareable link to clipboard"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006b2c]">
                  {copiedShare ? 'check_circle' : 'share'}
                </span>
                <span>{copiedShare ? 'Link Copied!' : 'Share'}</span>
              </button>
              <button
                onClick={() => handleToggleFollow(activeQuestion.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-95 ${
                  followingIds.includes(activeQuestion.id)
                    ? 'bg-[#7ffc97]/30 border-[#006b2c] text-[#005320]'
                    : 'bg-[#ffffff] border-[#eaedff] text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
                title={followingIds.includes(activeQuestion.id) ? 'Unfollow discussion notifications' : 'Follow discussion for updates'}
              >
                <span className="material-symbols-outlined text-[16px] text-[#006b2c]">
                  {followingIds.includes(activeQuestion.id) ? 'notifications_active' : 'notifications'}
                </span>
                <span>{followingIds.includes(activeQuestion.id) ? 'Following' : 'Follow'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Stream: Question + Accepted Solution + Answers */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Question Main Card */}
              <article className="bg-[#ffffff] rounded-2xl p-6 shadow-xs border border-[#eaedff] flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#7ffc97]/40 text-[#005320] text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] animate-pulse"></span>
                      Active Discussion
                    </span>
                    <span className="text-xs text-[#6e7b6c]">• {activeQuestion.key}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#6e7b6c]">
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>{activeQuestion.views} views</span>
                  </div>
                </div>

                {/* Notification Highlight Banner */}
                {selectedQuestionId && (activeQuestion.id === selectedQuestionId || activeQuestion.key.toLowerCase() === selectedQuestionId.toLowerCase()) && (
                  <div className="p-2.5 rounded-xl bg-[#7ffc97]/30 border border-[#006b2c]/30 text-[#005320] text-xs font-semibold flex items-center justify-between shadow-2xs animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#006b2c]">notifications_active</span>
                      <span>Referenced from notification: Marked Q-4823 resolved</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#006b2c] text-white font-bold">
                      Highlighted
                    </span>
                  </div>
                )}

                <h1 className="text-xl sm:text-2xl font-bold text-[#131b2e] tracking-tight leading-snug">
                  {activeQuestion.title}
                </h1>

                {/* Author row */}
                <div className="flex items-center justify-between flex-wrap gap-4 p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center">
                      {activeQuestion.author.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#131b2e]">{activeQuestion.author.name}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded bg-white text-[#6e7b6c]">
                          {activeQuestion.author.roleTitle.split('•')[0]}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6e7b6c]">
                        Asked {activeQuestion.createdAt} in Core Engineering Pod
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeQuestion.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md bg-[#ffffff] text-[11px] text-[#3e4a3d] font-medium border border-[#eaedff]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Question Content */}
                <div className="space-y-4 text-xs text-[#131b2e] leading-relaxed">
                  <p>{activeQuestion.content}</p>

                  {/* Code snippet if present */}
                  {activeQuestion.codeSnippet && (
                    <div className="rounded-xl overflow-hidden bg-[#283044] text-[#eef0ff] shadow-md">
                      <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] text-[11px] font-mono text-[#dbe1ff]">
                        <span>{activeQuestion.codeSnippet.filename}</span>
                        <button
                          onClick={() => {
                            if (activeQuestion.codeSnippet) {
                              navigator.clipboard.writeText(activeQuestion.codeSnippet.code);
                              setCopiedCode(true);
                              setTimeout(() => setCopiedCode(false), 1500);
                            }
                          }}
                          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">content_copy</span>
                          <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed text-[#f2f3ff]">
                        <code>{activeQuestion.codeSnippet.code}</code>
                      </pre>
                    </div>
                  )}
                </div>

                {/* Footer Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t border-[#eaedff]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleUpvoteQuestion(activeQuestion.id, e)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-bold text-[#006b2c] transition-colors cursor-pointer shadow-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                      <span>{activeQuestion.upvotes}</span>
                    </button>
                    <button
                      onClick={(e) => handleToggleBookmark(activeQuestion.id, e)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        bookmarkedIds.includes(activeQuestion.id)
                          ? 'text-[#006b2c] bg-[#eaedff]'
                          : 'text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
                      }`}
                      title={bookmarkedIds.includes(activeQuestion.id) ? 'Remove bookmark' : 'Save bookmark'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {bookmarkedIds.includes(activeQuestion.id) ? 'bookmark_added' : 'bookmark'}
                      </span>
                    </button>
                  </div>

                  <span className="text-xs text-[#6e7b6c]">
                    {activeQuestion.answers.length} verified answers
                  </span>
                </div>
              </article>

              {/* Answers Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#131b2e]">Answers</h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[#3e4a3d] text-xs font-semibold">
                    {activeQuestion.answers.length}
                  </span>
                </div>
                <span className="text-xs text-[#6e7b6c]">Sorted by Acceptance & Upvotes</span>
              </div>

              {/* Answers List */}
              <div className="space-y-4">
                {activeQuestion.answers.map((ans) => (
                  <div
                    key={ans.id}
                    className={`p-6 rounded-2xl shadow-xs border flex flex-col gap-4 ${
                      ans.isAccepted
                        ? 'bg-gradient-to-r from-[#7ffc97]/15 via-[#ffffff] to-[#ffffff] border-[#006b2c]/30'
                        : ans.isAiSuggested
                        ? 'bg-gradient-to-br from-[#f2f3ff] via-[#ffffff] to-[#ffffff] border-[#eaedff]'
                        : 'bg-[#ffffff] border-[#eaedff]'
                    }`}
                  >
                    {/* Top banner if accepted */}
                    {ans.isAccepted && (
                      <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]/60">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#006b2c] text-white text-[11px] font-semibold shadow-xs">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          <span>Accepted Solution by {activeQuestion.author.name}</span>
                        </span>
                        <span className="text-[11px] text-[#6e7b6c]">{ans.createdAt}</span>
                      </div>
                    )}

                    {ans.isAiSuggested && (
                      <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]/60">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dbe1ff] text-[#00174b] text-[11px] font-semibold shadow-xs">
                          <span className="material-symbols-outlined text-[15px] text-[#0051d5]">smart_toy</span>
                          <span>AI Suggested Solution</span>
                        </span>
                        <span className="text-[11px] text-[#6e7b6c]">Synthesized from PR #412</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-xs flex items-center justify-center">
                          {ans.author.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#131b2e]">{ans.author.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f2f3ff] text-[#6e7b6c]">
                              {ans.author.roleTitle.split('•')[0]}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#6e7b6c]">{ans.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-bold text-[#006b2c] bg-[#f2f3ff] px-2.5 py-1 rounded-xl">
                        <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                        <span>+{ans.upvotes}</span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs text-[#131b2e] leading-relaxed">
                      <p className="whitespace-pre-line">{ans.content}</p>

                      {ans.codeBlock && (
                        <div className="rounded-xl overflow-hidden bg-[#283044] text-[#f2f3ff] shadow-sm">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e293b] text-[10px] font-mono text-[#dbe1ff]">
                            <span>{ans.codeBlock.filename}</span>
                            <button
                              onClick={() => {
                                if (ans.codeBlock) navigator.clipboard.writeText(ans.codeBlock.code);
                              }}
                              className="hover:text-white"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="p-3 text-[11px] font-mono overflow-x-auto">
                            <code>{ans.codeBlock.code}</code>
                          </pre>
                        </div>
                      )}

                      {ans.tipBox && (
                        <div className="p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-[#006b2c] text-[20px] shrink-0 mt-0.5">
                            tips_and_updates
                          </span>
                          <div>
                            <span className="font-bold text-xs text-[#131b2e] block">{ans.tipBox.title}</span>
                            <p className="text-xs text-[#3e4a3d] mt-0.5 leading-relaxed">{ans.tipBox.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Composer */}
              <div className="bg-[#ffffff] rounded-2xl p-6 shadow-xs border border-[#eaedff] flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006b2c] text-[20px]">edit_note</span>
                    <h3 className="text-sm font-bold text-[#131b2e]">Your Answer / Resolution</h3>
                  </div>
                  <span className="text-[11px] text-[#6e7b6c]">Markdown supported</span>
                </div>

                <form onSubmit={handlePostAnswer} className="space-y-3">
                  <textarea
                    rows={4}
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder="Write an architectural recommendation, code block, or benchmark observation..."
                    className="w-full p-3.5 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:bg-white border border-[#eaedff] resize-y"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onOpenAiDrawer}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#f2f3ff] text-xs text-[#006b2c] font-semibold hover:bg-[#eaedff] cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>Draft with AI</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Post Your Answer
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Sidebar: Context & AI Summary */}
            <aside className="lg:col-span-4 flex flex-col gap-5">
              {/* Thread Status */}
              <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6e7b6c]">Thread Status</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#f2f3ff]">
                    <span className="text-[10px] text-[#6e7b6c] uppercase block">Status</span>
                    <span className="font-bold text-[#006b2c]">Resolved</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#f2f3ff]">
                    <span className="text-[10px] text-[#6e7b6c] uppercase block">Answers</span>
                    <span className="font-bold text-[#131b2e]">{activeQuestion.answers.length} Solutions</span>
                  </div>
                </div>
              </div>

              {/* AI Key Takeaways */}
              <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3 bg-gradient-to-b from-[#7ffc97]/10 to-[#ffffff]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006b2c] text-[18px]">psychology</span>
                  <h3 className="text-xs font-bold text-[#131b2e]">AI Key Takeaways</h3>
                </div>
                <div className="space-y-2 text-xs text-[#3e4a3d]">
                  {activeQuestion.aiSummary ? (
                    <p className="leading-relaxed">{activeQuestion.aiSummary}</p>
                  ) : activeQuestion.answers.length > 0 ? (
                    <div className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006b2c] mt-1.5 shrink-0"></span>
                      <span>Verified resolution: {activeQuestion.answers[0].content}</span>
                    </div>
                  ) : (
                    <p className="text-[#6e7b6c] italic">No AI takeaways or answers posted yet for this question.</p>
                  )}
                </div>
              </div>

              {/* Related Questions */}
              <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3">
                <h3 className="text-xs font-bold text-[#131b2e]">Related Questions</h3>
                <div className="space-y-3 text-xs">
                  {questions
                    .filter((q) => q.id !== activeQuestion.id)
                    .slice(0, 3)
                    .map((rq) => (
                      <div
                        key={rq.id}
                        onClick={() => setActiveQuestion(rq)}
                        className="p-2.5 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-[#131b2e] line-clamp-2">{rq.title}</span>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-[#6e7b6c]">
                          <span>{rq.answers.length} answers</span>
                          <span>•</span>
                          <span>{rq.createdAt}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* QUESTIONS LIST & KNOWLEDGE BASE FEED (Screen 11 & Screen 12) */
        /* ============================================================ */
        <div className="flex flex-col gap-6">
          {/* Header & Subheader */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#6e7b6c] mb-1 font-semibold">
                <span>Knowledge Exchange</span>
                <span>/</span>
                <span className="text-[#006b2c]">Core Engineering</span>
              </div>
              <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">
                Team Q&A & Knowledge Base
              </h1>
              <p className="text-xs text-[#6e7b6c] mt-0.5">
                Ask technical questions, get verified peer solutions, or query codebase specs with ambient AI.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#ffffff] text-xs font-semibold text-[#131b2e] shadow-xs border border-[#eaedff] hover:bg-[#f2f3ff] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-[#6e7b6c]">sort</span>
                  <span>{sortBy}</span>
                  <span className="material-symbols-outlined text-[15px]">expand_more</span>
                </button>

                {showSortDropdown && (
                  <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white shadow-xl border border-[#eaedff] py-1 z-30 text-xs">
                    {['Most Recent', 'Most Upvoted', 'Needs Answer', 'Fastest Solved'].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSortBy(s);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[#f2f3ff] cursor-pointer ${
                          sortBy === s ? 'font-bold text-[#006b2c]' : 'text-[#131b2e]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle Empty Demo */}
              <button
                onClick={() => setShowEmptyState(!showEmptyState)}
                className="p-2 rounded-xl text-[#6e7b6c] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                title="Toggle Empty Questions Screen"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showEmptyState ? 'visibility' : 'visibility_off'}
                </span>
              </button>

              {/* Ask Button */}
              <button
                onClick={() => setShowAskModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Ask a question</span>
              </button>
            </div>
          </div>

          {/* Search & Suggestions Bar */}
          <div className="bg-[#ffffff] rounded-2xl p-4 shadow-xs border border-[#eaedff] flex flex-col gap-2">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-[#6e7b6c] text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions, topics, error codes, or ask AI (@ai to prompt directly)..."
                className="w-full pl-11 pr-28 py-2.5 rounded-xl bg-[#f2f3ff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:bg-white border border-[#eaedff]"
              />
              <div className="absolute right-3 flex items-center gap-1.5">
                <button
                  onClick={onOpenAiDrawer}
                  className="px-2.5 py-1 rounded-lg bg-[#7ffc97] text-[#002109] text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:opacity-90 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  <span>Ask AI</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6e7b6c] pt-1">
              <span className="font-semibold text-[#006b2c] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                Related:
              </span>
              <button
                onClick={() => setSearchQuery('Redis')}
                className="px-2 py-0.5 rounded-md bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] cursor-pointer"
              >
                Redis failover
              </button>
              <button
                onClick={() => setSearchQuery('Next.js')}
                className="px-2 py-0.5 rounded-md bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] cursor-pointer"
              >
                Next.js server actions
              </button>
              <button
                onClick={() => setSearchQuery('WCAG')}
                className="px-2 py-0.5 rounded-md bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] cursor-pointer"
              >
                WCAG color tokens
              </button>
            </div>
          </div>

          {/* EMPTY QUESTIONS STATE (Screen 12) */}
          {showEmptyState || filteredQuestions.length === 0 ? (
            <div className="relative rounded-3xl bg-[#ffffff] p-8 sm:p-16 flex flex-col items-center justify-center text-center shadow-xs border border-[#eaedff]">
              <div className="w-32 h-32 rounded-full bg-[#f2f3ff] flex items-center justify-center mb-6 shadow-inner">
                <span className="material-symbols-outlined text-[48px] text-[#006b2c]">help_outline</span>
              </div>
              <h2 className="text-xl font-bold text-[#131b2e] tracking-tight mb-2">No questions asked yet</h2>
              <p className="text-xs text-[#6e7b6c] mb-8 leading-relaxed max-w-sm">
                Be the first to ask your team a question or spark an architectural discussion.
              </p>
              <button
                onClick={() => setShowAskModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Ask a question</span>
              </button>
            </div>
          ) : (
            /* QUESTIONS FEED + SIDEBAR GRID (Screen 11) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Questions Stream (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                {/* Tabs & Unanswered Switch */}
                <div className="bg-[#ffffff] rounded-2xl p-3 shadow-xs border border-[#eaedff] flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#eaedff]/60">
                    <div className="flex items-center gap-1 bg-[#f2f3ff] p-1 rounded-xl">
                      {(['open', 'answered', 'resolved', 'my'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                            activeTab === tab
                              ? 'bg-[#ffffff] text-[#006b2c] shadow-xs'
                              : 'text-[#6e7b6c] hover:text-[#131b2e]'
                          }`}
                        >
                          {tab === 'my' ? 'My Questions' : tab}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-xs font-medium text-[#3e4a3d] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unansweredOnly}
                        onChange={(e) => setUnansweredOnly(e.target.checked)}
                        className="rounded text-[#006b2c] accent-[#006b2c] w-3.5 h-3.5"
                      />
                      <span>Unanswered only</span>
                    </label>
                  </div>

                  {/* Topic Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {['all', '#backend', '#frontend', '#infra', '#design-system', '#security'].map((topic) => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                          selectedTopic === topic
                            ? 'bg-[#006b2c] text-white shadow-2xs'
                            : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                        }`}
                      >
                        {topic === 'all' ? 'All Topics' : topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Cards Stack */}
                <div className="space-y-3">
                  {filteredQuestions.map((q) => (
                    <article
                      key={q.id}
                      onClick={() => setActiveQuestion(q)}
                      className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] hover:shadow-md transition-all cursor-pointer group flex items-start gap-4"
                    >
                      {/* Upvotes & Answers Module */}
                      <div className="flex flex-col items-center shrink-0 w-12 gap-1.5">
                        <button
                          onClick={(e) => handleUpvoteQuestion(q.id, e)}
                          className="w-full flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#f2f3ff] hover:bg-[#7ffc97] hover:text-[#002109] transition-colors cursor-pointer"
                          title="Upvote"
                        >
                          <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                          <span className="text-xs font-bold">{q.upvotes}</span>
                        </button>

                        <div
                          className={`w-full py-1 rounded-xl flex flex-col items-center text-center ${
                            q.status === 'resolved'
                              ? 'bg-[#7ffc97]/40 text-[#005320]'
                              : 'bg-[#eaedff] text-[#131b2e]'
                          }`}
                        >
                          <span className="text-sm font-bold leading-none">{q.answers.length}</span>
                          <span className="text-[9px] font-semibold">ans</span>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                                q.status === 'resolved'
                                  ? 'bg-[#7ffc97]/40 text-[#005320]'
                                  : q.status === 'answered'
                                  ? 'bg-[#dbe1ff] text-[#00174b]'
                                  : 'bg-[#ffdad6] text-[#93000a]'
                              }`}
                            >
                              {q.status}
                            </span>
                            {q.aiSummary && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#7ffc97]/40 text-[#005320]">
                                <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                <span>AI Summary</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#6e7b6c]">{q.createdAt}</span>
                        </div>

                        <h2 className="text-sm font-bold text-[#131b2e] group-hover:text-[#006b2c] transition-colors leading-snug">
                          {q.title}
                        </h2>

                        <p className="text-xs text-[#3e4a3d] line-clamp-2 mt-1 leading-relaxed">
                          {q.content}
                        </p>

                        <div className="flex items-center justify-between pt-3 mt-1 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {q.tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-[#f2f3ff] text-[10px] text-[#6e7b6c] font-medium"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-[#eaedff] text-[#006b2c] text-[9px] font-bold flex items-center justify-center">
                              {q.author.initials}
                            </div>
                            <span className="text-[11px] text-[#3e4a3d]">{q.author.name}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* Right Pulse Column (4 cols) */}
              <aside className="lg:col-span-4 flex flex-col gap-5">
                {/* Ask TeamHub AI Fast Capsule */}
                <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3 bg-gradient-to-br from-[#ffffff] to-[#f2f3ff]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#7ffc97] flex items-center justify-center text-[#006b2c]">
                      <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#131b2e]">Ask TeamHub AI</h3>
                      <span className="text-[10px] text-[#6e7b6c]">Context-aware indexing</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#3e4a3d] leading-relaxed">
                    Got an immediate question? AI scans codebase specs, pull requests, and resolved pod docs instantly.
                  </p>
                  <button
                    onClick={onOpenAiDrawer}
                    className="w-full py-2 bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Launch AI Assistant</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>

                {/* Top Contributors */}
                <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
                    <span className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#006b2c] text-[18px]">workspace_premium</span>
                      Top Solvers
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#6e7b6c]">This Month</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold text-[10px] flex items-center justify-center">
                          DK
                        </div>
                        <div>
                          <span className="font-bold text-[#131b2e] block leading-none">David Kim</span>
                          <span className="text-[10px] text-[#6e7b6c]">24 solutions</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#006b2c] bg-[#7ffc97]/40 px-2 py-0.5 rounded-full">
                        +480 pt
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#ffdcc3] text-[#2f1500] font-bold text-[10px] flex items-center justify-center">
                          AL
                        </div>
                        <div>
                          <span className="font-bold text-[#131b2e] block leading-none">Anya Lin</span>
                          <span className="text-[10px] text-[#6e7b6c]">19 solutions</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#006b2c] bg-[#7ffc97]/40 px-2 py-0.5 rounded-full">
                        +365 pt
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#7ffc97] text-[#002109] font-bold text-[10px] flex items-center justify-center">
                          AI
                        </div>
                        <div>
                          <span className="font-bold text-[#131b2e] block leading-none">TeamHub AI</span>
                          <span className="text-[10px] text-[#6e7b6c]">42 answers</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#6e7b6c] bg-[#f2f3ff] px-2 py-0.5 rounded-full">
                        Automated
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hot Topics */}
                <div className="bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#eaedff] flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
                    <span className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#8d4b00] text-[18px]">trending_up</span>
                      Hot Topics
                    </span>
                    <span className="text-[10px] text-[#6e7b6c]">Past 7 days</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div
                      onClick={() => setSearchQuery('redis')}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] cursor-pointer transition-colors"
                    >
                      <span className="font-semibold text-[#131b2e]">#redis</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7ffc97]/50 text-[#005320] font-bold">
                        +18% (28 asks)
                      </span>
                    </div>

                    <div
                      onClick={() => setSearchQuery('tokens')}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] cursor-pointer transition-colors"
                    >
                      <span className="font-semibold text-[#131b2e]">#tokens</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#dbe1ff] text-[#00174b] font-bold">
                        Active (19 asks)
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* + Ask Question Modal */}
          {showAskModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#131b2e]/40 backdrop-blur-xs animate-in fade-in"
              onClick={() => setShowAskModal(false)}
            >
              <div
                className="bg-[#ffffff] w-full max-w-xl p-6 rounded-2xl shadow-2xl border border-[#eaedff]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#eaedff]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#7ffc97]/40 text-[#006b2c] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">help</span>
                    </div>
                    <span className="text-base font-bold text-[#131b2e]">Ask the Engineering Pod</span>
                  </div>
                  <button
                    onClick={() => setShowAskModal(false)}
                    className="p-1 rounded-lg text-[#6e7b6c] hover:bg-[#f2f3ff]"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#131b2e] mb-1">Question Title *</label>
                    <input
                      required
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. How should we manage gRPC connection pooling in staging?"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#131b2e] mb-1">Context & Details</label>
                    <textarea
                      rows={4}
                      value={newContext}
                      onChange={(e) => setNewContext(e.target.value)}
                      placeholder="Share background details, attempted solutions, or code snippets..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#f2f3ff] border border-[#eaedff] text-xs text-[#131b2e] focus:outline-none focus:bg-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#131b2e] mb-1">Channel & Topic</label>
                    <div className="flex flex-wrap gap-2">
                      {['#backend', '#architecture', '#frontend', '#design', '#security'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setNewTag(tag)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                            newTag === tag
                              ? 'bg-[#006b2c] text-white'
                              : 'bg-[#f2f3ff] text-[#3e4a3d] hover:bg-[#eaedff]'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
                    <button
                      type="button"
                      onClick={() => setShowAskModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6e7b6c] hover:bg-[#eaedff] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Post Question
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
