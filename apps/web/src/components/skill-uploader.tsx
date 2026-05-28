import { TwemojiIcon } from '@/components/twemoji-icon';
import { cn } from '@/lib/utils';
import { type SkillUploadIgnoredReason, getSkillUploadIgnoredPath } from '@mozia/skillhub-shared';
import { useRef, useState } from 'react';

// Type augmentation for HTMLInputElement to include webkitdirectory
type DirectoryInput = HTMLInputElement & { webkitdirectory?: boolean };

export interface SkillFromUpload {
  // SKILL.md content (root)
  skillMdContent: string;
  // Auxiliary files (relative paths). Empty for single-file upload.
  extras: SkillUploadExtra[];
  // Suggested slug from frontmatter `name:` or filename
  suggestedSlug?: string;
  // Suggested display name from frontmatter
  suggestedName?: string;
  // Suggested description from frontmatter
  suggestedDescription?: string;
  // Repository/system files skipped before upload.
  ignoredSystemFiles: Array<{ relPath: string; reason: SkillUploadIgnoredReason }>;
}

export interface SkillUploaderProps {
  onLoaded: (data: SkillFromUpload) => void;
  // When set, hides the "drop a folder" hint (e.g. on edit page where files
  // are already attached and we don't want to overwrite by accident).
  compact?: boolean;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB safety cap on a single upload bundle
const TEXT_FILE_RE = /\.(md|markdown|txt|json|ya?ml|toml|ts|tsx|js|jsx|py|sh|css|html)$/i;

export type SkillUploadExtra =
  | { kind: 'text'; path: string; content: string; size: number }
  | { kind: 'binary'; path: string; file: File; contentType: string; size: number };

function inferContentType(path: string, type?: string) {
  if (type) return type;
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
  };
  return (ext && map[ext]) || 'application/octet-stream';
}

function isTextUpload(path: string, type?: string) {
  const normalizedType = type?.split(';')[0]?.toLowerCase() ?? '';
  return (
    path.toLowerCase() === 'skill.md' ||
    TEXT_FILE_RE.test(path) ||
    normalizedType.startsWith('text/') ||
    normalizedType === 'application/json' ||
    normalizedType.endsWith('/xml')
  );
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error(`failed to read ${file.name}`));
    r.onload = () => resolve(r.result as string);
    r.readAsText(file);
  });
}

function parseFrontmatter(md: string): Record<string, string> {
  const lines = md.split('\n');
  if (lines[0] !== '---') return {};
  const out: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') break;
    if (!line || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) out[key] = val;
  }
  return out;
}

// Pure logic extracted for unit testing — given a list of file descriptors
// (path + name + size; content read on demand via readText), pick SKILL.md
// and bundle siblings as extras. No File / FileReader API dependency here.
export interface UploadFileLike {
  name: string;
  webkitRelativePath: string;
  size: number;
  type?: string;
  file?: File;
  readText: () => Promise<string>;
}

export interface PickResult {
  skillMd: UploadFileLike;
  skillMdRoot: string;
  extras: UploadFileLike[];
  ignoredSystemFiles: Array<{ relPath: string; reason: SkillUploadIgnoredReason }>;
  rejected: Array<{ relPath: string; reason: string }>;
}

export function pickSkillFromFiles(files: UploadFileLike[]): PickResult {
  if (files.length === 0) throw new Error('No files selected.');

  let skillMd: UploadFileLike | null = null;
  let skillMdRoot = '';
  const candidates: UploadFileLike[] = [];
  const ignoredSystemFiles: Array<{ relPath: string; reason: SkillUploadIgnoredReason }> = [];
  const rejected: Array<{ relPath: string; reason: string }> = [];

  for (const file of files) {
    const relPath = file.webkitRelativePath ?? '';
    const displayPath = relPath || file.name;
    const ignored = getSkillUploadIgnoredPath(displayPath);
    if (ignored.ignored) {
      ignoredSystemFiles.push({ relPath: displayPath, reason: ignored.reason });
      rejected.push({ relPath: displayPath, reason: ignored.reason });
      continue;
    }

    const segments = relPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      // Single-file mode (no folder context): only the file itself qualifies
      // as SKILL.md if it ends in .md.
      if (file.name.toLowerCase().endsWith('.md') && !skillMd) {
        skillMd = file;
      } else if (!file.name.toLowerCase().endsWith('.md')) {
        rejected.push({ relPath: file.name, reason: 'not a .md file' });
      }
      continue;
    }
    const fileName = segments[segments.length - 1] ?? '';

    if (fileName === 'SKILL.md') {
      const candidateRoot = segments.slice(0, -1).join('/');
      if (!skillMd || segments.length < skillMd.webkitRelativePath.split('/').length) {
        skillMd = file;
        skillMdRoot = candidateRoot;
      }
    } else {
      candidates.push(file);
    }
  }

  if (!skillMd) {
    throw new Error(
      'No SKILL.md found. Upload a single .md file or a folder containing SKILL.md at its root.',
    );
  }

  const rootPrefix = skillMdRoot ? `${skillMdRoot}/` : '';
  const extras: UploadFileLike[] = [];
  for (const c of candidates) {
    if (rootPrefix && !c.webkitRelativePath.startsWith(rootPrefix)) {
      rejected.push({ relPath: c.webkitRelativePath, reason: 'outside skill root' });
      continue;
    }
    const subPath = rootPrefix
      ? c.webkitRelativePath.slice(rootPrefix.length)
      : c.webkitRelativePath;
    if (!subPath || subPath.includes('..')) {
      rejected.push({ relPath: c.webkitRelativePath, reason: 'unsafe path' });
      continue;
    }
    const ignored = getSkillUploadIgnoredPath(subPath, { rootRelative: true });
    if (ignored.ignored) {
      ignoredSystemFiles.push({ relPath: c.webkitRelativePath, reason: ignored.reason });
      rejected.push({ relPath: c.webkitRelativePath, reason: ignored.reason });
      continue;
    }
    extras.push({ ...c, webkitRelativePath: subPath });
  }

  const totalBytes = [skillMd, ...extras].reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`上传文件总大小 ${(totalBytes / 1024).toFixed(0)} KB，已超过 5 MB 上限。`);
  }

  return { skillMd, skillMdRoot, extras, ignoredSystemFiles, rejected };
}

