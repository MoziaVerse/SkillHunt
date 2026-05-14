import { TwemojiIcon } from '@/components/twemoji-icon';
import type { MeResponse } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CommunityComment } from '@/types/api';
import { useEffect, useMemo, useState } from 'react';

export interface CommunityStatsTarget {
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
  viewerHasBookmarked: boolean;
}

export function CommunityStats({
  target,
  onUpvoteClick,
  onBookmarkClick,
  onCommentClick,
}: {
  target: CommunityStatsTarget;
  onUpvoteClick: () => void;
  onBookmarkClick: () => void;
  onCommentClick: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-neutral-600">
      <button
        type="button"
        onClick={onUpvoteClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition',
          target.viewerHasUpvoted
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:text-emerald-800'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
        )}
      >
        <span>▲</span>
        <span>{target.upvoteCount} 人点赞</span>
      </button>
      <button
        type="button"
        onClick={onBookmarkClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition',
          target.viewerHasBookmarked
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:text-emerald-800'
            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900',
        )}
      >
        <TwemojiIcon emoji={target.viewerHasBookmarked ? '🔖' : '📑'} />
        <span>{target.bookmarkCount} 人收藏</span>
      </button>
      <button
        type="button"
        onClick={onCommentClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 transition hover:border-neutral-300 hover:text-neutral-900"
      >
        <TwemojiIcon emoji="💬" />
        <span>{target.commentCount} 条评论</span>
      </button>
    </div>
  );
}

export function CommentsSection({
  targetName,
  commentCount,
  me,
  loadComments,
  createComment,
  onCommentCreated,
}: {
  targetName: string;
  commentCount: number;
  me: MeResponse | null;
  loadComments: () => Promise<{ items: CommunityComment[] }>;
  createComment: (input: {
    content: string;
    parentId?: string | null;
  }) => Promise<CommunityComment>;
  onCommentCreated: () => void;
}) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadComments()
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
  }, [loadComments]);

  const commentTree = useMemo(() => {
    const rootComments: CommunityComment[] = [];
    const childrenMap = new Map<string, CommunityComment[]>();

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
      const created = await createComment({ content: draft.trim() });
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
      const created = await createComment({ content: replyDraft.trim(), parentId });
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
      className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#0f172a]">评论</h2>
          <p className="mt-1 text-[14px] text-neutral-500">
            围绕这次发布留下反馈、建议和使用体验。
          </p>
        </div>
        <div className="text-[12px] text-neutral-500">{commentCount} 条评论</div>
      </div>

      <div className="rounded-2xl bg-neutral-50 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={me ? `写下你对这个${targetName}的看法…` : '登录后可以参与评论'}
          disabled={!me || submitting}
          className="min-h-[110px] w-full resize-y rounded-xl bg-white px-4 py-3 text-[14px] text-neutral-800 outline-none ring-1 ring-inset ring-neutral-100 focus:ring-2 focus:ring-emerald-200 disabled:bg-neutral-100"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12px] text-neutral-500">
            {me ? `你的评论会公开展示在这个${targetName}页面中。` : '请先登录再发表评论。'}
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
          <div className="py-6 text-center text-[13px] text-neutral-500">评论加载中…</div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-neutral-500">
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
  comment: CommunityComment;
  childComments: CommunityComment[];
  childrenMap: Map<string, CommunityComment[]>;
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
    'mt-4 space-y-4 border-l-2 border-neutral-200 pl-3',
    depth < 2 && 'ml-4',
  );

  return (
    <div className="rounded-2xl bg-neutral-50 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-neutral-900">{comment.author.name}</span>
          <span className="ml-1.5 text-[12px] text-neutral-500">@{comment.author.handle}</span>
        </div>
        <time className="shrink-0 text-[12px] text-neutral-500">
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
          className="mt-2 text-[12px] text-neutral-500 transition hover:text-neutral-700"
        >
          回复
        </button>
      )}
      {isReplying && (
        <div className="ml-4 mt-3 border-l-2 border-emerald-200 pl-3">
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
                className="px-3 py-1.5 text-[12px] text-neutral-600 transition hover:text-neutral-800"
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
