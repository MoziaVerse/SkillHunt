import { cn } from '@/lib/utils';

const EMOJI_GROUPS = [
  {
    label: '发布与上线',
    items: ['🚀', '🎉', '✨', '🌟', '💡', '🔥', '📢', '🏆'],
  },
  {
    label: 'AI 与科技',
    items: ['🤖', '🧠', '💻', '🔬', '📡', '🎯', '⚡', '🔧'],
  },
  {
    label: '内容与写作',
    items: ['📝', '📄', '📋', '🗂️', '✏️', '📊', '📈'],
  },
  {
    label: '搜索与分析',
    items: ['🔍', '📊', '🧮', '🔎', '📉', '💹'],
  },
  {
    label: '效率与工具',
    items: ['⚡', '🛠️', '🔄', '⚙️', '🔗', '📦', '🎛️'],
  },
  {
    label: '沟通与协作',
    items: ['💬', '🤝', '📞', '💌', '📣'],
  },
];

export interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string | null) => void;
  disabled?: boolean;
}

export function EmojiPicker({ value, onChange, disabled = false }: EmojiPickerProps) {
  return (
    <div className={cn(disabled && 'opacity-40 pointer-events-none')}>
      <div className="flex flex-wrap gap-1.5">
        {EMOJI_GROUPS.flatMap((g) => g.items).map((emoji) => {
          const active = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              disabled={disabled}
              onClick={() => onChange(active ? null : emoji)}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-lg text-[20px] transition border',
                active
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-transparent hover:border-neutral-300 hover:bg-neutral-50',
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 text-[12px] text-neutral-500 hover:text-neutral-700 transition"
        >
          清除已选图标
        </button>
      )}
    </div>
  );
}
