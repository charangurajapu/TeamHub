import React, { useState } from 'react';
import { Question } from '../../types';
import { INITIAL_QUESTIONS } from '../../data/mockData';

interface MobileQuestionsScreenProps {
  onSelectQuestion: (question: Question) => void;
  onAskQuestion: () => void;
}

export const MobileQuestionsScreen: React.FC<MobileQuestionsScreenProps> = ({
  onSelectQuestion,
  onAskQuestion,
}) => {
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);

  const handleUpvote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q))
    );
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#faf8ff] pb-24 text-[#131b2e]">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 w-full bg-[#faf8ff]/85 backdrop-blur-xl shadow-xs px-4 py-3 flex items-center justify-between border-b border-[#eaedff]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#131b2e]">Q&A Knowledge</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#ffdcc3] text-[#2f1500] font-semibold">
            {questions.length} Active
          </span>
        </div>
        <button
          onClick={onAskQuestion}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#006b2c] text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span>Ask</span>
        </button>
      </header>

      {/* Questions Feed */}
      <div className="p-4 space-y-3">
        {questions.map((q) => (
          <div
            key={q.id}
            onClick={() => onSelectQuestion(q)}
            className="p-4 rounded-2xl bg-[#ffffff] border border-[#eaedff]/70 shadow-xs flex flex-col gap-2.5 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  q.status === 'resolved'
                    ? 'bg-[#7ffc97]/40 text-[#005320]'
                    : q.status === 'answered'
                    ? 'bg-[#dbe1ff] text-[#00174b]'
                    : 'bg-[#ffdad6] text-[#93000a]'
                }`}
              >
                {q.status}
              </span>
              <span className="text-[10px] text-[#6e7b6c]">{q.createdAt}</span>
            </div>

            <h3 className="text-xs font-bold text-[#131b2e] leading-snug line-clamp-2">
              {q.title}
            </h3>

            <p className="text-xs text-[#3e4a3d] line-clamp-2 leading-relaxed">{q.content}</p>

            <div className="flex flex-wrap gap-1 mt-1">
              {q.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-[#f2f3ff] text-[10px] text-[#6e7b6c] font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#eaedff] text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#eaedff] text-[#006b2c] text-[9px] font-bold flex items-center justify-center">
                  {q.author.initials}
                </div>
                <span className="text-[11px] text-[#3e4a3d]">{q.author.name}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-[#6e7b6c]">
                  <span className="material-symbols-outlined text-[15px]">chat_bubble</span>
                  {q.answers.length}
                </span>

                <button
                  onClick={(e) => handleUpvote(q.id, e)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f2f3ff] text-xs font-semibold text-[#006b2c] active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                  <span>{q.upvotes}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
