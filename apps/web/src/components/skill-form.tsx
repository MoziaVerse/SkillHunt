import { CoverImageUpload } from '@/components/cover-image-upload';
import { EmojiPicker } from '@/components/emoji-picker';
import { TwemojiIcon } from '@/components/twemoji-icon';
import { Input } from '@/components/ui/input';
import { ApiError, apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';

const VIDEO_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

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
  icon: string | null;
  coverImage: string | null;
  demoVideoUrl: string | null;
  releaseTitle: string;
  releaseChangelog: string;
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
    icon: string | null;
    coverImage: string | null;
    demoVideoUrl: string | null;
    skillMdContent: string | null;
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

/** Parse simple YAML frontmatter tags from SKILL.md content. */
function parseFrontmatterTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[,>\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function splitSkillMdDescription(md: string): string {
  const lines = md.split('\n');
  if (lines[0] !== '---') return '';
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line === '---') break;
    if (line.startsWith('description:')) {
      return line
        .slice('description:'.length)
        .trim()
        .replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function inferVideoContentType(file: File): string | null {
  if (file.type.toLowerCase().startsWith('video/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'ogg' || ext === 'ogv') return 'video/ogg';
  return null;
}

function isDirectVideoUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isManagedOssVideoUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.pathname.includes('/skillhunt-videos/skillhunt/videos/');
  } catch {
    return false;
  }
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
  // Raw SKILL.md content — never modified by form fields
  const rawSkillMd = initial?.skillMdContent ?? defaultSkillMd(initial?.name ?? '');

  const initialTags = initial?.tags ?? parseFrontmatterTagsFromMd(rawSkillMd);
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
    initial?.tagline ?? splitSkillMdDescription(rawSkillMd) ?? '',
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
  const [icon, setIcon] = useState<string | null>(
    initial?.icon ?? (mode === 'create' ? DEFAULT_SKILL_ICON : null),
  );
  const [coverImage, setCoverImage] = useState<string | null>(initial?.coverImage ?? null);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(initial?.demoVideoUrl ?? null);
  const [releaseTitle, setReleaseTitle] = useState(
    initial?.releaseTitle ?? (mode === 'create' ? '首次发布' : '保存更新'),
  );
  const [releaseChangelog, setReleaseChangelog] = useState(initial?.releaseChangelog ?? '');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadLabel, setVideoUploadLabel] = useState<string | null>(null);
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

  const slugProblem = !slug;
  const tooShort = rawSkillMd.trim().length < 20;
  const isManagedUploadedVideo = isManagedOssVideoUrl(demoVideoUrl);
  const effectiveVideoPreviewUrl =
    videoPreviewUrl ??
    (demoVideoUrl && mode === 'edit'
      ? apiClient.getSkillDemoVideoUrl(owner, slug)
      : isDirectVideoUrl(demoVideoUrl)
        ? demoVideoUrl
        : null);

  // Mutual exclusion: selecting one clears the other
  const handleIconChange = (newIcon: string | null) => {
    setIcon(newIcon);
    if (newIcon) setCoverImage(null);
  };
  const handleCoverImageChange = (newImage: string | null) => {
    setCoverImage(newImage);
    if (newImage) setIcon(null);
  };

  useEffect(() => {
    if (!onPreviewChange) return;
    onPreviewChange({
      owner,
      name: name.trim() || slug || '未命名 Skill',
      tagline: tagline.trim(),
      tags: allTags,
      icon,
      coverImage,
      demoVideoUrl,
      skillMdContent: rawSkillMd,
    });
  }, [
    allTags,
    coverImage,
    demoVideoUrl,
    icon,
    name,
    onPreviewChange,
    owner,
    rawSkillMd,
    slug,
    tagline,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (slugProblem) return setError('slug 格式无效');
    if (tooShort) return setError('SKILL.md 至少需要 20 个字符');
    if (!tagline.trim()) return setError('请填写一句话介绍');
    if (mode !== 'create' && !releaseTitle.trim()) return setError('请填写版本标题');
    if (mode !== 'create' && !releaseChangelog.trim()) return setError('请填写本次版本说明');
    if (videoUploading) return setError('视频还在上传中，请稍等片刻');

    setSubmitting(true);
    try {
      await onSubmit({
        owner,
        slug,
        name: name.trim() || slug,
        tagline: tagline.trim(),
        tags: allTags,
        visibility,
        skillMdContent: rawSkillMd,
        icon,
        coverImage,
        demoVideoUrl,
        releaseTitle: mode === 'create' ? '首次发布' : releaseTitle.trim(),
        releaseChangelog: mode === 'create' ? '' : releaseChangelog.trim(),
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

  const handleVideoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setError(null);
    const contentType = inferVideoContentType(file);
    if (!contentType) {
      setError('请选择 MP4、WebM、MOV 或 OGG 视频文件');
      return;
    }
    if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
      setError('演示视频不能超过 500MB');
      return;
    }

    setVideoUploading(true);
    setVideoUploadLabel(`${file.name} · 上传中`);
    try {
      const ticket = await apiClient.createVideoUpload({
        fileName: file.name,
        contentType,
        size: file.size,
      });
      const uploadResponse = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`视频上传失败：${uploadResponse.status}`);
      }
      const uploaded = await apiClient.completeVideoUpload(ticket.objectKey);
      setDemoVideoUrl(uploaded.videoUrl);
      setVideoPreviewUrl(uploaded.playbackUrl);
      setVideoUploadLabel(`${file.name} · ${formatFileSize(uploaded.size)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.body || '视频上传失败'}`
          : err instanceof Error
            ? err.message
            : '视频上传失败';
      setError(msg);
      setVideoUploadLabel(null);
    } finally {
      setVideoUploading(false);
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

        {/* Icon / Cover — mutually exclusive */}
        <div>
          <FieldLabel hint="二选一，用于列表页和详情页展示">图标</FieldLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[12px] font-medium text-neutral-600 mb-2">Emoji 图标</div>
              <EmojiPicker value={icon} onChange={handleIconChange} disabled={!!coverImage} />
              {coverImage && (
                <div className="mt-2 text-[11px] text-neutral-400">
                  已选择封面图，Emoji 图标不可同时使用
                </div>
              )}
            </div>
            <div>
              <div className="text-[12px] font-medium text-neutral-600 mb-2">封面图片</div>
              <CoverImageUpload
                value={coverImage}
                onChange={handleCoverImageChange}
                disabled={!!icon}
              />
              {icon && (
                <div className="mt-2 text-[11px] text-neutral-400">
                  已选择 Emoji 图标，封面图不可同时使用
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Demo video upload */}
        <div>
          <FieldLabel hint="可选，上传到 SkillHunt OSS，单个视频不超过 500MB">演示视频</FieldLabel>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-neutral-800">
                  {demoVideoUrl
                    ? videoUploadLabel || '已添加演示视频'
                    : '上传一个演示视频，帮助别人快速判断实际效果'}
                </div>
                <div className="mt-1 text-[12px] text-neutral-500">
                  支持 MP4、WebM、MOV、OGG，文件大小上限 500MB。
                </div>
                {isManagedUploadedVideo && (
                  <div className="mt-2 text-[12px] text-emerald-700">
                    视频已保存到 SkillHunt OSS，可在下方直接预览。
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[12px] font-medium text-neutral-700 transition hover:border-neutral-500',
                    videoUploading && 'pointer-events-none opacity-50',
                  )}
                >
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/ogg,video/*"
                    className="sr-only"
                    disabled={videoUploading}
                    onChange={handleVideoFileChange}
                  />
                  {videoUploading ? '上传中…' : demoVideoUrl ? '替换视频' : '选择视频'}
                </label>
                {demoVideoUrl && (
                  <button
                    type="button"
                    disabled={videoUploading}
                    onClick={() => {
                      setDemoVideoUrl(null);
                      setVideoPreviewUrl(null);
                      setVideoUploadLabel(null);
                    }}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[12px] text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                  >
                    移除
                  </button>
                )}
              </div>
            </div>
            {effectiveVideoPreviewUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950">
                <video
                  key={effectiveVideoPreviewUrl}
                  src={effectiveVideoPreviewUrl}
                  controls
                  preload="metadata"
                  className="aspect-video w-full"
                >
                  <track kind="captions" label="暂无字幕" src="data:text/vtt,WEBVTT%0A" />
                </video>
              </div>
            )}
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

      {mode !== 'create' && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-1">
              版本发布
            </div>
            <h2 className="text-[22px] font-semibold text-[#0f172a]">说明这次更新</h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              每次发布都会生成一个版本记录。请写清楚这个版本新增、修复或调整了什么，方便使用者选择合适版本。
            </p>
          </div>

          <div>
            <FieldLabel hint="会显示在版本列表中">版本标题</FieldLabel>
            <Input
              value={releaseTitle}
              onChange={(e) => setReleaseTitle(e.target.value.slice(0, 120))}
              placeholder="优化安装说明"
            />
          </div>

          <div>
            <FieldLabel hint="必填，告诉使用者这个版本有什么变化">版本说明</FieldLabel>
            <textarea
              value={releaseChangelog}
              onChange={(e) => setReleaseChangelog(e.target.value.slice(0, 5000))}
              rows={5}
              placeholder="例如：补充了更多适用场景，修复了安装步骤描述不清的问题。"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-500"
            />
            <div className="mt-1 text-[12px] text-neutral-400">
              {releaseChangelog.trim().length}/5000 字。版本说明会展示在 Skill 详情页的版本 Tab。
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {/* Preview card */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            发布预览
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            {coverImage ? (
              <img src={coverImage} alt="封面" className="w-full h-32 object-cover" />
            ) : null}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-emerald-700">
                  {!coverImage && icon ? (
                    <TwemojiIcon emoji={icon} className="text-[18px]" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">
                      {(name || 'N').charAt(0).toUpperCase()}
                    </span>
                  )}
                  新发布
                </span>
                <span className="text-[11px] text-neutral-400">@{owner}</span>
              </div>
              <div className="text-[20px] font-semibold text-neutral-900 leading-tight">
                {name.trim() || '未命名 Skill'}
              </div>
              <p className="mt-2 text-[14px] text-neutral-600 leading-relaxed">
                {tagline.trim() || '一句话介绍会显示在这里'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(allTags.length > 0 ? allTags : ['待选择标签']).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-neutral-200 px-4 py-4 text-[13px] text-neutral-500">
            这张卡片会帮助你快速判断：社区在列表页第一眼看到的内容是否足够吸引人。
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={submitting || videoUploading}
          className="font-mono text-[12px] uppercase tracking-[0.1em] bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
        >
          {submitting || videoUploading
            ? '…'
            : (submitLabel ?? (mode === 'create' ? '立即发布' : '保存'))}
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

function parseFrontmatterTagsFromMd(md: string): string[] {
  const lines = md.split('\n');
  if (lines[0] !== '---') return [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line === '---') break;
    if (line.startsWith('tags:')) {
      return parseFrontmatterTags(line.slice('tags:'.length).trim());
    }
  }
  return [];
}
