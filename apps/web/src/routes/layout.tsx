import { Logo } from '@/components/logo';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

function SessionWidget() {
  const [state, setState] = useState<{
    loading: boolean;
    me: MeResponse | null;
    ssoConfigured: boolean;
    providerId: string;
    error: string | null;
  }>({ loading: true, me: null, ssoConfigured: false, providerId: 'mozia-sso', error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiClient.getMe().catch(() => null), apiClient.getAuthStatus()])
      .then(([me, status]) => {
        if (!cancelled)
          setState({
            loading: false,
            me,
            ssoConfigured: status.ssoConfigured,
            providerId: status.providerId,
            error: null,
          });
      })
      .catch(() => {
        if (!cancelled)
          setState({
            loading: false,
            me: null,
            ssoConfigured: false,
            providerId: 'mozia-sso',
            error: null,
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return <span className="font-mono text-[12.5px] text-neutral-400">…</span>;
  }

  const signIn = async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const res = await fetch('/api/auth/sign-in/oauth2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        // callbackURL is resolved relative to better-auth's baseURL (the api on
        // :3333), so we pass the full web origin to land back on the web app.
        body: JSON.stringify({
          providerId: state.providerId,
          callbackURL: window.location.origin + window.location.pathname,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body || res.statusText}`);
      }
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error('no redirect URL in response');
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'sign-in failed',
      }));
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    setState({
      loading: false,
      me: null,
      ssoConfigured: state.ssoConfigured,
      providerId: state.providerId,
      error: null,
    });
  };

  if (state.me) {
    return (
      <span className="font-mono text-[12.5px] text-neutral-700 flex items-center gap-2">
        <Link
          to="/publish"
          className="px-2 py-1 bg-neutral-900 text-neutral-100 hover:bg-neutral-700 transition"
        >
          + Publish
        </Link>
        <span className="text-neutral-300">|</span>
        <Link
          to={`/u/${encodeURIComponent(state.me.handle)}`}
          className="text-neutral-900 hover:underline"
          title={`@${state.me.handle}`}
        >
          {state.me.name}
        </Link>
        <span className="text-neutral-300">·</span>
        <Link
          to="/settings/profile"
          className="text-neutral-500 hover:text-neutral-900 transition"
          title="Profile"
        >
          settings
        </Link>
        <span className="text-neutral-300">·</span>
        <button
          type="button"
          onClick={signOut}
          className="text-neutral-500 hover:text-neutral-900 transition"
        >
          sign out
        </button>
      </span>
    );
  }

  if (!state.ssoConfigured) {
    return (
      <span
        className="font-mono text-[12.5px] px-3 py-1.5 border border-dashed border-neutral-300 rounded text-neutral-400 cursor-not-allowed"
        title="mozia-sso not configured. Fill OIDC_CLIENT_ID/SECRET in apps/api/.env and restart the api."
      >
        Sign in (sso unconfigured)
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={signIn}
        className="font-mono text-[12.5px] px-3 py-1.5 border border-neutral-300 rounded text-neutral-900 hover:bg-neutral-100 transition"
      >
        Sign in
      </button>
      {state.error ? (
        <span
          className="font-mono text-[11px] text-red-600 max-w-[260px] truncate"
          title={state.error}
        >
          {state.error}
        </span>
      ) : null}
    </span>
  );
}

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
        <nav className="flex items-center gap-3 font-mono text-[12.5px]">
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
          <SessionWidget />
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
