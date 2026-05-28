import { Logo } from '@/components/logo';
import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { SkillUploadPreview } from '@/components/skill-upload-preview';
import {
  type SkillFromUpload,
  type SkillUploadExtra,
  SkillUploader,
} from '@/components/skill-uploader';
import { TwemojiIcon } from '@/components/twemoji-icon';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

export default function PublishPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState<Partial<SkillFormValues> | undefined>(undefined);
  const [extras, setExtras] = useState<SkillUploadExtra[]>([]);
  const [ignoredSystemFileCount, setIgnoredSystemFileCount] = useState(0);

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
            <Link to="/publish" className="text-neutral-500 hover:text-neutral-900 transition">
              发布
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-900 font-medium">Skill</span>
          </div>
        </nav>

        <div className="px-6 py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-[28px]">
            <TwemojiIcon emoji="🔒" />
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
            <Link to="/publish" className="text-neutral-500 hover:text-neutral-900 transition">
              发布
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-900 font-medium">Skill</span>
          </div>
        </nav>

        <div className="px-6 py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-[28px]">
            <TwemojiIcon emoji="⚠️" />
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
    setIgnoredSystemFileCount(data.ignoredSystemFiles.length);
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (values: SkillFormValues) => {
    const { releaseTitle, releaseChangelog, ...skillValues } = values;
    const created = await apiClient.createSkill({
      ...skillValues,
      description: skillValues.tagline,
    });
    const failures: string[] = [];
    for (const f of extras) {
      try {
        await apiClient.upsertSkillFile(
          values.owner,
          values.slug,
          f.path,
          f.kind === 'text'
            ? { kind: 'text', content: f.content }
            : { kind: 'binary', file: f.file, contentType: f.contentType },
        );
      } catch (e) {
        failures.push(`${f.path}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
    if (failures.length) {
      window.alert(`Skill 已创建，但部分附加文件处理失败：\n${failures.join('\n')}`);
    }
    await apiClient.createSkillRelease(values.owner, values.slug, {
      title: releaseTitle,
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
          <Link to="/publish" className="text-neutral-500 hover:text-neutral-900 transition">
            发布
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-medium">Skill</span>
        </div>
      </nav>

      {/* Header */}
      <div className="px-6 pt-10 pb-8 border-b border-neutral-200">
        <div className="mx-auto max-w-[900px]">
          <div className="flex items-center gap-5">
            <div className="w-[80px] h-[80px] shrink-0 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center text-[36px] select-none">
              <TwemojiIcon emoji="🚀" />
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
        <div className="mx-auto max-w-[900px] space-y-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-1">
                第一步
              </div>
              <h2 className="text-[22px] font-semibold text-[#0f172a]">准备你的 Skill 文件</h2>
              <p className="mt-2 text-[14px] text-neutral-500">
                上传 SKILL.md 或整个 skill 文件夹，我们会帮你带入基础信息，再补充发布文案。
              </p>
            </div>
            {initial?.skillMdContent ? (
              <div className="space-y-4">
                <SkillUploadPreview
                  skillMdContent={initial.skillMdContent}
                  extras={extras}
                  ignoredSystemFileCount={ignoredSystemFileCount}
                />
                <details className="border border-neutral-200 px-4 py-3 rounded-xl">
                  <summary className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-600 cursor-pointer">
                    重新上传 / 替换文件
                  </summary>
                  <div className="mt-3">
                    <SkillUploader onLoaded={handleUpload} compact />
                  </div>
                </details>
              </div>
            ) : (
              <SkillUploader onLoaded={handleUpload} />
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
          />
        </div>
      </div>
    </>
  );
}
