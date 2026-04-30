import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { type SkillFromUpload, SkillUploader } from '@/components/skill-uploader';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

export default function PublishPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // formKey bumps to remount SkillForm with fresh initial values on each upload.
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState<Partial<SkillFormValues> | undefined>(undefined);
  const [extras, setExtras] = useState<Array<{ path: string; content: string }>>([]);

  useEffect(() => {
    apiClient
      .getMe()
      .then(setMe)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'failed to load profile');
      });
  }, []);

  if (loadError) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
          需要登录
        </div>
        <p className="text-neutral-700">发布 skill 前请先通过 mozia-sso 登录。</p>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        loading…
      </div>
    );
  }

  // handle is what shows up in URL; name is just display.
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
  if (!SLUG_RE.test(me.handle)) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
          handle 需要重命名
        </div>
        <p className="text-neutral-700">
          你的 URL handle <code className="font-mono">{me.handle}</code> 包含非法字符。SkillHub URL
          只允许小写字母、数字和连字符。
        </p>
        <Link
          to="/settings/profile"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] bg-neutral-900 text-neutral-100 px-3 py-1.5"
        >
          在设置中重命名
        </Link>
      </div>
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
      description: data.suggestedDescription ?? '',
      skillMdContent: data.skillMdContent,
    });
    setExtras(data.extras);
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (values: SkillFormValues) => {
    const created = await apiClient.createSkill(values);
    // Attach extras after the skill exists; failure here is non-fatal but reported.
    const failures: string[] = [];
    for (const f of extras) {
      try {
        await apiClient.upsertSkillFile(values.owner, values.slug, f.path, f.content);
      } catch (e) {
        failures.push(`${f.path}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
    if (failures.length) {
      window.alert(`Skill created but some extra files failed:\n${failures.join('\n')}`);
    }
    navigate(`/skills/${created.owner.handle}/${created.slug}`);
  };

  return (
    <div className="py-10">
      <div className="border-b border-neutral-200 pb-6">
        <h1 className="font-mono text-[28px] tracking-[-0.02em] text-neutral-900 font-medium">
          发布 skill
        </h1>
        <p className="mt-2 text-[14px] text-neutral-600 max-w-2xl">
          上传本地 SKILL.md 文件或 skill 文件夹，我们会自动填充元数据，你可以在发布前编辑。
        </p>
      </div>

      <div className="mt-8">
        <SkillUploader onLoaded={handleUpload} />
        {extras.length > 0 && (
          <div className="mt-3 font-mono text-[12px] text-neutral-600">
            <div className="uppercase tracking-[0.14em] text-[10.5px] text-neutral-500 mb-1">
              {extras.length} 个附加文件将被上传
            </div>
            <ul className="space-y-0.5">
              {extras.map((e) => (
                <li key={e.path} className="flex justify-between gap-3 max-w-md">
                  <span className="truncate text-neutral-700">{e.path}</span>
                  <span className="text-neutral-400 shrink-0">
                    {e.content.length.toLocaleString()} chars
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
      />
    </div>
  );
}
