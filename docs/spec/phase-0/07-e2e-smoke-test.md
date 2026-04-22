# Spec 07 · E2E Smoke Test

> 依赖：01-06 全部完成
> 产出：一份可重复执行的冒烟测试清单 + 自动化脚本，验证 Phase 0 全链路。

---

## 目标

跑完这组测试，就算 Phase 0 交付完成。

测试分两部分：

1. **自动化冒烟脚本**（`scripts/smoke.sh`）：一键跑完能用 bash 脚本完成的验证
2. **人工验收清单**：前端 UX 相关，需要人眼看

## 前置准备

在一台**干净**的 MacBook 上（最好是新 clone 的仓库）：

```bash
# 0. 前置依赖
node --version   # >= 20
pnpm --version   # >= 9
bun --version    # >= 1.1
psql --version   # >= 14

# 1. Clone
git clone <...>/mozia-skillhub.git
cd mozia-skillhub

# 2. 安装依赖
pnpm install

# 3. 准备 DB
psql postgres://postgres:postgres@localhost:36915/postgres \
  -c "DROP DATABASE IF EXISTS mozia_skillhub;" \
  -c "CREATE DATABASE mozia_skillhub;"

# 4. 配置环境变量
cp apps/api/.env.example apps/api/.env

# 5. 跑 migration
pnpm --filter @mozia/skillhub-api db:migrate

# 6. 录入数据
pnpm seed:referenced
pnpm seed:owned -- --dir <Zeo 本地 skill 目录的绝对路径>

# 7. 启动
pnpm dev &
sleep 3
```

完成后：api 在 3333、web 在 5173。

---

## 自动化冒烟脚本

文件：`scripts/smoke.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

API=${API:-http://localhost:3333}
WEB=${WEB:-http://localhost:5173}

red() { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
cyan() { printf "\033[36m%s\033[0m\n" "$1"; }

PASS=0
FAIL=0

check() {
  local name=$1
  shift
  if "$@"; then
    green "  ✓ $name"
    PASS=$((PASS+1))
  else
    red "  ✗ $name"
    FAIL=$((FAIL+1))
  fi
}

cyan "═══ 1. Health Check ═══"
check "api /healthz" bash -c "curl -fsS $API/healthz | grep -q skillhub-api"
check "web root" bash -c "curl -fsS $WEB | grep -q 'SkillHub\\|<html'"

cyan "═══ 2. Business API ═══"
check "/api/skills 返回 items 字段" bash -c "curl -fsS $API/api/skills | jq -e '.items | type == \"array\"' > /dev/null"
check "/api/skills 默认返回 9 条" bash -c "curl -fsS $API/api/skills | jq -e '.items | length == 9' > /dev/null"
check "/api/skills?type=owned 返回 5 条" bash -c "curl -fsS '$API/api/skills?type=owned' | jq -e '.items | length == 5' > /dev/null"
check "/api/skills?type=referenced 返回 4 条" bash -c "curl -fsS '$API/api/skills?type=referenced' | jq -e '.items | length == 4' > /dev/null"
check "/api/skills?q=design 返回包含 design 的 skill" bash -c "curl -fsS '$API/api/skills?q=design' | jq -e '.items | length >= 1' > /dev/null"
check "/api/tags 返回 tags 字段" bash -c "curl -fsS $API/api/tags | jq -e '.tags | type == \"array\"' > /dev/null"

cyan "═══ 3. Well-Known Protocol ═══"
check "index.json 可访问" bash -c "curl -fsS $API/.well-known/agent-skills/index.json > /dev/null"
check "index.json 是 {skills: [...]} 结构" bash -c "curl -fsS $API/.well-known/agent-skills/index.json | jq -e '.skills | type == \"array\"' > /dev/null"
check "index.json 只暴露 owned+public（不超过 5 条）" bash -c "curl -fsS $API/.well-known/agent-skills/index.json | jq -e '.skills | length <= 5' > /dev/null"
check "index.json 每个 entry 含 name/description/files" bash -c "curl -fsS $API/.well-known/agent-skills/index.json | jq -e 'all(.skills[]; has(\"name\") and has(\"description\") and has(\"files\"))' > /dev/null"
check "index.json 每个 entry 的 files 含 SKILL.md" bash -c "curl -fsS $API/.well-known/agent-skills/index.json | jq -e 'all(.skills[]; .files | any(. == \"SKILL.md\"))' > /dev/null"

FIRST_SLUG=$(curl -fsS $API/.well-known/agent-skills/index.json | jq -r '.skills[0].name')
check "能拉到第一个 owned skill 的 SKILL.md" bash -c "curl -fsS $API/.well-known/agent-skills/$FIRST_SLUG/SKILL.md | head -1 | grep -q '^---'"
check "referenced skill 在 well-known 中不可见" bash -c "! curl -fsS $API/.well-known/agent-skills/frontend-design/SKILL.md > /dev/null 2>&1"

cyan "═══ 4. Official CLI Compatibility ═══"
TMP=$(mktemp -d)
cd $TMP
check "npx skills add --list 能列出 owned skill" bash -c "npx -y skills@latest add $API --list 2>&1 | grep -q '$FIRST_SLUG'"

mkdir -p $TMP/agent-test/.claude/skills
cd $TMP/agent-test
check "npx skills add 能安装" bash -c "npx -y skills@latest add $API --skill $FIRST_SLUG -a claude-code -y 2>&1 | grep -qi 'install\\|added\\|success'"
check "安装后 SKILL.md 存在" test -f ".claude/skills/$FIRST_SLUG/SKILL.md"
check "安装的 SKILL.md 有 frontmatter" bash -c "head -1 .claude/skills/$FIRST_SLUG/SKILL.md | grep -q '^---'"

cd - > /dev/null
rm -rf $TMP

echo
if [ $FAIL -eq 0 ]; then
  green "═══ ALL PASSED ($PASS tests) ═══"
  exit 0
else
  red "═══ FAILED ($FAIL / $((PASS+FAIL)) tests) ═══"
  exit 1
fi
```

