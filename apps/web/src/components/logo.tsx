import { cn } from '@/lib/utils';

export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-label="SkillHunt"
      className={cn('brand-wordmark inline-block leading-none select-none', className)}
      style={{ fontSize: `${size}px` }}
    >
      SKILLHUNT
    </span>
  );
}
