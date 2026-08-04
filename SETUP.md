# Hatch 完整安装手册（一站式）

> 照着本文档操作，即可在一台**全新机器**上完整安装 Hatch 框架与全部扩展：
> 原型工作台、飞书 PRD 同步、界面内 AI 代码生成、局域网访问。
>
> 可直接将本文件内容发送给 AI 编程助手（CodeBuddy / Claude Code / Cursor 等），由助手按步骤自动执行。

---

## 0. 安装前确认

### 0.1 代码是最新的

本文档所有路径与功能均基于**已推送到远程仓库的最新代码**。若目标机器是从 GitHub 克隆，先确认远程已包含最新提交（本地如有未推送改动，先 `git push`）。

```bash
git -C <项目目录> status -sb
# 出现 "ahead N" 表示本地有 N 个提交尚未推送，其他人克隆不到
```

### 0.2 环境要求

| 工具 | 最低版本 | 检查命令 | 缺失时安装 |
|------|---------|---------|-----------|
| Node.js | 18+ | `node -v` | https://nodejs.org |
| npm | 9+ | `npm -v` | 随 Node.js 自带 |
| Git | 任意 | `git --version` | https://git-scm.com |

> 国内网络安装依赖缓慢时，建议先配置镜像（见 [6. 常见问题](#6-常见问题)）。

---

## 1. 获取代码

```bash
git clone https://github.com/weliilam/ProtoHub.git
cd ProtoHub
```

> 仓库**仅包含框架代码**。原型（prototype）、文档（doc）在 `.gitignore` 中排除，不随仓库分发，安装完成后在工作台内自行新建（见 [7. 下一步](#7-下一步)）。

---

## 2. 安装依赖

```bash
npm install
```

> 使用仓库中的 `package-lock.json` 锁定版本，保证与团队一致。

本项目依赖的组件库（`package.json`）：

| 依赖 | 用途 |
|------|------|
| vite 5 / typescript | 构建与类型检查 |
| react / react-dom | 原型 React 引擎 |
| antd / @ant-design/icons | React 原型组件库 |
| vue / ant-design-vue / element-plus | 原型 Vue 引擎 |
| @ant-design/icons-vue / @element-plus/icons-vue | Vue 组件库图标 |
| dayjs / marked / xlsx | 日期、文档渲染、数据表导入导出 |
| playwright | 截图 / 渲染能力（可选，见 [3.3](#33-截图渲染扩展playwright)） |

---

## 3. 安装扩展（必装）

> 以下扩展均为**全局安装**，不写入本项目 `package.json`，需逐项手动配置，请勿跳过。

### 3.1 飞书 PRD 同步扩展（lark-cli）

```bash
lark-cli --version        # 已安装则跳过安装，直接登录
npm install -g lark-cli   # 未安装时执行
lark-cli auth login       # 登录授权（浏览器扫码 / 账号登录）
lark-cli auth status      # 验证：确认 user / bot 身份 available
```

- 认证信息保存于本机 `~/.lark/` 目录，只影响本机；
- 未安装 / 未登录时：原型预览、批注、Git 快照、AI CLI 等功能**不受影响**，仅「同步飞书文档内容」会报错。

### 3.2 AI 代码生成扩展（AI CLI）

默认安装 **CodeBuddy**（推荐，安装后自动沿用 CodeBuddy 会话登录态，无需单独登录）：

```bash
npm install -g @tencent/codebuddy
```

如需切换其他 AI CLI，安装以下任一，安装后刷新工作台即可自动识别：

| CLI | 安装命令 | 说明 |
|-----|---------|------|
| **CodeBuddy**（默认） | `npm install -g @tencent/codebuddy` | 推荐 |
| Claude Code | `npm install -g @anthropic-ai/claude-code` | Anthropic |
| Cursor Agent | 通过 Cursor IDE 内置 | 无需额外安装 |
| Gemini CLI | `npm install -g @google/generative-ai` | Google |
| OpenAI Codex | `npm install -g @openai/codex` | OpenAI |
| OpenCode | `npm install -g opencode` | 开源方案 |

> 启动工作台后打开右侧「AI CLI」面板：**绿色圆点**表示对应 CLI 可用，红色为未安装。

### 3.3 截图 / 渲染扩展（playwright）

playwright 已包含在项目依赖中，如需使用截图 / 渲染能力，再下载浏览器内核：

```bash
npx playwright install chromium
```

> 当前为预留能力（`scripts/screenshots/`），不需要截图功能可跳过。

---

## 4. 启动工作台

```bash
npm run dev
```

启动成功后终端输出访问地址（默认 **http://localhost:5173**，端口被占用自动顺延）。

- **本机访问**：浏览器打开 `http://localhost:5173`
- **局域网访问**：Vite 已配置 `host: true`，同一局域网设备可访问本机 IP；工作台「复制链接」功能会自动替换为局域网 IP（`http://192.168.x.x:5173`）

---

## 5. 安装验证清单

启动后逐项核对，**全部 ✅ 才算安装完成**：

| 功能 | 验证方式 | 依赖 |
|------|---------|------|
| 工作台可访问 | 浏览器打开地址，左侧出现侧边栏 | 框架 |
| 新建原型 | 侧边栏「新建」→ 选择 `prototype` | 框架 |
| 批注 | 顶部工具栏「批注」→ 点击页面元素 → 保存 | 框架 |
| Git 快照 | 右侧「Git 快照」→ 填说明 → 快照 | 框架 |
| 飞书 PRD 同步 | 文档 Tab → 关联飞书 PRD → 🔄 同步成功 | lark-cli（已登录） |
| AI CLI | 右侧「AI CLI」面板显示**绿色圆点** | CodeBuddy 等（已安装） |
| 局域网访问 | 手机访问 `http://<本机IP>:5173` | 框架（同网段） |

---

## 6. 常见问题

### Q1：`npm install` 很慢 / 报网络错误

配置国内镜像后重试：

```bash
npm config set registry https://registry.npmmirror.com
```

### Q2：Node 版本过低

```bash
node -v   # 需 >= 18
```

版本过低建议用 [nvm](https://github.com/nvm-sh/nvm) 安装 Node 18/20/22 后再执行本文档。

### Q3：端口被占用

Vite 会自动顺延端口（5174、5175…），以终端输出为准。也可在 `vite.config.ts` 的 `server.port` 中固定端口。

### Q4：点「同步」飞书报错

说明 `lark-cli` 未安装或未登录，回到 [3.1](#31-飞书-prd-同步扩展lark-cli) 执行 `npm install -g lark-cli && lark-cli auth login`。

### Q5：AI CLI 面板全红

对应 CLI 未安装。回到 [3.2](#32-ai-代码生成扩展ai-cli) 安装后**刷新页面**即可识别。

### Q6：首次访问原型白屏卡顿

框架已对常用库（antd / vue / element-plus 等）做预构建，如仍复现，刷新一次页面触发重新优化即可。

### Q7：克隆后没有原型 / 文档

正常现象。`.gitignore` 排除了 `src/prototypes/` 与 `src/docs/`，需在工作台内「新建」或从其他机器拷贝。

---

## 7. 下一步

1. 在浏览器打开工作台地址；
2. 左侧边栏「新建」→ 选择类型（prototype / component / doc / theme / table）创建首个条目；
3. 原型模板自动生成后，可用右侧「AI CLI」面板让 AI 直接生成或修改代码；
4. 如需团队共享原型，将 `src/prototypes/<name>/` 目录拷贝给对方机器放入同名位置即可（该目录不入 Git）。

---

## 8. 相关文档

| 文档 | 内容 |
|------|------|
| `README.md` | 框架功能总览、API 一览、操作指南 |
| `fetch-code-skill.md` | 获取真实业务系统代码（星云系统）对标用技能说明 |

---

> 仓库地址：https://github.com/weliilam/ProtoHub
