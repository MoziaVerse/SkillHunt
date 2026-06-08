import { describe, expect, it } from 'bun:test';
import { skillProtocolName } from './protocol-name';

describe('skillProtocolName', () => {
  it('keeps valid mozia-owned slugs stable', () => {
    expect(skillProtocolName('mozia', 'project-mental-map')).toBe('project-mental-map');
  });

  it('keeps user-owned protocol names CLI-safe and hash-suffixed', () => {
    const name = skillProtocolName('volley', 'a-i-xue-ye-gui-hua-shi');

    expectCliSafe(name);
    expect(name).toBe('volley-a-i-xue-ye-gui-hua-shi-08n5vz0');
    expect(name).toMatch(/-[a-z0-9]{7}$/);
  });

  it('shortens production-length protocol names without losing the hash suffix', () => {
    const cases = [
      {
        owner: 'volley',
        slug: 'hang-zhou-dian-zi-ke-ji-da-xue-zhuan-shu-xiao-yuan-sheng-huo-zhi',
        hash: '1vzpopa',
      },
      {
        owner: 'ellipse',
        slug: 'hang-dian-ren-sheng-mo-ni-qi-h-d-u-l-i-f-e-s-i-m-u-l-a-t-o-r',
        hash: '0qhszag',
      },
      {
        owner: 'mnijf111',
        slug: 'hang-dian-xiao-yuan-pao-zhi-neng-an-pai-zhu-shou',
        hash: '0ysrdez',
      },
      {
        owner: 'javde',
        slug: 'nei-cun-zhen-tan-c-yu-yan-zhi-zhen-ke-shi-hua-jiao-xue-zhu-shou',
        hash: '16t210n',
      },
    ];

    for (const item of cases) {
      const name = skillProtocolName(item.owner, item.slug);
      expectCliSafe(name);
      expect(name).toEndWith(`-${item.hash}`);
    }
  });

  it('normalizes doubled hyphens before exposing a protocol name', () => {
    const name = skillProtocolName('alice', 'foo--bar');

    expectCliSafe(name);
    expect(name).not.toContain('--');
    expect(name).toMatch(/-[a-z0-9]{7}$/);
  });

  it('hashes mozia-owned names when normalization changes the raw slug', () => {
    const name = skillProtocolName('mozia', 'foo--bar');

    expectCliSafe(name);
    expect(name).not.toContain('--');
    expect(name).toMatch(/-[a-z0-9]{7}$/);
  });
});

function expectCliSafe(name: string) {
  expect(name.length).toBeGreaterThanOrEqual(1);
  expect(name.length).toBeLessThanOrEqual(64);
  expect(name).toMatch(/^[a-z0-9-]+$/);
  expect(name.startsWith('-')).toBe(false);
  expect(name.endsWith('-')).toBe(false);
  expect(name).not.toContain('--');
}
