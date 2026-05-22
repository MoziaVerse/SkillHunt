import { describe, expect, it } from 'bun:test';
import { shouldShowSkillReleaseFields } from './skill-form-helpers';

describe('shouldShowSkillReleaseFields', () => {
  it('does not show release fields while creating a skill', () => {
    expect(
      shouldShowSkillReleaseFields({
        mode: 'create',
        requiresVersionRelease: true,
        initialSkillMd: '',
        currentSkillMd: '# new skill',
      }),
    ).toBe(false);
  });

  it('does not require release notes for metadata-only edits', () => {
    expect(
      shouldShowSkillReleaseFields({
        mode: 'edit',
        initialSkillMd: '---\nname: lark-attendance\n---\n# body',
        currentSkillMd: '---\nname: lark-attendance\n---\n# body',
      }),
    ).toBe(false);
  });

  it('shows release fields when SKILL.md content changes', () => {
    expect(
      shouldShowSkillReleaseFields({
        mode: 'edit',
        initialSkillMd: '---\nname: lark-attendance\n---\n# old body',
        currentSkillMd: '---\nname: lark-attendance\n---\n# new body',
      }),
    ).toBe(true);
  });

  it('shows release fields when uploaded files force a version release', () => {
    expect(
      shouldShowSkillReleaseFields({
        mode: 'edit',
        requiresVersionRelease: true,
        initialSkillMd: '# same body',
        currentSkillMd: '# same body',
      }),
    ).toBe(true);
  });
});
