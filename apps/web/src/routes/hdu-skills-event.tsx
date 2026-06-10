import { TwemojiIcon } from '@/components/twemoji-icon';
import { Button } from '@/components/ui/button';
import { type ContestEligibilityResponse, type MeResponse, apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type {
  ContestSubmission,
  ContestTrack,
  ContestVoteSummary,
  OwnedSkillListItem,
  SkillListItem,
} from '@/types/api';
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageCircle,
  PlayCircle,
  QrCode,
  Search,
  ThumbsUp,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

const EVENT_SLUG = 'hdu-skills-2026';

type EventTab = 'overview' | 'guide' | 'submit' | 'submissions' | 'awards';

const tabs: Array<{ key: EventTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'guide', label: '参赛指南' },
  { key: 'submit', label: '提交作品' },
  { key: 'submissions', label: '作品专区' },
  { key: 'awards', label: '获奖公示' },
];

const contestTracks: ContestTrack[] = ['学习科研', '校园生活', '创意应用', '专业实训'];

const eventButtonBaseClass =
  'h-10 rounded-lg px-4 font-sans text-[14px] font-medium normal-case tracking-normal';
const eventPrimaryButtonClass = cn(eventButtonBaseClass, 'shadow-sm shadow-neutral-950/5');
const eventSecondaryButtonClass = cn(
  eventButtonBaseClass,
  'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-950',
);

const tracks: Array<{ name: ContestTrack; text: string }> = [
  {
    name: '学习科研',
    text: '文献综述辅助、数据处理、公式推导、论文润色、课程答疑、科研报告撰写等。',
  },
  {
    name: '校园生活',
    text: '校园办事指南、选课攻略、社团活动文案、校园问答、校园活动策划等。',
  },
  {
    name: '创意应用',
    text: '文创生成、学习规划、趣味互动、个性化 AI 工具等。',
  },
  {
    name: '专业实训',
    text: '代码调试、专业知识解答、实验报告辅助、实训工具等。',
  },
];

const schedule = [
  {
    title: '正式报名期',
    date: '5 月 18 日 - 5 月 31 日',
    start: '2026-05-18T00:00:00',
    end: '2026-06-01T00:00:00',
    text: '完成外部问卷报名与 Matrix 平台注册。',
  },
  {
    title: '作品征集期',
    date: '5 月 22 日 - 6 月 5 日 24:00',
    start: '2026-05-22T00:00:00',
    end: '2026-06-06T00:00:00',
    text: '发布真实可安装 Skill，并提交为参赛作品。',
  },
  {
    title: '评审投票期',
    date: '6 月 1 日 - 6 月 10 日',
    start: '2026-06-01T00:00:00',
    end: '2026-06-11T00:00:00',
    text: '大众投票与专家评审同步进行。',
  },
  {
    title: '公示收尾期',
    date: '6 月 11 日 - 6 月 15 日',
    start: '2026-06-11T00:00:00',
    end: '2026-06-16T00:00:00',
    text: '公示获奖名单，发放奖励与权益。',
  },
] as const;

const awards = [
  ['一等奖', '1288 元 Token 充值金、暑期实习直通名额、荣誉证书、阿里云神秘奖励'],
  ['二等奖', '688 元 Token 充值金、暑期实习面试直通资格、荣誉证书、阿里云神秘奖励'],
  ['三等奖', '288 元 Token 充值金、暑期实习面试直通资格、荣誉证书、阿里云神秘奖励'],
  ['优秀奖', '88 元 Token 充值金、荣誉证书'],
  ['参与奖', '完成报名并注册 Matrix 平台，可获 38 元 Token 充值金'],
] as const;

const guideRules = [
  '个人或 2 人团队参赛，团队仅需 1 人代表报名，团队内任一选手在平台提交的作品均视为团队作品。',
  '每个参赛主体不限作品提交数量，同/跨赛道均可。',
  '每个 Skill 只能选择 1 个赛道参加活动。',
  '作品须原创、积极健康、贴合高校校园场景，不得抄袭、侵权、涉密或违反法律法规。',
];

const guideFlow = [
  ['01', '完成报名', '扫码填写报名问卷，手机号需和 Matrix / SkillHunt 登录手机号一致。'],
  ['02', '发布 Skill', '在 SkillHunt 发布一个公开、真实可安装的 Skill。'],
  ['03', '加入竞赛', '进入提交作品页，选择已有 Skill 并设置唯一参赛赛道。'],
  ['04', '等待评审', '投票开放后可参与大众评审，专家评审结果由管理员导入。'],
] as const;

const submissionChecklist = [
  ['标准 Skill', '作品必须是平台内真实可安装的 Skill。'],
  ['Skill 演示视频', '发布或编辑 Skill 时上传 3 分钟以内演示视频，提交参赛时无需重复上传。'],
] as const;

type CurrentActionCard = {
  phase: string;
  date: string;
  title: string;
  text: string;
  actionLabel: string;
  actionTo?: string;
  actionType?: 'signup';
  icon: 'signup' | 'submit' | 'vote' | 'awards';
};

type AwardNoticeCard = {
  status: 'upcoming' | 'reviewing' | 'finalizing' | 'public' | 'closed';
  badge: string;
  title: string;
  date: string;
  text: string;
  detail: string;
};

type AwardResultPublishStatus = 'finalizing' | 'public';

type AwardResultItem = {
  skillName: string;
  track: ContestTrack;
  maker: string;
  organization: string;
  description: string;
  href?: string;
};

type AwardResultGroup = {
  award: string;
  items: AwardResultItem[];
};

const awardResultConfig: {
  publishStatus: AwardResultPublishStatus;
  updatedAt: string;
} = {
  // 名单确认后改为 public，并在 awardResultGroups 填入获奖作品。
  publishStatus: 'finalizing',
  updatedAt: '名单确认后更新',
};

const awardResultGroups: AwardResultGroup[] = [];

const awardFinalizingSteps = [
  ['投票结果汇总', '整理大众投票记录，核对异常投票与重复提交情况。'],
  ['专家评审确认', '汇总专家评分和评审意见，确认各赛道作品排序。'],
  ['名单信息复核', '核对作品、创作者、团队和学院/单位信息。'],
  ['统一发布公示', '名单确认后，本页会切换为获奖结果展示。'],
] as const;

const awardPublicNotes = [
  ['公示范围', '展示获奖作品、奖项、创作者姓名及所属学院/单位。'],
  ['异议反馈', '公示期内如有疑问，可在赛事企微群联系组织方。'],
  ['后续安排', '公示结束后推进权益确认、奖励发放和校园专区上架。'],
] as const;

const votingReferenceItems = [
  {
    title: '校园实用性（核心）',
    text: '优先选能真正帮到杭电同学的作品，解决高频痛点，场景明确，你自己都想用的那种！',
  },
  {
    title: '创意巧思',
    text: '选有新意的方案，不是千篇一律的通用模板，而是结合校园场景的专属创意，能给你带来新的 AI 使用灵感～',
  },
  {
    title: '实用好上手',
    text: '选介绍描述清楚的作品，逻辑易懂、内容完整，后续上架校园 SkillHunt 专区后，全校同学都能轻松用起来。',
  },
] as const;

