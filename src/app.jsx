// App shell: top nav, Tweaks panel, router outlet.

const DEFAULT_TWEAKS = {
  accent: '#2563eb',
  density: 'comfortable',
  heroVariant: 'full',
  showTagsCol: true,
  uiFont: 'Inter',
};

const FONT_STACKS = {
  Inter: "'Inter', ui-sans-serif, system-ui, 'PingFang SC', sans-serif",
  Geist: "'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif",
  IBM: "'IBM Plex Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
};

function hexToFg(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

function TopNav({ route }) {
  const onDocs = route.startsWith('/docs');
  return (
    <header className="border-b border-neutral-200 bg-white/90 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-[1100px] px-6 h-[49px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={18} />
          <span className="font-mono text-[14px] tracking-tight font-semibold text-neutral-900">
            SkillHub
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-400 ml-1 hidden sm:inline">
            · mozia
          </span>
        </Link>
        <nav className="flex items-center gap-1 font-mono text-[12.5px]">
          <Link
            to="/"
            className={cx(
              'px-3 py-1.5 transition',
              !onDocs ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
            )}
          >
            Skills
          </Link>
          <Link
            to="/docs"
            className={cx(
              'px-3 py-1.5 transition',
              onDocs ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
            )}
          >
            Docs
          </Link>
          <a
            href="https://github.com/MoziaVerse/mozia-skillhub"
            target="_blank"
            rel="noreferrer"
            className="ml-2 px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 text-neutral-700 transition"
            onClick={(e) => e.preventDefault()}
            title="phase 0 · placeholder"
          >
            ↗ repo
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-neutral-200">
      <div className="mx-auto max-w-[1100px] px-6 py-8 flex items-center justify-between flex-wrap gap-3 font-mono text-[11.5px] text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-neutral-600">api</span>
          <span className="text-neutral-400">http://localhost:3333</span>
          <span className="mx-1 text-neutral-300">·</span>
          <span className="text-neutral-600">web</span>
          <span className="text-neutral-400">http://localhost:5173</span>
        </div>
        <div className="uppercase tracking-[0.14em] text-neutral-400">
          skillhub · phase 0 · {SKILLS.length} skills indexed
        </div>
      </div>
    </footer>
  );
}

function TweaksPanel({ tweaks, setTweaks, open, setOpen }) {
  const set = (k, v) => setTweaks({ ...tweaks, [k]: v });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 bg-white border border-neutral-300 hover:border-neutral-900 shadow-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-600 hover:text-neutral-900 transition z-40"
        title="Open tweaks"
      >
        ⚙ tweaks
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-[300px] bg-white border border-neutral-900 shadow-xl z-50 font-mono text-[12px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 bg-neutral-900 text-neutral-100">
        <div className="uppercase tracking-[0.14em] text-[11px]">Tweaks</div>
        <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white">
          ×
        </button>
      </div>
      <div className="p-3 space-y-4">
        <div>
          <div className="uppercase tracking-[0.12em] text-[10px] text-neutral-500 mb-1.5">
            accent
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              ['#111111', 'ink'],
              ['#2563eb', 'blue'],
              ['#059669', 'emerald'],
              ['#d97706', 'amber'],
              ['#dc2626', 'red'],
              ['#7c3aed', 'violet'],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => set('accent', v)}
                title={label}
                className={cx(
                  'w-6 h-6 border-2 transition',
                  tweaks.accent === v ? 'border-neutral-900' : 'border-neutral-200'
                )}
                style={{ background: v }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="uppercase tracking-[0.12em] text-[10px] text-neutral-500 mb-1.5">
            density
          </div>
          <div className="flex border border-neutral-300 divide-x divide-neutral-300">
            {['compact', 'comfortable'].map((v) => (
              <button
                key={v}
                onClick={() => set('density', v)}
                className={cx(
                  'flex-1 px-2 py-1.5 uppercase tracking-[0.1em] text-[10.5px] transition',
                  tweaks.density === v
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="uppercase tracking-[0.12em] text-[10px] text-neutral-500 mb-1.5">
            hero
          </div>
          <div className="flex border border-neutral-300 divide-x divide-neutral-300">
            {['full', 'minimal'].map((v) => (
              <button
                key={v}
                onClick={() => set('heroVariant', v)}
                className={cx(
                  'flex-1 px-2 py-1.5 uppercase tracking-[0.1em] text-[10.5px] transition',
                  tweaks.heroVariant === v
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="uppercase tracking-[0.12em] text-[10px] text-neutral-500 mb-1.5">
            ui font
          </div>
          <div className="flex border border-neutral-300 divide-x divide-neutral-300">
            {['Inter', 'Geist', 'IBM'].map((v) => (
              <button
                key={v}
                onClick={() => set('uiFont', v)}
                className={cx(
                  'flex-1 px-2 py-1.5 uppercase tracking-[0.1em] text-[10.5px] transition',
                  tweaks.uiFont === v
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="uppercase tracking-[0.12em] text-[10px] text-neutral-500">
            tags column
          </span>
          <input
            type="checkbox"
            checked={tweaks.showTagsCol}
            onChange={(e) => set('showTagsCol', e.target.checked)}
          />
        </label>
      </div>
    </div>
  );
}

function Theme({ tweaks }) {
  const css = `:root {
    --accent: ${tweaks.accent};
    --accent-fg: ${hexToFg(tweaks.accent)};
    --ui-font: ${FONT_STACKS[tweaks.uiFont] || FONT_STACKS.Inter};
  }
  body { font-family: var(--ui-font); }`;
  return <style>{css}</style>;
}

function Router({ tweaks }) {
  const path = useHashRoute();

  let view;
  const detail = path.match(/^\/skills\/([^/]+)\/?$/);
  const docsArticle = path.match(/^\/docs\/([^/]+)\/?$/);

  if (path === '/' || path === '') {
    view = <ListPage tweaks={tweaks} />;
  } else if (detail) {
    view = <DetailPage slug={decodeURIComponent(detail[1])} />;
  } else if (path === '/docs' || path === '/docs/') {
    view = <DocsIndex />;
  } else if (docsArticle) {
    const s = docsArticle[1];
    if (s === 'what-is-a-skill') view = <WhatIsASkill />;
    else if (s === 'how-to-install') view = <HowToInstall />;
    else if (s === 'how-to-publish') view = <HowToPublish />;
    else view = <DocsIndex />;
  } else {
    view = <ListPage tweaks={tweaks} />;
  }

  return (
    <>
      <TopNav route={path} />
      <main className="mx-auto max-w-[1100px] px-6">{view}</main>
      <Footer />
    </>
  );
}

function App() {
  const [tweaks, setTweaks] = React.useState(DEFAULT_TWEAKS);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  return (
    <>
      <Theme tweaks={tweaks} />
      <Router tweaks={tweaks} />
      <TweaksPanel
        tweaks={tweaks}
        setTweaks={setTweaks}
        open={tweaksOpen}
        setOpen={setTweaksOpen}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
