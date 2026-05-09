import { Logo } from '@/components/logo';
import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { type SkillFromUpload, SkillUploader } from '@/components/skill-uploader';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

export default function PublishPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState<Partial<SkillFormValues> | undefined>(undefined);
  const [extras, setExtras] = useState<Array<{ path: string; content: string }>>([]);
  const [preview, setPreview] = useState({
    owner: '',
    name: '未命名 Skill',
    tagline: '一句话介绍会显示在这里',
    tags: [] as string[],
  });

  useEffect(() => {
    apiClient
      .getMe()
      .then(setMe)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : '加载资料失败');
      });
  }, []);

  if (loadError) {
    return (
      <>
        {/* Breadcrumb */}
        <nav className="px-6 py-3 border-b border-neutral-100 bg-white">
          <div className="mx-auto max-w-[1200px] flex items-center gap-1.5 text-[13px]">
            <Link to="/" className="text-neutral-500 hover:text-neutral-900 transition">
              <Logo size={16} className="text-neutral-900" />
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-900 font-medium">发布</span>
          </div>
        </nav>

        <div className="px-6 py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-[28px]">
            🔒
          </div>
          <div className="text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
            需要登录
          </div>
          <p className="text-neutral-700 text-[14px]">
            在 SkillHunt 发布前，请先通过 mozia-sso 登录。
          </p>
          <Link
            to="/"
            className="mt-5 inline-block text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 rounded-lg transition"
          >
            返回首页
          </Link>
        </div>
      </>
    );
  }

  if (!me) {
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        加载中…
      </div>
    );
  }

  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
  if (!SLUG_RE.test(me.handle)) {
    return (
      <>
        <nav className="px-6 py-3 border-b border-neutral-100 bg-white">
          <div className="mx-auto max-w-[1200px] flex items-center gap-1.5 text-[13px]">
            <Link to="/" className="text-neutral-500 hover:text-neutral-900 transition">
              <Logo size={16} className="text-neutral-900" />
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-900 font-medium">发布</span>
          </div>
        </nav>

        <div className="px-6 py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-[28px]">
            ⚠️
          </div>
          <div className="text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
            URL 标识需要重命名
          </div>
          <p className="text-neutral-700 text-[14px]">
            你的 URL 标识{' '}
            <code className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{me.handle}</code>{' '}
            包含非法字符。
          </p>
          <p className="mt-3 text-[13px] text-neutral-500">请联系管理员修改 URL 标识后再发布。</p>
        </div>
      </>
    );
  }

  const ownerOptions = [
    { handle: me.handle, displayName: me.name },
    ...me.canPublishAs.map((h) => ({ handle: h })),
  ];

  const handleUpload = (data: SkillFromUpload) => {
    setInitial({
      slug: data.suggestedSlug ?? '',
      name: data.suggestedName ?? '',
      tagline: data.suggestedDescription ?? '',
      skillMdContent: data.skillMdContent,
    });
    setExtras(data.extras);
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (values: SkillFormValues) => {
    const created = await apiClient.createSkill({
      ...values,
      description: values.tagline,
    });
    const failures: string[] = [];
    for (const f of extras) {
      try {
        await apiClient.upsertSkillFile(values.owner, values.slug, f.path, f.content);
      } catch (e) {
        failures.push(`${f.path}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
    if (failures.length) {
      window.alert(`Skill 已创建，但部分附加文件处理失败：\n${failures.join('\n')}`);
    }
    await apiClient.createSkillRelease(values.owner, values.slug, {
      title: '首次发布',
      changelog: '发布到 SkillHunt。',
    });
    navigate(`/skills/${created.owner.handle}/${created.slug}`);
  };

  return (
    <>
      {/* Breadcrumb */}
      <nav className="px-6 py-3 border-b border-neutral-100 bg-white">
        <div className="mx-auto max-w-[1200px] flex items-center gap-1.5 text-[13px]">
          <Link to="/" className="text-neutral-500 hover:text-neutral-900 transition">
            <Logo size={16} className="text-neutral-900" />
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-medium">发布</span>
        </div>
      </nav>

      {/* Header */}
      <div className="px-6 pt-10 pb-8 border-b border-neutral-200">
        <div className="mx-auto max-w-[900px]">
          <div className="flex items-center gap-5">
            <div className="w-[80px] h-[80px] shrink-0 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center text-[36px] select-none">
              🚀
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-[#0f172a] tracking-[-0.02em]">
                发布一个 Skill
              </h1>
              <p className="mt-2 text-[15px] text-[#64748b] max-w-xl">
                向社区介绍你的新能力。先准备好
                SKILL.md，再补充名称、一句话介绍和标签，就可以完成一次轻量发布。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-[1200px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="mb-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-1">
                  第一步
                </div>
                <h2 className="text-[22px] font-semibold text-[#0f172a]">准备你的 Skill 文件</h2>
                <p className="mt-2 text-[14px] text-neutral-500">
                  上传 SKILL.md 或整个 skill 文件夹，我们会帮你带入基础信息，再补充发布文案。
                </p>
              </div>
              <SkillUploader onLoaded={handleUpload} />
              {extras.length > 0 && (
                <div className="mt-4 border border-neutral-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
                    <div className="text-[12px] font-semibold text-neutral-700">
                      {extras.length} 个附加文件将被一并发布
                    </div>
                  </div>
                  <ul className="px-4 py-2 font-mono text-[12px]">
                    {extras.map((e) => (
                      <li
                        key={e.path}
                        className="py-1.5 border-b border-neutral-100 last:border-b-0 flex justify-between gap-3"
                      >
                        <span className="truncate text-neutral-700">{e.path}</span>
                        <span className="text-neutral-400 shrink-0">
                          {e.content.length.toLocaleString()} 字符
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <SkillForm
              key={formKey}
              mode="create"
              ownerOptions={ownerOptions}
              initial={initial}
              onSubmit={handleSubmit}
              onCancel={() => navigate(-1)}
              submitLabel="立即发布"
              onPreviewChange={setPreview}
            />
          </div>

          <aside className="lg:sticky lg:top-[80px] lg:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  发布预览
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-emerald-700">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">
                        N
                      </span>
                      新发布
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      @{preview.owner || me.handle}
                    </span>
                  </div>
                  <div className="text-[20px] font-semibold text-neutral-900 leading-tight">
                    {preview.name || '未命名 Skill'}
                  </div>
                  <p className="mt-2 text-[14px] text-neutral-600 leading-relaxed">
                    {preview.tagline || '一句话介绍会显示在这里'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(preview.tags.length > 0 ? preview.tags : ['待选择标签']).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-neutral-200 px-4 py-4 text-[13px] text-neutral-500">
                  这张卡片会帮助你快速判断：社区在列表页第一眼看到的内容是否足够吸引人。
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
