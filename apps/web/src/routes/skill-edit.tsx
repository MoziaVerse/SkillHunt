import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { type SkillFromUpload, SkillUploader } from '@/components/skill-uploader';
import { apiClient } from '@/lib/api-client';
import type { SkillDetail } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

export default function SkillEditPage() {
  const { owner = '', slug = '' } = useParams<{ owner: string; slug: string }>();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [extras, setExtras] = useState<Array<{ path: string; content: string }>>([]);
  const [overrideSkillMd, setOverrideSkillMd] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSkill(owner, slug)
      .then((s) => {
        if (!cancelled) setSkill(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [owner, slug]);

  if (error)
    return (
      <div className="py-24 text-center text-neutral-700">
        无法加载 skill（{error}）。{' '}
        <Link to="/" className="underline">
          返回首页
        </Link>
      </div>
    );

  if (!skill)
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        loading…
      </div>
    );

  if (skill.type !== 'owned')
    return (
      <div className="py-24 text-center text-neutral-700">
        只有自有 skill 才能编辑。{' '}
        <Link to={`/skills/${owner}/${slug}`} className="underline">
          返回
        </Link>
      </div>
    );

  const handleUpload = (data: SkillFromUpload) => {
    setOverrideSkillMd(data.skillMdContent);
    setExtras(data.extras);
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (values: SkillFormValues) => {
    await apiClient.updateSkill(owner, slug, {
      name: values.name,
      description: values.description,
      tags: values.tags,
      visibility: values.visibility,
      skillMdContent: values.skillMdContent,
    });
    const failures: string[] = [];
    for (const f of extras) {
      try {
        await apiClient.upsertSkillFile(owner, slug, f.path, f.content);
      } catch (e) {
        failures.push(`${f.path}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
    if (failures.length) {
      window.alert(`Saved but some extra files failed:\n${failures.join('\n')}`);
    }
    navigate(`/skills/${owner}/${slug}`);
  };

  return (
    <div className="py-10">
      <div className="border-b border-neutral-200 pb-6 flex items-baseline justify-between">
        <h1 className="font-mono text-[24px] tracking-[-0.02em] text-neutral-900 font-medium">
          编辑{' '}
          <span className="text-neutral-500">
            {owner}/{slug}
          </span>
        </h1>
        <Link
          to={`/skills/${owner}/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900"
        >
          ← 返回详情
        </Link>
      </div>

      <details className="mt-6 border border-neutral-200 px-4 py-3">
        <summary className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-600 cursor-pointer">
          从本地文件 / 文件夹替换
        </summary>
        <div className="mt-3">
          <SkillUploader onLoaded={handleUpload} compact />
          {extras.length > 0 && (
            <div className="mt-3 font-mono text-[11.5px] text-neutral-600">
              {extras.length} 个附加文件将在保存时添加/替换：{extras.map((e) => e.path).join(', ')}
            </div>
          )}
        </div>
      </details>

      <SkillForm
        key={formKey}
        mode="edit"
        ownerOptions={[{ handle: owner, displayName: skill.owner.name }]}
        initial={{
          owner,
          slug,
          name: skill.name,
          description: skill.description,
          tags: skill.tags,
          visibility: skill.visibility,
          skillMdContent: overrideSkillMd ?? skill.skillMdContent,
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/skills/${owner}/${slug}`)}
        submitLabel="保存更改"
      />
    </div>
  );
}
