import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { apiClient } from '@/lib/api-client';
import type { SkillDetail } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

export default function SkillEditPage() {
  const { owner = '', slug = '' } = useParams<{ owner: string; slug: string }>();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        Cannot load skill ({error}).{' '}
        <Link to="/" className="underline">
          back home
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
        Only owned skills can be edited.{' '}
        <Link to={`/skills/${owner}/${slug}`} className="underline">
          back
        </Link>
      </div>
    );

  const handleSubmit = async (values: SkillFormValues) => {
    await apiClient.updateSkill(owner, slug, {
      name: values.name,
      description: values.description,
      tags: values.tags,
      visibility: values.visibility,
      skillMdContent: values.skillMdContent,
    });
    navigate(`/skills/${owner}/${slug}`);
  };

  return (
    <div className="py-10">
      <div className="border-b border-neutral-200 pb-6 flex items-baseline justify-between">
        <h1 className="font-mono text-[24px] tracking-[-0.02em] text-neutral-900 font-medium">
          Edit{' '}
          <span className="text-neutral-500">
            {owner}/{slug}
          </span>
        </h1>
        <Link
          to={`/skills/${owner}/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900"
        >
          ← back to detail
        </Link>
      </div>
      <SkillForm
        mode="edit"
        ownerOptions={[owner]}
        initial={{
          owner,
          slug,
          name: skill.name,
          description: skill.description,
          tags: skill.tags,
          visibility: skill.visibility,
          skillMdContent: skill.skillMdContent,
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/skills/${owner}/${slug}`)}
        submitLabel="Save changes"
      />
    </div>
  );
}
