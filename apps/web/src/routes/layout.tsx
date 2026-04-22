import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation } from 'react-router';

function TopNav() {
  const { pathname } = useLocation();
  const onDocs = pathname.startsWith('/docs');

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
            className={cn(
              'px-3 py-1.5 transition',
              !onDocs ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900',
            )}
          >
            Skills
          </Link>
          <Link
            to="/docs"
            className={cn(
              'px-3 py-1.5 transition',
              onDocs ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900',
            )}
          >
            Docs
          </Link>
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
          <span className="text-neutral-400">http://localhost:5180</span>
        </div>
        <div className="uppercase tracking-[0.14em] text-neutral-400">skillhub · phase 0</div>
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1100px] px-6">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
