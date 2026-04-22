# Spec 01 · Repo Scaffold

> 依赖：无（第一个任务）
> 产出：`mozia-skillhub` monorepo 骨架，`pnpm install` 成功，`pnpm dev` 能启动 api + web 两个占位服务。

---

## 目标

搭一个**空壳**。骨架要完整，但业务代码一行都不写。本任务交付后，仓库能跑起来但什么功能都没有——这是故意的。

## 硬约束

- ❌ 不引入 Next.js / Express / Fastify
- ❌ 不引入 npm / yarn（只用 pnpm）
- ❌ 不引入 ESLint / Prettier（用 Biome）
- ❌ 不引入 Jest / Vitest（用 Bun test）
- ❌ 不写任何业务逻辑

## 最终目录结构

```
mozia-skillhub/
├── .gitignore
├── .nvmrc                    # node 版本占位（Bun 不强依赖但保留）
├── biome.json                # Biome 配置
├── package.json              # 根 package.json（workspace 配置）
├── pnpm-workspace.yaml       # pnpm workspace 声明
├── tsconfig.base.json        # 共享 TS 配置
├── README.md                 # 启动说明
│
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   └── index.ts      # Hono 应用入口，只有一个 /healthz
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── web/
│       ├── src/
│       │   ├── main.tsx      # React 入口
│       │   ├── App.tsx       # 占位：只显示 "SkillHub" 文字
│       │   ├── index.css     # Tailwind 入口
│       │   └── vite-env.d.ts
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       ├── package.json
│       └── .env.example
│
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts      # 空导出：export {}
│       ├── tsconfig.json
│       └── package.json
│
├── scripts/                  # 根 scripts，这个 spec 不写内容
│
└── docs/                     # Phase 0 后面会放静态文档
    └── .gitkeep
```

## 关键配置详述

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 根 `package.json`

```json
{
  "name": "mozia-skillhub",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "dev:api": "pnpm --filter @mozia/skillhub-api dev",
    "dev:web": "pnpm --filter @mozia/skillhub-web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### `biome.json`

采用默认配置，但启用 `organizeImports` 和严格的 `formatter`。不要折腾这个。

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  }
}
```

注意 `noUncheckedIndexedAccess: true`——这是 matrix 项目的强约束，保留。

### `apps/api/package.json`

```json
{
  "name": "@mozia/skillhub-api",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun dist/index.js",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@mozia/skillhub-shared": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.6.0"
  }
}
```

### `apps/api/src/index.ts`（占位）

```ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/healthz', (c) => c.json({ ok: true, service: 'skillhub-api' }));

const port = Number(Bun.env.PORT ?? 3333);

export default {
  port,
  fetch: app.fetch,
};

console.log(`[skillhub-api] listening on http://localhost:${port}`);
```

### `apps/api/.env.example`

```env
PORT=3333
DATABASE_URL=postgres://postgres:postgres@localhost:36915/mozia_skillhub
```

注意端口 36915 对齐 matrix 的 Postgres 端口（见 Zeo 的文档）。本机开发共用一个 Postgres 实例。

### `apps/web/package.json`

```json
{
  "name": "@mozia/skillhub-web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "zustand": "^5.0.0",
    "@mozia/skillhub-shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^7.0.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

注意 Tailwind v4 用 `@tailwindcss/vite` 插件，不再需要 `tailwind.config.ts` 传统配置。检查 matrix 的做法对齐。

### `apps/web/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
```

**关键**：开发环境 `/api/*` 代理到 api，避免 CORS。

### `apps/web/src/App.tsx`（占位）

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-bold">SkillHub</h1>
    </div>
  );
}
```

### `apps/web/src/index.css`

```css
@import 'tailwindcss';
```

### `README.md`

写以下内容，**不要多写**：

```markdown
# mozia-skillhub

## 启动

前置：Node 20+、pnpm 9+、Bun 1.1+、PostgreSQL（`localhost:36915`）

\`\`\`bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev
\`\`\`

- API: http://localhost:3333
- Web: http://localhost:5173

## 技术栈

Bun + Hono + Drizzle + Postgres（后端），Bun + React + shadcn + Zustand（前端），pnpm workspace 管理。
```

## 验收标准

- [ ] `pnpm install` 无错误
- [ ] `pnpm dev` 同时启动两个服务
- [ ] `curl http://localhost:3333/healthz` 返回 `{"ok":true,"service":"skillhub-api"}`
- [ ] 浏览器打开 http://localhost:5173 看到 "SkillHub" 文字
- [ ] `pnpm typecheck` 全部通过
- [ ] `pnpm lint` 全部通过
- [ ] `git status` 干净（`.gitignore` 覆盖了 `node_modules` / `dist` / `.env`）

## 反例（这个 spec 不要做的事）

- 不要写任何业务逻辑（路由、组件、数据库连接都不要）
- 不要安装 shadcn 组件（下一个 spec 需要时再装）
- 不要集成 Drizzle（02 spec 的事）
- 不要写测试（每个 spec 有自己的测试，本 spec 只搭骨架）
- 不要做样式设计（下一个相关 spec 的事）
