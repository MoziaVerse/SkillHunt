import { Logo } from '@/components/logo';
import { Link } from 'react-router';

function PublishOption({
  to,
  eyebrow,
  title,
  description,
  bullets,
  accent,
}: {
  to: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  accent: 'emerald' | 'amber';
}) {
  const isEmerald = accent === 'emerald';

  return (
    <Link to={to} className="skill-card group block p-6">
      <div>
        <div
          className={
            isEmerald
              ? 'inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-800'
              : 'inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-800'
          }
        >
          {eyebrow}
        </div>
        <h2 className="mt-5 text-[26px] font-bold tracking-[-0.03em] text-neutral-950">{title}</h2>
        <p className="mt-3 min-h-[72px] text-[15px] leading-7 text-neutral-600">{description}</p>
        <div className="mt-6 space-y-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex items-center gap-2 text-[14px] text-neutral-700">
              <span
                className={
                  isEmerald
                    ? 'h-1.5 w-1.5 rounded-full bg-emerald-500'
                    : 'h-1.5 w-1.5 rounded-full bg-amber-500'
                }
              />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-[14px] font-semibold text-white transition group-hover:bg-neutral-800">
          开始发布
          <span className="transition group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </Link>
  );
}

export default function PublishChoicePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-[1120px] items-center gap-1.5 text-[13px]">
          <Link to="/" className="text-neutral-500 transition hover:text-neutral-900">
            <Logo size={16} className="text-neutral-900" />
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="font-medium text-neutral-900">发布</span>
        </div>
      </nav>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-[1120px]">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[13px] text-neutral-700">
              发布新的 Agent 能力
            </span>
            <h1 className="mt-5 text-[42px] font-bold leading-[1.05] tracking-[-0.04em] text-neutral-950 sm:text-[58px]">
              你想发布什么？
            </h1>
            <p className="mt-5 text-[17px] leading-8 text-neutral-600">
              可以发布一个独立 Skill，也可以把一组相关 skills 组织成 Skill 包。SkillHunt
              会把发布、发现、讨论和安装放在同一条产品路径里。
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <PublishOption
              to="/publish/skill"
              eyebrow="单个能力"
              title="发布 Skill"
              description="上传 SKILL.md 或完整 skill 文件夹，补充发布文案后，让社区发现并安装这个能力。"
              bullets={[
                '适合发布一个明确能力',
                '支持附加文件与发布版本',
                '详情页展示讨论与安装入口',
              ]}
              accent="emerald"
            />
            <PublishOption
              to="/publish/package"
              eyebrow="场景组合"
              title="发布 Skill 包"
              description="从已有 skills 中选择一组相关能力，生成对 npx skills CLI 友好的整包安装入口。"
              bullets={['适合一组相关 skills', '一条命令安装整包', '仍兼容标准 well-known 协议']}
              accent="amber"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
