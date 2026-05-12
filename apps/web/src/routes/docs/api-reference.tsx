const codeBlockClass =
  'my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto';
const inlineCodeClass = 'text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5';
const tableClass =
  'w-full text-[13px] font-mono border border-neutral-200 rounded-xl overflow-hidden';
const tableHeadRowClass = 'border-b border-neutral-200 bg-neutral-50';
const tableBodyRowClass = 'border-b border-neutral-100';
const thClass = 'text-left px-3 py-2';
const tdClass = 'px-3 py-2';
const tdTextClass = 'px-3 py-2 text-[13px] font-sans';

const scopeRows = [
  ['profile:read', '读取当前登录用户资料', 'GET /me'],
  ['skills:read', '读取公开 skill', 'GET /skills、GET /skills/:owner/:slug'],
  ['skills:read_private', '读取当前用户可见的私有 skill 元信息', 'GET /me/skills'],
  ['skills:files:read', '读取 skill 文件内容和安装包快照', 'GET /skills/:owner/:slug/package'],
  ['skills:install', '为可访问的 skill 生成安装令牌', 'POST /install-tokens'],
  ['skills:write', '创建、更新、删除 skill 和文件', 'POST /skills、PUT /skills/:owner/:slug'],
  ['community:write', '评论、点赞、收藏等社区动作', 'POST /comments、POST /upvote'],
  ['notifications:read', '读取和更新当前用户通知', 'GET /notifications'],
];

const endpointGroups = [
  {
    title: '公开发现',
    rows: [
      ['GET /skills', '无需认证', '搜索、筛选和分页获取公开 skill。'],
      ['GET /skills/:owner/:slug', '无需认证', '读取公开 skill 详情。'],
      ['GET /tags', '无需认证', '读取公开 skill 使用过的标签。'],
    ],
  },
  {
    title: '当前用户与私有内容',
    rows: [
      ['GET /me', 'profile:read', '读取当前登录用户资料。'],
      ['GET /me/skills', 'skills:read_private', '读取当前用户发布、引用和可见的私有 skill。'],
      ['GET /me/bookmarks', 'skills:read', '读取当前用户收藏的 skill。'],
      [
        'GET /users/:owner/skills',
        'skills:read_private',
        '读取指定用户公开 skill；本人可额外看到自己的私有 skill。',
      ],
      [
        'GET /skills/:owner/:slug/package',
        'skills:files:read',
        '读取 Agent 可安装的完整文件快照。',
      ],
      ['GET /skills/:owner/:slug/files', 'skills:files:read', '读取文件列表。'],
      ['GET /skills/:owner/:slug/files/:path', 'skills:files:read', '读取单个文件内容。'],
    ],
  },
  {
    title: '发布与维护',
    rows: [
      ['POST /skills', 'skills:write', '发布一个新 skill。'],
      ['PUT /skills/:owner/:slug', 'skills:write', '更新 skill 的展示信息、可见性和 SKILL.md。'],
      ['DELETE /skills/:owner/:slug', 'skills:write', '删除 skill。'],
      ['POST /skills/:owner/:slug/files/:path', 'skills:write', '添加或更新附加文件。'],
      [
        'DELETE /skills/:owner/:slug/files/:path',
        'skills:write',
        '删除附加文件，不能删除 SKILL.md。',
      ],
    ],
  },
  {
    title: '社区与安装',
    rows: [
      ['GET /skills/:owner/:slug/comments', '无需认证', '读取公开 skill 评论。'],
      ['POST /skills/:owner/:slug/comments', 'community:write', '发表评论。'],
      ['POST /skills/:owner/:slug/upvote', 'community:write', '点赞 skill。'],
      ['DELETE /skills/:owner/:slug/upvote', 'community:write', '取消点赞。'],
      ['POST /skills/:owner/:slug/bookmark', 'community:write', '收藏 skill。'],
      ['DELETE /skills/:owner/:slug/bookmark', 'community:write', '取消收藏。'],
      ['POST /install-tokens', 'skills:install', '为私有 skill 生成有时效、有限次数的安装链接。'],
    ],
  },
];

