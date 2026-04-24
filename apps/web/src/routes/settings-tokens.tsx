import { Input } from '@/components/ui/input';
import { ApiError, type CreatePatResult, type PatRow, apiClient } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

export default function SettingsTokensPage() {
  const [items, setItems] = useState<PatRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreatePatResult | null>(null);

  const refresh = async () => {
    try {
      const r = await apiClient.listPats();
      setItems(r.items);
    } catch (e) {
      setLoadError(e instanceof ApiError ? `${e.status}: sign in required` : (e as Error).message);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is stable in this scope
  useEffect(() => {
    refresh();
  }, []);

  if (loadError) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
          sign in required
        </div>
        <p className="text-neutral-700">You need to sign in via mozia-sso.</p>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
        >
          back home
        </Link>
      </div>
    );
  }

  return (
    <div className="py-10 max-w-3xl">
      <div className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2 flex items-center gap-3">
          <span>settings</span>
          <span className="text-neutral-300">/</span>
          <Link to="/settings/profile" className="text-neutral-500 hover:text-neutral-900">
            profile
          </Link>
          <span className="text-neutral-300">·</span>
          <span className="text-neutral-900">tokens</span>
        </div>
        <h1 className="font-mono text-[28px] tracking-[-0.02em] text-neutral-900 font-medium">
          Personal access tokens
        </h1>
        <p className="mt-2 text-[14px] text-neutral-600 max-w-2xl">
          For mclaw / curl / CI scripts that pull your skills. A token grants full access to your
          account via{' '}
          <code className="font-mono bg-neutral-100 px-1 rounded">Authorization: Bearer ...</code>.
          Treat it like a password.
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => {
            setCreated(null);
            setShowCreate(true);
          }}
          className="font-mono text-[12px] uppercase tracking-[0.1em] bg-neutral-900 text-neutral-100 px-3 py-1.5"
        >
          + Generate new token
        </button>
      </div>

      {!items ? (
        <div className="py-16 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
          loading…
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 border border-dashed border-neutral-300">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-2">
            no tokens yet
          </div>
          <p className="text-[13px]">Create one to let mclaw or scripts read your skills.</p>
        </div>
      ) : (
        <div className="border border-neutral-200">
          {items.map((p, idx) => (
            <PatItem key={p.id} pat={p} first={idx === 0} onRevoked={refresh} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            setCreated(c);
            refresh();
          }}
          created={created}
        />
      )}
    </div>
  );
}

function PatItem({
  pat,
  first,
  onRevoked,
}: {
  pat: PatRow;
  first: boolean;
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handleRevoke = async () => {
    if (!window.confirm(`Revoke "${pat.name}"? Anything using it will break immediately.`)) return;
    setBusy(true);
    try {
      await apiClient.revokePat(pat.id);
      onRevoked();
    } catch (e) {
      window.alert(`Revoke failed: ${e instanceof Error ? e.message : 'unknown'}`);
      setBusy(false);
    }
  };

  return (
    <div className={`px-4 py-3 ${first ? '' : 'border-t border-neutral-100'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-mono text-[14px] text-neutral-900">{pat.name}</div>
          <div className="font-mono text-[11.5px] text-neutral-500 mt-0.5">
            <span>{pat.tokenPrefix}…</span>
            <span className="mx-2 text-neutral-300">·</span>
            <span>created {formatRelative(pat.createdAt)}</span>
            <span className="mx-2 text-neutral-300">·</span>
            <span>
              last used{' '}
              {pat.lastUsedAt ? (
                formatRelative(pat.lastUsedAt)
              ) : (
                <em className="text-neutral-400">never</em>
              )}
            </span>
            {pat.expiresAt && (
              <>
                <span className="mx-2 text-neutral-300">·</span>
                <span>expires {formatRelative(pat.expiresAt)}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 border border-red-300 text-red-700 hover:border-red-700 transition disabled:opacity-50"
        >
          {busy ? '…' : 'revoke'}
        </button>
      </div>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreated,
  created,
}: {
  onClose: () => void;
  onCreated: (c: CreatePatResult) => void;
  created: CreatePatResult | null;
}) {
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setBusy(true);
    try {
      const r = await apiClient.createPat({
        name: name.trim(),
        expiresInDays: expiresInDays === '' ? undefined : Number(expiresInDays),
      });
      onCreated(r);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.status}: ${err.body || 'create failed'}`
          : err instanceof Error
            ? err.message
            : 'create failed',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 px-4">
      <div className="bg-white border border-neutral-200 max-w-lg w-full p-6">
        {!created ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="font-mono text-[16px] text-neutral-900 font-medium">
              Generate new token
            </h2>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
                name
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mclaw on macbook"
                autoFocus
              />
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
                expires in (days){' '}
                <span className="ml-1 normal-case tracking-normal text-neutral-400">
                  blank = never
                </span>
              </div>
              <Input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => {
                  const v = e.target.value;
                  setExpiresInDays(v === '' ? '' : Number(v));
                }}
                placeholder="90"
              />
            </div>
            {error && (
              <div className="border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[12px] uppercase tracking-[0.1em] px-3 py-1.5 text-neutral-500 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="font-mono text-[12px] uppercase tracking-[0.1em] bg-neutral-900 text-neutral-100 px-3 py-1.5 disabled:opacity-50"
              >
                {busy ? '…' : 'Create'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <h2 className="font-mono text-[16px] text-neutral-900 font-medium">Token created</h2>
            <p className="text-[13px] text-neutral-700">Copy it now — you won't see it again.</p>
            <div className="border border-amber-300 bg-amber-50 px-3 py-2 font-mono text-[12px] text-amber-900">
              ⚠ Treat this token like a password. Do not commit to git.
            </div>
            <div className="border border-neutral-200 bg-neutral-50 px-3 py-3 font-mono text-[12px] break-all">
              {created.token}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCopy}
                className="font-mono text-[12px] uppercase tracking-[0.1em] bg-neutral-900 text-neutral-100 px-3 py-1.5"
              >
                {copied ? '✓ copied' : 'Copy to clipboard'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[12px] uppercase tracking-[0.1em] px-3 py-1.5 text-neutral-500 hover:text-neutral-900"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
