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
          SkillHunt 开放平台 API 面向第三方应用和 Agent 客户端。所有端点均返回 JSON，基础路径为{' '}
          <code className={inlineCodeClass}>/api</code>。
        </p>
      </header>

      <h2 id="base-url">基础地址</h2>
      <pre className={codeBlockClass}>{'https://skillhunt.mozia.ai/api'}</pre>

      <h2 id="endpoint-groups">端点分类</h2>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>分类</th>
              <th className={thClass}>典型端点</th>
              <th className={thClass}>认证要求</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>公开发现</td>
              <td className={tdClass}>GET /skills、GET /tags、GET /skills/:owner/:slug</td>
              <td className={tdTextClass}>无需登录，只返回公开 skill。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>授权读取</td>
              <td className={tdClass}>GET /me、GET /me/skills、GET /skills/:owner/:slug/package</td>
              <td className={tdTextClass}>第三方应用使用 Bearer token。</td>
            </tr>
            <tr>
              <td className={tdClass}>写入与互动</td>
              <td className={tdClass}>POST /skills、POST /comments、POST /install-tokens</td>
              <td className={tdTextClass}>需要登录，并且 token 或 session 具备对应 scope。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="integration-flow">第三方应用接入流程</h2>
      <ol className="my-4 list-decimal pl-5 space-y-2">
        <li>先使用公开端点做发现和搜索，例如读取公开 skill 列表、标签和详情。</li>
        <li>
          如果需要读取登录用户信息、用户自己的私有 skill 或安装包，请让用户授权应用，并由 SkillHunt
          为应用签发访问令牌。
        </li>
        <li>
          调用 API 时在请求头传入 <code className={inlineCodeClass}>Authorization: Bearer</code>
          。服务端会根据 token 上的 scope 判断可访问的数据。
        </li>
        <li>
          安装或同步 skill 时，优先读取{' '}
          <code className={inlineCodeClass}>/skills/:owner/:slug/package</code>
          ，它会返回 Agent 可消费的文件快照。
        </li>
      </ol>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/me/skills" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>

      <h2 id="auth">认证</h2>
      <p>公开端点无需认证。访问用户资料、私有 skill、安装包快照或写入接口时，需要使用访问令牌。</p>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>方式</th>
              <th className={thClass}>适用场景</th>
              <th className={thClass}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>匿名访问</td>
              <td className={tdTextClass}>公开发现、公开详情、公开安装包</td>
              <td className={tdTextClass}>
                默认具备 <code>skills:read</code>。
              </td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>Bearer token</td>
              <td className={tdTextClass}>第三方应用、Agent 客户端、服务端集成</td>
              <td className={tdTextClass}>推荐给外部应用使用，token 按用户和应用分配 scope。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre className={codeBlockClass}>{'Authorization: Bearer skh_example_access_token'}</pre>
      <p>
        访问令牌应由应用在用户授权后获得，并只申请业务必需的 scope。服务端应用应妥善保存
        token；前端应用不要长期暴露高权限 token。
      </p>

      <h2 id="scopes">Scope</h2>
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
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>profile:read</td>
              <td className={tdTextClass}>读取当前用户资料。</td>
              <td className={tdClass}>GET /me</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>skills:read</td>
              <td className={tdTextClass}>读取公开 skill。</td>
              <td className={tdClass}>GET /skills、GET /skills/:owner/:slug</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>skills:read_private</td>
              <td className={tdTextClass}>读取当前用户可见的私有 skill 元信息。</td>
              <td className={tdClass}>GET /me/skills、GET /users/:owner/skills</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>skills:files:read</td>
              <td className={tdTextClass}>读取 skill 文件内容和安装包快照。</td>
              <td className={tdClass}>GET /skills/:owner/:slug/files、GET /package</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>skills:install</td>
              <td className={tdTextClass}>为可访问的 skill 生成安装令牌。</td>
              <td className={tdClass}>POST /install-tokens</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>skills:write</td>
              <td className={tdTextClass}>创建、更新、删除 skill 和文件。</td>
              <td className={tdClass}>POST /skills、PUT /skills/:owner/:slug</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>community:write</td>
              <td className={tdTextClass}>发表评论、点赞、收藏等社区动作。</td>
              <td className={tdClass}>POST /comments、POST /upvote、POST /bookmark</td>
            </tr>
            <tr>
              <td className={tdClass}>notifications:read</td>
              <td className={tdTextClass}>读取和更新当前用户通知。</td>
              <td className={tdClass}>GET /notifications、POST /notifications/:id/read</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="errors">错误</h2>
      <p>所有错误响应格式一致：</p>
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
              <td className={tdTextClass}>未登录、token 无效或 session 过期。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>403</td>
              <td className={tdTextClass}>已认证，但缺少所需 scope 或没有资源操作权限。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>404</td>
              <td className={tdTextClass}>资源不存在，或当前 actor 无权知道该私有资源是否存在。</td>
            </tr>
            <tr>
              <td className={tdClass}>500</td>
              <td className={tdTextClass}>服务端错误。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="skills">技能接口</h2>

      <h3>
        <code className={inlineCodeClass}>GET /skills</code>
      </h3>
      <p>
        列出和搜索 skill。匿名请求只返回公开 skill；带有{' '}
        <code className={inlineCodeClass}>skills:read_private</code> 的 token
        会额外返回当前用户可见的私有 skill。
      </p>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>参数</th>
              <th className={thClass}>类型</th>
              <th className={thClass}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>type</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>
                <code>owned</code> | <code>referenced</code> | <code>all</code>，默认{' '}
                <code>all</code>。
              </td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>q</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>搜索关键词，最长 200 字符。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>tag</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>
                按标签过滤，可多个 <code>?tag=a&amp;tag=b</code>。
              </td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>sort</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>
                <code>recent</code> | <code>hottest</code> | <code>az</code>，默认{' '}
                <code>recent</code>。
              </td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>limit</td>
              <td className={tdClass}>number</td>
              <td className={tdTextClass}>每页数量，范围 1-100，默认 20。</td>
            </tr>
            <tr>
              <td className={tdClass}>offset</td>
              <td className={tdClass}>number</td>
              <td className={tdTextClass}>分页偏移量，默认 0。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills?q=react&tag=frontend&sort=hottest&limit=20"`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "items": [
    {
      "id": "uuid",
      "slug": "react-hooks",
      "name": "React Hooks",
      "description": "...",
      "tags": ["react", "frontend"],
      "type": "owned",
      "visibility": "public",
      "owner": {
        "id": "uuid",
        "name": "alice",
        "handle": "alice"
      },
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-03-01T12:00:00.000Z"
    }
  ],
  "total": 42
}`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /skills/:owner/:slug</code>
      </h3>
      <p>获取单个 skill 的完整信息，包含 SKILL.md 内容和文件列表。</p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/react-hooks"`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "id": "uuid",
  "slug": "react-hooks",
  "name": "React Hooks",
  "description": "...",
  "tags": ["react", "frontend"],
  "type": "owned",
  "visibility": "public",
  "owner": { "id": "uuid", "name": "alice", "handle": "alice" },
  "skillMdContent": "---\\nname: React Hooks\\n---\\n...",
  "files": ["SKILL.md", "examples/usage.md"],
  "installCommand": "npx skills add https://skillhunt.mozia.ai --skill alice/react-hooks",
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-03-01T12:00:00.000Z"
}`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /skills/:owner/:slug/packages</code>
      </h3>
      <p>
        获取收录这个 skill 的 Skills
        包列表。公开包可以匿名查看；私有包只会在当前用户有权查看该包时返回。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/packages"`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /skills/:owner/:slug/package</code>
      </h3>
      <p>
        获取可供 Agent 或第三方应用消费的 skill 文件快照。公开 skill 可以匿名读取；私有 skill
        需要用户授权，并同时具备 <code className={inlineCodeClass}>skills:read_private</code> 和{' '}
        <code className={inlineCodeClass}>skills:files:read</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/package" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "id": "uuid",
  "owner": { "id": "uuid", "name": "alice", "handle": "alice" },
  "slug": "react-hooks",
  "name": "React Hooks",
  "description": "...",
  "visibility": "private",
  "protocolName": "alice-react-hooks-a1b2c3d4",
  "installCommand": "npx skills add https://skillhunt.mozia.ai --skill alice-react-hooks-a1b2c3d4",
  "hash": "sha256:...",
  "files": [
    { "path": "SKILL.md", "content": "---\\nname: React Hooks\\n---\\n..." },
    { "path": "examples/usage.md", "content": "# Usage\\n..." }
  ],
  "updatedAt": "2026-03-01T12:00:00.000Z"
}`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>POST /skills</code>
      </h3>
      <p>
        创建新 skill。需要 <code className={inlineCodeClass}>skills:write</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl -X POST "https://skillhunt.mozia.ai/api/skills" \\
  -H "Authorization: Bearer skh_example_access_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "owner": "alice",
    "slug": "react-hooks",
    "name": "React Hooks",
    "description": "React Hooks 最佳实践",
    "tags": ["react", "frontend"],
    "visibility": "public",
    "skillMdContent": "---\\nname: React Hooks\\n---\\n..."
  }'`}
      </pre>
      <p>
        响应：<code>201 Created</code>，返回创建的 skill 对象。
      </p>

      <h3>
        <code className={inlineCodeClass}>PUT /skills/:owner/:slug</code>
      </h3>
      <p>
        更新 skill。仅 owner 可操作，需要 <code className={inlineCodeClass}>skills:write</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl -X PUT "https://skillhunt.mozia.ai/api/skills/alice/react-hooks" \\
  -H "Authorization: Bearer skh_example_access_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "description": "更新后的描述",
    "tags": ["react", "frontend", "hooks"]
  }'`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>DELETE /skills/:owner/:slug</code>
      </h3>
      <p>
        删除 skill。仅 owner 可操作，需要 <code className={inlineCodeClass}>skills:write</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl -X DELETE "https://skillhunt.mozia.ai/api/skills/alice/react-hooks" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>
      <p>
        响应：<code>204 No Content</code>
      </p>

      <h2 id="skill-files">技能文件</h2>

      <h3>
        <code className={inlineCodeClass}>GET /skills/:owner/:slug/files</code>
      </h3>
      <p>
        获取 skill 文件列表。公开 skill 可以匿名读取；私有 skill 需要{' '}
        <code className={inlineCodeClass}>skills:read_private</code> 和{' '}
        <code className={inlineCodeClass}>skills:files:read</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/files"`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "files": ["SKILL.md", "examples/usage.md"]
}`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /skills/:owner/:slug/files/:path</code>
      </h3>
      <p>读取单个 skill 文件内容。路径不能包含前导斜杠或上级目录。</p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/files/examples/usage.md"`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "path": "examples/usage.md",
  "content": "# Usage\\n..."
}`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>POST /skills/:owner/:slug/files/:path</code>
      </h3>
      <p>
        添加或更新 skill 的附加文件。仅 owner 可操作，需要{' '}
        <code className={inlineCodeClass}>skills:write</code>。
      </p>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>参数</th>
              <th className={thClass}>类型</th>
              <th className={thClass}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>path</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>
                文件路径，无前导 <code>/</code>，无 <code>..</code>，最长 512 字符。
              </td>
            </tr>
            <tr>
              <td className={tdClass}>content</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>文件内容，最长 200,000 字符。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre className={codeBlockClass}>
        {`curl -X POST "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/files/examples/usage.md" \\
  -H "Authorization: Bearer skh_example_access_token" \\
  -H "Content-Type: application/json" \\
  -d '{ "content": "# Usage Examples\\n..." }'`}
      </pre>
      <p>
        响应：<code>204 No Content</code>
      </p>

      <h3>
        <code className={inlineCodeClass}>DELETE /skills/:owner/:slug/files/:path</code>
      </h3>
      <p>
        删除附加文件。不能删除 <code>SKILL.md</code>。仅 owner 可操作，需要{' '}
        <code className={inlineCodeClass}>skills:write</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl -X DELETE "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/files/examples/usage.md" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>
      <p>
        响应：<code>204 No Content</code>
      </p>

      <h2 id="current-user">当前用户</h2>

      <h3>
        <code className={inlineCodeClass}>GET /me</code>
      </h3>
      <p>
        获取当前登录用户信息。第三方应用需要 <code className={inlineCodeClass}>profile:read</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/me" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "id": "uuid",
  "name": "Alice",
  "handle": "alice",
  "email": "alice@example.com",
  "image": null,
  "isVirtual": false,
  "canPublishAs": ["team-org"]
}`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /me/skills</code>
      </h3>
      <p>
        获取当前用户发布或引用的 skill。只有具备{' '}
        <code className={inlineCodeClass}>skills:read_private</code> 时才会包含当前用户的私有
        skill。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/me/skills" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /me/bookmarks</code>
      </h3>
      <p>
        获取当前用户收藏的 skill。需要 <code className={inlineCodeClass}>skills:read</code>。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/me/bookmarks" \\
  -H "Authorization: Bearer skh_example_access_token"`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>PATCH /me/profile</code>
      </h3>
      <p>更新当前用户资料。站内 Web 使用该接口；第三方应用默认不建议申请写资料权限。</p>

      <h3>
        <code className={inlineCodeClass}>PATCH /me/avatar</code>
      </h3>
      <p>更新当前用户头像地址。站内 Web 使用该接口；第三方应用默认不建议申请写资料权限。</p>

      <p>
        旧路径 <code className={inlineCodeClass}>/users/me</code>、{' '}
        <code className={inlineCodeClass}>/users/me/skills</code> 和{' '}
        <code className={inlineCodeClass}>/users/me/bookmarks</code> 仍然兼容，个人 Skills 包也支持{' '}
        <code className={inlineCodeClass}>/users/me/packages</code>。新应用请优先使用{' '}
        <code className={inlineCodeClass}>/me</code> 相关路径。
      </p>

      <h2 id="public-users">公开用户</h2>

      <h3>
        <code className={inlineCodeClass}>GET /users/:owner/skills</code>
      </h3>
      <p>
        获取指定用户公开的 skill 列表。如果 token 对应的用户正是该 owner，并且具备{' '}
        <code className={inlineCodeClass}>skills:read_private</code>，响应会包含自己的私有 skill。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/users/alice/skills"`}
      </pre>

      <h3>
        <code className={inlineCodeClass}>GET /users/:owner/packages</code>
      </h3>
      <p>
        获取指定用户发布的 Skills 包列表。如果 token 对应的用户正是该 owner，并且具备{' '}
        <code className={inlineCodeClass}>skills:read_private</code>，响应会包含自己的私有包。
      </p>
      <pre className={codeBlockClass}>
        {`curl "https://skillhunt.mozia.ai/api/users/alice/packages"`}
      </pre>

      <h2 id="community">社区互动</h2>
      <p>
        社区写入接口需要 <code className={inlineCodeClass}>community:write</code>
        。读取评论可以匿名访问公开 skill 或公开 Skills 包，私有内容仍遵循统一可见性判断。
      </p>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>端点</th>
              <th className={thClass}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>GET /skills/:owner/:slug/comments</td>
              <td className={tdTextClass}>读取 skill 评论。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>POST /skills/:owner/:slug/comments</td>
              <td className={tdTextClass}>发表评论。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>POST /skills/:owner/:slug/upvote</td>
              <td className={tdTextClass}>点赞 skill。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>DELETE /skills/:owner/:slug/upvote</td>
              <td className={tdTextClass}>取消点赞。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>POST /skills/:owner/:slug/bookmark</td>
              <td className={tdTextClass}>收藏 skill。</td>
            </tr>
            <tr>
              <td className={tdClass}>DELETE /skills/:owner/:slug/bookmark</td>
              <td className={tdTextClass}>取消收藏。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>GET /packages/:owner/:slug/comments</td>
              <td className={tdTextClass}>读取 Skills 包评论。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>POST /packages/:owner/:slug/comments</td>
              <td className={tdTextClass}>给 Skills 包发表评论。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>POST /packages/:owner/:slug/upvote</td>
              <td className={tdTextClass}>点赞 Skills 包。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>DELETE /packages/:owner/:slug/upvote</td>
              <td className={tdTextClass}>取消点赞 Skills 包。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>POST /packages/:owner/:slug/bookmark</td>
              <td className={tdTextClass}>收藏 Skills 包。</td>
            </tr>
            <tr>
              <td className={tdClass}>DELETE /packages/:owner/:slug/bookmark</td>
              <td className={tdTextClass}>取消收藏 Skills 包。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="install-tokens">安装令牌</h2>
      <p>
        为私有 skill 生成有时效、有次数限制的安装链接。需要{' '}
        <code className={inlineCodeClass}>skills:install</code>，且当前用户必须有权访问该 skill。
      </p>

      <h3>
        <code className={inlineCodeClass}>POST /install-tokens</code>
      </h3>
      <div className="my-4 overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={thClass}>参数</th>
              <th className={thClass}>类型</th>
              <th className={thClass}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>skillId</td>
              <td className={tdClass}>string</td>
              <td className={tdTextClass}>skill UUID。</td>
            </tr>
            <tr className={tableBodyRowClass}>
              <td className={tdClass}>expiresInHours</td>
              <td className={tdClass}>number</td>
              <td className={tdTextClass}>过期时间，范围 1-168 小时，默认 24。</td>
            </tr>
            <tr>
              <td className={tdClass}>maxUses</td>
              <td className={tdClass}>number</td>
              <td className={tdTextClass}>最大使用次数，范围 1-100，默认 1。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre className={codeBlockClass}>
        {`curl -X POST "https://skillhunt.mozia.ai/api/install-tokens" \\
  -H "Authorization: Bearer skh_example_access_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "skillId": "uuid-of-skill",
    "expiresInHours": 48,
    "maxUses": 5
  }'`}
      </pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "token": "capability-token",
  "expiresAt": "2026-05-08T12:00:00.000Z",
  "maxUses": 5,
  "installCommand": "npx skills add https://skillhunt.mozia.ai/i/capability-token"
}`}
      </pre>

      <h2 id="well-known">Well-Known 协议</h2>
      <p>
        SkillHunt 同时实现 <code className={inlineCodeClass}>/.well-known/agent-skills</code>{' '}
        协议，用于公开 skill 的 Agent
        自动发现和安装。第三方应用需要更完整的登录用户上下文时，应优先使用{' '}
        <code className={inlineCodeClass}>/api</code>。
      </p>

      <h3>
        <code className={inlineCodeClass}>GET /.well-known/agent-skills/index.json</code>
      </h3>
      <p>列出所有公开 skill 的索引。</p>

      <h3>
        <code className={inlineCodeClass}>GET /.well-known/agent-skills/:owner/:slug/:file</code>
      </h3>
      <p>获取指定公开 skill 的文件内容。</p>
      <pre className={codeBlockClass}>
        {`# 安装公开 skill
npx skills add https://skillhunt.mozia.ai --skill alice/react-hooks

# 通过 capability URL 安装私有 skill
npx skills add https://skillhunt.mozia.ai/i/capability-token`}
      </pre>

      <h2 id="tags">标签</h2>

      <h3>
        <code className={inlineCodeClass}>GET /tags</code>
      </h3>
      <p>获取所有公开 skill 使用的标签列表。</p>
      <pre className={codeBlockClass}>{`curl "https://skillhunt.mozia.ai/api/tags"`}</pre>
      <p>响应：</p>
      <pre className={codeBlockClass}>
        {`{
  "tags": ["react", "frontend", "backend", "testing", "devops"]
}`}
      </pre>
    </>
  );
}
