# 欢迎使用 Proto Hub

这是你的本地 AI 原型工作台。

## 快速上手

1. 左侧 **原型** Tab：查看 / 新建原型，点击后在中间预览
2. 顶部工具栏：切换设备尺寸、刷新、批注
3. **批注**：开启后在原型页面上点击任意元素，写下修改意见，可一键复制为 AI Prompt 发给 AI 修改
4. **Git 快照**：随时保存版本，可回滚
5. **AI CLI**：直接在界面里调用本机的 Claude / Cursor / Gemini 等 AI 命令行

## 目录说明

| 目录 | 内容 |
|------|------|
| `src/prototypes/` | 原型页面（每个目录含 index.tsx + spec.md） |
| `src/components/` | 公共组件 |
| `src/themes/` | 主题配置 |
| `src/docs/` | 项目文档（Markdown） |
| `src/database/` | 数据表（JSON，原型可直接 fetch 读取） |
