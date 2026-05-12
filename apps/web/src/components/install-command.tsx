import { cn } from '@/lib/utils';
import { useState } from 'react';

export function InstallSnippet({
  command,
  content,
  style = 'terminal',
  title,
}: {
  command?: string;
  content?: string;
  style?: 'terminal' | 'prompt' | 'inline';
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const value = content ?? command ?? '';

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (style === 'inline') {
    return (
      <div className="flex items-center gap-2 font-mono text-[13px] text-neutral-900">
        <code className="bg-neutral-100 px-2 py-1 rounded-sm truncate">{value}</code>
        <button
          type="button"
          onClick={onCopy}
          className="text-neutral-500 hover:text-neutral-900 transition"
          aria-label="复制"
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>
    );
  }

  const isPrompt = style === 'prompt';
  const panelTitle = title ?? (isPrompt ? '给 Agent 的提示词' : '通用安装命令');

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl text-[13px] leading-relaxed shadow-[0_16px_40px_rgba(10,10,10,0.12)]',
        isPrompt
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-950'
          : 'bg-neutral-950 text-neutral-100',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2.5',
          isPrompt ? 'bg-emerald-100/90' : 'bg-neutral-900/70',
        )}
      >
        <div className="flex items-center gap-2">
          {isPrompt ? (
            <span className="inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              Agent
            </span>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
            </>
          )}
          <span
            className={cn(
              'text-[10.5px] uppercase tracking-[0.14em]',
              isPrompt ? 'text-emerald-800' : 'ml-3 text-neutral-500',
            )}
          >
            {panelTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-md transition',
            copied
              ? isPrompt
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500/15 text-emerald-400'
              : isPrompt
                ? 'bg-white/80 text-emerald-900 hover:bg-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100',
          )}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div
        className={cn(
          'px-4 py-3',
          isPrompt
            ? 'whitespace-pre-wrap break-words text-[13px] text-emerald-950'
            : 'overflow-x-auto',
        )}
      >
        {isPrompt ? (
          value
        ) : (
          <>
            <span className="select-none text-emerald-400">$ </span>
            <span className="text-neutral-100">{value}</span>
          </>
        )}
      </div>
    </div>
  );
}

export { InstallSnippet as InstallCommand };
