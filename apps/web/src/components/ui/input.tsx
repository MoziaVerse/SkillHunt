import { cn } from '@/lib/utils';
import * as React from 'react';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-9 w-full border border-neutral-300 bg-white px-3 py-2 font-mono text-[13.5px] placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
