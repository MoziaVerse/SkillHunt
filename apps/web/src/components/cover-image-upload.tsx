import { TwemojiIcon } from '@/components/twemoji-icon';
import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';

export interface CoverImageUploadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

const MAX_SIZE = 2_000_000;

export function CoverImageUpload({ value, onChange, disabled = false }: CoverImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('仅支持图片文件');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('图片大小不能超过 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className={cn(disabled && 'opacity-40 pointer-events-none')}>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="封面预览"
            className="w-full h-32 object-cover rounded-xl border border-neutral-200"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-[12px] px-3 py-1.5 bg-white text-neutral-800 rounded-lg hover:bg-neutral-100 transition"
            >
              更换
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[12px] px-3 py-1.5 bg-white text-red-700 rounded-lg hover:bg-red-50 transition"
            >
              清除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition',
            dragActive
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-neutral-300 hover:border-neutral-400',
          )}
        >
          <TwemojiIcon emoji="🖼️" className="mb-1 text-[28px]" />
          <div className="text-[13px] text-neutral-600">点击或拖放上传封面图</div>
          <div className="text-[11px] text-neutral-400 mt-1">
            建议 1200×630，JPG/PNG/WebP，不超过 2MB
          </div>
        </button>
      )}
      {error && <div className="mt-2 text-[12px] text-red-600">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
