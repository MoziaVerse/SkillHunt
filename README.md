# mozia-skillhub

Mozia 内部 skill 中心：管理 owned/referenced skill，对外暴露 `/.well-known/agent-skills/*` 安装协议端点，并提供对齐 `skills.sh` 的 `/api/v1/*` 公共目录 API。

| 进程 | 端口 | 说明 |
| --- | --- | --- |
| SQLite | 文件 | 主数据，默认 `apps/api/data/skillhub.sqlite` |
| skillhub-api | `3333` | Hono on Bun，OpenID Connect via better-auth |
| skillhub-web | `5180` | Vite + React，`/api/*` 代理到 :3333 |
| mozia-sso (可选) | `8778` | Casdoor，仅 sign-in / internal skill 流程需要 |

## 0. 前置

- Node 20+、pnpm 10+、Bun 1.1+
- `openssl`（生成 BETTER_AUTH_SECRET）

## 1. 首次设置

```bash
# 1) 装依赖
pnpm install

# 2) 配置 .env（首次拷贝，已存在则跳过）
cp -n apps/api/.env.example apps/api/.env

# 3) 给 BETTER_AUTH_SECRET 一个真随机值（dev 用）
SECRET=$(openssl rand -hex 32) \
  && sed -i '' "s/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=$SECRET/" apps/api/.env

# 4) 准备测试环境变量
cp -n apps/api/.env.test.example apps/api/.env.test

# 5) 跑 migration（dev + test 各跑一次，会自动创建 SQLite 文件）
pnpm db:migrate
pnpm db:migrate:test

# 6) 灌种子数据（4 referenced + 5 owned）
pnpm seed:all
```

## 2. 日常开发

最简启动（前后端并行）：

```bash
pnpm dev
```

或拆开起：

```bash
pnpm dev:api      # :3333
pnpm dev:web      # :5180
```

- 没有 mozia-sso 时也能跑：未登录路径全部正常，登录按钮点击会因 `OIDC_CLIENT_ID` 为空而失败（启动时会打 `[auth] missing env: ...` 警告）。
- 想试 sign-in / internal skill：起本地 mozia-sso (`:8778`)，按 [`mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md) 注册 application + `mozia-members` group，把 `OIDC_CLIENT_ID/SECRET` 填到 `apps/api/.env`，重启 api。

## 3. 测试 / 校验流程

按从快到慢的顺序：

```bash
pnpm typecheck    # tsc --noEmit on shared/api/web (1-2s)
pnpm lint         # biome check (<1s)
pnpm test         # bun test on api（含 SQLite 集成测试）
bash scripts/smoke.sh   # 端到端 curl，需要 api+web 都在跑
```

### 测试在独立 DB

测试套件会清理表数据。测试已经隔离到 `apps/api/data/skillhub.test.sqlite`（通过 `apps/api/.env.test`），跑 `pnpm test` 不会动 dev 数据。

新增 / 改了 schema 后要把 migration 同步到 test DB：

```bash
pnpm db:migrate          # dev DB
pnpm db:migrate:test     # test DB
```

### 推荐组合

| 场景 | 跑什么 |
| --- | --- |
| 改代码前快速 sanity | `pnpm typecheck && pnpm lint` |
| commit 前 | 上面两条 + `pnpm test` |
| PR 前 / 怀疑 e2e 坏了 | 全套 + `bash scripts/smoke.sh`（要求 api+web 在跑 + dev DB 有 seed）|

## 4. 故障排查

| 现象 | 原因 / 处理 |
| --- | --- |
| `API error: 500 ... Is the api running on :3333?` | api 没起，或 api 启动 crash。看 api 日志：`bun --watch src/index.ts` 直接前台跑。常见原因是 `.env` 里某个 PHASE 1 必填漏了——api 已做 graceful 降级，启动会打 `[auth] missing env:` 警告，不会崩 |
| api 启动崩在 `BETTER_AUTH_URL is not set` | `.env` 旧；按上面"首次设置"第 2/3 步重新生成 |
| `/api/skills` 返 0 | dev DB 没 seed 或被手动清过，跑 `pnpm seed:all`（**测试不会动 dev DB**——它使用独立 SQLite 文件）|
| 顶栏显示 `Sign in (sso unconfigured)` 且不可点 | `OIDC_CLIENT_ID/SECRET` 在 `.env` 是空的。按 [`mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md) 注册 application 拿到 client id/secret 填进去，重启 api |
| 点 Sign in 报 `500: ... ConnectionRefused` | mozia-sso (`:8778`) 没起。`docker compose -f /Users/apple/Desktop/work/mozia-sso/docker-compose.mozia.yml up -d` |
| 浏览器点 Sign in 跳到一片白 / 报 `redirect_uri mismatch` | mozia-sso application 的 redirectUris 不对。必须是 `http://localhost:3333/api/auth/oauth2/callback/mozia-sso`（注意 `/oauth2/`）。详见 [`mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md) |
| 登录成功但还是看不到 private skill | 当前用户不是该 skill owner。确认 owner handle 或重新登录刷新用户信息 |
| 5180 显示空白 | vite 没起或 web 进程崩了。`lsof -nP -iTCP:5180 -sTCP:LISTEN` 检查；重启 `pnpm dev:web` |

### skills.sh 兼容 API

```bash
curl http://localhost:3333/api/v1/skills
curl "http://localhost:3333/api/v1/skills/search?q=design"
curl http://localhost:3333/api/v1/skills/localhost:3333/project-mental-map
```

## 5. 完整重置

```bash
# wipe dev SQLite 后重建
rm -f apps/api/data/skillhub.sqlite apps/api/data/skillhub.sqlite-shm apps/api/data/skillhub.sqlite-wal

pnpm db:migrate
pnpm seed:all
```

## 6. 文档导航

- 各阶段 spec：[`docs/spec/phase-0/`](docs/spec/phase-0/)、[`docs/spec/phase-1/`](docs/spec/phase-1/)、[`docs/spec/phase-2/`](docs/spec/phase-2/)
- 战略 + 路线图（跨团队/上行沟通用）：[`docs/SkillHub/strategy.md`](docs/SkillHub/strategy.md)
- mozia-sso 集成手册：[`../mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md)（分支 `feat/skillhub-onboarding-doc`）

## 7. 飞书 wiki 同步

战略文档 `docs/SkillHub/strategy.md` 同时维护一份**飞书 wiki 镜像** ↗
[SkillHub · 战略与路线图](https://ecn1zd9lqqzk.feishu.cn/wiki/WHRowkRuliXKj0ktiL7cTCv6nxg)

**单一源是本地 md。** 改完后跑：

```bash
scripts/feishu-sync.sh docs/SkillHub/strategy.md Rt0Md4z00oXsGnxRuZdcHdmknzc
```

脚本依赖：`npm install -g @larksuite/cli` + `lark-cli auth login --recommend`（一次性）。详细行为和"section 级精准更新"姿势见脚本头部注释。
