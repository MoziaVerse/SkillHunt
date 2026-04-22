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
          aria-label="Copy"
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>
    );
  }

  return (
    <div className="group relative border border-neutral-200 bg-neutral-950 text-neutral-100 font-mono text-[13px] leading-relaxed">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/60">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neutral-700" />
          <span className="w-2 h-2 rounded-full bg-neutral-700" />
          <span className="w-2 h-2 rounded-full bg-neutral-700" />
          <span className="ml-2 text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
            shell
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'text-[11px] uppercase tracking-[0.1em] px-2 py-0.5 border transition',
            copied
              ? 'border-emerald-400 text-emerald-400'
              : 'border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500',
          )}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className="px-3 py-3 overflow-x-auto">
        <span className="text-neutral-500 select-none">$ </span>
        <span className="text-neutral-100">{command}</span>
      </div>
    </div>
  );
}