function dateInShanghai(value: string) {
  return new Date(`${value}+08:00`);
}

type TimelineStatus = 'done' | 'current' | 'upcoming';

function getTimelineStatus(item: (typeof schedule)[number], now = new Date()): TimelineStatus {
  const start = dateInShanghai(item.start);
  const end = dateInShanghai(item.end);
  if (now < start) return 'upcoming';
  if (now >= end) return 'done';
  return 'current';
}

function getCurrentActionCards(now = new Date()): CurrentActionCard[] {
  return schedule
    .filter((item) => getTimelineStatus(item, now) === 'current')
    .map((item) => {
      if (item.title === '正式报名期') {
        return {
          phase: item.title,
          date: item.date,
          title: '完成报名问卷',
          text: '请先填写外部报名问卷，并确认报名手机号和 SkillHunt 登录手机号一致。',
          actionLabel: '填写报名问卷',
          actionType: 'signup',
          icon: 'signup',
        };
      }
      if (item.title === '作品征集期') {
        return {
          phase: item.title,
          date: item.date,
          title: '提交参赛作品',
          text: '发布公开 Skill 后，到提交作品页选择参赛赛道。有效作品需要 Skill 已上传 3 分钟以内演示视频。',
          actionLabel: '选择 Skill 参赛',
          actionTo: `/events/${EVENT_SLUG}?tab=submit`,
          icon: 'submit',
        };
      }
      if (item.title === '评审投票期') {
        return {
          phase: item.title,
          date: item.date,
          title: '参与大众投票',
          text: '作品专区已进入投票评审阶段。每个用户每个赛道最多 5 票，可给自己作品投票。',
          actionLabel: '进入作品专区',
          actionTo: `/events/${EVENT_SLUG}?tab=submissions`,
          icon: 'vote',
        };
      }
      return {
        phase: item.title,
        date: item.date,
        title: awardResultConfig.publishStatus === 'public' ? '查看获奖名单' : '关注评审统计进展',
        text:
          awardResultConfig.publishStatus === 'public'
            ? '获奖名单、奖励发放和校园专区上架会在公示阶段同步更新。'
            : '大众投票与专家评审进入统计确认阶段，获奖名单确认后统一展示。',
        actionLabel: '查看获奖公示',
        actionTo: `/events/${EVENT_SLUG}?tab=awards`,
        icon: 'awards',
      };
    });
}

function getAwardNoticeCard(now = new Date()): AwardNoticeCard {
  const votingStart = dateInShanghai('2026-06-01T00:00:00');
  const votingEnd = dateInShanghai('2026-06-11T00:00:00');
  const showcaseStart = dateInShanghai('2026-06-11T00:00:00');
  const showcaseEnd = dateInShanghai('2026-06-16T00:00:00');

  if (now < votingStart) {
    return {
      status: 'upcoming',
      badge: '未开始',
      title: '等待作品征集与评审',
      date: '6 月 11 日 - 6 月 15 日',
      text: '获奖名单会在专家评审和大众投票结束后进入公示。',
      detail: '当前重点是完成报名、发布 Skill 并提交参赛作品。',
    };
  }
  if (now < votingEnd) {
    return {
      status: 'reviewing',
      badge: '评审投票中',
      title: '获奖结果正在形成',
      date: '6 月 1 日 - 6 月 10 日',
      text: '大众投票与专家评审正在同步进行，获奖名单暂不公示。',
      detail: '请先关注作品专区投票进展，最终结果会在公示期统一展示。',
    };
  }
  if (now >= showcaseStart && now < showcaseEnd) {
    if (awardResultConfig.publishStatus === 'finalizing') {
      return {
        status: 'finalizing',
        badge: '结果整理中',
        title: '获奖结果正在整理中',
        date: '6 月 11 日 - 6 月 15 日',
        text: '大众投票与专家评审已进入统计确认阶段，最终获奖名单将在确认完成后统一公示。',
        detail: '当前不会提前展示名单，请关注本页后续更新。',
      };
    }

    return {
      status: 'public',
      badge: '公示中',
      title: '获奖名单公示中',
      date: '6 月 11 日 - 6 月 15 日',
      text: '获奖作品、奖项、创作者姓名及所属学院/单位会在这里集中展示。',
      detail: '公示期间会同步推进奖励发放、权益确认和校园专区上架。',
    };
  }
  return {
    status: 'closed',
    badge: '已结束',
    title: '公示收尾已完成',
    date: '6 月 16 日起',
    text: '获奖作品将沉淀为杭电校园 Skills 专区，供全校师生持续发现与使用。',
    detail: '如需查看历史结果，可关注后续上架的校园专区作品与赛事复盘。',
  };
}

function getStage() {
  const now = new Date();
  const registrationStart = dateInShanghai('2026-05-18T00:00:00');
  const submissionStart = dateInShanghai('2026-05-22T00:00:00');
  const votingStart = dateInShanghai('2026-06-01T00:00:00');
  const submissionEnd = dateInShanghai('2026-06-06T00:00:00');
  const votingEnd = dateInShanghai('2026-06-11T00:00:00');
  const showcaseEnd = dateInShanghai('2026-06-16T00:00:00');

  if (now < registrationStart) {
    return {
      label: '活动即将开始',
      detail: '报名通道将于 2026 年 5 月 18 日开放。',
    };
  }
  if (now < submissionStart) {
    return {
      label: '报名进行中',
      detail: '作品征集将于 2026 年 5 月 22 日开启。',
    };
  }
  if (now < votingStart) {
    return {
      label: '报名与作品征集进行中',
      detail: '发布 Skill 后即可准备加入竞赛，投票将于 2026 年 6 月 1 日开启。',
    };
  }
  if (now < submissionEnd) {
    return {
      label: '作品征集与大众投票进行中',
      detail: '每位用户总共最多 5 票，作品提交截止到 2026 年 6 月 5 日 24:00。',
    };
  }
  if (now < votingEnd) {
    return {
      label: '评审投票进行中',
      detail: '作品提交已截止，大众投票与专家评审持续到 2026 年 6 月 10 日。',
    };
  }
  if (now < showcaseEnd) {
    return {
      label: '获奖公示期',
      detail:
        awardResultConfig.publishStatus === 'public'
          ? '获奖名单公示、权益发放和校园专区上架正在进行。'
          : '评审结果正在统计确认，获奖名单确认后统一公示。',
    };
  }
  return {
    label: '活动已结束',
    detail: '获奖作品将沉淀为杭电校园 Skills 专区，供师生持续发现与使用。',
  };
}

function parseTab(value: string | null): EventTab {
  return tabs.some((tab) => tab.key === value) ? (value as EventTab) : 'overview';
}

