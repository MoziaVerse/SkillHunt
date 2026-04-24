import { SkillForm, type SkillFormValues } from '@/components/skill-form';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

export default function PublishPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMe()
      .then(setMe)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'failed to load profile');
      });
  }, []);

  if (error) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-3">
          sign in required
        </div>
        <p className="text-neutral-700">
          You need to sign in via mozia-sso before publishing a skill.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
        >
          back home
        </Link>
      </div>
    );
  }

  if (!me) return <Spinner />;

  const ownerOptions = [me.name, ...me.canPublishAs];

  const handleSubmit = async (values: SkillFormValues) => {
    const created = await apiClient.createSkill(values);
    navigate(`/skills/${created.owner.name}/${created.slug}`);
  };

  return (
    <div className="py-10">
      <div className="border-b border-neutral-200 pb-6">
        <h1 className="font-mono text-[28px] tracking-[-0.02em] text-neutral-900 font-medium">
          Publish a skill
        </h1>
        <p className="mt-2 text-[14px] text-neutral-600 max-w-2xl">
          Owned skills live in SkillHub's database. Others can install yours via{' '}
          <code className="font-mono bg-neutral-100 px-1 rounded">npx skills add</code> if you mark
          it public.
        </p>
      </div>
      <SkillForm
        mode="create"
        ownerOptions={ownerOptions}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

function Spinner() {
  return (
    <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
      loading…
    </div>
  );
}
