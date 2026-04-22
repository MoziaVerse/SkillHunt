# mozia-skillhub

## 启动

前置：Node 20+、pnpm 9+、Bun 1.1+、PostgreSQL（`localhost:36915`）

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev
```

- API: http://localhost:3333
- Web: http://localhost:5180

## 技术栈

Bun + Hono + Drizzle + Postgres（后端），Bun + React + shadcn + Zustand（前端），pnpm workspace 管理。
