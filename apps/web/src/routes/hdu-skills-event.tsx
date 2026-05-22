import { TwemojiIcon } from '@/components/twemoji-icon';
import { Button } from '@/components/ui/button';
import { type ContestEligibilityResponse, type MeResponse, apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type {
  ContestSubmission,
  ContestTrack,
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
  QrCode,
  Search,
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
      detail: '每位用户每个赛道最多 5 票，作品提交截止到 2026 年 6 月 5 日 24:00。',
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
      detail: '获奖名单公示、权益发放和校园专区上架正在进行。',
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
}: {
  eyebrow: string;
  title: string;
  description?: string;
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
        <div className="grid gap-4 md:grid-cols-2">
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-[15px] font-semibold text-emerald-900">现在最重要</div>
              <p className="mt-2 text-[13px] leading-6 text-emerald-800">
                先完成报名问卷，再发布公开 Skill。活动资格会按报名手机号校验。
              </p>
              <Button
                type="button"
                onClick={onSignupClick}
                className={cn(eventPrimaryButtonClass, 'mt-4 w-full')}
              >
                填写报名问卷
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
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
            每个 Skill 只能选择一个赛道。重复设置会更新该 Skill 的参赛赛道。
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
        </aside>
      </div>
    </div>
  );
}

function SubmissionsTab() {
  return (
    <div>
      <SectionTitle
        eyebrow="Submissions"
        title="作品专区"
        description="参赛作品会在征集期公开展示，投票功能将在 2026 年 6 月 1 日开放。"
      />
      <EmptyState
        icon={<MessageCircle className="h-5 w-5" />}
        title="作品专区暂未开放"
        description="作品列表、赛道筛选和投票入口会在后续迭代中接入。投票期每位用户每个赛道最多 5 票。"
      />
    </div>
  );
}

function AwardsTab() {
  return (
    <div>
      <SectionTitle
        eyebrow="Awards"
        title="获奖公示"
        description="公示期为 2026 年 6 月 11 日至 6 月 15 日，参与奖也会进入公示结果。"
      />
      <EmptyState
        icon={<Award className="h-5 w-5" />}
        title="获奖名单待公示"
        description="专家评审和大众投票结束后，这里会展示获奖作品、奖项、创作者姓名及所属学院/单位。"
      />
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
