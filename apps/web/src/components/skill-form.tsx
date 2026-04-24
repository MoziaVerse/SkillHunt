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

export interface SkillFormProps {
  mode: 'create' | 'edit';
  // Owners the current user can publish as. First is highlighted as default.
  ownerOptions: string[];
  initial?: Partial<SkillFormValues>;
  onSubmit: (values: SkillFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

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
  const [owner, setOwner] = useState(initial?.owner ?? ownerOptions[0] ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(', '));
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    initial?.visibility ?? 'private',
  );
  const [skillMd, setSkillMd] = useState(initial?.skillMdContent ?? defaultSkillMd(slug));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugDisabled = mode === 'edit';
  const ownerDisabled = mode === 'edit';

  const slugProblem = !slugDisabled && slug && !SLUG_RE.test(slug);
  const tooShort = skillMd.trim().length < 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (slugProblem) return setError('Invalid slug format');
    if (tooShort) return setError('SKILL.md must be at least 20 characters');

    const tags = tagsRaw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      await onSubmit({
        owner,
        slug,
        name: name.trim() || slug,
        description: description.trim(),
        tags,
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
    <form onSubmit={handleSubmit} className="max-w-[760px] py-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
        <div>
          <FieldLabel hint="who publishes this">owner</FieldLabel>
          <select
            disabled={ownerDisabled}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full font-mono text-[13px] border border-neutral-300 px-2 py-1.5 bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            {ownerOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel hint="lowercase, dashes; URL slug">slug</FieldLabel>
          <Input
            value={slug}
            disabled={slugDisabled}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-helpful-skill"
            className={cn('font-mono', slugProblem && 'border-red-400')}
          />
        </div>
      </div>

      <div>
        <FieldLabel hint="display name (defaults to slug)">name</FieldLabel>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Helpful Skill"
        />
      </div>

      <div>
        <FieldLabel hint="one-liner shown in lists; ≤500 chars">description</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this skill does, in one sentence."
          className="w-full text-[14px] border border-neutral-300 px-3 py-2 leading-relaxed"
        />
      </div>

      <div>
        <FieldLabel hint="comma-separated; max 10">tags</FieldLabel>
        <Input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="design, writing, review"
        />
      </div>

      <div>
        <FieldLabel>visibility</FieldLabel>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 font-mono text-[13px] cursor-pointer">
            <input
              type="radio"
              checked={visibility === 'private'}
              onChange={() => setVisibility('private')}
            />
            <span>private — only you can see + install</span>
          </label>
        </div>
        <div className="mt-2">
          <label className="flex items-center gap-2 font-mono text-[13px] cursor-pointer">
            <input
              type="radio"
              checked={visibility === 'public'}
              onChange={() => setVisibility('public')}
            />
            <span>public — visible to all visitors and crawlable via well-known</span>
          </label>
        </div>
      </div>

      <div>
        <FieldLabel hint={`${skillMd.length} chars · 20 min · 200 KB max`}>SKILL.md</FieldLabel>
        <textarea
          value={skillMd}
          onChange={(e) => setSkillMd(e.target.value)}
          rows={20}
          spellCheck={false}
          className={cn(
            'w-full font-mono text-[12.5px] border border-neutral-300 px-3 py-2 leading-relaxed bg-white',
            tooShort && 'border-red-400',
          )}
        />
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
          {submitting ? '…' : (submitLabel ?? (mode === 'create' ? 'Publish' : 'Save'))}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-900 px-3"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function defaultSkillMd(slug: string): string {
  const name = slug || 'my-skill';
  return `---\nname: ${name}\ndescription: short description here\n---\n\n# ${name}\n\n## When to Use\n\nDescribe the trigger / scenario.\n\n## How\n\nSteps the agent should follow.\n`;
}
