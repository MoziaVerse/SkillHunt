import { InstallCommand } from '@/components/install-command';

export default function HowToPublish() {
  return (
    <>
      <header className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
          guide · 03
        </div>
        <h1 className="font-semibold text-[36px] leading-[1.05] tracking-[-0.02em]">
          How to Publish
        </h1>
      </header>

      <div className="border-l-2 border-amber-400 bg-amber-50 pl-4 py-3 my-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-amber-700 mb-1">
          phase 0
        </div>
        <p className="text-[13.5px] text-amber-900 m-0">
          外部发布流程 Phase 1 开放。目前通过内部脚本录入。
        </p>
      </div>

      <h2>Internal: Import Script</h2>
      <p>Mozia 内部成员可以用 import 脚本把本地目录录入为 owned skill:</p>
      <div className="my-5">
        <InstallCommand command="pnpm seed:owned" />
      </div>

      <h2>Submit a Skill</h2>
      <p>如果你有一个想加入 SkillHub 的 skill:</p>
      <ol>
        <li>
          开一个 issue 到 <code>MoziaVerse/mozia-skillhub</code>
        </li>
        <li>附上 SKILL.md 草稿和 3 个使用场景</li>
        <li>维护者 review 后走 import 脚本录入</li>
      </ol>

      <h2>Phase 1 Roadmap</h2>
      <ul>
        <li>Web UI 提交 + 预览</li>
        <li>基于 GitHub OAuth 的发布者身份</li>
        <li>自动爬取公开仓库的 skill 并索引</li>
      </ul>
    </>
  );
}
