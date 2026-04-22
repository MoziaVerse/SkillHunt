// Shared UI atoms — Badge, SourceBadge, CopyCommand, hash router.

const cx = (...a) => a.filter(Boolean).join(' ');

function Badge({ children, variant = 'solid', className }) {
  const base =
    'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-mono uppercase tracking-[0.08em] leading-none';
  const styles = {
    solid: 'bg-neutral-900 text-neutral-100',
    outline: 'border border-neutral-300 text-neutral-700 bg-white',
    subtle: 'bg-neutral-100 text-neutral-700',
    warn: 'border border-amber-400 text-amber-700 bg-amber-50',
    accent: 'bg-[var(--accent)] text-[var(--accent-fg)]',
  };
  return <span className={cx(base, styles[variant], className)}>{children}</span>;
}

function SourceBadge({ skill }) {
  if (skill.type === 'owned') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-neutral-900">
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden>
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
          <rect x="3" y="3" width="4" height="4" fill="currentColor" />
        </svg>
        mozia-official
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-neutral-600">
      <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden>
        <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
      </svg>
      {skill.sourceRepo}
    </span>
  );
}

function CopyCommand({ command, style = 'terminal' }) {
  const [copied, setCopied] = React.useState(false);
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
          onClick={onCopy}
          className={cx(
            'text-[11px] uppercase tracking-[0.1em] px-2 py-0.5 border transition',
            copied
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500'
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

// Hash-based router. Routes:
//   #/                → list
//   #/skills/:slug    → detail
//   #/docs            → docs index
//   #/docs/:article   → docs article
function useHashRoute() {
  const [hash, setHash] = React.useState(() => window.location.hash || '#/');
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const path = hash.replace(/^#/, '') || '/';
  return path;
}

function navigate(path) {
  window.location.hash = '#' + path;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function Link({ to, children, className, ...rest }) {
  return (
    <a
      href={'#' + to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

Object.assign(window, { cx, Badge, SourceBadge, CopyCommand, useHashRoute, navigate, Link });