function isOwnedSkill(item: SkillListItem): item is OwnedSkillListItem {
  return item.type === 'owned';
}

function SectionTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        {eyebrow}
      </div>
      <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-neutral-950">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-neutral-500">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

function VotingReferenceInline() {
  return (
    <div className="mt-4 w-full rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="shrink-0 text-[13px] font-semibold text-emerald-800 lg:w-20">投票重点</div>
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          {votingReferenceItems.map((item, index) => (
            <div key={item.title} className="min-w-0 border-emerald-100 md:border-l md:pl-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-950">
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  {index + 1}
                </span>
                {item.title}
              </div>
              <p className="mt-1 text-[12px] leading-5 text-neutral-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QrCard({
  title,
  text,
  imageSrc,
  imageAlt,
}: {
  title: string;
  text: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex justify-center">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="h-44 w-44 rounded-lg border border-neutral-200 bg-white object-contain p-2"
        />
      </div>
      <div className="mt-4 text-center">
        <div className="text-[15px] font-semibold text-neutral-900">{title}</div>
        <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-5 text-neutral-500">{text}</p>
      </div>
    </div>
  );
}

function SignupQrModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid min-h-dvh place-items-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="signup-qr-title"
        className="static m-0 max-h-[calc(100dvh-2rem)] w-full max-w-[380px] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-950/15"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div id="signup-qr-title" className="text-[18px] font-semibold text-neutral-950">
              报名问卷
            </div>
            <p className="mt-1 text-[13px] leading-5 text-neutral-500">
              扫描二维码填写报名问卷，活动资格会按报名手机号校验。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭报名问卷二维码"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <img
            src={`/events/${EVENT_SLUG}/signup-qr.png`}
            alt="杭电 Skills 创意竞赛报名问卷二维码"
            className="h-72 w-72 max-w-full rounded-lg border border-neutral-200 bg-white object-contain p-2"
          />
        </div>
      </dialog>
    </div>
  );
}

function DemoVideoModal({
  video,
  onClose,
}: {
  video: { url: string; title: string } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!video) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [video, onClose]);

  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid min-h-dvh place-items-center overflow-y-auto bg-neutral-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-labelledby="demo-video-title"
        className="static m-0 max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 p-0 shadow-2xl shadow-neutral-950/30"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
          <div id="demo-video-title" className="line-clamp-1 text-[15px] font-semibold text-white">
            {video.title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭演示视频"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 transition hover:border-white/35 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-black">
          <video
            src={video.url}
            controls
            autoPlay
            playsInline
            className="aspect-video max-h-[calc(100dvh-8rem)] w-full bg-black object-contain"
          >
            <track kind="captions" src="data:text/vtt;charset=utf-8,WEBVTT%0A" srcLang="zh-CN" />
          </video>
        </div>
      </dialog>
    </div>
  );
}

