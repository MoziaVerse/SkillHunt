import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-mono uppercase tracking-[0.08em] leading-none',
  {
    variants: {
      variant: {
        solid: 'bg-neutral-900 text-neutral-100',
        outline: 'border border-neutral-300 text-neutral-700 bg-white',
        subtle: 'bg-neutral-100 text-neutral-700',
        warn: 'border border-amber-400 text-amber-700 bg-amber-50',
      },
    },
    defaultVariants: { variant: 'solid' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
