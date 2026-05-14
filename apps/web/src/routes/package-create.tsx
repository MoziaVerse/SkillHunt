import { EmojiPicker } from '@/components/emoji-picker';
import { Logo } from '@/components/logo';
import { type CreateSkillPackageInput, apiClient } from '@/lib/api-client';
import type { MeResponse } from '@/lib/api-client';
import { DEFAULT_SKILL_ICON, DEFAULT_SKILL_PACKAGE_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type { OwnedSkillListItem, SkillListItem } from '@/types/api';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MAX_PACKAGE_TAGS,
  PACKAGE_TAG_OPTIONS,
  addPackageTag,
  hasPackageTag,
  isBookmarkedPackageSkill,
  isOwnPackageSkill,
  isPriorityPackageSkill,
  matchesPackageSkillQuery,
  mergeOwnedSkillCandidates,
  normalizePackageTag,
  slugifyPackageName,
  sortPackageSkillCandidates,
  togglePackageTag,
} from './package-create-helpers';

type Visibility = CreateSkillPackageInput['visibility'];

interface OwnerOption {
  handle: string;
  displayName?: string;
}

const emptySkillListResponse = () => ({ items: [] as SkillListItem[], total: 0 });

function isOwnedSkill(item: SkillListItem): item is OwnedSkillListItem {
  return item.type === 'owned';
}

function PageBreadcrumb() {
  return (
    <nav className="border-b border-neutral-100 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-[1200px] items-center gap-1.5 text-[13px]">
        <Link to="/" className="text-neutral-500 transition hover:text-neutral-900">
          <Logo size={16} className="text-neutral-900" />
        </Link>
        <span className="text-neutral-300">/</span>
        <Link to="/publish" className="text-neutral-500 transition hover:text-neutral-900">
          发布
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">Skills 包</span>
      </div>
    </nav>
  );
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500">
      {children}
      {hint ? (
        <span className="ml-2 normal-case tracking-normal text-neutral-400">{hint}</span>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
        {eyebrow}
      </div>
      <h2 className="text-[22px] font-semibold text-[#0f172a]">{title}</h2>
      <p className="mt-2 text-[14px] leading-6 text-neutral-500">{description}</p>
    </div>
  );
}

function SkillGroup({
  title,
  description,
  skills,
  children,
}: {
  title: string;
  description?: string;
  skills: OwnedSkillListItem[];
  children: (skill: OwnedSkillListItem) => ReactNode;
}) {
  if (skills.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-neutral-900">{title}</h3>
          {description ? <p className="mt-1 text-[12px] text-neutral-500">{description}</p> : null}
        </div>
        <span className="font-mono text-[11px] text-neutral-400">{skills.length} 个</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{skills.map(children)}</div>
    </div>
  );
}

function SkillOptionCard({
  skill,
  selected,
  bookmarked,
  own,
  onToggle,
}: {
  skill: OwnedSkillListItem;
  selected: boolean;
  bookmarked: boolean;
  own: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'skill-card relative flex min-h-[220px] cursor-pointer flex-col p-4',
        selected && 'skill-card-selected',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="absolute top-4 right-4 accent-emerald-600"
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-[24px]">
        {skill.icon || DEFAULT_SKILL_ICON}
      </div>
      <div className="mt-4 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 pr-5">
          <span className="line-clamp-1 text-[15px] font-semibold text-[#0f172a]">
            {skill.name}
          </span>
          {selected ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              已选择
            </span>
          ) : null}
          {bookmarked ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              已收藏
            </span>
          ) : null}
          {own ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              我发布
            </span>
          ) : null}
          {skill.visibility === 'private' ? (
            <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              私有
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#64748b]">
          {skill.description}
        </p>
      </div>
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
          <span>
            作者 <span className="font-medium text-neutral-700">@{skill.owner.handle}</span>
          </span>
          <span>▲ {skill.upvoteCount}</span>
          <span>🔖 {skill.bookmarkCount}</span>
          {skill.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px]">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </label>
  );
}