function ContestSubmissionCover({ skill }: { skill: SkillListItem }) {
  if (skill.coverImage) {
    return (
      <img
        src={skill.coverImage}
        alt={`${skill.name} 封面`}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full select-none items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-[48px]">
      <TwemojiIcon emoji={skill.icon || DEFAULT_SKILL_ICON} />
    </div>
  );
}

function OrganizationLogo({ src, name }: { src: string; name: string }) {
  return (
    <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <img src={src} alt={name} className="max-h-12 max-w-full object-contain" />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-500">
        {icon}
      </div>
      <h3 className="text-[20px] font-semibold text-neutral-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-[14px] leading-6 text-neutral-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

function EligibilityStatus({ eligibility }: { eligibility: ContestEligibilityResponse | null }) {
  if (!eligibility) return null;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        eligibility.eligible
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="text-[14px] font-semibold">
              {eligibility.eligible ? '参赛资格已通过' : '参赛资格待确认'}
            </div>
            <p className="mt-1 text-[13px] leading-5 opacity-80">{eligibility.message}</p>
          </div>
        </div>
        {eligibility.phone ? (
          <div className="shrink-0 font-mono text-[12px] opacity-70">
            手机号 {eligibility.phone}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ContestTimeline() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            竞赛时间线
          </div>
          <p className="mt-2 text-[13px] leading-6 text-neutral-500">
            报名、征集、投票评审和公示存在少量重叠，以下按北京时间展示。
          </p>
        </div>
        <div className="font-mono text-[11px] text-neutral-400">5.18 - 6.15</div>
      </div>

      <ol className="relative grid items-stretch gap-4 lg:grid-cols-4 lg:gap-3">
        <div className="absolute top-4 bottom-4 left-4 w-px bg-neutral-200 lg:top-4 lg:right-[12%] lg:left-[12%] lg:h-px lg:w-auto" />
        {schedule.map((item, index) => {
          const status = getTimelineStatus(item);
          const statusText =
            status === 'current' ? '进行中' : status === 'done' ? '已结束' : '未开始';

          return (
            <li key={item.title} className="relative flex flex-col pl-10 lg:pl-0">
              <div
                className={cn(
                  'absolute top-0 left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[11px] lg:static lg:mx-auto lg:mb-3',
                  status === 'current'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : status === 'done'
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-500',
                )}
              >
                {index + 1}
              </div>
              <div
                className={cn(
                  'flex flex-1 flex-col rounded-lg border p-4 transition-colors',
                  status === 'current'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-neutral-200 bg-neutral-50',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[15px] font-semibold text-neutral-950">{item.title}</div>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[12px]',
                      status === 'current'
                        ? 'border-emerald-200 bg-white text-emerald-700'
                        : status === 'done'
                          ? 'border-neutral-200 bg-white text-neutral-500'
                          : 'border-neutral-200 bg-white text-neutral-400',
                    )}
                  >
                    {statusText}
                  </span>
                </div>
                <div className="mt-3 font-mono text-[11px] leading-5 text-neutral-400">
                  {item.date}
                </div>
                <p className="mt-auto pt-4 text-[13px] leading-6 text-neutral-500">{item.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CurrentActionCards({ onSignupClick }: { onSignupClick: () => void }) {
  const cards = getCurrentActionCards();
  const iconMap = {
    signup: QrCode,
    submit: Upload,
    vote: ThumbsUp,
    awards: Trophy,
  };

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="text-[15px] font-semibold text-neutral-950">当前提醒</div>
        <p className="mt-2 text-[13px] leading-6 text-neutral-500">
          活动当前没有正在进行的阶段，可查看时间线确认下一步安排。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[15px] font-semibold text-neutral-950">正在进行</div>
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12px] text-emerald-700">
          {cards.length} 项
        </div>
      </div>
      <div className="space-y-3">
        {cards.map((card) => {
          const Icon = iconMap[card.icon];
          const action =
            card.actionType === 'signup' ? (
              <Button
                type="button"
                onClick={onSignupClick}
                className={cn(eventPrimaryButtonClass, 'mt-4 w-full')}
              >
                {card.actionLabel}
                <QrCode className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className={cn(eventSecondaryButtonClass, 'mt-4 w-full bg-white')}
              >
                <Link to={card.actionTo ?? `/events/${EVENT_SLUG}`}>
                  {card.actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            );

          return (
            <div
              key={card.phase}
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[12px] font-semibold text-emerald-700">{card.phase}</div>
                    <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700">
                      进行中
                    </span>
                  </div>
                  <div className="mt-2 text-[15px] font-semibold text-emerald-950">
                    {card.title}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-700/70">{card.date}</div>
                  <p className="mt-2 text-[13px] leading-6 text-emerald-800">{card.text}</p>
                  {action}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hero({
  stage,
  onSignupClick,
}: {
  stage: ReturnType<typeof getStage>;
  onSignupClick: () => void;
}) {
  return (
    <section className="border-b border-neutral-200 px-6 py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[13px] text-emerald-700">
            <CalendarDays className="h-4 w-4" />
            <span>{stage.label}</span>
          </div>
          <h1 className="max-w-3xl text-[42px] font-bold leading-[1.05] tracking-[-0.04em] text-neutral-950 sm:text-[58px]">
            智创杭电・技筑未来
          </h1>
          <p className="mt-4 max-w-2xl text-[18px] leading-8 text-neutral-600">
            杭电・摩智视界・阿里云 Skills 创意竞赛
          </p>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-neutral-600">
            聚焦校园真实需求，征集面向 AI Agent 的可安装
            Skills。参赛者可以围绕学习科研、校园生活、创意应用和专业实训发布作品，让好的校园 AI
            能力被发现、讨论和使用。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={onSignupClick} className={eventPrimaryButtonClass}>
              填写报名问卷
              <QrCode className="h-4 w-4" />
            </Button>
            <Button asChild variant="outline" className={eventSecondaryButtonClass}>
              <Link to={`/events/${EVENT_SLUG}?tab=submit`}>
                检查参赛资格
                <CheckCircle2 className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className={eventSecondaryButtonClass}>
              <Link to="/publish/skill">
                发布 Skill
                <Upload className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className={eventSecondaryButtonClass}>
              <Link to={`/events/${EVENT_SLUG}?tab=submit`}>
                选择 Skill 参赛
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventTabs({
  active,
  onChange,
}: {
  active: EventTab;
  onChange: (tab: EventTab) => void;
}) {
  return (
    <div className="sticky top-[58px] z-10 border-b border-neutral-200 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'border-b-2 px-4 py-3 text-[13px] font-medium transition',
              active === tab.key
                ? 'border-emerald-500 text-neutral-950'
                : 'border-transparent text-neutral-500 hover:text-neutral-800',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-12">
      <section>
        <div className="grid gap-3 sm:grid-cols-3">
          <OrganizationLogo src={`/events/${EVENT_SLUG}/hdu-logo.svg`} name="杭州电子科技大学" />
          <OrganizationLogo src={`/events/${EVENT_SLUG}/mozia-logo.png`} name="摩智视界" />
          <OrganizationLogo src={`/events/${EVENT_SLUG}/alibaba-cloud-logo.svg`} name="阿里云" />
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow="Event Brief"
          title="活动简介"
          description="本次竞赛面向本校全日制在校大学生、研究生、港澳台籍学生、外籍留学生、大学科技园 OPC 社区成员等开放，鼓励跨专业组队参赛。"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <Users className="mb-4 h-5 w-5 text-emerald-600" />
            <div className="text-[16px] font-semibold text-neutral-950">报名参赛</div>
            <p className="mt-2 text-[13px] leading-6 text-neutral-500">
              先完成外部问卷报名和 Matrix 平台注册，SkillHunt 后续会识别活动用户资格。
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <Upload className="mb-4 h-5 w-5 text-emerald-600" />
            <div className="text-[16px] font-semibold text-neutral-950">发布作品</div>
            <p className="mt-2 text-[13px] leading-6 text-neutral-500">
              参赛作品必须是真实可安装 Skill，且 Skill 本身已上传 3 分钟以内演示视频。
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <Trophy className="mb-4 h-5 w-5 text-emerald-600" />
            <div className="text-[16px] font-semibold text-neutral-950">评审公示</div>
            <p className="mt-2 text-[13px] leading-6 text-neutral-500">
              投票和专家评审结束后，获奖作品将上架杭电校园 Skills 专区。
            </p>
          </div>
        </div>
      </section>

      <section id="signup-form">
        <SectionTitle
          eyebrow="Contact"
          title="报名与咨询"
          description="完成外部问卷报名后，请继续准备标准 Skill，并在发布或编辑 Skill 时上传演示视频。赛事教程、答疑和节点提醒会在企微群内同步。"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <QrCard
            title="报名问卷"
            text="扫描二维码填写报名问卷，报名、投票资格核验和权益发放均以问卷信息为准。"
            imageSrc={`/events/${EVENT_SLUG}/signup-qr.png`}
            imageAlt="杭电 Skills 创意竞赛报名问卷二维码"
          />
          <QrCard
            title="赛事企微群"
            text="扫描二维码加入赛事企微群，获取教程、答疑和关键节点提醒。"
            imageSrc={`/events/${EVENT_SLUG}/wecom-qr.jpg`}
            imageAlt="杭电 Skills 创意竞赛赛事企微群二维码"
          />
        </div>
      </section>
    </div>
  );
}

function GuideTab({ onSignupClick }: { onSignupClick: () => void }) {
  return (
    <div className="space-y-12">
      <section>
        <SectionTitle
          eyebrow="Tracks"
          title="四大赛道"
          description="每个 Skill 限选择一个赛道。可以提交多个作品，同一作品不能跨赛道重复提交。"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tracks.map((track, index) => (
            <div key={track.name} className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-5 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 font-mono text-[12px] text-white">
                {index + 1}
              </div>
              <h3 className="text-[18px] font-semibold text-neutral-950">{track.name}</h3>
              <p className="mt-3 text-[13px] leading-6 text-neutral-500">{track.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow="Guide"
          title="参赛指南"
          description="按真实参赛路径整理：先报名，再发布 Skill，最后选择作品加入竞赛。"
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-200 bg-white">
              <div className="border-b border-neutral-100 p-5">
                <div className="flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                  参赛流程
                </div>
                <p className="mt-2 text-[13px] leading-6 text-neutral-500">
                  下面 4 步完成后，作品就会进入活动作品池。
                </p>
              </div>
              <div className="grid divide-y divide-neutral-100 md:grid-cols-4 md:divide-x md:divide-y-0">
                {guideFlow.map(([step, title, text]) => (
                  <div key={step} className="p-5">
                    <div className="font-mono text-[11px] text-emerald-600">{step}</div>
                    <div className="mt-3 text-[15px] font-semibold text-neutral-950">{title}</div>
                    <p className="mt-2 text-[13px] leading-6 text-neutral-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
                  <Users className="h-5 w-5 text-emerald-600" />
                  参赛规则
                </div>
                <div className="space-y-3">
                  {guideRules.map((item) => (
                    <div key={item} className="flex gap-3 text-[13px] leading-6 text-neutral-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  提交材料
                </div>
                <div className="space-y-4">
                  {submissionChecklist.map(([title, text]) => (
                    <div key={title}>
                      <div className="text-[14px] font-semibold text-neutral-950">{title}</div>
                      <p className="mt-1 text-[13px] leading-6 text-neutral-500">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ContestTimeline />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[118px] lg:self-start">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
                <Trophy className="h-5 w-5 text-emerald-600" />
                奖项速览
              </div>
              <div className="divide-y divide-neutral-200">
                {awards.map(([title, text]) => (
                  <div key={title} className="py-3 first:pt-0 last:pb-0">
                    <div className="text-[14px] font-semibold text-neutral-950">{title}</div>
                    <p className="mt-1 text-[13px] leading-5 text-neutral-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <CurrentActionCards onSignupClick={onSignupClick} />
          </aside>
        </div>
      </section>
    </div>
  );
}

function ContestSkillOptionCard({
  skill,
  selected,
  submission,
  onSelect,
}: {
  skill: OwnedSkillListItem;
  selected: boolean;
  submission?: ContestSubmission;
  onSelect: () => void;
}) {
  const unavailable = skill.visibility !== 'public';

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={onSelect}
      className={cn(
        'skill-card flex min-h-[188px] flex-col p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
        selected && 'skill-card-selected',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-[24px]">
          <TwemojiIcon emoji={skill.icon || DEFAULT_SKILL_ICON} />
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {submission ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              已加入
            </span>
          ) : null}
          {skill.visibility === 'private' ? (
            <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              私有
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <div className="line-clamp-1 text-[15px] font-semibold text-neutral-950">{skill.name}</div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-500">
          {skill.description}
        </p>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3 text-[12px] leading-5 text-neutral-500">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>@{skill.owner.handle}</span>
          {skill.downloadCount > 0 ? <span>⬇ {skill.downloadCount}</span> : null}
          <span>▲ {skill.upvoteCount}</span>
          {skill.demoVideoUrl ? <span>已有演示视频</span> : <span>缺少演示视频</span>}
        </div>
        {submission ? (
          <div className="mt-1 text-emerald-700">参赛赛道：{submission.track}</div>
        ) : null}
        {unavailable ? (
          <div className="mt-1 text-neutral-500">参赛作品需要先在编辑页设置为公开。</div>
        ) : null}
      </div>
    </button>
  );
}

function SubmitTab() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [skills, setSkills] = useState<OwnedSkillListItem[]>([]);
  const [submissions, setSubmissions] = useState<ContestSubmission[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<ContestTrack>('学习科研');
  const [eligibility, setEligibility] = useState<ContestEligibilityResponse | null>(null);
  const [skillQuery, setSkillQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const user = await apiClient.getMe().catch(() => null);
        if (cancelled) return;
        setMe(user);

        if (!user) {
          setSkills([]);
          setSubmissions([]);
          setSelectedSkillId(null);
          setEligibility(null);
          return;
        }

        const [skillRes, submissionRes, eligibilityRes] = await Promise.all([
          apiClient.getMySkills(),
          apiClient.listMyContestSubmissions(EVENT_SLUG),
          apiClient.getContestEligibility(EVENT_SLUG),
        ]);
        if (cancelled) return;

        const ownedSkills = skillRes.items.filter(isOwnedSkill);
        const firstPublicSkill = ownedSkills.find((skill) => skill.visibility === 'public');
        const initialSkillId = firstPublicSkill?.id ?? null;
        const initialSubmission = initialSkillId
          ? submissionRes.items.find((submission) => submission.skill.id === initialSkillId)
          : null;
        setSkills(ownedSkills);
        setSubmissions(submissionRes.items);
        setEligibility(eligibilityRes);
        setSelectedSkillId((current) => current ?? initialSkillId);
        if (initialSubmission) setSelectedTrack(initialSubmission.track);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载你的 Skill 失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submissionsBySkillId = useMemo(
    () => new Map(submissions.map((submission) => [submission.skill.id, submission])),
    [submissions],
  );

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skills],
  );

  const selectedSubmission = selectedSkill ? submissionsBySkillId.get(selectedSkill.id) : undefined;
  const selectedSkillHasVideo = Boolean(selectedSkill?.demoVideoUrl);
  const submitAlreadySet = selectedSubmission?.track === selectedTrack && selectedSkillHasVideo;
  const submitUnavailable =
    !selectedSkill || selectedSkill.visibility !== 'public' || !selectedSkillHasVideo;

  const visibleSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((skill) =>
      [skill.name, skill.description, skill.owner.handle, ...skill.tags]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [skillQuery, skills]);

  const submit = async () => {
    if (!selectedSkill) {
      setError('请先选择一个 Skill');
      return;
    }
    if (selectedSkill.visibility !== 'public') {
      setError('参赛作品需要先设置为公开');
      return;
    }
    if (!selectedSkill.demoVideoUrl) {
      setError('请先在发布或编辑 Skill 时上传 3 分钟以内演示视频');
      return;
    }
    if (
      selectedSubmission &&
      selectedSubmission.track !== selectedTrack &&
      !window.confirm('更换赛道会清空该作品已获得的竞赛投票数，确认继续吗？')
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const submission = await apiClient.createContestSubmission(EVENT_SLUG, {
        skillId: selectedSkill.id,
        track: selectedTrack,
      });
      setSubmissions((prev) => [
        submission,
        ...prev.filter((item) => item.skill.id !== selectedSkill.id),
      ]);
      setNotice(`已将「${selectedSkill.name}」设置为 ${selectedTrack} 赛道活动作品。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置活动作品失败');
    } finally {
      setSaving(false);
    }
  };

  const cancelSubmission = async () => {
    if (!selectedSkill || !selectedSubmission) return;
    if (
      !window.confirm('取消参赛会清空该作品已获得的竞赛投票数，并移出活动作品列表，确认继续吗？')
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.deleteContestSubmission(EVENT_SLUG, selectedSkill.id);
      setSubmissions((prev) => prev.filter((item) => item.skill.id !== selectedSkill.id));
      setNotice(`已取消「${selectedSkill.name}」的参赛状态。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消参赛失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <SectionTitle
          eyebrow="Submit"
          title="提交作品"
          description="正在读取你已经发布的 Skill。"
        />
        <EmptyState
          icon={<Upload className="h-5 w-5" />}
          title="正在加载作品"
          description="稍等一下，系统正在准备你的可选 Skill 列表。"
        />
      </div>
    );
  }

  if (!me) {
    return (
      <div>
        <SectionTitle
          eyebrow="Submit"
          title="提交作品"
          description="登录后可以从自己已经发布的 Skill 中选择作品加入本次竞赛。"
        />
        <EmptyState
          icon={<Upload className="h-5 w-5" />}
          title="请先登录"
          description="活动作品需要绑定到你的 SkillHunt 账号。登录后，这里会展示你已经发布的 Skill。"
          action={
            <Button asChild variant="outline" className={eventSecondaryButtonClass}>
              <Link to="/publish/skill">
                先去发布 Skill
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Submit"
          title="提交作品"
          description="第一版操作路径是先发布一个真实可安装 Skill，再把该 Skill 加入本次竞赛。"
        />
        <EligibilityStatus eligibility={eligibility} />
        <EmptyState
          icon={<Upload className="h-5 w-5" />}
          title="还没有可提交的 Skill"
          description="发布完成后回到这里，就可以直接选择已有 Skill 设置为活动作品。"
          action={
            <Button asChild variant="outline" className={eventSecondaryButtonClass}>
              <Link to="/publish/skill">
                去发布 Skill
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Submit"
        title="提交作品"
        description="从你已经发布的公开 Skill 中选择作品，设置赛道后加入本次活动。"
      />
      <EligibilityStatus eligibility={eligibility} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-neutral-950">选择已有 Skill</h3>
              <p className="mt-1 text-[13px] text-neutral-500">
                私有 Skill 需要先公开后才能作为活动作品展示。
              </p>
            </div>
            <Button asChild variant="outline" className={eventSecondaryButtonClass}>
              <Link to="/publish/skill">
                发布新 Skill
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={skillQuery}
              onChange={(event) => setSkillQuery(event.target.value)}
              placeholder="搜索名称、简介、作者或标签"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-[14px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {visibleSkills.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleSkills.map((skill) => (
                <ContestSkillOptionCard
                  key={skill.id}
                  skill={skill}
                  selected={selectedSkillId === skill.id}
                  submission={submissionsBySkillId.get(skill.id)}
                  onSelect={() => {
                    if (skill.visibility !== 'public') return;
                    setSelectedSkillId(skill.id);
                    setError(null);
                    setNotice(null);
                    const existing = submissionsBySkillId.get(skill.id);
                    if (existing) setSelectedTrack(existing.track);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center text-[14px] text-neutral-500">
              没有匹配的 Skill。
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 lg:sticky lg:top-[118px] lg:self-start">
          <div className="text-[16px] font-semibold text-neutral-950">设置活动作品</div>
          <p className="mt-2 text-[13px] leading-6 text-neutral-500">
            每个 Skill 只能选择一个赛道。更换赛道或取消参赛后，已获得的竞赛投票数会清零。
          </p>

          <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[12px] text-neutral-400">当前选择</div>
            {selectedSkill ? (
              <div className="mt-2">
                <div className="text-[15px] font-semibold text-neutral-950">
                  {selectedSkill.name}
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-500">
                  {selectedSkill.description}
                </p>
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-neutral-500">请选择一个公开 Skill。</div>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[13px] font-semibold text-neutral-900">参赛赛道</div>
            <div className="grid grid-cols-2 gap-2">
              {contestTracks.map((track) => (
                <button
                  key={track}
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[13px] transition',
                    selectedTrack === track
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400',
                  )}
                >
                  {track}
                </button>
              ))}
            </div>
            {selectedSubmission ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
                当前已参加 {selectedSubmission.track}{' '}
                赛道。更换赛道或取消参赛，会清空该作品已获得的竞赛投票数。
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="mb-1 text-[13px] font-semibold text-neutral-900">Skill 演示视频</div>
            <p className="text-[12px] leading-5 text-neutral-500">
              有效参赛作品需要 Skill 本身已上传 3 分钟以内演示视频，提交时无需重复上传。
            </p>

            {selectedSkill?.demoVideoUrl ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-start gap-2 text-[13px] leading-5 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium">已上传 Skill 演示视频</div>
                    <div className="mt-0.5 text-emerald-700">可以直接提交为活动作品。</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-3 text-[12px] leading-5 text-neutral-500">
                这个 Skill 还没有演示视频。请先进入发布或编辑页上传视频，再回到这里提交参赛作品。
              </div>
            )}
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] leading-5 text-emerald-700">
              {notice}
            </div>
          ) : null}

          <Button
            type="button"
            disabled={saving || submitUnavailable || submitAlreadySet}
            onClick={submit}
            variant={submitAlreadySet || submitUnavailable ? 'outline' : 'solid'}
            className={cn(
              eventButtonBaseClass,
              'mt-5 w-full',
              submitAlreadySet
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-100'
                : submitUnavailable
                  ? 'border-neutral-200 bg-neutral-100 text-neutral-400 disabled:opacity-100'
                  : 'shadow-sm shadow-neutral-950/5',
            )}
          >
            {saving ? (
              '正在设置…'
            ) : submitAlreadySet ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                已设为活动作品
              </>
            ) : selectedSubmission ? (
              '更新活动赛道'
            ) : (
              '设为活动作品'
            )}
          </Button>
          {selectedSubmission ? (
            <Button
              type="button"
              disabled={saving}
              onClick={cancelSubmission}
              variant="outline"
              className={cn(
                eventButtonBaseClass,
                'mt-3 w-full border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700',
              )}
            >
              取消参赛
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function voteStatusText(status: ContestVoteSummary['status'] | undefined) {
  if (status === 'open') return '投票进行中';
  if (status === 'ended') return '投票已结束';
  return '投票将于 6 月 1 日开启';
}

function SubmissionsTab() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<ContestSubmission[]>([]);
  const [voteSummary, setVoteSummary] = useState<ContestVoteSummary | null>(null);
  const [activeTrack, setActiveTrack] = useState<ContestTrack | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [submissionRes, user] = await Promise.all([
          apiClient.listContestSubmissions(EVENT_SLUG),
          apiClient.getMe().catch(() => null),
        ]);
        if (cancelled) return;
        setItems(submissionRes.items);
        setVoteSummary(submissionRes.voteSummary ?? null);
        setMe(user);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载作品专区失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const voteSummaryText = useMemo(() => {
    const maxVotes = voteSummary?.maxVotes ?? 5;
    if (!me) return `登录后可以参与大众投票；每人总共最多 ${maxVotes} 票。`;
    const used = voteSummary?.used ?? 0;
    const remaining = voteSummary?.remaining ?? maxVotes;
    return `你已投 ${used}/${maxVotes} 票，剩余 ${remaining} 票。`;
  }, [me, voteSummary?.maxVotes, voteSummary?.remaining, voteSummary?.used]);

  const visibleItems = useMemo(() => {
    if (activeTrack === 'all') return items;
    return items.filter((item) => item.track === activeTrack);
  }, [activeTrack, items]);

  const updateVotedItem = (item: ContestSubmission, nextSummary: ContestVoteSummary) => {
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? item : entry)));
    setVoteSummary(nextSummary);
  };

  const toggleVote = async (submission: ContestSubmission) => {
    if (voteSummary?.status !== 'open') return;
    if (!me) {
      setError('请先登录后再投票');
      return;
    }

    setActionId(submission.id);
    setError(null);
    try {
      const result = submission.viewerHasVoted
        ? await apiClient.removeContestSubmissionVote(EVENT_SLUG, submission.id)
        : await apiClient.voteContestSubmission(EVENT_SLUG, submission.id);
      updateVotedItem(result.item, result.voteSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '投票失败，请稍后重试');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <SectionTitle eyebrow="作品" title="作品专区" description="正在读取参赛作品列表。" />
        <EmptyState
          icon={<MessageCircle className="h-5 w-5" />}
          title="正在加载作品"
          description="稍等一下，系统正在整理本次竞赛的公开作品。"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="作品"
        title="作品专区"
        description="浏览本次竞赛公开作品，投票期内每位用户总共最多 5 票。"
      >
        <VotingReferenceInline />
      </SectionTitle>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[15px] font-semibold text-neutral-950">
              {voteStatusText(voteSummary?.status)}
            </div>
            <p className="mt-1 text-[13px] leading-5 text-neutral-500">{voteSummaryText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTrack('all')}
              className={cn(
                'rounded-lg border px-3 py-2 text-[13px] transition',
                activeTrack === 'all'
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400',
              )}
            >
              全部作品
            </button>
            {contestTracks.map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => setActiveTrack(track)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-[13px] transition',
                  activeTrack === track
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400',
                )}
              >
                {track}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
          {error}
        </div>
      ) : null}

      {visibleItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {visibleItems.map((submission) => {
            const skill = submission.skill;
            const voteOpen = voteSummary?.status === 'open';
            const busy = actionId === submission.id;
            const quotaUsedUp = Boolean(
              me && !submission.viewerHasVoted && voteSummary?.remaining === 0,
            );
            const videoUrl = submission.videoPlaybackUrl ?? submission.videoUrl;
            const openVideo = () => {
              if (!videoUrl) return;
              setActiveVideo({ url: videoUrl, title: skill.name });
            };
            const buttonText = !voteOpen
              ? voteSummary?.status === 'ended'
                ? '投票已结束'
                : '6 月 1 日开启'
              : !me
                ? '登录后投票'
                : submission.viewerHasVoted
                  ? '已投票'
                  : quotaUsedUp
                    ? '票已用完'
                    : '投一票';

            return (
              <article
                key={submission.id}
                role={videoUrl ? 'button' : undefined}
                tabIndex={videoUrl ? 0 : undefined}
                aria-label={videoUrl ? `播放 ${skill.name} 的演示视频` : undefined}
                onClick={openVideo}
                onKeyDown={(event) => {
                  if (!videoUrl) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openVideo();
                  }
                }}
                className={cn(
                  'skill-card flex min-h-[360px] flex-col',
                  videoUrl ? 'cursor-pointer transition hover:border-neutral-300' : '',
                )}
              >
                <div className="h-40 overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
                  <ContestSubmissionCover skill={skill} />
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
                    <span>参赛 Skill</span>
                    <span>{new Date(submission.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/skills/${encodeURIComponent(skill.owner.handle)}/${encodeURIComponent(skill.slug)}`}
                        onClick={(event) => event.stopPropagation()}
                        className="line-clamp-1 text-[15px] font-semibold leading-tight text-[#0f172a] hover:text-emerald-700"
                      >
                        {skill.name}
                      </Link>
                      <div className="mt-1 text-[12px] text-neutral-500">@{skill.owner.handle}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700">
                      {submission.track}
                    </span>
                  </div>

                  <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
                    {skill.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {submission.voteCount} 票
                    </span>
                    {skill.downloadCount > 0 ? <span>⬇ {skill.downloadCount}</span> : null}
                    <span>▲ {skill.upvoteCount}</span>
                    <span>💬 {skill.commentCount}</span>
                    {videoUrl ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openVideo();
                        }}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        演示视频
                      </button>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    disabled={busy || !voteOpen || quotaUsedUp}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleVote(submission);
                    }}
                    variant={submission.viewerHasVoted ? 'outline' : 'solid'}
                    className={cn(
                      eventButtonBaseClass,
                      'mt-4 w-full',
                      submission.viewerHasVoted
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                        : '',
                      !voteOpen
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-400 disabled:opacity-100'
                        : '',
                    )}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {busy ? '处理中…' : buttonText}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<MessageCircle className="h-5 w-5" />}
          title={items.length === 0 ? '暂无公开作品' : '这个赛道暂无作品'}
          description={
            items.length === 0
              ? '作品提交后会在这里公开展示。'
              : '切换到全部作品或其他赛道继续浏览。'
          }
        />
      )}
      <DemoVideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
    </div>
  );
}

function AwardNotice({ notice }: { notice: AwardNoticeCard }) {
  const tone = {
    upcoming: {
      wrap: 'border-neutral-200 bg-neutral-50',
      icon: 'border-neutral-200 bg-white text-neutral-500',
      badge: 'border-neutral-200 bg-white text-neutral-500',
      title: 'text-neutral-950',
      text: 'text-neutral-500',
    },
    reviewing: {
      wrap: 'border-amber-200 bg-amber-50',
      icon: 'border-amber-200 bg-white text-amber-700',
      badge: 'border-amber-200 bg-white text-amber-700',
      title: 'text-amber-950',
      text: 'text-amber-800',
    },
    finalizing: {
      wrap: 'border-sky-200 bg-sky-50',
      icon: 'border-sky-200 bg-white text-sky-700',
      badge: 'border-sky-200 bg-white text-sky-700',
      title: 'text-sky-950',
      text: 'text-sky-800',
    },
    public: {
      wrap: 'border-emerald-200 bg-emerald-50',
      icon: 'border-emerald-200 bg-white text-emerald-700',
      badge: 'border-emerald-200 bg-white text-emerald-700',
      title: 'text-emerald-950',
      text: 'text-emerald-800',
    },
    closed: {
      wrap: 'border-neutral-200 bg-white',
      icon: 'border-neutral-200 bg-neutral-50 text-neutral-700',
      badge: 'border-neutral-200 bg-neutral-50 text-neutral-600',
      title: 'text-neutral-950',
      text: 'text-neutral-600',
    },
  }[notice.status];

  return (
    <section className={cn('rounded-xl border p-5', tone.wrap)}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
              tone.icon,
            )}
          >
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
                公示状态
              </span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[12px]', tone.badge)}>
                {notice.badge}
              </span>
            </div>
            <h2 className={cn('mt-3 text-[22px] font-semibold', tone.title)}>{notice.title}</h2>
            <p className={cn('mt-2 max-w-2xl text-[14px] leading-6', tone.text)}>{notice.text}</p>
          </div>
        </div>
        <div className="shrink-0 rounded-lg border border-white/70 bg-white/70 px-3 py-2 font-mono text-[12px] text-neutral-500 shadow-sm shadow-neutral-950/5">
          {notice.date}
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-white/70 bg-white/70 px-4 py-3 text-[13px] leading-6 text-neutral-600 shadow-sm shadow-neutral-950/5">
        {notice.detail}
      </div>
    </section>
  );
}

function AwardPhaseStepper({ notice }: { notice: AwardNoticeCard }) {
  type PhaseState = 'done' | 'current' | 'upcoming';

  const finalizingState: PhaseState =
    notice.status === 'public' || notice.status === 'closed'
      ? 'done'
      : notice.status === 'finalizing'
        ? 'current'
        : 'upcoming';
  const publicState: PhaseState =
    notice.status === 'public'
      ? 'current'
      : notice.status === 'closed' && awardResultConfig.publishStatus === 'public'
        ? 'done'
        : 'upcoming';
  const phases = [
    {
      title: '评审统计',
      text: '汇总大众投票与专家评审，复核作品和创作者信息。',
      state: finalizingState,
    },
    {
      title: '名单公示',
      text: '结果确认后集中展示获奖作品，并同步后续奖励安排。',
      state: publicState,
    },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        {phases.map((phase, index) => {
          const stateText =
            phase.state === 'current' ? '进行中' : phase.state === 'done' ? '已完成' : '待开始';
          return (
            <div
              key={phase.title}
              className={cn(
                'flex gap-4 border-neutral-100 md:border-l md:first:border-l-0 md:first:pl-0 md:pl-5',
                phase.state === 'current' ? 'text-neutral-950' : 'text-neutral-500',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]',
                  phase.state === 'current'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : phase.state === 'done'
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-400',
                )}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[15px] font-semibold text-neutral-950">{phase.title}</div>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[12px]',
                      phase.state === 'current'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-500',
                    )}
                  >
                    {stateText}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-neutral-500">{phase.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AwardFinalizingPanel({ notice }: { notice: AwardNoticeCard }) {
  const active = notice.status === 'finalizing';

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5">
          <div className="flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
            <ClipboardList className="h-5 w-5 text-sky-600" />
            {active ? '评审统计正在进行' : '等待进入评审统计'}
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-neutral-500">
            {active
              ? '当前阶段以结果确认和信息复核为主，名单不会提前展示。确认完成后，这里会切换为获奖名单。'
              : '投票和专家评审结束后，本页会先展示结果整理进展，再进入名单公示。'}
          </p>

          <div className="mt-5 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {awardFinalizingSteps.map(([title, text], index) => (
              <div key={title} className="flex gap-4 p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-mono text-[11px] text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-neutral-950">{title}</div>
                  <p className="mt-1 text-[13px] leading-6 text-neutral-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-neutral-100 bg-neutral-50 p-5 lg:border-t-0 lg:border-l">
          <div className="text-[15px] font-semibold text-neutral-950">当前提示</div>
          <p className="mt-2 text-[13px] leading-6 text-neutral-500">
            请先关注作品专区和赛事群通知，最终名单会在本页统一更新。
          </p>
          <div className="mt-5 space-y-3">
            <Button
              asChild
              variant="outline"
              className={cn(eventSecondaryButtonClass, 'w-full bg-white')}
            >
              <Link to={`/events/${EVENT_SLUG}?tab=submissions`}>
                查看参赛作品
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={cn(eventSecondaryButtonClass, 'w-full bg-white')}
            >
              <Link to={`/events/${EVENT_SLUG}`}>
                返回活动概览
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function AwardResultsPanel() {
  const visibleGroups = awardResultGroups.filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-5 w-5" />}
        title="获奖名单正在录入"
        description="名单确认后会按奖项展示作品、赛道、创作者和所属学院/单位。"
      />
    );
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
            <Trophy className="h-5 w-5 text-emerald-600" />
            获奖名单
          </div>
          <p className="mt-2 text-[13px] leading-6 text-neutral-500">
            以下为本次竞赛获奖作品，公示期内如有疑问可联系赛事组织方。
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[12px] text-neutral-500">
          更新时间：{awardResultConfig.updatedAt}
        </div>
      </div>

      <div className="space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.award}>
            <div className="mb-3 text-[15px] font-semibold text-neutral-950">{group.award}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map((item) => (
                <article
                  key={`${group.award}-${item.skillName}-${item.maker}`}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[12px] text-emerald-700">
                      {item.track}
                    </span>
                    <span className="text-[12px] text-neutral-500">{item.organization}</span>
                  </div>
                  <h3 className="mt-3 text-[16px] font-semibold text-neutral-950">
                    {item.skillName}
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-neutral-500">{item.description}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                    <div className="text-[13px] text-neutral-600">创作者：{item.maker}</div>
                    {item.href ? (
                      <Link
                        to={item.href}
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        查看作品
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardPublicNotes() {
  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <div className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
        <FileText className="h-5 w-5 text-emerald-600" />
        公示说明
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {awardPublicNotes.map(([title, text]) => (
          <div
            key={title}
            className="border-neutral-200 md:border-l md:pl-4 md:first:border-l-0 md:first:pl-0"
          >
            <div className="text-[14px] font-semibold text-neutral-950">{title}</div>
            <p className="mt-2 text-[13px] leading-6 text-neutral-500">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardPrizeSection() {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-5 flex items-center gap-2 text-[16px] font-semibold text-neutral-950">
        <Trophy className="h-5 w-5 text-emerald-600" />
        奖项设置
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {awards.map(([title, text]) => (
          <div key={title} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-[14px] font-semibold text-neutral-950">{title}</div>
            <p className="mt-2 text-[13px] leading-6 text-neutral-500">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardsTab() {
  const notice = getAwardNoticeCard();
  const showResults =
    notice.status === 'public' ||
    (notice.status === 'closed' && awardResultConfig.publishStatus === 'public');

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="公示"
        title="获奖公示"
        description="公示期分为结果整理和名单展示两个阶段，名单确认前不会提前展示获奖结果。"
      />
      <AwardNotice notice={notice} />
      <AwardPhaseStepper notice={notice} />
      {showResults ? <AwardResultsPanel /> : <AwardFinalizingPanel notice={notice} />}
      <AwardPublicNotes />
      <AwardPrizeSection />
    </div>
  );
}

function TabContent({ active, onSignupClick }: { active: EventTab; onSignupClick: () => void }) {
  if (active === 'guide') return <GuideTab onSignupClick={onSignupClick} />;
  if (active === 'submit') return <SubmitTab />;
  if (active === 'submissions') return <SubmissionsTab />;
  if (active === 'awards') return <AwardsTab />;
  return <OverviewTab />;
}

export default function HduSkillsEventPage() {
  const stage = getStage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const activeTab = parseTab(searchParams.get('tab'));

  const setActiveTab = (tab: EventTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="bg-white">
      <Hero stage={stage} onSignupClick={() => setSignupModalOpen(true)} />
      <EventTabs active={activeTab} onChange={setActiveTab} />
      <section className="px-6 py-12">
        <div className="mx-auto max-w-[1200px]">
          <TabContent active={activeTab} onSignupClick={() => setSignupModalOpen(true)} />
        </div>
      </section>
      <SignupQrModal open={signupModalOpen} onClose={() => setSignupModalOpen(false)} />
    </div>
  );
}
