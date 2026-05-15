export function sortReleaseFiles(files: string[]) {
  return [...files].sort((a, b) => {
    if (a === 'SKILL.md') return -1;
    if (b === 'SKILL.md') return 1;
    return a.localeCompare(b, 'zh-CN');
  });
}

export function releaseVersionLabel(version: number) {
  return `v${version}`;
}

export function releaseChangelogText(changelog: string) {
  const trimmed = changelog.trim();
  return trimmed || '这个版本没有填写发布说明。';
}

export function firstReleaseId<T extends { id: string }>(releases: T[]) {
  return releases[0]?.id ?? null;
}
