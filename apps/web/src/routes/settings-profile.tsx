import { Input } from '@/components/ui/input';
import { ApiError, type MeResponse, apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export default function SettingsProfilePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient
      .getMe()
      .then((m) => {
        setMe(m);
        setName(m.name);
        setHandle(m.handle);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'failed to load');
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    if (!me) return;

    if (!name.trim()) {
      setSaveError('显示名称不能为空');
      return;
    }
    if (!HANDLE_RE.test(handle)) {
      setSaveError('handle 只能包含小写字母、数字和连字符，长度 1–32');
      return;
    }

    const patch: { name?: string; handle?: string } = {};
    if (name.trim() !== me.name) patch.name = name.trim();
    if (handle !== me.handle) patch.handle = handle;
    if (Object.keys(patch).length === 0) {
      setSaveError('没有需要保存的更改');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiClient.updateProfile(patch);
      setMe(updated);
      setName(updated.name);
      setHandle(updated.handle);
      setSaved(true);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.body || 'update failed'}`
          : err instanceof Error
            ? err.message
            : 'update failed';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
          需要登录
        </div>
        <p className="text-neutral-700">请先通过 mozia-sso 登录。</p>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!me)
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        loading…
      </div>
    );

  const handleChanged = handle !== me.handle;

  return (
    <div className="py-10 max-w-2xl">
      <div className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2 flex items-center gap-3">
          <span>设置</span>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900">个人资料</span>
        </div>
        <h1 className="font-mono text-[28px] tracking-[-0.02em] text-neutral-900 font-medium">
          个人资料
        </h1>
      </div>

      <dl className="space-y-3 mb-10 font-mono text-[13px]">
        <Row label="邮箱">{me.email}</Row>
        <Row label="用户 ID">{me.id}</Row>
        {me.canPublishAs.length > 0 && <Row label="可发布为">{me.canPublishAs.join(', ')}</Row>}
      </dl>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
            显示名称
            <span className="ml-2 normal-case tracking-normal text-neutral-400">
              （任意内容——中文、空格、大小写均可）
            </span>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" />
        </div>

        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
            handle{' '}
            <span className="ml-2 normal-case tracking-normal text-neutral-400">
              (URL: <code>/u/{handle || '...'}</code>)
            </span>
          </div>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="your-handle"
            className="font-mono"
          />
          {handleChanged && (
            <p className="mt-1 font-mono text-[11px] text-amber-700">
              ⚠ 修改 handle 会导致所有指向你的 /u/ 和 /skills/ URL 失效。
            </p>
          )}
        </div>

        {saveError && (
          <div className="border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">
            {saveError}
          </div>
        )}
        {saved && !saveError && (
          <div className="font-mono text-[12px] text-emerald-700">已保存。</div>
        )}
        <button
          type="submit"
          disabled={saving || (name === me.name && handle === me.handle)}
          className="font-mono text-[12px] uppercase tracking-[0.1em] bg-neutral-900 text-neutral-100 px-4 py-2 disabled:opacity-50"
        >
          {saving ? '…' : '保存'}
        </button>
      </form>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 w-32 shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-neutral-800 font-mono break-all">{children}</span>
    </div>
  );
}
