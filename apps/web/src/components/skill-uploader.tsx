import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';

export interface SkillFromUpload {
  // SKILL.md content (root)
  skillMdContent: string;
  // Auxiliary files (relative paths, content). Empty for single-file upload.
  extras: Array<{ path: string; content: string }>;
  // Suggested slug from frontmatter `name:` or filename
  suggestedSlug?: string;
  // Suggested display name from frontmatter
  suggestedName?: string;
  // Suggested description from frontmatter
  suggestedDescription?: string;
}

export interface SkillUploaderProps {
  onLoaded: (data: SkillFromUpload) => void;
  // When set, hides the "drop a folder" hint (e.g. on edit page where files
  // are already attached and we don't want to overwrite by accident).
  compact?: boolean;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAX_TOTAL_BYTES = 1_000_000; // 1MB safety cap on a single upload bundle

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

// Type augmentation for HTMLInputElement to include webkitdirectory + webkitRelativePath
type DirectoryInput = HTMLInputElement & { webkitdirectory?: boolean };

async function processFiles(files: File[]): Promise<SkillFromUpload> {
  if (files.length === 0) throw new Error('No files selected.');

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`Total upload size ${(totalBytes / 1024).toFixed(0)} KB exceeds 1 MB cap.`);
  }

  // Identify SKILL.md. For folder upload, look at relative paths; pick the
  // shallowest one. For single-file upload, the file must end in .md and we
  // treat it as the SKILL.md.
  let skillMdFile: File | null = null;
  let skillMdRoot = '';
  const extrasRaw: Array<{ relPath: string; file: File }> = [];

  for (const file of files) {
    // webkitRelativePath is set when upload comes from a directory picker; for
    // drag-drop we'll set our own via processed FileSystemEntry API (not done
    // here for simplicity — drag-drop currently only supports flat files).
    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    const segments = relPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      // single file mode — the file itself is the upload. If it ends in .md, treat as SKILL.md.
      if (file.name.toLowerCase().endsWith('.md')) {
        if (!skillMdFile) {
          skillMdFile = file;
        }
      }
      continue;
    }

    // folder mode: skip non-content (dotfiles, .DS_Store, etc.)
    const fileName = segments[segments.length - 1] ?? '';
    if (fileName.startsWith('.')) continue;

    if (fileName === 'SKILL.md') {
      const depth = segments.length;
      const candidateRoot = segments.slice(0, -1).join('/');
      if (!skillMdFile || depth < skillMdFile.webkitRelativePath.split('/').length) {
        skillMdFile = file;
        skillMdRoot = candidateRoot;
      }
    } else {
      extrasRaw.push({ relPath, file });
    }
  }

  if (!skillMdFile) {
    throw new Error(
      'No SKILL.md found. Upload a single .md file or a folder containing SKILL.md at its root.',
    );
  }

  const skillMdContent = await readText(skillMdFile);

  // Filter extras to only those under the same root as SKILL.md
  const rootPrefix = skillMdRoot ? `${skillMdRoot}/` : '';
  const extras: Array<{ path: string; content: string }> = [];
  for (const e of extrasRaw) {
    if (rootPrefix && !e.relPath.startsWith(rootPrefix)) continue;
    const subPath = rootPrefix ? e.relPath.slice(rootPrefix.length) : e.relPath;
    if (!subPath || subPath.includes('..')) continue;
    extras.push({ path: subPath, content: await readText(e.file) });
  }

  const fm = parseFrontmatter(skillMdContent);
  const fmName = (fm.name ?? '').toLowerCase();
  const filenameStem = skillMdFile.name.replace(/\.md$/i, '').toLowerCase();
  const folderName = skillMdRoot.split('/').pop()?.toLowerCase() ?? '';

  const suggestedSlug =
    [fmName, folderName, filenameStem].find((s) => s && SLUG_RE.test(s)) ?? undefined;

  return {
    skillMdContent,
    extras,
    suggestedSlug,
    suggestedName: fm.name,
    suggestedDescription: fm.description,
  };
}

export function SkillUploader({ onLoaded, compact = false }: SkillUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
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
      setError(e instanceof Error ? e.message : 'failed to read files');
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
          'border-2 border-dashed transition px-6 py-8 text-center',
          dragActive
            ? 'border-neutral-900 bg-neutral-50'
            : 'border-neutral-300 hover:border-neutral-500',
        )}
      >
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500 mb-2">
          {busy ? 'reading…' : 'drop SKILL.md or skill folder here'}
        </div>
        {!compact && (
          <div className="font-mono text-[11px] text-neutral-400 mb-4">
            single .md file → fills SKILL.md · folder → SKILL.md at root + sibling files as extras
          </div>
        )}
        <div className="flex gap-2 items-center justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="font-mono text-[12px] uppercase tracking-[0.1em] px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 transition disabled:opacity-50"
          >
            pick file
          </button>
          <span className="text-neutral-300">|</span>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={busy}
            className="font-mono text-[12px] uppercase tracking-[0.1em] px-3 py-1.5 border border-neutral-300 hover:border-neutral-900 transition disabled:opacity-50"
          >
            pick folder
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
          ref={folderInputRef as React.RefObject<DirectoryInput>}
          type="file"
          // @ts-expect-error — webkitdirectory is non-standard but supported by Chromium / Firefox
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
        <div className="mt-3 border border-red-300 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
