import React, { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  // Helper to copy code block content
  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Helper to format inline markdown (bold, code, links)
  const renderInlineFormatted = (text: string) => {
    // Split by inline code: `code`
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-mono text-xs"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="font-semibold text-on-surface">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Parse lines into blocks (code blocks, headings, lists, tables, paragraphs)
  const blocks: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;
  let codeBlockCounter = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks: ```lang ... ```
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```([a-zA-Z0-9_-]+)?/);
      const language = langMatch && langMatch[1] ? langMatch[1] : 'code';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      const codeString = codeLines.join('\n');
      const currentIndex = codeBlockCounter++;

      blocks.push(
        <div
          key={`code-${currentIndex}`}
          className="flex flex-col rounded-xl overflow-hidden bg-inverse-surface text-inverse-on-surface shadow-inner my-3"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-inverse-surface/90 border-b border-surface-variant/20 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-primary-fixed">
              <span className="material-symbols-outlined text-[15px]">code</span>
              <span className="text-inverse-on-surface/90">{language}</span>
            </div>
            <button
              onClick={() => handleCopyCode(codeString, currentIndex)}
              className="hover:text-primary-fixed transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copiedCodeIndex === currentIndex ? 'check' : 'content_copy'}
              </span>
              <span>{copiedCodeIndex === currentIndex ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="p-3 font-mono text-xs overflow-x-auto leading-relaxed text-inverse-on-surface/90 selection:bg-primary-container">
            <code>{codeString}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Headings: ### Heading, ## Heading, # Heading
    if (line.startsWith('### ')) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="text-base font-semibold text-on-surface tracking-tight mt-3 mb-1 flex items-center gap-2"
        >
          <span className="w-1.5 h-4 bg-primary rounded-full inline-block shrink-0"></span>
          <span>{renderInlineFormatted(line.slice(4))}</span>
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2
          key={`h2-${i}`}
          className="text-lg font-semibold text-on-surface tracking-tight mt-4 mb-2 flex items-center gap-2"
        >
          <span className="w-2 h-4.5 bg-primary rounded-full inline-block shrink-0"></span>
          <span>{renderInlineFormatted(line.slice(3))}</span>
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h1
          key={`h1-${i}`}
          className="text-xl font-bold text-on-surface tracking-tight mt-4 mb-2 flex items-center gap-2"
        >
          <span>{renderInlineFormatted(line.slice(2))}</span>
        </h1>
      );
      i++;
      continue;
    }

    // 3. Bullet list item: - text or * text
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }

      blocks.push(
        <div key={`list-${i}`} className="flex flex-col gap-2 my-2 pl-1">
          {listItems.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">
                check_circle
              </span>
              <p className="text-sm text-on-surface leading-relaxed flex-1">
                {renderInlineFormatted(item)}
              </p>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // 4. Numbered list: 1. text
    if (/^\d+\.\s/.test(line.trim())) {
      const numItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        numItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }

      blocks.push(
        <ol key={`numlist-${i}`} className="flex flex-col gap-2 my-2 pl-2">
          {numItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center text-[11px] font-semibold text-primary shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm text-on-surface leading-relaxed flex-1">
                {renderInlineFormatted(item)}
              </p>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 5. Empty line spacer
    if (!line.trim()) {
      i++;
      continue;
    }

    // 6. Regular paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-sm text-on-surface leading-relaxed my-1">
        {renderInlineFormatted(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
};
