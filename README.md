# mozia-skillhub

Mozia 内部 skill 中心：管理 owned/referenced skill，对外暴露 `/.well-known/agent-skills/*` 协议端点，通过 mozia-sso 区分 public / internal 可见性。

| 进程 | 端口 | 说明 |
| --- | --- | --- |
| Postgres (Docker) | `36915` | 主数据，库名 `mozia_skillhub` |
| skillhub-api | `3333` | Hono on Bun，OpenID Connect via better-auth |
| skillhub-web | `5180` | Vite + React，`/api/*` 代理到 :3333 |
| mozia-sso (可选) | `8778` | Casdoor，仅 sign-in / internal skill 流程需要 |

## 0. 前置

- Node 20+、pnpm 10+、Bun 1.1+
- Docker（跑 Postgres，仓库期望端口 `36915`）
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

# 4) 起 Postgres（用你已有的 docker 配置；端口 36915）
#    略 — 仓库不带 db compose

# 5) 建独立的 test database（一次性，让测试不冲 dev 数据）
docker exec skillhub-pg psql -U postgres -c "CREATE DATABASE mozia_skillhub_test"
cp -n apps/api/.env.test.example apps/api/.env.test

# 6) 跑 migration（dev + test 各跑一次）
pnpm db:migrate
pnpm db:migrate:test

# 7) 灌种子数据（4 referenced + 5 owned）
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
pnpm test         # bun test on api（含 db 集成测试，需 Postgres 在跑）
bash scripts/smoke.sh   # 端到端 curl，需要 api+web 都在跑
```

### 测试在独立 DB

测试套件 `beforeEach` / `afterAll` 会 `TRUNCATE skillhub.*`。Phase 2-02 之后**测试已经隔离到 `mozia_skillhub_test` DB**（通过 `apps/api/.env.test`），跑 `pnpm test` 不会动 dev 数据。

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
| `API error: 500 ... Is the api running on :3333?` | api 没起，或 api 启动 crash。看 api 日志：`bun --watch src/index.ts` 直接前台跑。常见原因：(a) Postgres 没起；(b) `.env` 里某个 PHASE 1 必填漏了——api 已做 graceful 降级，启动会打 `[auth] missing env:` 警告，不会崩 |
| api 启动崩在 `BETTER_AUTH_URL is not set` | `.env` 旧；按上面"首次设置"第 2/3 步重新生成 |
| `/api/skills` 返 0 | dev DB 没 seed 或被手动清过，跑 `pnpm seed:all`（**测试不会动 dev DB**——它现在用独立 `mozia_skillhub_test`）|
| 顶栏显示 `Sign in (sso unconfigured)` 且不可点 | `OIDC_CLIENT_ID/SECRET` 在 `.env` 是空的。按 [`mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md) 注册 application 拿到 client id/secret 填进去，重启 api |
| 点 Sign in 报 `500: ... ConnectionRefused` | mozia-sso (`:8778`) 没起。`docker compose -f /Users/apple/Desktop/work/mozia-sso/docker-compose.mozia.yml up -d` |
| 浏览器点 Sign in 跳到一片白 / 报 `redirect_uri mismatch` | mozia-sso application 的 redirectUris 不对。必须是 `http://localhost:3333/api/auth/oauth2/callback/mozia-sso`（注意 `/oauth2/`）。详见 [`mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md) |
| 登录成功但还是看不到 internal skill | 当前用户的 `groups` claim 不含 `mozia-members`（或 `INTERNAL_GROUPS` env 列表）。在 Casdoor 把用户加入 group，**重新登录**（groups 在登录时刷新到 `skillhub.user.groups`） |
| 5180 显示空白 | vite 没起或 web 进程崩了。`lsof -nP -iTCP:5180 -sTCP:LISTEN` 检查；重启 `pnpm dev:web` |

## 5. 完整重置

```bash
# wipe 表数据（保留 schema/migration 历史）
psql "postgres://postgres:postgres@localhost:36915/mozia_skillhub" \
  -c "TRUNCATE skillhub.skills, skillhub.skill_files, skillhub.user, skillhub.session, skillhub.account, skillhub.verification RESTART IDENTITY CASCADE"

pnpm seed:all
```

## 6. 文档导航

- 各阶段 spec：[`docs/spec/phase-0/`](docs/spec/phase-0/) Phase 0 全部，[`docs/spec/phase-1/`](docs/spec/phase-1/) auth
- mozia-sso 集成手册：[`../mozia-sso/docs/skillhub-onboarding.md`](../mozia-sso/docs/skillhub-onboarding.md)（分支 `feat/skillhub-onboarding-doc`）
