import { Avatar } from '@/components/avatar';
import { type Notification, apiClient } from '@/lib/api-client';
import { publishUnreadNotificationCount } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

type FilterTab = 'all' | 'upvote' | 'comment' | 'reply' | 'fork' | 'sync' | 'release';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'upvote', label: '点赞' },
  { key: 'comment', label: '评论' },
  { key: 'reply', label: '回复' },
  { key: 'fork', label: 'Fork' },
  { key: 'sync', label: '同步' },
  { key: 'release', label: '版本' },
];

const typeIcons: Record<NotificationType, string> = {
  upvote: '👍',
  comment: '💬',
  reply: '↩️',
  bookmark: '⭐',
  fork: '🔱',
  sync: '🔄',
  release: '📦',
};

const typeLabels: Record<NotificationType, string> = {
  upvote: '点赞了',
  comment: '评论了',
  reply: '回复了',
  bookmark: '收藏了',
  fork: 'Fork 了',
  sync: '同步了',
  release: '发布了新版本',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([apiClient.listNotifications(), apiClient.getUnreadNotificationCount()])
      .then(([listRes, countRes]) => {
        if (cancelled) return;
        setNotifications(listRes.items);
        setUnreadCount(countRes.count);
        publishUnreadNotificationCount(countRes.count);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    if (notifications.find((n) => n.id === id)?.read) return;

    await apiClient.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const countRes = await apiClient.getUnreadNotificationCount();
    setUnreadCount(countRes.count);
    publishUnreadNotificationCount(countRes.count);
  };

  const handleMarkAllRead = async () => {
    await apiClient.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    publishUnreadNotificationCount(0);
  };

  const filtered =
    activeFilter === 'all' ? notifications : notifications.filter((n) => n.type === activeFilter);

  return (
    <div className="mx-auto max-w-[800px] px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">通知</h1>
          {unreadCount > 0 && <p className="text-sm text-neutral-500 mt-1">{unreadCount} 条未读</p>}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm text-neutral-500 hover:text-neutral-900 border border-neutral-200 px-3 py-1.5 rounded-lg transition"
          >
            全部标记为已读
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 mb-6 overflow-x-auto">
        {filterTabs.map((tab) => {
          const count =
            tab.key === 'all'
              ? notifications.length
              : notifications.filter((n) => n.type === tab.key).length;
          if (tab.key !== 'all' && count === 0) return null;
          return (
            <button
              key={tab.key}
              type="button"
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition',
                activeFilter === tab.key
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600',
              )}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
              {count > 0 && <span className="ml-1.5 text-xs text-neutral-400">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {error && (
        <div className="py-12 text-center font-mono text-[13px] text-red-700">
          加载失败：{error.message}
        </div>
      )}

      {!error && loading && (
        <div className="py-12 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
          加载中…
        </div>
      )}

      {!error && !loading && filtered.length === 0 && (
        <div className="py-24 text-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
            {activeFilter === 'all' ? '暂无通知' : '暂无此类通知'}
          </div>
          <div className="text-neutral-500 text-[15px]">
            当有人点赞、评论你的 skill 时，通知会出现在这里。
          </div>
        </div>
      )}

      {!error && !loading && filtered.length > 0 && (
        <div className="space-y-0 border border-neutral-200 rounded-xl overflow-hidden">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              className={cn(
                'w-full px-5 py-4 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition text-left flex items-start gap-4',
                !n.read && 'bg-blue-50/40',
              )}
              onClick={() => handleMarkRead(n.id)}
            >
              {/* Icon */}
              <span className="text-lg mt-0.5 flex-shrink-0">{typeIcons[n.type] ?? '📌'}</span>

              {/* Avatar */}
              <Avatar
                src={n.actor?.image ?? null}
                name={n.actor?.name ?? '未知用户'}
                handle={n.actor?.handle ?? ''}
                size={36}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-800 leading-relaxed">
                  <span className="font-semibold">{n.actor?.name ?? '未知用户'}</span>{' '}
                  {typeLabels[n.type] ?? n.type}
                  {n.skill && (
                    <>
                      {' '}
                      <Link
                        to={`/skills/${n.skill.owner.handle}/${encodeURIComponent(n.skill.slug)}`}
                        className="text-blue-600 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {n.skill.name}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-xs text-neutral-400 mt-1.5">{formatRelativeTime(n.createdAt)}</p>
              </div>

              {/* Unread indicator */}
              {!n.read && (
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