async function processFiles(files: File[]): Promise<SkillFromUpload> {
  const adapted: UploadFileLike[] = files.map((f) => ({
    name: f.name,
    webkitRelativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '',
    size: f.size,
    type: f.type,
    file: f,
    readText: () => readText(f),
  }));
  const picked = pickSkillFromFiles(adapted);

  const skillMdContent = await picked.skillMd.readText();
  const extras: SkillUploadExtra[] = [];
  for (const e of picked.extras) {
    if (isTextUpload(e.webkitRelativePath, e.type)) {
      extras.push({
        kind: 'text',
        path: e.webkitRelativePath,
        content: await e.readText(),
        size: e.size,
      });
    } else if (e.file) {
      extras.push({
        kind: 'binary',
        path: e.webkitRelativePath,
        file: e.file,
        contentType: inferContentType(e.webkitRelativePath, e.type),
        size: e.size,
      });
    }
  }

  const fm = parseFrontmatter(skillMdContent);
  const fmName = (fm.name ?? '').toLowerCase();
  const filenameStem = picked.skillMd.name.replace(/\.md$/i, '').toLowerCase();
  const folderName = picked.skillMdRoot.split('/').pop()?.toLowerCase() ?? '';

  const suggestedSlug =
    [fmName, folderName, filenameStem].find((s) => s && SLUG_RE.test(s)) ?? undefined;

  return {
    skillMdContent,
    extras,
    suggestedSlug,
    suggestedName: fm.name,
    suggestedDescription: fm.description,
    ignoredSystemFiles: picked.ignoredSystemFiles,
  };
}

export const __test__ = { parseFrontmatter, SLUG_RE, isTextUpload, inferContentType };

export function SkillUploader({ onLoaded, compact = false }: SkillUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<DirectoryInput>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    setBusy(true);
    try {
      const arr = Array.from(files);
      const data = await processFiles(arr);
      onLoaded(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取文件失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const items = e.dataTransfer.files;
    if (items && items.length > 0) handleFiles(items);
  };

  return (
    <div>
      <div
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
        className={cn(
          'border-2 border-dashed rounded-xl transition px-6 py-10 text-center',
          dragActive
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-neutral-300 hover:border-neutral-400',
        )}
      >
        <TwemojiIcon emoji="📁" className="mb-3 text-[48px] select-none" />
        <div className="text-[14px] font-medium text-[#0f172a] mb-1">
          {busy ? '读取中…' : '拖放 SKILL.md 或 Skill 文件夹到此处'}
        </div>
        {!compact && (
          <div className="text-[12px] text-neutral-500 mb-4">
            用文件快速开始一次发布：`.md` 会导入主说明，文件夹会把根目录 `SKILL.md`
            和同级文件一起带入。
          </div>
        )}
        <div className="relative inline-flex">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="text-[12px] uppercase tracking-[0.1em] px-4 py-2 border border-neutral-300 hover:border-neutral-900 rounded-l-lg transition disabled:opacity-50 font-medium"
          >
            选择文件
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => folderInputRef.current?.click()}
            className="text-[12px] uppercase tracking-[0.1em] px-4 py-2 border border-l-0 border-neutral-300 hover:border-neutral-900 hover:border-l rounded-r-lg transition disabled:opacity-50 font-medium"
          >
            文件夹
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error — webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <div className="mt-3 border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700 rounded-xl">
          {error}
        </div>
      )}
    </div>
  );
}
