export function shouldShowSkillReleaseFields(input: {
  mode: 'create' | 'edit';
  requiresVersionRelease?: boolean;
  initialSkillMd?: string | null;
  currentSkillMd?: string | null;
}) {
  if (input.mode === 'create') return false;
  if (input.requiresVersionRelease) return true;
  return (input.initialSkillMd ?? '').trim() !== (input.currentSkillMd ?? '').trim();
}
