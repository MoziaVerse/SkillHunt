import { useRef, useState } from 'react';

interface AvatarProps {
  src: string | null | undefined;
  name: string;
  handle?: string;
  size?: number;
  editable?: boolean;
  onUpload?: (dataUrl: string) => void;
}

const MOZIA_ICON = '/icons/mozia.svg';

export function Avatar({ src, name, handle, size = 32, editable = false, onUpload }: AvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 1_500_000) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onUpload?.(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isMozia = handle === 'mozia';
  const effectiveSrc = src ?? (isMozia ? MOZIA_ICON : null);

  return (
    <div
      className="relative shrink-0 rounded-xl overflow-hidden"
      style={{ width: size, height: size }}
      onMouseEnter={() => editable && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {effectiveSrc ? (
        <img src={effectiveSrc} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex items-center justify-center font-bold text-emerald-700 select-none"
          style={{ fontSize: Math.max(12, Math.round(size * 0.4)) }}
        >
          {name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      )}

      {editable && hover && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[11px] font-medium transition"
        >
          更换
        </button>
      )}

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      )}
    </div>
  );
}
