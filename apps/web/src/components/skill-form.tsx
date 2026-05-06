import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface SkillFormValues {
  owner: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private';
  skillMdContent: string;
}

export interface OwnerOption {
  /** URL handle, sent as `owner` in API */
  handle: string;
  /** Optional display name shown alongside */
  displayName?: string;
}

export interface SkillFormProps {
  mode: 'create' | 'edit';
  // Owners the current user can publish as. First is highlighted as default.
  ownerOptions: OwnerOption[];
  initial?: Partial<SkillFormValues>;
  onSubmit: (values: SkillFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

import { pinyin } from 'pinyin-pro';

/** Allowed in name: Chinese, letters, digits, spaces, hyphens. Everything else is stripped. */
const NAME_ALLOWED_RE = /[^\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9\s-]/g;

/** Derive a slug from a display name: Chinese → pinyin, then keep only a-z0-9 hyphenated. */
function nameToSlug(name: string): string {
  const py = pinyin(name, { toneType: 'none', type: 'string' });
  return py
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/** Parse simple YAML frontmatter from SKILL.md content. */
function parseFrontmatter(md: string): Record<string, string> {
  const lines = md.split('\n');
  if (lines[0] !== '---') return {};
  const out: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') break;
    if (!line || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) out[key] = val;
  }
  return out;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
      {children}
      {hint ? (
        <span className="ml-2 normal-case tracking-normal text-neutral-400">{hint}</span>
      ) : null}
    </div>
  );
}

export function SkillForm({
  mode,
  ownerOptions,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: SkillFormProps) {
  const singleOwner = ownerOptions.length <= 1;
  const [owner, setOwner] = useState(initial?.owner ?? ownerOptions[0]?.handle ?? '');
  const [name, setName] = useState(initial?.name ?? initial?.slug ?? '');
  // Slug is auto-derived from name in create mode; fixed in edit mode.
  const slug =
    mode === 'edit'
      ? (initial?.slug ?? '')
      : (initial?.slug && name === initial.name ? initial.slug : nameToSlug(name));
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    initial?.visibility ?? 'private',
  );
  const [skillMd, setSkillMd] = useState(initial?.skillMdContent ?? defaultSkillMd(name));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerDisabled = mode === 'edit';

  const slugProblem = !slug;
  const tooShort = skillMd.trim().length < 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (slugProblem) return setError('slug 格式无效');
    if (tooShort) return setError('SKILL.md 至少需要 20 个字符');

    // Derive description & tags from SKILL.md frontmatter.
    const fm = parseFrontmatter(skillMd);
    const fmTags = (fm.tags ?? '')
      .split(/[,>\s]+/)
      .map((t) => t.trim().replace(/^\[|]$/g, ''))
      .filter(Boolean);

    setSubmitting(true);
    try {
      await onSubmit({
        owner,
        slug,
        name: name.trim() || slug,
        description: fm.description ?? '',
        tags: fmTags,
        visibility,
        skillMdContent: skillMd,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.body || 'request failed'}`
          : err instanceof Error
            ? err.message
            : 'submit failed';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-[760px] py-8 space-y-5">
      {/* Owner (hidden when single) */}
      {!singleOwner && (
        <div>
          <FieldLabel hint="发布者">owner</FieldLabel>
          <select
            disabled={ownerDisabled}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full max-w-[200px] font-mono text-[13px] border border-neutral-300 px-2 py-1.5 bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            {ownerOptions.map((o) => (
              <option key={o.handle} value={o.handle}>
                {o.handle}
                {o.displayName && o.displayName !== o.handle ? ` (${o.displayName})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Name → auto slug */}
      <div>
        <FieldLabel hint="skill 的显示名称，会自动生成 URL slug">名称</FieldLabel>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.replace(NAME_ALLOWED_RE, ''))}
          placeholder="My Helpful Skill"
          disabled={mode === 'edit'}
        />
        {slug && (
          <div className="mt-1 font-mono text-[12px] text-neutral-400">
            /u/{owner}/<span className="text-neutral-700">{slug}</span>
          </div>
        )}
      </div>

      {/* Visibility — inline toggle */}
      <div className="flex items-center gap-4">
        <FieldLabel>可见性</FieldLabel>
        <div className="flex items-center gap-3 font-mono text-[12.5px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={visibility === 'private'}
              onChange={() => setVisibility('private')}
              className="accent-neutral-900"
            />
            <span className={visibility === 'private' ? 'text-neutral-900' : 'text-neutral-400'}>
              私有
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={visibility === 'public'}
              onChange={() => setVisibility('public')}
              className="accent-neutral-900"
            />
            <span className={visibility === 'public' ? 'text-neutral-900' : 'text-neutral-400'}>
              公开
            </span>
          </label>
        </div>
      </div>

      {/* SKILL.md — preview only */}
      <div>
        <FieldLabel hint={`${skillMd.length} chars`}>SKILL.md</FieldLabel>
        {skillMd ? (
          <pre className="w-full font-mono text-[12.5px] border border-neutral-200 bg-neutral-50 px-3 py-2 leading-relaxed overflow-auto max-h-[480px] whitespace-pre-wrap break-words">
            {skillMd}
          </pre>
        ) : (
          <div className="font-mono text-[12px] text-neutral-400 py-6 text-center border border-dashed border-neutral-300">
            请先上传 SKILL.md 文件或文件夹
          </div>
        )}
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={submitting}
          className="font-mono text-[12px] uppercase tracking-[0.1em] bg-neutral-900 text-neutral-100 px-4 py-2 disabled:opacity-50"
        >
          {submitting ? '…' : (submitLabel ?? (mode === 'create' ? '发布' : '保存'))}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-900 px-3"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}

function defaultSkillMd(name: string): string {
  const displayName = name || 'my-skill';
  return `---\nname: ${displayName}\ndescription: short description here\ntags: []\n---\n\n# ${displayName}\n\n## When to Use\n\nDescribe the trigger / scenario.\n\n## How\n\nSteps the agent should follow.\n`;
}
