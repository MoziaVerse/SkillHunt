import { describe, expect, it } from 'bun:test';
import { toTwemojiCodepoint } from './twemoji-icon';

describe('toTwemojiCodepoint', () => {
  it('converts emoji to Twemoji svg codepoints', () => {
    expect(toTwemojiCodepoint('🧩')).toBe('1f9e9');
    expect(toTwemojiCodepoint('📦')).toBe('1f4e6');
  });

  it('removes variation selectors used by native emoji fonts', () => {
    expect(toTwemojiCodepoint('⚠️')).toBe('26a0');
    expect(toTwemojiCodepoint('✏️')).toBe('270f');
  });

  it('returns null for empty values', () => {
    expect(toTwemojiCodepoint('   ')).toBeNull();
  });
});
