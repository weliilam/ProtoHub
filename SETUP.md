# Proto Hub 环境搭建指引

> 将以下内容发送给 AI 编程助手（如 CodeBuddy、Claude Code、Cursor 等），助手将自动完成环境搭建与启动。

---

## 任务说明

你是一名 AI 编程助手。收到本指引后，请严格按照以下步骤，为目标机器完成 Proto Hub 原型工作台的搭建与启动。

## 环境要求

执行前确认本机已安装以下工具（缺失则先安装）：

- **Node.js** >= 18（`node -v` 检查）
- **pnpm**（如未安装：`npm install -g pnpm`）
- **Git**

## 执行步骤

### 1. 克隆仓库

```bash
git clone https://github.com/weliilam/ProtoHub.git
cd ProtoHub
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

```bash
pnpm dev
```

启动后在终端输出访问地址（默认 http://localhost:5173，端口被占用会自动顺延）。

---

## 扩展配置（必装）

基础搭建完成后，以下功能为工作台推荐的必装扩展（飞书 PRD 同步、界面内 AI 代码生成）。请按下方步骤逐项正确配置，不要跳过：

### 飞书 PRD 同步

先检查本机是否已安装 `lark-cli`，未安装则安装并授权：

```bash
lark-cli --version           # 检查是否已安装；命令不存在则需要安装
npm install -g lark-cli      # 未安装时执行
lark-cli auth login          # 安装后登录授权（浏览器扫码 / 账号登录）
lark-cli auth status         # 验证登录状态，确认 user / bot 身份 available
```

> 若 `lark-cli --version` 已能正常输出版本号，说明依赖已存在，跳过安装步骤，直接执行 `lark-cli auth login` 完成配置即可；无需重复安装。

### AI CLI 代码生成

默认安装 **CodeBuddy**（推荐）：安装完成后刷新工作台即自动识别，并沿用当前 CodeBuddy 会话登录态，无需单独登录。

```bash
npm install -g @tencent/codebuddy
```

如需切换其他 AI CLI，可安装以下任一（安装后刷新工作台即可识别）：

| CLI | 安装命令 |
|-----|---------|
| **CodeBuddy**（默认） | `npm install -g @tencent/codebuddy` |
| Claude Code | `npm install -g @anthropic-ai/claude-code` |
| Cursor Agent | 通过 Cursor IDE 内置，无需额外安装 |
| Gemini CLI | `npm install -g @google/generative-ai` |
| OpenAI Codex | `npm install -g @openai/codex` |
| OpenCode | `npm install -g opencode` |

---

## 完成后

服务启动成功后：
1. 在浏览器打开终端输出的地址
2. 告知用户：「Proto Hub 已启动，访问地址为 xxx」
3. 提醒用户：仓库仅含框架代码，原型和文档请在左侧边栏点击「新建」自行创建
4. 按上方「扩展配置（必装）」完成飞书 PRD 同步与 AI CLI（CodeBuddy）的安装与登录配置

---

> 仓库地址：https://github.com/weliilam/ProtoHub
