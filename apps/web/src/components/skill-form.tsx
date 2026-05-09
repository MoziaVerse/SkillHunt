import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';

const OFFICIAL_TAGS = [
  '编程开发',
  '内容写作',
  '数据分析',
  '自动化',
  '搜索检索',
  '工作流',
  '办公效率',
  '研究分析',
  '文档处理',
  '报告生成',
  '电商',
  '客服支持',
] as const;

export interface SkillFormValues {
  owner: string;
  slug: string;
  name: string;
  tagline: string;
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
  onPreviewChange?: (preview: {
    owner: string;
    name: string;
    tagline: string;
    tags: string[];
  }) => void;
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
function parseFrontmatterTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[,>\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function splitSkillMd(md: string): { frontmatter: Record<string, string>; body: string } {
  const lines = md.split('\n');
  if (lines[0] !== '---') return { frontmatter: {}, body: md };

  const fm: Record<string, string> = {};
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') {
      endIndex = i;
      break;
    }
    if (!line || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) fm[key] = val;
  }

  if (endIndex === -1) return { frontmatter: {}, body: md };
  return {
    frontmatter: fm,
    body: lines
      .slice(endIndex + 1)
      .join('\n')
      .replace(/^\n+/, ''),
  };
}

function buildSkillMd(input: {
  name: string;
  tagline: string;
  tags: string[];
  body: string;
  frontmatter: Record<string, string>;
}) {
  const nextFrontmatter = {
    ...input.frontmatter,
    name: input.name || 'my-skill',
    description: input.tagline || '在这里填写一句话介绍',
    tags: `[${input.tags.join(', ')}]`,
  };
  const frontmatterLines = Object.entries(nextFrontmatter).map(
    ([key, value]) => `${key}: ${value}`,
  );
  return `---\n${frontmatterLines.join('\n')}\n---\n\n${input.body.trim()}\n`;
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
  onPreviewChange,
}: SkillFormProps) {
  const initialSkillMd = initial?.skillMdContent ?? defaultSkillMd(initial?.name ?? '');
  const parsedSkillMd = splitSkillMd(initialSkillMd);
  const initialTags = initial?.tags ?? parseFrontmatterTags(parsedSkillMd.frontmatter.tags);
  const initialOfficialTags = initialTags.filter((tag) =>
    OFFICIAL_TAGS.includes(tag as (typeof OFFICIAL_TAGS)[number]),
  );
  const initialCustomTags = initialTags.filter(
    (tag) => !OFFICIAL_TAGS.includes(tag as (typeof OFFICIAL_TAGS)[number]),
  );

  const singleOwner = ownerOptions.length <= 1;
  const [owner, setOwner] = useState(initial?.owner ?? ownerOptions[0]?.handle ?? '');
  const [name, setName] = useState(initial?.name ?? initial?.slug ?? '');
  const [tagline, setTagline] = useState(
    initial?.tagline ?? parsedSkillMd.frontmatter.description ?? '',
  );
  // Slug is auto-derived from name in create mode; fixed in edit mode.
  const slug =
    mode === 'edit'
      ? (initial?.slug ?? '')
      : initial?.slug && name === initial.name
        ? initial.slug
        : nameToSlug(name);
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    initial?.visibility ?? 'private',
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialOfficialTags);
  const [customTagInput, setCustomTagInput] = useState(initialCustomTags.join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerDisabled = mode === 'edit';
  const customTags = useMemo(
    () =>
      customTagInput
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 2),
    [customTagInput],
  );
  const allTags = useMemo(
    () => [...selectedTags, ...customTags].slice(0, 5),
    [customTags, selectedTags],
  );
  const skillMd = useMemo(
    () =>
      buildSkillMd({
        name,
        tagline,
        tags: allTags,
        body:
          parsedSkillMd.body ||
          `# ${name || 'my-skill'}\n\n## 何时使用\n\n描述触发条件或适用场景。\n`,
        frontmatter: parsedSkillMd.frontmatter,
      }),
    [allTags, name, parsedSkillMd.body, parsedSkillMd.frontmatter, tagline],
  );

  const slugProblem = !slug;
  const tooShort = skillMd.trim().length < 20;

  useEffect(() => {
    if (!onPreviewChange) return;
    onPreviewChange({
      owner,
      name: name.trim() || slug || '未命名 Skill',
      tagline: tagline.trim(),
      tags: allTags,
    });
  }, [allTags, name, onPreviewChange, owner, slug, tagline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (slugProblem) return setError('slug 格式无效');
    if (tooShort) return setError('SKILL.md 至少需要 20 个字符');
    if (!tagline.trim()) return setError('请填写一句话介绍');

    setSubmitting(true);
    try {
      await onSubmit({
        owner,
        slug,
        name: name.trim() || slug,
        tagline: tagline.trim(),
        tags: allTags,
        visibility,
        skillMdContent: skillMd,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.body || '请求失败'}`
          : err instanceof Error
            ? err.message
            : '提交失败';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Owner (hidden when single) */}
      {!singleOwner && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <FieldLabel hint="选择本次发布使用的身份">发布者</FieldLabel>
          <select
            disabled={ownerDisabled}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full max-w-[200px] font-mono text-[13px] border border-neutral-300 rounded-lg px-2 py-1.5 bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
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

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-1">
            发布信息
          </div>
          <h2 className="text-[22px] font-semibold text-[#0f172a]">向社区介绍你的新能力</h2>
          <p className="mt-2 text-[14px] text-neutral-500">
            先说清楚它叫什么、解决什么问题，以及最适合什么场景。
          </p>
        </div>

        <div>
          <FieldLabel hint="Skill 的显示名称，会自动生成 URL 标识">名称</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.replace(NAME_ALLOWED_RE, ''))}
            placeholder="会议纪要整理助手"
            disabled={mode === 'edit'}
          />
          {slug && (
            <div className="mt-1 font-mono text-[12px] text-neutral-400">
              /u/{owner}/<span className="text-neutral-700">{slug}</span>
            </div>
          )}
        </div>

        <div>
          <FieldLabel hint="会作为列表页最醒目的文案">一句话介绍</FieldLabel>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 120))}
            placeholder="让 Agent 自动整理会议纪要"
          />
          <div className="mt-1 text-[12px] text-neutral-400">
            用一句话说清楚它的价值，建议控制在 40 字以内。
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
        <div>
          <FieldLabel hint="优先使用官方标签，再补充少量自定义">标签</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {OFFICIAL_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelectedTags((current) =>
                      active
                        ? current.filter((item) => item !== tag)
                        : current.length >= 4
                          ? current
                          : [...current, tag],
                    )
                  }
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[13px] transition',
                    active
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400',
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <FieldLabel hint="最多补充 2 个自定义标签">自定义标签</FieldLabel>
            <Input
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              placeholder="例如：会议纪要，销售复盘"
            />
            <div className="mt-1 text-[12px] text-neutral-400">
              使用中文逗号或英文逗号分隔。当前将发布 {allTags.length} 个标签。
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <FieldLabel>可见性</FieldLabel>
          <div className="flex items-center gap-3 font-mono text-[12.5px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="accent-emerald-500"
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
                className="accent-emerald-500"
              />
              <span className={visibility === 'public' ? 'text-neutral-900' : 'text-neutral-400'}>
                公开
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <FieldLabel hint={`${skillMd.length} 字符`}>SKILL.md 预览</FieldLabel>
        {skillMd ? (
          <pre className="w-full font-mono text-[12.5px] border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-3 leading-relaxed overflow-auto max-h-[480px] whitespace-pre-wrap break-words">
            {skillMd}
          </pre>
        ) : (
          <div className="font-mono text-[12px] text-neutral-400 py-6 text-center border border-dashed border-neutral-300 rounded-xl">
            请先上传 SKILL.md 文件或文件夹
          </div>
        )}
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={submitting}
          className="font-mono text-[12px] uppercase tracking-[0.1em] bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
        >
          {submitting ? '…' : (submitLabel ?? (mode === 'create' ? '立即发布' : '保存'))}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[12px] uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-900 px-3 py-2.5 border border-neutral-300 hover:border-neutral-900 rounded-lg transition"
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
  return `---\nname: ${displayName}\ndescription: 在这里填写一句话介绍\ntags: []\n---\n\n# ${displayName}\n\n## 何时使用\n\n描述触发条件或适用场景。\n\n## 如何使用\n\n写下 agent 应该遵循的步骤。\n`;
}
