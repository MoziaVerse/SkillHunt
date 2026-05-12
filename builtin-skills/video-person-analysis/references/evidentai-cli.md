# Evidentai CLI

视频案件分析数据生成工具。

## 依赖

- `jq` - JSON 处理
- `python3` - 脚本执行

## 安装

```bash
chmod +x evidentai
```

## 命令

### validate

验证 `persons.personinfo.json` 格式。

```bash
evidentai validate -i persons.personinfo.json
```

检查项：
- version 字段
- persons 数组非空
- id 格式 (p_xxx)
- name 非占位符
- role 有效值 (attacker/victim/witness)
- time ≤ endTime
- personIds 引用存在

### timeline

从 `persons.personinfo.json` 生成 `risk.timeline.json`。

```bash
evidentai timeline -i persons.personinfo.json
evidentai timeline -i persons.personinfo.json -o output/timeline.json
evidentai timeline -i persons.personinfo.json -v raw_data/video.mp4
```

### relation

从 `persons.personinfo.json` 生成 `persons.relation.json`。

```bash
evidentai relation -i persons.personinfo.json
evidentai relation -i persons.personinfo.json -f
```

### generate

同时生成 timeline 和 relation。

```bash
evidentai generate -i persons.personinfo.json
evidentai generate -i persons.personinfo.json -v raw_data/video.mp4
```

## 参数

| 参数 | 说明 |
|------|------|
| `-i, --input <file>` | 输入文件（必需） |
| `-o, --output <file>` | 输出文件 |
| `-v, --video-path <path>` | 视频路径，默认 `raw_data/video.mp4` |
| `-f, --force` | 覆盖已存在文件 |
| `-h, --help` | 显示帮助 |

## 输出格式

### risk.timeline.json

```json
{
  "version": "1.0",
  "videoPath": "raw_data/video.mp4",
  "segments": [
    {
      "id": "seg_1",
      "startTime": 10.5,
      "endTime": 25.3,
      "description": "张三对李四进行殴打",
      "personIds": ["p_001", "p_002"]
    }
  ]
}
```

### persons.relation.json

```json
{
  "version": "1.0",
  "layout": {
    "p_001": { "x": 100, "y": 200 }
  },
  "edges": [
    {
      "id": "e_1",
      "source": "p_001",
      "target": "p_002",
      "label": "殴打",
      "edgeSource": "auto"
    }
  ]
}
```