export default function ApiReference() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          参考 · 04
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          API 参考
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          这篇文档面向要接入 SkillHunt 的第三方应用和 Agent
          客户端。阅读顺序建议是：先确认基础地址，再接入 SSO 登录，最后按业务场景选择端点。
        </p>
      </header>

      <h2 id="base-url">基础地址</h2>
      <p>所有 API 都以这个地址为前缀，响应格式均为 JSON。</p>
      <pre className={codeBlockClass}>{'https://skillhunt.mozia.ai/api'}</pre>

      <h2 id="quick-start">最快接入</h2>
      <p>只读取公开 skill 时不需要登录；读取用户私有内容时，必须携带 SSO 返回的 access_token。</p>

      <h3>1. 搜索公开 skill</h3>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills?q=video&sort=hottest&limit=20"`}
      </pre>

      <h3>2. 读取当前用户的 skill</h3>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/me/skills" \\
  -H "Authorization: Bearer sso_access_token"`}
      </pre>

      <h3>3. 获取可安装的文件快照</h3>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/video-helper/package" \\
  -H "Authorization: Bearer sso_access_token"`}
      </pre>

      <h2 id="auth">认证方式</h2>
      <p>
        SkillHunt 目前只接受同一套 SSO 登录后获得的 OAuth/OIDC{' '}
        <code className={inlineCodeClass}>access_token</code> 作为私有 API 凭据。
      </p>
      <pre className={codeBlockClass}>{'Authorization: Bearer sso_access_token'}</pre>
      <p>
        不要使用 <code className={inlineCodeClass}>id_token</code> 调用 API。id_token
        只用于让客户端确认用户是谁；access_token 才用于访问 SkillHunt 资源。SkillHunt 会验证 token
        的签名、签发方、过期时间和 scope。
      </p>

      <h2 id="scopes">Scope</h2>
      <p>第三方应用只应申请自己业务需要的 scope。读取私有 skill 文件通常需要同时具备两个权限。</p>
      <pre className={codeBlockClass}>{'skills:read_private skills:files:read'}</pre>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>Scope</th>
              <th className={thClass}>能力</th>
              <th className={thClass}>常用端点</th>
            </tr>
          </thead>
          <tbody>
            {scopeRows.map(([scope, ability, endpoint], index) => (
              <tr
                key={scope}
                className={index === scopeRows.length - 1 ? undefined : tableBodyRowClass}
              >
                <td className={tdClass}>{scope}</td>
                <td className={tdTextClass}>{ability}</td>
                <td className={tdClass}>{endpoint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="common-flows">常用流程</h2>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>目标</th>
              <th className={thClass}>推荐调用顺序</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdTextClass}>展示公开发现页</td>
              <td className={tdClass}>GET /skills → GET /skills/:owner/:slug</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdTextClass}>展示“我的 skills”</td>
              <td className={tdClass}>SSO 登录 → GET /me → GET /me/skills</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdTextClass}>给 Agent 安装 skill</td>
              <td className={tdClass}>GET /skills/:owner/:slug/package → 写入本地 skill 目录</td>
            </tr>
            <tr>
              <td className={tdTextClass}>同步私有 skill 文件</td>
              <td className={tdClass}>
                GET /me/skills → GET /skills/:owner/:slug/package 或 GET /files/:path
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="endpoints">端点速查</h2>
      <p>下面只列最常用的正式端点。路径均省略基础地址前缀。</p>
      {endpointGroups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <div className="my-4 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={thClass}>端点</th>
                  <th className={thClass}>所需 scope</th>
                  <th className={thClass}>说明</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(([endpoint, scope, description], index) => (
                  <tr
                    key={endpoint}
                    className={index === group.rows.length - 1 ? undefined : tableBodyRowClass}
                  >
                    <td className={tdClass}>{endpoint}</td>
                    <td className={tdClass}>{scope}</td>
                    <td className={tdTextClass}>{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2 id="examples">核心示例</h2>

      <h3>搜索参数</h3>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>参数</th>
              <th className={thClass}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>q</td>
              <td className={tdTextClass}>搜索关键词，最长 200 字符。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>tag</td>
              <td className={tdTextClass}>
                按标签过滤，可重复传入：<code>?tag=a&amp;tag=b</code>。
              </td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>sort</td>
              <td className={tdTextClass}>
                <code>recent</code>、<code>hottest</code> 或 <code>az</code>，默认{' '}
                <code>recent</code>。
              </td>
            </tr>
            <tr>
              <td className={tdClass}>limit / offset</td>
              <td className={tdTextClass}>分页参数，limit 范围 1-100，默认 20。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>安装包快照响应</h3>
      <p>
        <code className={inlineCodeClass}>/package</code> 是 Agent
        客户端最应该优先使用的端点。它返回安装所需的元信息和文件内容。
      </p>
      <pre className={codeBlockClass}>
        {`{
  "id": "uuid",
  "owner": { "id": "uuid", "name": "Alice", "handle": "alice" },
  "slug": "video-helper",
  "name": "Video Helper",
  "visibility": "private",
  "protocolName": "alice-video-helper-a1b2c3d4",
  "hash": "sha256:...",
  "files": [
    { "path": "SKILL.md", "content": "---\\nname: Video Helper\\n---\\n..." }
  ],
  "updatedAt": "2026-05-12T08:00:00.000Z"
}`}
      </pre>

      <h3>发布 skill</h3>
      <pre className={codeBlockClass}>
        {`curl -X POST "https://skillhunt.mozia.ai/api/skills" \\
  -H "Authorization: Bearer sso_access_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "owner": "alice",
    "slug": "video-helper",
    "name": "Video Helper",
    "description": "辅助 Agent 分析视频内容",
    "tags": ["video", "agent"],
    "visibility": "private",
    "skillMdContent": "---\\nname: Video Helper\\n---\\n# Video Helper\\n..."
  }'`}
      </pre>

      <h2 id="errors">错误处理</h2>
      <p>错误响应统一返回一个 JSON 对象：</p>
      <pre className={codeBlockClass}>
        {`{
  "error": "error description"
}`}
      </pre>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>状态码</th>
              <th className={thClass}>含义</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>400</td>
              <td className={tdTextClass}>请求参数无效。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>401</td>
              <td className={tdTextClass}>未登录、SSO access_token 无效或已过期。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>403</td>
              <td className={tdTextClass}>已认证，但缺少 scope 或没有资源操作权限。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>404</td>
              <td className={tdTextClass}>资源不存在，或当前用户无权知道该私有资源是否存在。</td>
            </tr>
            <tr>
              <td className={tdClass}>500</td>
              <td className={tdTextClass}>服务端错误。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="well-known">公开 Agent 协议</h2>
      <p>
        <code className={inlineCodeClass}>/.well-known/agent-skills</code> 只用于公开 skill
        的自动发现和安装。需要登录用户上下文或私有 skill 时，请使用上面的{' '}
        <code className={inlineCodeClass}>/api</code> 端点。
      </p>
      <pre className={codeBlockClass}>
        {`GET /.well-known/agent-skills/index.json
GET /.well-known/agent-skills/:owner/:slug/:file`}
      </pre>
    </>
  );
}