运行：

```bash
chmod +x scripts/smoke.sh
./scripts/smoke.sh
```

**验收标准**：所有 check 全部 ✓，最后输出 `ALL PASSED`。

---

## 人工验收清单

前端相关，需要人眼看。按顺序在浏览器执行：

### UX 清单

**列表页 `http://localhost:5173`：**

- [ ] 页面加载无白屏，控制台无 error
- [ ] 能看到 9 条 skill
- [ ] 每行显示：序号、skill 名称、描述、来源标识（"mozia-official" 或原始 repo）、更新时间
- [ ] owned + internal 的 skill 有 "[internal]" 标记
- [ ] referenced 的 skill 来源标识正确显示原始 repo（如 "anthropics/skills"）
- [ ] 搜索框输入关键词，列表实时过滤
- [ ] 类型切换（全部/自有/引用）能正确过滤
- [ ] 列表按更新时间倒序排列

**owned skill 详情页（点击任意 owned skill）：**

- [ ] URL 变成 `/skills/<slug>`
- [ ] 展示 skill name、description、tags、更新时间
- [ ] 显示本地安装命令：`npx skills add http://localhost:3333 --skill <slug>`
- [ ] "复制" 按钮点击后安装命令复制到剪贴板
- [ ] 页面下方渲染 SKILL.md 内容，代码块有高亮
- [ ] 文件列表（如果 skill 有多个文件）能看到所有 path

**referenced skill 详情页：**

- [ ] URL 变成 `/skills/<slug>`
- [ ] 展示 skill name、description、tags、更新时间
- [ ] **不**显示 SKILL.md 内容预览
- [ ] 显示原始安装命令：`npx skills add <original-repo> --skill <name>`
- [ ] "查看源代码" 按钮跳转到正确的 GitHub URL

**Docs 页：**

- [ ] `/docs` 可访问，三篇文档的链接都能点
- [ ] `/docs/what-is-a-skill` 渲染正常
- [ ] `/docs/how-to-install` 渲染正常
- [ ] `/docs/how-to-publish` 渲染正常
- [ ] 所有内部链接可点击

**视觉一致性：**

- [ ] 顶部导航在所有页面都存在
- [ ] 字体、配色统一
- [ ] 代码块用等宽字体
- [ ] 浏览器 1920x1080 下，列表一屏能看到至少 8 行

### 协议深度验证（可选）

用真实 agent 试装一次：

- [ ] 在 `~/Desktop/test-project/` 里执行 `npx skills add http://localhost:3333 --skill <owned-slug> -a claude-code -y`
- [ ] 看到 `~/Desktop/test-project/.claude/skills/<slug>/SKILL.md` 存在
- [ ] 打开 Claude Code，在该目录下让它做一个对应 skill 擅长的任务，观察 skill 是否被激活（这步比较玄学，跑过就行）

---

## 输出的验收报告

Phase 0 完成时，产出以下文件留档：

```
docs/phase-0/
├── acceptance-report.md          # 验收报告（人工填）
├── smoke-output.txt              # smoke.sh 的输出
└── screenshots/                  # 手动验收时的截图
    ├── list-page.png
    ├── owned-detail.png
    ├── referenced-detail.png
    └── docs-what-is.png
```

`acceptance-report.md` 模板：

```markdown
# SkillHub Phase 0 验收报告

- 验收人：@zeo
- 验收日期：YYYY-MM-DD
- 仓库 commit：<sha>

## 自动化冒烟
- smoke.sh 退出码：0 / 1
- 通过 / 总数：X / X
- 详细输出：见 smoke-output.txt

## 人工验收
- 列表页：✓ / ✗（如 ✗ 说明原因）
- owned 详情：✓ / ✗
- referenced 详情：✓ / ✗
- Docs：✓ / ✗
- 视觉一致性：✓ / ✗

## 发现的问题
1. ...

## 结论
- [ ] 通过，进入 Phase 1
- [ ] 未通过，需要修复以下内容并重新验收
```

---

## 反例 / 不要做的事

- 不要在 smoke 脚本里检查"install 数"或"排行榜排序"（Phase 0 没这些）
- 不要在 smoke 脚本里用真实 GitHub repo 测试 referenced skill 的实际安装（那是上游 CLI 的责任，不是我们的）
- 不要用 Playwright / Puppeteer 做端到端浏览器测试（Phase 0 的规模用不上这些工具）
- 不要在 CI 里跑这个 smoke（Phase 0 没 CI；Phase 1 再加 GitHub Actions）
- 不要把 smoke 脚本搞得太复杂。如果一条 check 逻辑超过 3 行 bash，说明应该写成独立的 Bun test 而不是塞进 smoke.sh

---

## Phase 0 完成的标志

当下面全部满足：

1. `scripts/smoke.sh` 在干净环境下退出码 0
2. 人工验收清单全部 ✓
3. `acceptance-report.md` 写完并提交
4. 仓库主分支绿色（`pnpm typecheck` + `pnpm test` + `pnpm lint` 全过）
5. Zeo 用 Codex review 过所有 spec 对应的 PR

→ Phase 0 交付完成，可以进 Phase 1。
