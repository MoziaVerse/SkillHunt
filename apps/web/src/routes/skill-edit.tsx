import { Logo } from '@/components/logo';
import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { SkillUploadPreview } from '@/components/skill-upload-preview';
import {
  type SkillFromUpload,
  type SkillUploadExtra,
  SkillUploader,
} from '@/components/skill-uploader';
import { TwemojiIcon } from '@/components/twemoji-icon';
import { apiClient } from '@/lib/api-client';
import type { SkillDetail } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

function EditBreadcrumb({ owner, slug }: { owner: string; slug: string }) {
  return (
    <nav className="border-b border-neutral-100 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-[1200px] items-center gap-1.5 text-[13px]">
        <Link to="/" className="text-neutral-500 transition hover:text-neutral-900">
          <Logo size={16} className="text-neutral-900" />
        </Link>
        <span className="text-neutral-300">/</span>
        <Link
          to={`/skills/${owner}/${slug}`}
          className="text-neutral-500 transition hover:text-neutral-900"
        >
          {owner}/{slug}
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">编辑</span>
      </div>
    </nav>
  );
}

export default function SkillEditPage() {
  const { owner = '', slug = '' } = useParams<{ owner: string; slug: string }>();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [extras, setExtras] = useState<SkillUploadExtra[]>([]);
  const [overrideSkillMd, setOverrideSkillMd] = useState<string | null>(null);
  const [ignoredSystemFileCount, setIgnoredSystemFileCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSkill(owner, slug)
      .then((s) => {
        if (!cancelled) setSkill(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [owner, slug]);

  if (error)
    return (
      <>
        <EditBreadcrumb owner={owner} slug={slug} />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-[28px]">
            !
          </div>
          <div className="mb-3 text-[12px] tracking-[0.16em] text-neutral-500">加载失败</div>
          <p className="text-[14px] text-neutral-700">无法加载这个 Skill：{error}</p>
          <Link
            to="/"
            className="mt-5 inline-block rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] tracking-[0.1em] transition hover:border-neutral-900"
          >
            返回首页
          </Link>
        </div>
      </>
    );

  if (!skill)
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        加载中…
      </div>
    );

  if (skill.type !== 'owned')
    return (
      <>
        <EditBreadcrumb owner={owner} slug={slug} />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-[28px]">
            <TwemojiIcon emoji="🔒" />
          </div>
          <div className="mb-3 text-[12px] tracking-[0.16em] text-neutral-500">不能编辑</div>
          <p className="text-[14px] text-neutral-700">只有自有 Skill 才能编辑。</p>
          <Link
            to={`/skills/${owner}/${slug}`}
            className="mt-5 inline-block rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] tracking-[0.1em] transition hover:border-neutral-900"
          >
            返回详情
          </Link>
        </div>
      </>
    );

  const handleUpload = (data: SkillFromUpload) => {
    setOverrideSkillMd(data.skillMdContent);
    setExtras(data.extras);
    setIgnoredSystemFileCount(data.ignoredSystemFiles.length);
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (values: SkillFormValues) => {
    await apiClient.updateSkill(owner, slug, {
      name: values.name,
      description: values.tagline,
      tags: values.tags,
      visibility: values.visibility,
      ...(values.skillMdContent ? { skillMdContent: values.skillMdContent } : {}),
      icon: values.icon,
      coverImage: values.coverImage,
      demoVideoUrl: values.demoVideoUrl,
    });
    const failures: string[] = [];
    for (const f of extras) {
      try {
        await apiClient.upsertSkillFile(
          owner,
          slug,
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
      window.alert(`已保存，但部分附加文件处理失败：\n${failures.join('\n')}`);
    }
    if (values.releaseChangelog.trim()) {
      await apiClient.createSkillRelease(owner, slug, {
        title: values.releaseTitle,
        changelog: values.releaseChangelog,
      });
    }
    navigate(`/skills/${owner}/${slug}`);
  };

  return (
    <>
      <EditBreadcrumb owner={owner} slug={slug} />

      <div className="border-b border-neutral-200 px-6 pt-10 pb-8">
        <div className="mx-auto max-w-[900px]">
          <div className="flex items-center gap-5">
            <div className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 text-[36px] select-none">
              <TwemojiIcon emoji="✏️" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#0f172a]">
                  编辑 Skill
                </h1>
                <Link
                  to={`/skills/${owner}/${slug}`}
                  className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] tracking-[0.1em] text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
                >
                  返回详情
                </Link>
              </div>
              <p className="max-w-xl text-[15px] text-[#64748b]">
                更新这个 Skill 的说明、标签、图标和 SKILL.md 内容。只有替换 Skill
                文件或改变可安装内容时，才需要填写版本说明。
              </p>
              <div className="mt-2 font-mono text-[12px] text-neutral-400">
                {owner}/{slug}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-[900px] space-y-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-4">
              <div className="mb-1 text-[12px] font-semibold tracking-[0.16em] text-emerald-700">
                可选
              </div>
              <h2 className="text-[22px] font-semibold text-[#0f172a]">替换 Skill 文件</h2>
              <p className="mt-2 text-[14px] text-neutral-500">
                如果本地已经更新了 SKILL.md
                或附加文件，可以在这里重新上传；不上传则继续编辑当前内容。
              </p>
            </div>

            {overrideSkillMd ? (
              <div className="space-y-4">
                <SkillUploadPreview
                  skillMdContent={overrideSkillMd}
                  extras={extras}
                  ignoredSystemFileCount={ignoredSystemFileCount}
                />
                <details className="rounded-xl border border-neutral-200 px-4 py-3">
                  <summary className="cursor-pointer text-[12px] tracking-[0.14em] text-neutral-600">
                    重新上传 / 替换文件
                  </summary>
                  <div className="mt-3">
                    <SkillUploader onLoaded={handleUpload} compact />
                  </div>
                </details>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
                <SkillUploader onLoaded={handleUpload} compact />
              </div>
            )}
          </div>

          <SkillForm
            key={formKey}
            mode="edit"
            ownerOptions={[{ handle: owner, displayName: skill.owner.name }]}
            initial={{
              owner,
              slug,
              name: skill.name,
              tagline: skill.description,
              tags: skill.tags,
              visibility: skill.visibility,
              skillMdContent: overrideSkillMd ?? skill.skillMdContent,
              icon: skill.icon,
              coverImage: skill.coverImage,
              demoVideoUrl: skill.demoVideoUrl,
            }}
            requiresVersionRelease={Boolean(overrideSkillMd || extras.length > 0)}
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/skills/${owner}/${slug}`)}
            submitLabel="保存更改"
          />
        </div>
      </div>
    </>
  );
}
