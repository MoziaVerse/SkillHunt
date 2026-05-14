import { cn } from '@/lib/utils';
import { useState } from 'react';

const TWEMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';
const VARIATION_SELECTORS = new Set([0xfe0e, 0xfe0f]);

export function toTwemojiCodepoint(emoji: string) {
  const codepoints = Array.from(emoji.trim())
    .map((char) => char.codePointAt(0))
    .filter((codepoint): codepoint is number => Boolean(codepoint))
    .filter((codepoint) => !VARIATION_SELECTORS.has(codepoint))
    .map((codepoint) => codepoint.toString(16));

  return codepoints.length > 0 ? codepoints.join('-') : null;
}

export function TwemojiIcon({
  emoji,
  className,
  title,
}: {
  emoji: string;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const codepoint = toTwemojiCodepoint(emoji);

  if (!codepoint || failed) {
    return (
      <span className={cn('inline-flex items-center justify-center leading-none', className)}>
        {emoji}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center justify-center leading-none', className)}>
      <img
        src={`${TWEMOJI_BASE_URL}/${codepoint}.svg`}
        alt={title ?? emoji}
        title={title}
        draggable={false}
        className="h-[1em] w-[1em]"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