export default function PackageCreate() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [skills, setSkills] = useState<OwnedSkillListItem[]>([]);
  const [bookmarkedSkillIds, setBookmarkedSkillIds] = useState<Set<string>>(() => new Set());
  const [ownSkillIds, setOwnSkillIds] = useState<Set<string>>(() => new Set());
  const [skillQuery, setSkillQuery] = useState('');
  const [fetchingSkills, setFetchingSkills] = useState(false);
  const [skillSearchError, setSkillSearchError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTagError, setCustomTagError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSkillPackageInput>({
    owner: '',
    slug: '',
    name: '',
    description: '',
    tags: [],
    visibility: 'public',
    icon: DEFAULT_SKILL_PACKAGE_ICON,
    coverImage: null,
    skillIds: [],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.getMe().catch(() => null),
      apiClient.listSkills({ type: 'owned', sort: 'hottest', limit: 100 }),
      apiClient.getMyBookmarks().catch(emptySkillListResponse),
      apiClient.getMySkills().catch(emptySkillListResponse),
    ])
      .then(([user, skillRes, bookmarkRes, mySkillRes]) => {
        if (cancelled) return;
        const publicOwnedSkills = skillRes.items.filter(isOwnedSkill);
        const bookmarkedOwnedSkills = bookmarkRes.items.filter(isOwnedSkill);
        const myOwnedSkills = mySkillRes.items.filter(isOwnedSkill);

        setMe(user);
        setForm((prev) => ({
          ...prev,
          owner: user?.handle ?? prev.owner,
        }));
        setBookmarkedSkillIds(new Set(bookmarkedOwnedSkills.map((skill) => skill.id)));
        setOwnSkillIds(new Set(myOwnedSkills.map((skill) => skill.id)));
        setSkills(
          mergeOwnedSkillCandidates(bookmarkedOwnedSkills, myOwnedSkills, publicOwnedSkills),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载可选 Skill 失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = skillQuery.trim();
    if (!query || loading) {
      setFetchingSkills(false);
      setSkillSearchError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setFetchingSkills(true);
      apiClient
        .listSkills({ type: 'owned', q: query, sort: 'hottest', limit: 80 })
        .then((res) => {
          if (cancelled) return;
          setSkills((prev) => mergeOwnedSkillCandidates(prev, res.items.filter(isOwnedSkill)));
          setSkillSearchError(null);
        })
        .catch((err) => {
          if (!cancelled) {
            setSkillSearchError(err instanceof Error ? err.message : '搜索 Skill 失败');
          }
        })
        .finally(() => {
          if (!cancelled) setFetchingSkills(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, skillQuery]);

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    if (!me) return [];
    return [
      { handle: me.handle, displayName: me.name },
      ...me.canPublishAs.map((handle) => ({ handle })),
    ];
  }, [me]);

  const ownerHandles = useMemo(
    () => new Set(ownerOptions.map((owner) => owner.handle)),
    [ownerOptions],
  );

  const skillById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const selectedSkillIds = useMemo(() => new Set(form.skillIds), [form.skillIds]);

  const selectedSkills = useMemo(
    () =>
      form.skillIds
        .map((skillId) => skillById.get(skillId))
        .filter((skill): skill is OwnedSkillListItem => Boolean(skill)),
    [form.skillIds, skillById],
  );

  const priorityContext = useMemo(
    () => ({
      selectedSkillIds,
      bookmarkedSkillIds,
      ownSkillIds,
      ownerHandles,
    }),
    [bookmarkedSkillIds, ownSkillIds, ownerHandles, selectedSkillIds],
  );

  const selectableSkills = useMemo(() => {
    const available =
      form.visibility === 'public'
        ? skills.filter((skill) => skill.visibility === 'public')
        : skills;
    return sortPackageSkillCandidates(
      available.filter((skill) => matchesPackageSkillQuery(skill, skillQuery)),
      priorityContext,
    );
  }, [form.visibility, priorityContext, skillQuery, skills]);

  const prioritySkills = selectableSkills.filter((skill) =>
    isPriorityPackageSkill(skill, priorityContext),
  );
  const otherSkills = selectableSkills.filter(
    (skill) => !isPriorityPackageSkill(skill, priorityContext),
  );

  const update = <K extends keyof CreateSkillPackageInput>(
    key: K,
    value: CreateSkillPackageInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugEdited ? prev.slug : slugifyPackageName(name),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugEdited(true);
    update('slug', slugifyPackageName(slug));
  };

  const regenerateSlug = () => {
    setSlugEdited(false);
    update('slug', slugifyPackageName(form.name));
  };

  const handleTagToggle = (tag: string) => {
    setCustomTagError(null);
    setForm((prev) => ({
      ...prev,
      tags: togglePackageTag(prev.tags, tag),
    }));
  };

  const handleCustomTagAdd = () => {
    const tag = normalizePackageTag(customTagInput);
    if (!tag) {
      setCustomTagError('请先输入标签名称');
      return;
    }
    if (hasPackageTag(form.tags, tag)) {
      setCustomTagError('这个标签已经添加过了');
      return;
    }
    if (form.tags.length >= MAX_PACKAGE_TAGS) {
      setCustomTagError(`最多只能选择 ${MAX_PACKAGE_TAGS} 个标签`);
      return;
    }
    setForm((prev) => ({
      ...prev,
      tags: addPackageTag(prev.tags, tag),
    }));
    setCustomTagInput('');
    setCustomTagError(null);
  };

  const toggleSkill = (skillId: string) => {
    const alreadySelected = form.skillIds.includes(skillId);
    if (!alreadySelected && form.skillIds.length >= 50) {
      setError('一个 Skill 包最多包含 50 个 Skill');
      return;
    }
    setError(null);
    setForm((prev) => ({
      ...prev,
      skillIds: alreadySelected
        ? prev.skillIds.filter((id) => id !== skillId)
        : [...prev.skillIds, skillId],
    }));
  };

  const handleVisibilityChange = (visibility: Visibility) => {
    const nextSkillIds =
      visibility === 'public'
        ? form.skillIds.filter((skillId) => skillById.get(skillId)?.visibility === 'public')
        : form.skillIds;
    if (nextSkillIds.length !== form.skillIds.length) {
      setError('已自动移除私有 Skill。公开 Skills 包只能包含公开 Skill，方便用户一条命令安装。');
    } else {
      setError(null);
    }
    setForm((prev) => ({
      ...prev,
      visibility,
      skillIds: nextSkillIds,
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!me) {
      setError('请先登录后再创建 Skills 包');
      return;
    }

    const slug = slugifyPackageName(form.slug || form.name);
    if (!slug) {
      setError('请填写可生成 URL 的包名称或 slug');
      return;
    }
    if (form.skillIds.length === 0) {
      setError('请至少选择一个要打包安装的 Skill');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await apiClient.createPackage({
        ...form,
        tags: form.tags.filter(Boolean),
        slug,
        icon: form.icon || null,
      });
      navigate(`/packages/${created.owner.handle}/${created.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建 Skills 包失败');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSkillCard = (skill: OwnedSkillListItem) => (
    <SkillOptionCard
      key={skill.id}
      skill={skill}
      selected={selectedSkillIds.has(skill.id)}
      bookmarked={isBookmarkedPackageSkill(skill, priorityContext)}
      own={isOwnPackageSkill(skill, priorityContext)}
      onToggle={() => toggleSkill(skill.id)}
    />
  );

  if (loading) {
    return (
      <>
        <PageBreadcrumb />
        <div className="bg-white px-6 py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
          正在准备创建表单…
        </div>
      </>
    );
  }

  if (!me) {
    return (
      <>
        <PageBreadcrumb />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-[28px]">
            🔒
          </div>
          <div className="mb-3 text-[12px] uppercase tracking-[0.16em] text-neutral-500">
            需要登录
          </div>
          <p className="text-[14px] text-neutral-700">
            创建 Skills 包前，请先通过 mozia-sso 登录。
          </p>
          <Link
            to="/publish"
            className="mt-5 inline-block rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] transition hover:border-neutral-900"
          >
            返回发布选择
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageBreadcrumb />

      <div className="border-b border-neutral-200 px-6 pt-10 pb-8">
        <div className="mx-auto max-w-[900px]">
          <div className="flex items-center gap-5">
            <div className="flex h-[80px] w-[80px] shrink-0 select-none items-center justify-center rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 text-[36px]">
              {DEFAULT_SKILL_PACKAGE_ICON}
            </div>
            <div>
              <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#0f172a]">
                发布一个 Skills 包
              </h1>
              <p className="mt-2 max-w-xl text-[15px] text-[#64748b]">
                把同一场景会一起使用的 Skill 组合成一个安装入口，让用户用一条
                <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[12px]">
                  npx skills add
                </code>
                命令载入整组能力。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white px-6 py-8">
        <form onSubmit={submit} className="mx-auto max-w-[900px] space-y-8">
          <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5">
            <SectionHeader
              eyebrow="第一步"
              title="介绍这个 Skills 包"
              description="先说清楚它服务什么场景，再补充 URL、标签和展示图标。"
            />

            {ownerOptions.length > 1 ? (
              <div>
                <FieldLabel hint="选择本次发布使用的身份">发布者</FieldLabel>
                <select
                  value={form.owner}
                  onChange={(event) => update('owner', event.target.value)}
                  className="w-full max-w-[220px] rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-[13px] transition focus:border-neutral-900 focus:outline-none"
                >
                  {ownerOptions.map((owner) => (
                    <option key={owner.handle} value={owner.handle}>
                      {owner.handle}
                      {owner.displayName && owner.displayName !== owner.handle
                        ? ` (${owner.displayName})`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <FieldLabel hint="会显示在列表页和详情页">包名称</FieldLabel>
              <input
                value={form.name}
                onChange={(event) => handleNameChange(event.target.value)}
                required
                maxLength={120}
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-[14px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="例如：视频案件分析包"
              />
            </div>

            <div>
              <FieldLabel hint="从常用 Emoji 中选择，用于列表页和详情页展示">图标</FieldLabel>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white text-[26px]">
                    {form.icon || DEFAULT_SKILL_PACKAGE_ICON}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-neutral-800">
                      {form.icon ? '已选择包图标' : '还没有选择包图标'}
                    </div>
                    <p className="mt-1 text-[12px] text-neutral-500">
                      点击一个 Emoji 作为 Skills 包的视觉标识。
                    </p>
                  </div>
                </div>
                <EmojiPicker
                  value={form.icon ?? null}
                  onChange={(emoji) => update('icon', emoji)}
                />
              </div>
            </div>

            <div>
              <FieldLabel hint="默认跟随包名称；手动编辑后会停止自动同步">URL slug</FieldLabel>
              <input
                value={form.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 font-mono text-[14px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="video-case-suite"
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                {form.slug ? (
                  <div className="font-mono text-[12px] text-neutral-400">
                    /p/{form.owner}/<span className="text-neutral-700">{form.slug}</span>
                  </div>
                ) : (
                  <div className="text-[12px] text-neutral-400">输入包名称后会自动生成 URL。</div>
                )}
                {slugEdited ? (
                  <button
                    type="button"
                    onClick={regenerateSlug}
                    className="text-[12px] text-emerald-700 transition hover:text-emerald-900"
                  >
                    重新根据包名称生成
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <FieldLabel hint="说明为什么这些 Skill 应该一起安装">简介</FieldLabel>
              <textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                required
                maxLength={500}
                rows={4}
                className="w-full resize-none rounded-lg border border-neutral-200 px-4 py-3 text-[14px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="例如：覆盖视频取证、人物关系分析和报告生成，适合一次性装配案件分析 Agent。"
              />
            </div>

            <div>
              <FieldLabel hint={`点击按钮添加，最多 ${MAX_PACKAGE_TAGS} 个`}>标签</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PACKAGE_TAG_OPTIONS.map((tag) => {
                  const active = form.tags.includes(tag);
                  const disabled = !active && form.tags.length >= MAX_PACKAGE_TAGS;
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleTagToggle(tag)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[13px] transition disabled:cursor-not-allowed disabled:opacity-45',
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
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={customTagInput}
                  onChange={(event) => {
                    setCustomTagInput(event.target.value);
                    setCustomTagError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCustomTagAdd();
                    }
                  }}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-[14px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="添加自定义标签，例如：本地知识库"
                />
                <button
                  type="button"
                  onClick={handleCustomTagAdd}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-[13px] font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
                >
                  添加标签
                </button>
              </div>
              {customTagError ? (
                <div className="mt-2 text-[12px] text-red-600">{customTagError}</div>
              ) : null}
              <div className="mt-2 text-[12px] text-neutral-400">
                {form.tags.length > 0
                  ? `已选择 ${form.tags.length} 个标签：${form.tags.join('、')}`
                  : '选择几个标签，让用户更容易在发现页找到这个 Skills 包。'}
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader
                eyebrow="第二步"
                title="选择要打包的 Skill"
                description="支持搜索名称、作者和标签。默认优先展示你收藏过的 Skill，以及你自己发布的 Skill。"
              />
              <div className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-[12px] text-neutral-600">
                已选 {form.skillIds.length}/50
              </div>
            </div>

            <div className="relative">
              <svg
                className="absolute top-1/2 left-4 -translate-y-1/2 text-neutral-400"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                aria-hidden
              >
                <title>搜索</title>
                <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line
                  x1="12"
                  y1="12"
                  x2="16"
                  y2="16"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
              <input
                type="search"
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
                placeholder="搜索 Skill 名称、作者或标签..."
                className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pr-4 pl-11 text-[14px] shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['public', '公开包'],
                  ['private', '私有包'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleVisibilityChange(value)}
                  className={cn('category-btn', form.visibility === value ? 'active' : '')}
                >
                  <span>{value === 'public' ? '◆' : '◇'}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <p className="text-[12px] leading-5 text-neutral-500">
              公开包只能包含公开 Skill，这样用户无需登录就能通过
              <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 font-mono">
                npx skills add
              </code>
              完成安装；私有包可以先整理自己的私有 Skill。
            </p>

            {skillSearchError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                {skillSearchError}
              </div>
            ) : null}

            <div className="space-y-7">
              <SkillGroup
                title="已选择"
                description="这里汇总将被打包安装的 Skill，下方原列表会继续保留它们，方便对照上下文。"
                skills={selectedSkills}
              >
                {renderSkillCard}
              </SkillGroup>

              <SkillGroup
                title="优先展示：收藏与自有"
                description="先从你已经关注或发布过的 Skill 里挑，创建包会更快。"
                skills={prioritySkills}
              >
                {renderSkillCard}
              </SkillGroup>

              <SkillGroup
                title={skillQuery.trim() ? '搜索结果' : '其他可选 Skill'}
                skills={otherSkills}
              >
                {renderSkillCard}
              </SkillGroup>

              {selectedSkills.length === 0 &&
              prioritySkills.length === 0 &&
              otherSkills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-[14px] text-neutral-500">
                  {skillQuery.trim()
                    ? '没有找到匹配的公开 owned Skill。换个关键词试试。'
                    : '暂时没有可加入这个包的 owned Skill。'}
                </div>
              ) : null}
            </div>

            {fetchingSkills ? (
              <div className="text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
                正在搜索更多 Skill…
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/publish"
              className="text-[13px] text-neutral-500 transition hover:text-neutral-900"
            >
              ← 返回发布选择
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-neutral-950 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '正在创建…' : '创建 Skills 包'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
