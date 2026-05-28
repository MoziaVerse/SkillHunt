import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { subscribeUnreadNotificationCount } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Bell, ExternalLink, LogOut, Plus } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeUnreadNotificationCount(setUnreadCount);

    apiClient.getUnreadNotificationCount().then(
      (res) => setUnreadCount(res.count),
      () => setUnreadCount(0),
    );

    return unsubscribe;
  }, []);

  return (
    <Link
      to="/notifications"
      className="relative rounded-sm p-1.5 text-neutral-400 transition hover:bg-neutral-900 hover:text-white"
      title="通知"
      aria-label="通知"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

function SessionWidget() {
  const [state, setState] = useState<{
    loading: boolean;
    me: MeResponse | null;
    ssoConfigured: boolean;
    providerId: string;
    error: string | null;
  }>({
    loading: true,
    me: null,
    ssoConfigured: false,
    providerId: 'mozia-sso',
    error: null,
  });

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
    return <span className="shrink-0 font-mono text-[12.5px] text-neutral-400">…</span>;
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
      const data = (await res.json().catch(() => null)) as {
        url?: string;
      } | null;
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error('响应中缺少跳转地址');
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : '登录失败',
      }));
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
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
      <div className="flex shrink-0 items-center gap-2 border-neutral-800 font-mono text-[12.5px] sm:border-l sm:pl-4">
        <NotificationBell />
        <Link
          to={`/u/${encodeURIComponent(state.me.handle)}`}
          className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-neutral-200 transition hover:bg-neutral-900 hover:text-white"
          title={state.me.name}
        >
          <Avatar src={state.me.image} name={state.me.name} handle={state.me.handle} size={24} />
          <span className="hidden max-w-[120px] truncate sm:inline">{state.me.name}</span>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1 rounded-sm px-2 py-1.5 text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          退出
        </button>
      </div>
    );
  }

  if (!state.ssoConfigured) {
    return (
      <span
        className="font-mono text-[12.5px] px-3 py-1.5 border border-dashed border-neutral-600 rounded text-neutral-400 cursor-not-allowed"
        title="mozia-sso 未配置。请在 apps/api/.env 中填写 OIDC_CLIENT_ID/SECRET 并重启 api。"
      >
        登录（sso 未配置）
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={signIn}
        className="font-mono text-[12.5px] px-3 py-1.5 border border-neutral-600 rounded text-neutral-200 hover:bg-neutral-800 transition"
      >
        登录
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

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-sm px-3 py-1.5 transition',
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-400 hover:bg-neutral-900 hover:text-white',
      )}
    >
      {children}
    </Link>
  );
}

function TopNav() {
  const { pathname } = useLocation();
  const onDocs = pathname.startsWith('/docs');
  const onEvents = pathname.startsWith('/events');
  const onPublish = pathname.startsWith('/publish');
  const onDiscover =
    pathname === '/' || pathname.startsWith('/skills') || pathname.startsWith('/packages');

  return (
    <header className="bg-[#0a0a0a] sticky top-0 z-20">
      <div className="relative h-[58px] w-full">
        <div className="mx-auto flex h-full max-w-[1200px] items-center px-6">
          <Link to="/" className="flex shrink-0 items-end gap-3" aria-label="SkillHunt 首页">
            <Logo size={28} className="text-white" />
          </Link>
        </div>

        <div className="absolute inset-y-0 right-4 left-[220px] flex min-w-0 items-center justify-end gap-3 sm:right-6">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden">
            <NavLink to="/" active={onDiscover}>
              发现
            </NavLink>
            <NavLink to="/docs" active={onDocs}>
              文档
            </NavLink>
            <NavLink to="/publish" active={onPublish}>
              <span className="inline-flex items-center gap-1">
                发布
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </NavLink>
            <span className="mx-1 h-4 w-px bg-neutral-800" aria-hidden="true" />
            <NavLink to="/events/hdu-skills-2026" active={onEvents}>
              竞赛专区
            </NavLink>
            <a
              href="https://matrix.mzsjai.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-neutral-400 transition hover:bg-neutral-900 hover:text-white"
            >
              Matrix
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </nav>
          <SessionWidget />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Logo size={24} className="text-neutral-900" />
            </div>
            <div className="font-mono text-[11px] text-neutral-500 leading-relaxed">
              发布并发现新的 AI Agent Skills。
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
            <Link to="/" className="text-neutral-600 hover:text-neutral-900 transition">
              发现
            </Link>
            <Link to="/publish" className="text-neutral-600 hover:text-neutral-900 transition">
              发布 Skill
            </Link>
            <a
              href="https://mzsjai.com"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-600 hover:text-neutral-900 transition"
            >
              关于我们
            </a>
          </nav>
        </div>

        <div className="flex flex-col gap-2 text-[12px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 摩智视界</div>
          <div>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-neutral-900 transition"
            >
              浙ICP备2025205413号-4
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
