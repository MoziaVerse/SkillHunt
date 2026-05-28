import { MarkdownView } from '@/components/markdown-view';
import type { SkillUploadExtra } from '@/components/skill-uploader';
import { TwemojiIcon } from '@/components/twemoji-icon';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';

// ─── Shared tree types & helpers (same logic as skill-detail.tsx) ─────

type FileTreeNode =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'folder'; name: string; path: string; children: FileTreeNode[] };

function isTextPreviewable(path: string) {
  return /\.(md|txt|ts|tsx|js|jsx|json|yaml|yml|toml|css|html|py|sh)$/i.test(path);
}

function sortFiles(files: string[]) {
  return [...files].sort((a, b) => {
    if (a === 'SKILL.md') return -1;
    if (b === 'SKILL.md') return 1;
    return a.localeCompare(b, 'zh-CN');
  });
}

function buildFileTree(files: string[]): FileTreeNode[] {
  type FileLeaf = Extract<FileTreeNode, { kind: 'file' }>;
  type MutableFolder = {
    nodeType: 'mutable-folder';
    name: string;
    path: string;
    children: Map<string, MutableFolder | FileLeaf>;
  };

  const root: MutableFolder = {
    nodeType: 'mutable-folder',
    name: '',
    path: '',
    children: new Map(),
  };

  for (const file of sortFiles(files)) {
    const parts = file.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join('/');

      if (isLeaf) {
        current.children.set(currentPath, {
          kind: 'file',
          name: part,
          path: currentPath,
        } satisfies FileLeaf);
        return;
      }

      const existing = current.children.get(currentPath);
      if (existing && 'nodeType' in existing) {
        current = existing;
        return;
      }

      const nextFolder: MutableFolder = {
        nodeType: 'mutable-folder',
        name: part,
        path: currentPath,
        children: new Map(),
      };
      current.children.set(currentPath, nextFolder);
      current = nextFolder;
    });
  }

  const finalize = (folder: MutableFolder): FileTreeNode[] => {
    return [...folder.children.values()]
      .map(
        (node): FileTreeNode =>
          'nodeType' in node
            ? { kind: 'folder', name: node.name, path: node.path, children: finalize(node) }
            : node,
      )
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        if (a.kind === 'file' && b.kind === 'file') {
          if (a.path === 'SKILL.md') return -1;
          if (b.path === 'SKILL.md') return 1;
        }
        return a.name.localeCompare(b.name, 'zh-CN');
      });
  };

  return finalize(root);
}

function collectFolderPaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === 'folder' ? [node.path, ...collectFolderPaths(node.children)] : [],
  );
}

// ─── Component ─────────────────────────────────────────────────────────

export interface UploadFileData {
  /** Relative file path */
  path: string;
  /** File content */
  content: string;
}

export interface SkillUploadPreviewProps {
  /** SKILL.md content */
  skillMdContent: string;
  /** Additional files */
  extras: SkillUploadExtra[];
  /** Repository/system files skipped before upload */
  ignoredSystemFileCount?: number;
}

export function SkillUploadPreview({
  skillMdContent,
  extras,
  ignoredSystemFileCount = 0,
}: SkillUploadPreviewProps) {
  // All files: SKILL.md + extras
  const allFiles = useMemo(() => {
    const paths = ['SKILL.md', ...extras.map((e) => e.path)];
    return sortFiles(paths);
  }, [extras]);

  // Content map for quick lookup
  const fileMap = useMemo(() => {
    const map = new Map<
      string,
      SkillUploadExtra | { kind: 'text'; path: string; content: string }
    >();
    map.set('SKILL.md', { kind: 'text', path: 'SKILL.md', content: skillMdContent });
    for (const e of extras) {
      map.set(e.path, e);
    }
    return map;
  }, [skillMdContent, extras]);

  const fileTree = useMemo(() => buildFileTree(allFiles), [allFiles]);
  const [activeFile, setActiveFile] = useState('SKILL.md');
  const [expandedFolders, setExpandedFolders] = useState<Set<string> | null>(null);
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;
    setExpandedFolders(new Set(collectFolderPaths(fileTree)));
  }

  const activeData = fileMap.get(activeFile);
  const content = activeData?.kind === 'text' ? activeData.content : undefined;
  const previewable = isTextPreviewable(activeFile);
  const imagePreviewable =
    activeData?.kind === 'binary' && activeData.contentType.toLowerCase().startsWith('image/');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imagePreviewable || activeData?.kind !== 'binary') {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(activeData.file);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeData, imagePreviewable]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderTree = (nodes: FileTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      if (node.kind === 'folder') {
        const expanded = expandedFolders?.has(node.path) ?? false;
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-neutral-700 transition hover:bg-neutral-50"
              style={{ paddingLeft: `${16 + depth * 18}px` }}
            >
              <span className="w-4 text-center text-[11px] text-neutral-400">
                {expanded ? '▾' : '▸'}
              </span>
              <TwemojiIcon emoji="📁" className="text-[14px]" />
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {expanded ? <ul className="pb-1">{renderTree(node.children, depth + 1)}</ul> : null}
          </li>
        );
      }

      const isActive = activeFile === node.path;
      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => setActiveFile(node.path)}
            className={cn(
              'w-full py-2.5 pr-4 text-left text-[13px] transition',
              isActive ? 'bg-emerald-50 text-emerald-800' : 'text-neutral-700 hover:bg-neutral-50',
            )}
            style={{ paddingLeft: `${38 + depth * 18}px` }}
          >
            <div className="flex items-center gap-2">
              <TwemojiIcon
                emoji={
                  node.path.endsWith('.md')
                    ? '📝'
                    : /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(node.path)
                      ? '🖼️'
                      : '📄'
                }
                className="text-[14px]"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{node.name}</div>
              </div>
            </div>
          </button>
        </li>
      );
    });
  };

  return (
    <div className="space-y-4">
      {ignoredSystemFileCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          已忽略 {ignoredSystemFileCount} 个仓库/系统文件，未计入 5 MB 上传大小。
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex max-h-[720px] min-h-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <div className="text-[12px] font-semibold text-neutral-700">
              文件树 · {allFiles.length}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto py-2">{renderTree(fileTree)}</ul>
        </aside>

        <section className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between gap-3">
            <div>
              <div className="text-[16px] font-semibold text-neutral-900">{activeFile}</div>
              <div className="mt-1 text-[12px] text-neutral-500">
                {previewable ? '可在线预览' : imagePreviewable ? '图片资源' : '二进制附件'}
              </div>
            </div>
          </div>
          <div className="px-5 py-5">
            {previewable && content !== undefined ? (
              activeFile.endsWith('.md') ? (
                <MarkdownView source={content} />
              ) : (
                <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
                  {content}
                </pre>
              )
            ) : imagePreviewUrl ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <img
                  src={imagePreviewUrl}
                  alt={activeFile}
                  className="max-h-[520px] w-full object-contain"
                />
                {activeData?.kind === 'binary' ? (
                  <div className="mt-3 text-center text-[12px] text-neutral-500">
                    {activeData.contentType} · {(activeData.size / 1024).toFixed(0)} KB
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-[14px] text-neutral-500">
                <div className="font-medium text-neutral-700">{activeFile}</div>
                <p className="mt-2">
                  {activeData?.kind === 'binary'
                    ? '这个文件会作为二进制附件上传。'
                    : '这个文件暂不支持在线预览。'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
