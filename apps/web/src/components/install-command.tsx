import { cn } from '@/lib/utils';
import { useState } from 'react';

export function InstallCommand({
  command,
  style = 'terminal',
}: {
  command: string;
  style?: 'terminal' | 'inline';
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = command;
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
        <code className="bg-neutral-100 px-2 py-1 rounded-sm truncate">{command}</code>
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

  return (
    <div className="group relative bg-neutral-950 text-neutral-100 font-mono text-[13px] leading-relaxed rounded-xl overflow-hidden shadow-[0_16px_40px_rgba(10,10,10,0.18)]">
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/70">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-3 text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            命令行
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-md transition',
            copied
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100',
          )}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="px-4 py-3 overflow-x-auto">
        <span className="text-emerald-400 select-none">$ </span>
        <span className="text-neutral-100">{command}</span>
      </div>
    </div>
  );
}
