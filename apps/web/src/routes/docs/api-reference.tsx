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
          SkillHunt REST API 的完整参考。所有端点均返回 JSON，使用 HTTPS。
        </p>
      </header>

      {/* Base URL */}
      <h2>基础地址</h2>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {'https://skillhunt.mozia.ai/api'}
      </pre>

      {/* Authentication */}
      <h2>认证</h2>
      <p>
        公开端点无需认证。创建、更新、删除 skill 需要通过 mozia-sso 登录获取 session
        cookie。请求时浏览器会自动携带 cookie。
      </p>

      {/* Errors */}
      <h2>错误</h2>
      <p>所有错误响应格式一致：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`{
  "error": "error description"
}`}
      </pre>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-[13px] font-mono border border-neutral-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-3 py-2">状态码</th>
              <th className="text-left px-3 py-2">含义</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">400</td>
              <td className="px-3 py-2 text-[13px] font-sans">请求参数无效</td>
            </tr>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">401</td>
              <td className="px-3 py-2 text-[13px] font-sans">未登录或 session 过期</td>
            </tr>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">404</td>
              <td className="px-3 py-2 text-[13px] font-sans">资源不存在</td>
            </tr>
            <tr>
              <td className="px-3 py-2">500</td>
              <td className="px-3 py-2 text-[13px] font-sans">服务端错误</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Skills ── */}
      <h2>技能接口</h2>

      {/* List */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">GET /skills</code>
      </h3>
      <p>列出和搜索 skill。</p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-[13px] font-mono border border-neutral-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-3 py-2">参数</th>
              <th className="text-left px-3 py-2">类型</th>
              <th className="text-left px-3 py-2">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">type</td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2 text-[13px] font-sans">
                <code>owned</code> | <code>referenced</code> | <code>all</code>（默认）
              </td>
            </tr>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">q</td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2 text-[13px] font-sans">搜索关键词（1-200 字符）</td>
            </tr>
            <tr>
              <td className="px-3 py-2">tag</td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2 text-[13px] font-sans">
                按标签过滤，可多个 <code>?tag=a&tag=b</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>示例：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl "https://skillhunt.mozia.ai/api/skills?q=react&tag=frontend"`}
      </pre>
      <p>响应：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
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

      {/* Detail */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          GET /skills/:owner/:slug
        </code>
      </h3>
      <p>获取单个 skill 的完整信息，包含 SKILL.md 内容和文件列表。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl "https://skillhunt.mozia.ai/api/skills/alice/react-hooks"`}
      </pre>
      <p>响应：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
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

      {/* Create */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">POST /skills</code>
      </h3>
      <p>创建新 skill。需要登录。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl -X POST "https://skillhunt.mozia.ai/api/skills" \\
  -H "Content-Type: application/json" \\
  -b "session_cookie" \\
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

      {/* Update */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          PUT /skills/:owner/:slug
        </code>
      </h3>
      <p>更新 skill。仅 owner 可操作，所有字段可选。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl -X PUT "https://skillhunt.mozia.ai/api/skills/alice/react-hooks" \\
  -H "Content-Type: application/json" \\
  -b "session_cookie" \\
  -d '{
    "description": "更新后的描述",
    "tags": ["react", "frontend", "hooks"]
  }'`}
      </pre>

      {/* Delete */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          DELETE /skills/:owner/:slug
        </code>
      </h3>
      <p>删除 skill。仅 owner 可操作。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl -X DELETE "https://skillhunt.mozia.ai/api/skills/alice/react-hooks" \\
  -b "session_cookie"`}
      </pre>
      <p>
        响应：<code>204 No Content</code>
      </p>

      {/* ── Skill Files ── */}
      <h2>技能文件</h2>

      {/* Upsert file */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          POST /skills/:owner/:slug/files/:path
        </code>
      </h3>
      <p>添加或更新 skill 的附加文件。仅 owner 可操作。</p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-[13px] font-mono border border-neutral-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-3 py-2">参数</th>
              <th className="text-left px-3 py-2">类型</th>
              <th className="text-left px-3 py-2">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">path</td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2 text-[13px] font-sans">
                文件路径（无前导 <code>/</code>，无 <code>..</code>，最长 512 字符）
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2">content</td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2 text-[13px] font-sans">文件内容（最长 200,000 字符）</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl -X POST "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/files/examples/usage.md" \\
  -H "Content-Type: application/json" \\
  -b "session_cookie" \\
  -d '{ "content": "# Usage Examples\\n..." }'`}
      </pre>
      <p>
        响应：<code>204 No Content</code>
      </p>

      {/* Delete file */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          DELETE /skills/:owner/:slug/files/:path
        </code>
      </h3>
      <p>
        删除附加文件。不能删除 <code>SKILL.md</code>。
      </p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl -X DELETE "https://skillhunt.mozia.ai/api/skills/alice/react-hooks/files/examples/usage.md" \\
  -b "session_cookie"`}
      </pre>
      <p>
        响应：<code>204 No Content</code>
      </p>

      {/* ── Users ── */}
      <h2>用户</h2>

      {/* Current user */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">GET /users/me</code>
      </h3>
      <p>获取当前登录用户信息。需要登录。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl "https://skillhunt.mozia.ai/api/users/me" -b "session_cookie"`}
      </pre>
      <p>响应：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
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

      {/* User's skills */}
      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          GET /users/:owner/skills
        </code>
      </h3>
      <p>获取指定用户公开的 skill 列表。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl "https://skillhunt.mozia.ai/api/users/alice/skills"`}
      </pre>

      {/* ── Install Tokens ── */}
      <h2>安装令牌</h2>
      <p>为私有 skill 生成有时效、有次数限制的安装链接。</p>

      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          POST /install-tokens
        </code>
      </h3>
      <p>创建安装令牌。需要登录且为 skill owner。</p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-[13px] font-mono border border-neutral-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-3 py-2">参数</th>
              <th className="text-left px-3 py-2">类型</th>
              <th className="text-left px-3 py-2">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">skillId</td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2 text-[13px] font-sans">skill UUID</td>
            </tr>
            <tr className="border-b border-neutral-100">
              <td className="px-3 py-2">expiresInHours</td>
              <td className="px-3 py-2">number</td>
              <td className="px-3 py-2 text-[13px] font-sans">过期时间（1-168 小时，默认 24）</td>
            </tr>
            <tr>
              <td className="px-3 py-2">maxUses</td>
              <td className="px-3 py-2">number</td>
              <td className="px-3 py-2 text-[13px] font-sans">最大使用次数（1-100，默认 1）</td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl -X POST "https://skillhunt.mozia.ai/api/install-tokens" \\
  -H "Content-Type: application/json" \\
  -b "session_cookie" \\
  -d '{
    "skillId": "uuid-of-skill",
    "expiresInHours": 48,
    "maxUses": 5
  }'`}
      </pre>
      <p>响应：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`{
  "token": "abc123...",
  "expiresAt": "2026-05-08T12:00:00.000Z",
  "maxUses": 5,
  "installCommand": "npx skills add https://skillhunt.mozia.ai/i/abc123..."
}`}
      </pre>

      {/* ── Well-Known ── */}
      <h2>Well-Known 协议</h2>
      <p>
        SkillHunt 实现了{' '}
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          /.well-known/agent-skills
        </code>{' '}
        协议，支持 agent 自动发现和安装 skill。
      </p>

      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          GET /.well-known/agent-skills/index.json
        </code>
      </h3>
      <p>列出所有公开 skill 的索引。</p>

      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">
          GET /.well-known/agent-skills/:owner/:slug/:file
        </code>
      </h3>
      <p>获取指定 skill 的文件内容。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`# 安装 skill
npx skills add https://skillhunt.mozia.ai --skill alice/react-hooks

# 通过 capability URL 安装私有 skill
npx skills add https://skillhunt.mozia.ai/i/TOKEN`}
      </pre>

      {/* ── Tags ── */}
      <h2>标签</h2>

      <h3>
        <code className="text-[13px] font-mono bg-neutral-100 px-1.5 py-0.5">GET /tags</code>
      </h3>
      <p>获取所有公开 skill 使用的标签列表。</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`curl "https://skillhunt.mozia.ai/api/tags"`}
      </pre>
      <p>响应：</p>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`{
  "tags": ["react", "frontend", "backend", "testing", "devops"]
}`}
      </pre>
    </>
  );
}
