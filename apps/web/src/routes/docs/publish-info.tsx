export default function PublishInfo() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          发布 · 05
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          发布信息填写指南
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          发布信息决定别人是否愿意点开、试用、评论和收藏你的 Skill。
        </p>
      </header>

      <h2>名称</h2>
      <ul>
        <li>写清楚能力对象，不要只写抽象词。</li>
        <li>推荐：会议纪要整理助手、论文摘要改写助手、接口报错排查助手。</li>
        <li>不推荐：超级助手、AI 工具、万能 Agent、测试 Skill。</li>
      </ul>

      <h2>一句话介绍</h2>
      <p>一句话介绍会出现在列表页和发布预览中，建议控制在 40 字以内。</p>
      <ul>
        <li>推荐写法：把课程资料整理成可复习的知识卡片。</li>
        <li>推荐写法：根据日志和报错信息定位接口问题。</li>
        <li>不推荐写法：这是一个很好用的 Skill。</li>
      </ul>

      <h2>标签</h2>
      <ul>
        <li>优先选择官方标签，保证能被稳定归类。</li>
        <li>官方标签不够时，再补充 1-2 个自定义标签。</li>
        <li>标签应描述场景或任务类型，不要写过宽泛的词。</li>
      </ul>

      <h2>图标或封面</h2>
      <ul>
        <li>Emoji 图标适合轻量工具，识别快、成本低。</li>
        <li>封面图适合需要展示场景、作品风格或视觉效果的 Skill。</li>
        <li>二者只能选一个。列表页第一眼能看懂，比装饰感更重要。</li>
      </ul>

      <h2>演示视频</h2>
      <ul>
        <li>可选，但推荐给复杂 Skill 添加。</li>
        <li>视频重点展示输入、处理过程和输出结果。</li>
        <li>不要只录介绍页；用户更关心实际能完成什么。</li>
      </ul>

      <h2>公开与私有</h2>
      <div className="my-6 border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                可见性
              </th>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                适合场景
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2.5 border-b border-neutral-100">私有</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">
                草稿、自测、内部使用、包含未整理材料。
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">公开</td>
              <td className="px-4 py-2.5">适合被搜索、安装、评论、Fork 的稳定版本。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>发布预览怎么判断</h2>
      <ul>
        <li>只看卡片，不读全文，也能知道它解决什么问题。</li>
        <li>标题、介绍、标签没有互相重复。</li>
        <li>如果展示给陌生用户，对方能在 5 秒内判断是否相关。</li>
      </ul>

      <h2>延伸阅读</h2>
      <ul>
        <li>
          <a
            href="https://agentskills.io/skill-creation/optimizing-descriptions"
            target="_blank"
            rel="noreferrer"
          >
            Optimizing skill descriptions
          </a>
          ：理解为什么 <code>description</code> 要同时说明“做什么”和“何时使用”。
        </li>
        <li>
          <a
            href="https://agentskills.io/skill-creation/best-practices"
            target="_blank"
            rel="noreferrer"
          >
            Best practices for skill creators
          </a>
          ：参考如何把 Skill 写成清晰、可复用、不过度泛化的能力单元。
        </li>
      </ul>
    </>
  );
}
