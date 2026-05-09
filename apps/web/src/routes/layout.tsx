import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    apiClient.getUnreadNotificationCount().then(
      (res) => setUnreadCount(res.count),
      () => setUnreadCount(0),
    );
  }, []);

  return (
    <Link
      to="/notifications"
      className="relative p-1.5 text-neutral-400 hover:text-white transition"
      title="通知"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        role="img"
        aria-label="通知铃铛"
      >
        <title>通知</title>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
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
      <span className="flex items-center gap-2 font-mono text-[12.5px]">
        <Link
          to="/publish"
          className="px-2 py-1 bg-neutral-900 text-neutral-100 hover:bg-neutral-700 transition"
        >
          + 发布
        </Link>
        <span className="text-neutral-500">|</span>
        <NotificationBell />
        <Link
          to={`/u/${encodeURIComponent(state.me.handle)}`}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <Avatar src={state.me.image} name={state.me.name} handle={state.me.handle} size={24} />
          <span className="text-neutral-200 hover:underline">{state.me.name}</span>
        </Link>
        <span className="text-neutral-500">·</span>
        <button
          type="button"
          onClick={signOut}
          className="text-neutral-400 hover:text-neutral-200 transition"
        >
          退出
        </button>
      </span>
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
    <span className="flex items-center gap-2">
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

function TopNav() {
  const { pathname } = useLocation();
  const onDocs = pathname.startsWith('/docs');

  return (
    <header className="bg-[#0a0a0a] sticky top-0 z-20">
      <div className="mx-auto max-w-[1200px] px-6 h-[58px] flex items-center justify-between">
        <Link to="/" className="flex items-end gap-3">
          <Logo size={28} className="text-white" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 ml-1 hidden sm:inline">
            · mozia
          </span>
        </Link>
        <nav className="flex items-center gap-3 font-mono text-[12.5px]">
          <Link
            to="/"
            className={cn(
              'px-3 py-1.5 transition rounded-sm',
              !onDocs ? 'text-white' : 'text-neutral-400 hover:text-white',
            )}
          >
            发现
          </Link>
          <Link
            to="/docs"
            className={cn(
              'px-3 py-1.5 transition rounded-sm',
              onDocs ? 'text-white' : 'text-neutral-400 hover:text-white',
            )}
          >
            文档
          </Link>
          <SessionWidget />
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Logo size={24} className="text-neutral-900" />
            </div>
            <div className="font-mono text-[11px] text-neutral-500 leading-relaxed">
              发布并发现新的 AI Agent Skills。
            </div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 mb-3">
              产品
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link to="/" className="text-neutral-600 hover:text-neutral-900 transition">
                  发现
                </Link>
              </li>
              <li>
                <Link to="/docs" className="text-neutral-600 hover:text-neutral-900 transition">
                  文档
                </Link>
              </li>
              <li>
                <Link to="/publish" className="text-neutral-600 hover:text-neutral-900 transition">
                  发布 Skill
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 mb-3">
              资源
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link
                  to="/docs/api-reference"
                  className="text-neutral-600 hover:text-neutral-900 transition"
                >
                  API 参考
                </Link>
              </li>
              <li>
                <span className="text-neutral-400">更新日志</span>
              </li>
              <li>
                <span className="text-neutral-400">常见问题</span>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 mb-3">
              连接
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <span className="text-neutral-400">反馈</span>
              </li>
              <li>
                <a
                  href="https://github.com/MoziaVerse/mozia-skillhub"
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-600 hover:text-neutral-900 transition"
                >
                  GitHub
                </a>
              </li>
              <li>
                <span className="text-neutral-400">联系</span>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 mb-3">
              法律
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <span className="text-neutral-400">服务条款</span>
              </li>
              <li>
                <span className="text-neutral-400">隐私政策</span>
              </li>
            </ul>
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
