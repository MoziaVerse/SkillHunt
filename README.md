# SkillHunt

SkillHunt 是一个面向 AI Agent Skills 的发布、发现与讨论平台。

它不再只是一个静态 skill 仓库或安装目录，而是围绕下面这条主路径设计的产品：

`发布 -> 发现 -> 反馈 -> 安装`

当前仓库使用 monorepo 结构，包含 Web 前端、API 服务、共享包和开发脚本。

## 项目概览

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 前端应用 | `apps/web` | Vite + React，负责 SkillHunt 的用户界面与交互 |
| 后端 API | `apps/api` | Hono + Bun + Drizzle + SQLite，负责 skill 数据、认证与社区能力 |
| 共享逻辑 | `packages/shared` | 前后端共享类型与通用逻辑 |
| 开发脚本 | `scripts` | 种子数据、辅助脚本与 smoke 检查 |
| 产品文档 | `docs` | 项目定位、路线图与设计说明 |

## 本地服务

| 进程 | 端口 | 说明 |
| --- | --- | --- |
| SQLite | 文件 | 主数据，默认在 `apps/api/data/skillhub.sqlite` |
| skillhunt-api | `3333` | Hono on Bun |
| skillhunt-web | `5180` | Vite + React，`/api/*` 代理到 `:3333` |
| mozia-sso（可选） | `8778` | 本地 SSO，用于登录与私有能力联调 |

## 环境要求

- Node 20+
- pnpm 10+
- Bun 1.1+
- `openssl`（用于生成 `BETTER_AUTH_SECRET`）

## 首次设置

```bash
pnpm install

cp -n apps/api/.env.example apps/api/.env

SECRET=$(openssl rand -hex 32) \
  && sed -i '' "s/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=$SECRET/" apps/api/.env

cp -n apps/api/.env.test.example apps/api/.env.test

pnpm db:migrate
pnpm db:migrate:test
pnpm seed:all
```

如果需要联调本地登录流程，再额外启动 `mozia-sso`，并把对应的 `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` 写入 `apps/api/.env`。

## 开发命令

最常用的是直接同时启动前后端：

```bash
pnpm dev
```

也可以分开启动：

```bash
pnpm dev:api
pnpm dev:web
```

常用检查命令：

```bash
pnpm typecheck
pnpm lint
pnpm test
bash scripts/smoke.sh
```

推荐顺序：

| 场景 | 建议执行 |
| --- | --- |
| 改动后快速检查 | `pnpm typecheck && pnpm lint` |
| 提交前 | `pnpm typecheck && pnpm lint && pnpm test` |
| 前后端联调前 | `pnpm dev` 后执行 `bash scripts/smoke.sh` |

## 数据库与种子

开发库和测试库分离，`pnpm test` 不会写入开发数据。

常用命令：

```bash
pnpm db:migrate
pnpm db:migrate:test
pnpm seed:all
```

如果改了 schema、migration 或依赖数据库的数据流，建议按上面的顺序重新执行一遍。

## API 与协议

- Web 应用默认通过 `/api/*` 调用后端服务
- SkillHunt 对外提供 `/.well-known/agent-skills/*` 协议端点
- 同时提供面向客户端与 Agent 的 `/api/*` 与 `/api/v1/*` 接口

更完整的说明可参考：

- [docs/skillhunt-positioning.md](/Users/linsoap/Documents/Github/Skillhub/docs/skillhunt-positioning.md)
- [docs/skillhunt-roadmap.md](/Users/linsoap/Documents/Github/Skillhub/docs/skillhunt-roadmap.md)

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| `/api/*` 返回 500 或前端读不到数据 | 确认 `pnpm dev:api` 已正常启动，并检查 `apps/api/.env` 是否完整 |
| `/api/skills` 返回空列表 | 先执行 `pnpm seed:all`，确认开发库已有种子数据 |
| 登录按钮不可用或登录失败 | 检查 `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` 是否已配置，并确认本地 `mozia-sso` 已启动 |
| 页面空白或样式异常 | 确认 `pnpm dev:web` 正常运行，并查看 Vite 控制台输出 |

## 重置开发数据

```bash
rm -f apps/api/data/skillhub.sqlite apps/api/data/skillhub.sqlite-shm apps/api/data/skillhub.sqlite-wal

pnpm db:migrate
pnpm seed:all
```

## 文档导航

- 项目定位：[docs/skillhunt-positioning.md](/Users/linsoap/Documents/Github/Skillhub/docs/skillhunt-positioning.md)
- 路线图：[docs/skillhunt-roadmap.md](/Users/linsoap/Documents/Github/Skillhub/docs/skillhunt-roadmap.md)
- 仓库协作约定：[AGENTS.md](/Users/linsoap/Documents/Github/Skillhub/AGENTS.md)
