import { InstallCommand } from '@/components/install-command';
import { Logo } from '@/components/logo';
import { MarkdownView } from '@/components/markdown-view';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SkillComment, SkillDetail, UpstreamStatus } from '@/types/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

type DetailTab = 'overview' | 'files' | 'releases' | 'install' | 'discussion';

type SkillStatsPatch = Pick<
  SkillDetail,
  'upvoteCount' | 'commentCount' | 'bookmarkCount' | 'viewerHasUpvoted'
>;

function isTextPreviewable(path: string) {
  return /\.(md|txt|ts|tsx|js|jsx|json|yaml|yml|toml|css|html|py|sh)$/i.test(path);
}

function isDirectVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isManagedOssVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.includes('/skillhunt-videos/skillhunt/videos/');
  } catch {
    return false;
  }
}

function shouldPreviewDemoVideo(value: string) {
  return isManagedOssVideoUrl(value) || isDirectVideoUrl(value);
}

function sortFiles(files: string[]) {
  return [...files].sort((a, b) => {
    if (a === 'SKILL.md') return -1;
    if (b === 'SKILL.md') return 1;
    return a.localeCompare(b, 'zh-CN');
  });
}

type FileTreeNode =
  | {
      kind: 'file';
      name: string;
      path: string;
    }
  | {
      kind: 'folder';
      name: string;
      path: string;
      children: FileTreeNode[];
    };

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
            ? {
                kind: 'folder',
                name: node.name,
                path: node.path,
                children: finalize(node),
              }
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

function buildReleaseTimeline(skill: SkillDetail) {
  const created = new Date(skill.createdAt);
  const updated = new Date(skill.updatedAt);
  const nearlySame = Math.abs(updated.getTime() - created.getTime()) < 5 * 60 * 1000;

  const items = [
    {
      key: 'created',
      title: '首次发布',
      date: skill.createdAt,
      body: '已发布到 SkillHunt，开始支持安装与讨论。',
    },
  ];

  if (!nearlySame) {
    items.push({
      key: 'updated',
      title: '最近更新',
      date: skill.updatedAt,
      body: 'Skill 内容已更新，建议重新查看文件与安装说明。',
    });
  }

  return items;
}

function Breadcrumb({ skill }: { skill: SkillDetail }) {
  return (
    <nav className="px-6 py-3 border-b border-neutral-100 bg-white">
      <div className="mx-auto max-w-[1200px] flex items-center gap-1.5 text-[13px]">
        <Link to="/" className="text-neutral-500 hover:text-neutral-900 transition">
          <Logo size={16} className="text-neutral-900" />
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-neutral-900 font-medium">{skill.name}</span>
      </div>
    </nav>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 py-3 border-b border-neutral-100 last:border-b-0">
      <span className="text-[12px] uppercase tracking-[0.1em] text-neutral-400 w-24 shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-neutral-800 break-all">{children}</span>
    </div>
  );
}

function CommunityStats({
  skill,
  onUpvoteClick,
  onBookmarkClick,
  onCommentClick,
}: {
  skill: SkillDetail;
  onUpvoteClick: () => void;
  onBookmarkClick: () => void;
  onCommentClick: () => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-3 flex-wrap text-[13px] text-neutral-600">
      <button
        type="button"
        onClick={onUpvoteClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition',
          skill.viewerHasUpvoted
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:text-emerald-800'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
        )}
      >
        <span>▲</span>
        <span>{skill.upvoteCount} 人点赞</span>
      </button>
      <button
        type="button"
        onClick={onBookmarkClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition',
          skill.viewerHasBookmarked
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:text-emerald-800'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
        )}
      >
        <span>{skill.viewerHasBookmarked ? '🔖' : '📑'}</span>
        <span>{skill.bookmarkCount} 人收藏</span>
      </button>
      <button
        type="button"
        onClick={onCommentClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 transition hover:border-neutral-300 hover:text-neutral-900"
      >
        <span>💬</span>
        <span>{skill.commentCount} 条评论</span>
      </button>
    </div>
  );
}

function ForkButton({
  me,
  onFork,
}: {
  me: MeResponse | null;
  onFork: () => Promise<void>;
}) {
  const [forking, setForking] = useState(false);

  return (
    <button
      type="button"
      disabled={forking}
      onClick={async () => {
        if (!me) {
          window.alert('登录后才能 Fork。');
          return;
        }
        const confirmed = window.confirm(
          '这会把当前 Skill 复制到你的账号下，默认保存为私有副本。是否继续？',
        );
        if (!confirmed) return;
        setForking(true);
        try {
          await onFork();
        } finally {
          setForking(false);
        }
      }}
      className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-[13px] font-medium text-neutral-700 rounded-lg transition disabled:opacity-50"
    >
      {forking ? 'Fork 中…' : 'Fork 到我的账号'}
    </button>
  );
}

