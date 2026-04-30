---
name: postgres-schema-reviewer
description: 审查 Postgres / Drizzle schema
---

# Postgres Schema Reviewer

## When to Use

当有人提交了 Drizzle schema 或 SQL migration,需要 review 索引、约束、
命名、潜在的 lock 问题时。

## Checklist

### Indexes

- 所有外键是否有索引?
- 所有 `ORDER BY` / `WHERE` 字段是否有索引?
- 是否有冗余索引?

### Constraints

- `CHECK` constraints 是否齐全?
- `NOT NULL` 是否该有都有?
- `CASCADE` 是否符合业务预期?

### Naming

- 表名复数 or 单数?
- 索引名约定?

### Migration Safety

- 是否有全表扫描?
- 是否有长 lock?
- 是否需要 `CONCURRENTLY`?