function OwnerActions({
  owner,
  slug,
  onDeleted,
}: {
  owner: string;
  slug: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex gap-2 items-center">
      <Link
        to={`/skills/${owner}/${slug}/edit`}
        className="font-mono text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 border border-neutral-300 hover:border-neutral-900 transition rounded-lg"
      >
        编辑
      </Link>
      <button
        type="button"
        onClick={async () => {
          if (!window.confirm(`确认删除 ${owner}/${slug} 吗？此操作无法撤销。`)) return;
          setBusy(true);
          try {
            await apiClient.deleteSkill(owner, slug);
            onDeleted();
          } catch (err) {
            window.alert(err instanceof Error ? err.message : '删除失败');
            setBusy(false);
          }
        }}
        disabled={busy}
        className="font-mono text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 border border-red-300 text-red-700 hover:border-red-700 transition disabled:opacity-50 rounded-lg"
      >
        {busy ? '…' : '删除'}
      </button>
    </div>
  );
}

function TabNav({
  active,
  onChange,
}: {
  active: DetailTab;
  onChange: (v: DetailTab) => void;
}) {
  const tabs: Array<{ key: DetailTab; label: string; icon: string }> = [
    { key: 'overview', label: '概览', icon: '📖' },
    { key: 'files', label: '文件', icon: '📁' },
    { key: 'install', label: '安装', icon: '⬇️' },
    { key: 'discussion', label: '评论', icon: '💬' },
    { key: 'releases', label: '版本发布', icon: '🕒' },
  ];

  return (
    <div className="sticky top-[58px] z-10 border-b border-neutral-200 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-[1200px] items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'px-4 py-3 text-[13px] font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap',
              active === tab.key
                ? 'border-emerald-500 text-[#0f172a]'
                : 'border-transparent text-neutral-500 hover:text-neutral-700',
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrivateInstallSection({
  skill,
  me,
  onFork,
}: {
  skill: Extract<SkillDetail, { type: 'owned' }>;
  me: MeResponse | null;
  onFork: () => Promise<void>;
}) {
  const [grant, setGrant] = useState<{
    installCommand: string;
    expiresAt: string;
    maxUses: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-3xl bg-gradient-to-br  from-amber-50 to-white  p-6 shadow-sm shadow-amber-100/70">
      <div id="install-section" className="scroll-mt-24">
        <h2 className="text-[20px] font-semibold text-amber-950">安装使用</h2>
        <p className="mt-2 text-[14px] leading-7 text-amber-900">
          这是一个私有 Skill。你可以在这里生成一次性安装命令，分享给需要访问的人。
        </p>
      </div>
      <div className="mt-5">
        {grant ? (
          <>
            <InstallCommand command={grant.installCommand} />
            <p className="mt-2 text-[12px] text-amber-800">
              Token 过期时间：{new Date(grant.expiresAt).toLocaleString()} · 可用次数：
              {grant.maxUses}
            </p>
          </>
        ) : (
          <div>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  const result = await apiClient.mintInstallToken({
                    skillId: skill.id,
                    expiresInHours: 24,
                    maxUses: 1,
                  });
                  setGrant(result);
                } catch (err) {
                  setError(err instanceof Error ? err.message : '生成失败');
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {busy ? '生成中…' : '生成一次性安装命令'}
            </button>
            {error && <p className="mt-3 text-[12px] text-red-700">{error}</p>}
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <ForkButton me={me} onFork={onFork} />
      </div>
    </section>
  );
}

function PublicInstallSection({
  skill,
  me,
  onFork,
}: {
  skill: SkillDetail;
  me: MeResponse | null;
  onFork: () => Promise<void>;
}) {
  const installCommand = skill.type === 'owned' ? skill.installCommand : skill.sourceInstallCommand;
  const [tab, setTab] = useState<'agent' | 'human'>('agent');

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm shadow-neutral-100/80 border border-neutral-200">
      <div id="install-section" className="scroll-mt-24">
        <h2 className="text-[20px] font-semibold text-[#0f172a]">安装使用</h2>
        <p className="mt-2 text-[14px] text-[#64748b] leading-7">
          先把这个 Skill 安装到你的工作流里，再按需继续 Fork、修改或补充文件。
        </p>
      </div>

      <div className="mt-5 flex divide-x divide-neutral-200 rounded-xl overflow-hidden bg-neutral-100 w-fit">
        {(['agent', 'human'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setTab(mode)}
            className={cn(
              'px-4 py-2 text-[12px] font-medium transition',
              tab === mode
                ? 'bg-neutral-900 text-white'
                : 'bg-transparent text-neutral-600 hover:text-neutral-900',
            )}
          >
            {mode === 'agent' ? '面向 Agent' : '面向人工'}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <InstallCommand command={installCommand} />
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(installCommand)}
          className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-[13px] font-medium text-neutral-700 rounded-lg transition"
        >
          复制命令
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-[13px] font-medium text-neutral-700 rounded-lg transition"
        >
          分享 Skill
        </button>
        <ForkButton me={me} onFork={onFork} />
      </div>
    </section>
  );
}

function AboutSection({ skill }: { skill: SkillDetail }) {
  return (
    <section className="rounded-3xl bg-white border border-neutral-200 p-6 shadow-sm shadow-neutral-100/80">
      <div className="text-[12px] font-semibold  uppercase tracking-[0.16em] text-emerald-700">
        关于这个 Skill
      </div>
      <p className="mt-3 text-[17px] leading-8 text-neutral-700">{skill.description}</p>
      <div className="mt-6 pt-1">
        {skill.type === 'owned' ? (
          <MarkdownView source={skill.skillMdContent} />
        ) : (
          <div className="rounded-2xl bg-neutral-50 px-5 py-4 text-[14px] leading-7 text-neutral-600">
            这是一个引用 Skill。SkillHunt 帮你完成发现、安装和
            Fork，但完整实现和后续更新仍以原始来源为准。
          </div>
        )}
      </div>
    </section>
  );
}

function ReleaseTimeline({
  skill,
  compact = false,
  onViewAll,
}: {
  skill: SkillDetail;
  compact?: boolean;
  onViewAll?: () => void;
}) {
  const items = buildReleaseTimeline(skill);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm shadow-neutral-100/80 border border-neutral-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#0f172a]">
            {compact ? '版本发布预览' : '版本发布'}
          </h2>
          <p className="mt-1 text-[14px] text-neutral-500">
            先用轻量时间线展示这个 Skill 在 SkillHunt 上的发布轨迹。
          </p>
        </div>
        {compact && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[13px] font-medium text-emerald-700 hover:text-emerald-900"
          >
            查看完整发布记录
          </button>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div key={item.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-emerald-500" />
              {index < items.length - 1 && (
                <span className="mt-2 h-full min-h-[56px] w-px bg-neutral-200" />
              )}
            </div>
            <div className="flex-1 rounded-2xl bg-neutral-50 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[16px] font-semibold text-neutral-900">{item.title}</div>
                <time className="text-[12px] text-neutral-500">{formatRelative(item.date)}</time>
              </div>
              <div className="mt-2 text-[13px] text-neutral-500">发布者 @{skill.owner.handle}</div>
              <p className="mt-3 text-[14px] leading-7 text-neutral-700">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilePreviewPane({
  owner,
  slug,
  files,
  initialContent,
}: {
  owner: string;
  slug: string;
  files: string[];
  initialContent?: string;
}) {
  const orderedFiles = useMemo(() => sortFiles(files), [files]);
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const initialFile = orderedFiles[0] ?? 'SKILL.md';
  const [activeFile, setActiveFile] = useState(initialFile);
  const [content, setContent] = useState<string | null>(initialContent ?? null);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string> | null>(null);
  const initialized = useRef(false);

  // Initialize expanded folders only once on first render
  if (!initialized.current) {
    initialized.current = true;
    setExpandedFolders(new Set(collectFolderPaths(fileTree)));
  }

  useEffect(() => {
    const first = orderedFiles[0] ?? 'SKILL.md';
    setActiveFile(first);
    setContent(first === 'SKILL.md' ? (initialContent ?? null) : null);
    setLoading(false);
  }, [initialContent, orderedFiles]);

  const previewable = isTextPreviewable(activeFile);

  const loadFile = async (file: string) => {
    setActiveFile(file);
    if (file === 'SKILL.md') {
      setContent(initialContent ?? null);
      setLoading(false);
      return;
    }
    if (!isTextPreviewable(file)) {
      setContent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await apiClient.getSkillFile(owner, slug, file);
      setContent(next);
    } catch {
      setContent(null);
    } finally {
      setLoading(false);
    }
  };

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
              <span className="text-[14px]">📁</span>
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
            onClick={() => void loadFile(node.path)}
            className={cn(
              'w-full py-2.5 pr-4 text-left text-[13px] transition',
              isActive ? 'bg-emerald-50 text-emerald-800' : 'text-neutral-700 hover:bg-neutral-50',
            )}
            style={{ paddingLeft: `${38 + depth * 18}px` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[14px]">{node.path.endsWith('.md') ? '📝' : '📄'}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{node.name}</div>
                {!isTextPreviewable(node.path) && (
                  <div className="mt-1 text-[11px] text-neutral-400">不支持在线预览</div>
                )}
              </div>
            </div>
          </button>
        </li>
      );
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex max-h-[720px] min-h-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white">
        <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
          <div className="text-[12px] font-semibold text-neutral-700">
            文件树 · {orderedFiles.length}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto py-2">{renderTree(fileTree)}</ul>
      </aside>

      <section className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold text-neutral-900">{activeFile}</div>
            <div className="mt-1 text-[12px] text-neutral-500">
              {previewable ? '可在线预览' : '当前文件仅展示文件名'}
            </div>
          </div>
        </div>
        <div className="px-5 py-5">
          {loading ? (
            <div className="text-[13px] text-neutral-500">加载中…</div>
          ) : !previewable ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-[14px] text-neutral-500">
              <div className="font-medium text-neutral-700">{activeFile}</div>
              <p className="mt-2">
                这个文件暂不支持在线预览，你可以 Fork 后在自己的 Skill 中继续编辑。
              </p>
            </div>
          ) : content !== null ? (
            activeFile.endsWith('.md') ? (
              <MarkdownView source={content} />
            ) : (
              <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
                {content}
              </pre>
            )
          ) : (
            <div className="text-[13px] text-red-600">文件加载失败。</div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusSidebar({
  skill,
  onOpenFiles,
}: {
  skill: SkillDetail;
  onOpenFiles: () => void;
}) {
  const files = skill.type === 'owned' ? sortFiles(skill.files).slice(0, 5) : [];

  return (
    <aside className="lg:sticky lg:top-[126px] lg:self-start">
      <div className="rounded-3xl border border-neutral-200 overflow-hidden bg-white">
        <div className="px-5 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            信息面板
          </div>
        </div>

        <div className="border-t border-neutral-100 px-5 py-3">
          <div className="text-[12px] font-semibold text-neutral-700">发布信息</div>
        </div>
        <div className="px-5 py-1">
          <MetaRow label="类型">{skill.type === 'owned' ? '自有' : '引用'}</MetaRow>
          {'visibility' in skill ? (
            <MetaRow label="可见性">{skill.visibility === 'public' ? '公开' : '私有'}</MetaRow>
          ) : null}
          <MetaRow label="标识">{skill.slug}</MetaRow>
          <MetaRow label="创建">{formatRelative(skill.createdAt)}</MetaRow>
          <MetaRow label="更新">{formatRelative(skill.updatedAt)}</MetaRow>
        </div>

        <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between gap-3">
          <div className="text-[12px] font-semibold text-neutral-700">文件概况</div>
          <button
            type="button"
            onClick={onOpenFiles}
            className="text-[12px] font-medium text-emerald-700 hover:text-emerald-900"
          >
            查看全部
          </button>
        </div>
        {skill.type === 'owned' ? (
          <div className="px-5 pb-5">
            <div className="text-[13px] text-neutral-700">{skill.files.length} 个文件</div>
            <ul className="mt-3 space-y-2">
              {files.map((file) => (
                <li key={file} className="truncate text-[13px] text-neutral-500">
                  {file}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="px-5 pb-5 text-[13px] text-neutral-500">
            引用 Skill 暂不在站内展示完整文件列表。
          </div>
        )}

        <div className="border-t border-neutral-100 px-5 py-3">
          <div className="text-[12px] font-semibold text-neutral-700">
            {skill.type === 'referenced' ? '来源信息' : '状态'}
          </div>
        </div>
        <div className="px-5 pb-5">
          {skill.type === 'referenced' ? (
            <>
              <div className="text-[13px] text-neutral-700">来源仓库：{skill.sourceRepo}</div>
              <div className="mt-2 text-[13px] text-neutral-700">
                原始 Skill：{skill.sourceSkillName}
              </div>
              {skill.sourceUrl ? (
                <a
                  href={skill.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center text-[13px] font-medium text-emerald-700 hover:text-emerald-900"
                >
                  查看原始来源
                </a>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
                可 Fork
              </span>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-700">
                可安装
              </span>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-700">
                {skill.visibility === 'public' ? '公开发布' : '私有发布'}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function CommentsSection({
  skill,
  me,
  onCommentCreated,
}: {
  skill: SkillDetail;
  me: MeResponse | null;
  onCommentCreated: () => void;
}) {
  const [comments, setComments] = useState<SkillComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .listSkillComments(skill.owner.handle, skill.slug)
      .then((res) => {
        if (!cancelled) setComments(res.items);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [skill.owner.handle, skill.slug]);

  // 构建评论树
  const commentTree = useMemo(() => {
    const rootComments: SkillComment[] = [];
    const childrenMap = new Map<string, SkillComment[]>();

    for (const comment of comments) {
      if (comment.parentId) {
        const children = childrenMap.get(comment.parentId) || [];
        children.push(comment);
        childrenMap.set(comment.parentId, children);
      } else {
        rootComments.push(comment);
      }
    }

    return { rootComments, childrenMap };
  }, [comments]);

  const submitTopLevel = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiClient.createSkillComment(skill.owner.handle, skill.slug, {
        content: draft.trim(),
      });
      setComments((prev) => [created, ...prev]);
      setDraft('');
      onCommentCreated();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '发表评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (parentId: string) => {
    if (!replyDraft.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiClient.createSkillComment(skill.owner.handle, skill.slug, {
        content: replyDraft.trim(),
        parentId,
      });
      setComments((prev) => [...prev, created]);
      setReplyDraft('');
      setReplyingTo(null);
      onCommentCreated();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '发表回复失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="comments-section"
      className="rounded-3xl bg-white p-6 shadow-sm shadow-neutral-100/80 border border-neutral-200"
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] font-semibold text-[#0f172a]">评论</h2>
          <p className="text-[14px] text-neutral-500 mt-1">
            围绕这次发布留下反馈、建议和使用体验。
          </p>
        </div>
        <div className="text-[12px] text-neutral-500">{skill.commentCount} 条评论</div>
      </div>

      <div className="rounded-2xl bg-neutral-50 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={me ? '写下你对这个 Skill 的看法…' : '登录后可以参与评论'}
          disabled={!me || submitting}
          className="min-h-[110px] w-full resize-y rounded-xl bg-white px-4 py-3 text-[14px] text-neutral-800 outline-none ring-1 ring-inset ring-neutral-100 focus:ring-2 focus:ring-emerald-200 disabled:bg-neutral-100"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12px] text-neutral-500">
            {me ? '你的评论会公开展示在这个 Skill 页面中。' : '请先登录再发表评论。'}
          </span>
          <button
            type="button"
            disabled={!me || submitting || !draft.trim()}
            onClick={submitTopLevel}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {submitting ? '发布中…' : '发表评论'}
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-6 text-[13px] text-neutral-500 text-center">评论加载中…</div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-[13px] text-neutral-500 text-center">
            还没有评论，来发表第一条看法吧。
          </div>
        ) : (
          <div className="space-y-4">
            {commentTree.rootComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                childComments={commentTree.childrenMap.get(comment.id) || []}
                childrenMap={commentTree.childrenMap}
                me={me}
                replyingTo={replyingTo}
                replyDraft={replyDraft}
                onReplyDraftChange={setReplyDraft}
                onReply={submitReply}
                onSetReplyingTo={setReplyingTo}
                submitting={submitting}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CommentThread({
  comment,
  childComments,
  childrenMap,
  me,
  replyingTo,
  replyDraft,
  onReplyDraftChange,
  onReply,
  onSetReplyingTo,
  submitting,
  depth = 0,
}: {
  comment: SkillComment;
  childComments: SkillComment[];
  childrenMap: Map<string, SkillComment[]>;
  me: MeResponse | null;
  replyingTo: string | null;
  replyDraft: string;
  onReplyDraftChange: (v: string) => void;
  onReply: (parentId: string) => Promise<void>;
  onSetReplyingTo: (id: string | null) => void;
  submitting: boolean;
  depth?: number;
}) {
  const isReplying = replyingTo === comment.id;
  const childIndentClass = cn(
    'mt-4 pl-3 border-l-2 border-neutral-200 space-y-4',
    depth < 2 && 'ml-4',
  );

  return (
    <div className="rounded-2xl bg-neutral-50 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-neutral-900">{comment.author.name}</span>
          <span className="ml-1.5 text-[12px] text-neutral-500">@{comment.author.handle}</span>
        </div>
        <time className="text-[12px] text-neutral-500 shrink-0">
          {formatRelative(comment.createdAt)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-neutral-700">
        {comment.content}
      </p>
      {me && (
        <button
          type="button"
          onClick={() => onSetReplyingTo(isReplying ? null : comment.id)}
          className="mt-2 text-[12px] text-neutral-500 hover:text-neutral-700 transition"
        >
          回复
        </button>
      )}
      {isReplying && (
        <div className="mt-3 ml-4 pl-3 border-l-2 border-emerald-200">
          <div className="rounded-xl bg-white p-3">
            <textarea
              value={replyDraft}
              onChange={(e) => onReplyDraftChange(e.target.value)}
              placeholder={`回复 @${comment.author.name}…`}
              disabled={submitting}
              className="min-h-[70px] w-full resize-y rounded-lg bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 outline-none ring-1 ring-inset ring-neutral-100 focus:ring-2 focus:ring-emerald-200 disabled:bg-neutral-100"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetReplyingTo(null);
                  onReplyDraftChange('');
                }}
                className="px-3 py-1.5 text-[12px] text-neutral-600 hover:text-neutral-800 transition"
              >
                取消
              </button>
              <button
                type="button"
                disabled={submitting || !replyDraft.trim()}
                onClick={() => onReply(comment.id)}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              >
                {submitting ? '发布中…' : '发表回复'}
              </button>
            </div>
          </div>
        </div>
      )}
      {childComments.length > 0 && (
        <div className={childIndentClass}>
          {childComments.map((child) => (
            <CommentThread
              key={child.id}
              comment={child}
              childComments={childrenMap.get(child.id) || []}
              childrenMap={childrenMap}
              me={me}
              replyingTo={replyingTo}
              replyDraft={replyDraft}
              onReplyDraftChange={onReplyDraftChange}
              onReply={onReply}
              onSetReplyingTo={onSetReplyingTo}
              submitting={submitting}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ForkAndSyncSection({
  skill,
  me,
  isOwner,
  onFork,
}: {
  skill: SkillDetail;
  me: MeResponse | null;
  isOwner: boolean;
  onFork: () => Promise<void>;
}) {
  const [status, setStatus] = useState<UpstreamStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const nextStatus = await apiClient.getUpstreamStatus(skill.owner.handle, skill.slug);
    setStatus(nextStatus);
  };

  useEffect(() => {
    let cancelled = false;
    apiClient.getUpstreamStatus(skill.owner.handle, skill.slug).then((nextStatus) => {
      if (cancelled) return;
      setStatus(nextStatus);
    });
    return () => {
      cancelled = true;
    };
  }, [skill.owner.handle, skill.slug]);

  const subscriptionTarget =
    status?.isFork && status.upstream
      ? { owner: status.upstream.owner.handle, slug: status.upstream.slug }
      : { owner: skill.owner.handle, slug: skill.slug };
  const subscription = status?.subscription;

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm shadow-neutral-100/80 border border-neutral-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[#0f172a]">
            {isOwner ? 'Fork 管理' : 'Fork 与同步'}
          </h2>
          <p className="mt-2 text-[14px] leading-7 text-neutral-500">
            {isOwner
              ? '管理你的 Fork，同步上游更新，或查看下游 Fork。'
              : 'Fork 后可以自己修改，也可以订阅并同步上游更新。'}
          </p>
        </div>
        {status?.isFork && status.hasUpdate ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-700">
            上游有更新
          </span>
        ) : null}
      </div>

      {!isOwner && (
        <div className="mt-5">
          <ForkButton me={me} onFork={onFork} />
        </div>
      )}

      {!status ? (
        <div className="mt-6 text-[13px] text-neutral-500">加载中…</div>
      ) : status.isFork ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl bg-neutral-50 p-5 text-[14px] text-neutral-700">
            {status.upstream ? (
              <>
                Fork 自{' '}
                <Link
                  to={`/skills/${status.upstream.owner.handle}/${status.upstream.slug}`}
                  className="font-medium text-neutral-950 hover:underline"
                >
                  @{status.upstream.owner.handle}/{status.upstream.slug}
                </Link>
                。当前基于上游 v{status.baseRelease?.version ?? '-'}，上游最新 v
                {status.latestUpstreamRelease?.version ?? '-'}。
              </>
            ) : (
              '上游 Skill 不可用。'
            )}
          </div>

          {status.conflictFiles.length > 0 ? (
            <div className="rounded-2xl bg-red-50 p-5">
              <div className="text-[13px] font-semibold text-red-800">检测到冲突文件</div>
              <ul className="mt-3 space-y-1 text-[13px] text-red-700">
                {status.conflictFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!isOwner || busy || !status.hasUpdate}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await apiClient.syncUpstream(skill.owner.handle, skill.slug);
                  if (result.status === 'conflict') {
                    window.alert(`同步存在冲突：\n${result.conflictFiles.join('\n')}`);
                  } else {
                    window.alert('已同步上游更新。');
                  }
                  await load();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : '同步失败');
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
            >
              {busy ? '同步中…' : '同步上游'}
            </button>
            <button
              type="button"
              disabled={!me || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiClient.setSkillSubscription(
                    subscriptionTarget.owner,
                    subscriptionTarget.slug,
                    {
                      active: !subscription?.active,
                      notifyOnRelease: true,
                      notifyOnSync: true,
                    },
                  );
                  await load();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : '订阅操作失败');
                } finally {
                  setBusy(false);
                }
              }}
              className={cn(
                'rounded-lg px-4 py-2 text-[13px] font-medium transition disabled:opacity-40',
                subscription?.active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
              )}
            >
              {subscription?.active ? '已订阅' : '订阅更新'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-neutral-50 p-5 text-[14px] leading-7 text-neutral-700">
          这是原创 Skill。当前有 {status.forkCount} 个 Fork，已发布 {status.ownReleases.length}{' '}
          个版本。
        </div>
      )}
    </section>
  );
}

function HeroSection({
  skill,
  me,
  isOwner,
  onDelete,
  onUpvote,
  onBookmark,
  onCommentOpen,
}: {
  skill: SkillDetail;
  me: MeResponse | null;
  isOwner: boolean;
  onDelete: () => void;
  onUpvote: (patch: SkillStatsPatch) => void;
  onBookmark: (patch: SkillStatsPatch) => void;
  onCommentOpen: () => void;
}) {
  return (
    <div className="px-6 pt-10 pb-8 bg-white">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="text-[12px] uppercase tracking-[0.16em] text-neutral-400">
            Skill 发布详情
          </div>
          {isOwner ? (
            <OwnerActions owner={skill.owner.handle} slug={skill.slug} onDeleted={onDelete} />
          ) : null}
        </div>

        <div className="min-w-0">
          {/* Cover image or icon */}
          {skill.coverImage && (
            <img
              src={skill.coverImage}
              alt="封面"
              className="w-full max-h-64 object-cover rounded-2xl mb-6"
            />
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {!skill.coverImage && skill.icon && (
              <span className="text-[36px] leading-none select-none">{skill.icon}</span>
            )}
            <h1 className="text-[34px] font-bold tracking-[-0.03em] text-[#0f172a]">
              {skill.name}
            </h1>
            {skill.type === 'owned' ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                自有发布
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                引用发布
              </span>
            )}
          </div>

          <p className="mt-4 max-w-3xl text-[18px] leading-8 text-[#475569]">{skill.description}</p>

          <div className="mt-5 flex items-center gap-3 text-[13px] text-[#64748b] flex-wrap">
            <span>
              发布者{' '}
              <Link
                to={`/u/${skill.owner.handle}`}
                className="font-medium text-[#0f172a] hover:underline"
              >
                @{skill.owner.handle}
              </Link>
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-300" />
            <span>首次发布 {formatRelative(skill.createdAt)}</span>
            <span className="w-1 h-1 rounded-full bg-neutral-300" />
            <span>最近更新 {formatRelative(skill.updatedAt)}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] text-neutral-600"
              >
                #{tag}
              </span>
            ))}
          </div>

          <CommunityStats
            skill={skill}
            onUpvoteClick={() => {
              if (!me) {
                window.alert('登录后才能点赞。');
                return;
              }
              void (async () => {
                try {
                  const next = skill.viewerHasUpvoted
                    ? await apiClient.removeSkillUpvote(skill.owner.handle, skill.slug)
                    : await apiClient.upvoteSkill(skill.owner.handle, skill.slug);
                  onUpvote({
                    upvoteCount: next.upvoteCount,
                    commentCount: next.commentCount,
                    bookmarkCount: next.bookmarkCount,
                    viewerHasUpvoted: next.viewerHasUpvoted,
                  });
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : '点赞失败');
                }
              })();
            }}
            onBookmarkClick={() => {
              if (!me) {
                window.alert('登录后才能收藏。');
                return;
              }
              void (async () => {
                try {
                  const next = skill.viewerHasBookmarked
                    ? await apiClient.removeSkillBookmark(skill.owner.handle, skill.slug)
                    : await apiClient.bookmarkSkill(skill.owner.handle, skill.slug);
                  onBookmark({
                    upvoteCount: next.upvoteCount,
                    commentCount: next.commentCount,
                    bookmarkCount: next.bookmarkCount,
                    viewerHasUpvoted: next.viewerHasUpvoted,
                  });
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : '收藏操作失败');
                }
              })();
            }}
            onCommentClick={onCommentOpen}
          />
        </div>
      </div>
    </div>
  );
}

function DetailContent({
  skill,
  me,
  activeTab,
  onChangeTab,
  onSkillUpdate,
  onFork,
}: {
  skill: SkillDetail;
  me: MeResponse | null;
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  onSkillUpdate: (patch: SkillStatsPatch) => void;
  onFork: () => Promise<void>;
}) {
  const ownedFiles = skill.type === 'owned' ? sortFiles(skill.files) : [];

  if (activeTab === 'files') {
    return skill.type === 'owned' ? (
      <FilePreviewPane
        owner={skill.owner.handle}
        slug={skill.slug}
        files={ownedFiles}
        initialContent={skill.skillMdContent}
      />
    ) : (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-[14px] text-neutral-500">
        引用 Skill 暂不提供站内文件浏览。你可以先安装，或通过 Fork 复制到自己的账号后继续修改。
      </div>
    );
  }

  if (activeTab === 'releases') {
    return <ReleaseTimeline skill={skill} />;
  }

  if (activeTab === 'install') {
    return (
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10 min-w-0">
          {skill.type === 'owned' && skill.visibility === 'private' ? (
            <PrivateInstallSection skill={skill} me={me} onFork={onFork} />
          ) : (
            <PublicInstallSection skill={skill} me={me} onFork={onFork} />
          )}
          <ForkAndSyncSection
            skill={skill}
            me={me}
            isOwner={skill.owner.id === me?.id}
            onFork={onFork}
          />
        </div>
        <StatusSidebar skill={skill} onOpenFiles={() => onChangeTab('files')} />
      </div>
    );
  }

  if (activeTab === 'discussion') {
    return (
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10 min-w-0">
          <CommentsSection
            skill={skill}
            me={me}
            onCommentCreated={() =>
              onSkillUpdate({
                upvoteCount: skill.upvoteCount,
                commentCount: skill.commentCount + 1,
                bookmarkCount: skill.bookmarkCount,
                viewerHasUpvoted: skill.viewerHasUpvoted,
              })
            }
          />
        </div>
        <StatusSidebar skill={skill} onOpenFiles={() => onChangeTab('files')} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-10 min-w-0">
        {skill.demoVideoUrl && shouldPreviewDemoVideo(skill.demoVideoUrl) && (
          <section className="rounded-3xl bg-white border border-neutral-200 p-6 shadow-sm shadow-neutral-100/80">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500 mb-3">
              演示视频
            </div>
            <video
              src={apiClient.getSkillDemoVideoUrl(skill.owner.handle, skill.slug)}
              controls
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-neutral-950"
            >
              <track kind="captions" label="暂无字幕" src="data:text/vtt,WEBVTT%0A" />
            </video>
          </section>
        )}
        <AboutSection skill={skill} />
      </div>
      <StatusSidebar skill={skill} onOpenFiles={() => onChangeTab('files')} />
    </div>
  );
}

export default function SkillDetailPage() {
  const { owner = '', slug = '' } = useParams<{
    owner: string;
    slug: string;
  }>();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([apiClient.getSkill(owner, slug), apiClient.getMe().catch(() => null)])
      .then(([detail, currentUser]) => {
        if (cancelled) return;
        setSkill(detail);
        setMe(currentUser);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, slug]);

  const isOwner = !!skill && !!me && skill.owner.id === me.id;

  const updateSkillStats = (patch: SkillStatsPatch) => {
    setSkill((current) => (current ? { ...current, ...patch } : current));
  };

  const openTabSection = (
    tab: Extract<DetailTab, 'install' | 'discussion'>,
    targetId: 'install-section' | 'comments-section',
  ) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  };

  if (loading) {
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        加载中…
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="py-24 text-center">
        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
          404
        </div>
        <div className="text-neutral-700">
          技能{' '}
          <code className="font-mono">
            {owner}/{slug}
          </code>{' '}
          不存在。
        </div>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 rounded-lg"
        >
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb skill={skill} />
      <HeroSection
        skill={skill}
        me={me}
        isOwner={isOwner}
        onDelete={() => navigate('/')}
        onCommentOpen={() => openTabSection('discussion', 'comments-section')}
        onUpvote={updateSkillStats}
        onBookmark={updateSkillStats}
      />
      <TabNav active={activeTab} onChange={setActiveTab} />

      <div className="px-6 py-10 bg-[#fcfcfb]">
        <div className="mx-auto max-w-[1200px]">
          <DetailContent
            skill={skill}
            me={me}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onSkillUpdate={updateSkillStats}
            onFork={async () => {
              const created = await apiClient.forkSkill(skill.owner.handle, skill.slug);
              window.alert('已复制到你的账号，建议补充说明后再发布。');
              navigate(`/skills/${created.owner.handle}/${created.slug}/edit`);
            }}
          />
        </div>
      </div>
    </>
  );
}
