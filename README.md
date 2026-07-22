# Proto Hub — 本地 AI 原型工作台

> 基于 Vite + React + Ant Design 的本地原型工作台。内置**原型预览、批注、Git 快照、AI CLI、分组管理、飞书 PRD 同步**，帮助产品 / 设计 / 开发在同一处快速搭建、评审与管理前端原型。

---

## ✨ 特性

- **多类型条目**：统一管理原型（prototype）、组件（component）、文档（doc）、主题（theme）、数据表（table）。
- **实时预览 + 设备模式**：桌面 / 平板 / 手机三种视口一键切换，所见即所得。
- **可视化批注**：进入批注模式后点击页面任意元素即可钉点标注修改意见，支持「待处理 / 已完成」状态流转。
- **Git 快照**：按条目粒度提交与回滚，原型演进过程可追踪，且不污染业务代码仓库。
- **AI CLI**：在界面内直接调用 AI 命令行工具，基于当前原型生成或修改代码。
- **分组管理**：左侧按业务域对原型分组，默认全部展开，便于快速定位。
- **飞书 PRD 同步**：原型可关联飞书文档，同步标题与功能描述内容到工作台内预览。
- **在线编辑**：文档、主题、数据表均可在工作台内直接编辑保存。

---

## 🧰 技术栈

| 类别 | 选型 |
|------|------|
| 构建 | Vite 5（`appType: 'custom'`，页面由插件伺服） |
| 前端 | React 18 + TypeScript |
| UI | Ant Design 5 + @ant-design/icons |
| 包管理 | pnpm |
| 其他 | dayjs、marked（文档渲染）、xlsx（数据表导入导出）、playwright（截图/渲染） |

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- 包管理器：pnpm
- Git（用于快照功能）

### 获取项目（从 Git 克隆）

本工作台已发布到 GitHub，可直接克隆到本地使用：

```bash
git clone https://github.com/weliilam/ProtoHub.git
cd ProtoHub
```

> **说明**：仓库仅包含 Proto Hub 框架代码，原型（prototype）与文档（doc）已在版本控制中排除，克隆后需自行在工作台内新建原型 / 文档。

### 安装与启动

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动开发服务器，默认 http://localhost:5173
```

其他脚本：

```bash
pnpm typecheck    # TypeScript 类型检查（tsc --noEmit）
```

---

## 📁 项目结构

```
newproject/
├── vite.config.ts            # Vite 配置，挂载 server 端插件
├── package.json
├── tsconfig.json
├── .gitignore
├── server/                   # Node 端能力（以 Vite 中间件形式注入）
│   ├── index.ts              # 聚合所有 server 插件
│   ├── entriesApi.ts         # 条目扫描 / CRUD、分组 CRUD
│   ├── docsApi.ts            # 文档读写
│   ├── themesApi.ts          # 主题读写
│   ├── dataApi.ts            # 数据表读写
│   ├── gitApi.ts             # Git 快照（提交 / 回滚 / 历史）
│   ├── aiCliApi.ts           # AI CLI 调用
│   ├── annotationApi.ts      # 批注读写
│   ├── prdApi.ts             # 飞书 PRD 链接管理 + 文档内容同步
│   ├── prototypeInfoApi.ts   # 原型基本信息（组件分析）
│   ├── comparePlugin.ts      # 版本分屏对比
│   └── pagesPlugin.ts        # 原型页面的 HTML 伺服（兜底路由）
├── admin/                    # 工作台前端（管理界面）
│   └── src/
│       ├── App.tsx           # 主布局：侧边栏 + 预览区 + 右侧面板
│       ├── api.ts            # 前端 API 封装
│       ├── annotation.ts     # 批注元素拾取逻辑
│       ├── styles.css        # 全局样式
│       ├── types.ts          # 共享类型定义
│       └── components/       # Sidebar / PrototypePreview / AnnotationPanel /
│                             #   GitPanel / AiCliPanel / DocEditor / ThemeViewer /
│                             #   DataTableEditor / CompareView / ViteErrorOverlay
└── src/
    ├── prototypes/           # 原型目录（每个子目录 = 一个原型，含 index.tsx + spec.md）
    ├── components/           # 组件条目目录
    ├── docs/                 # 文档（.md）
    ├── themes/               # 主题配置
    └── database/             # 数据表（.json）
```

---

## 🧩 条目类型与约定

工作台会自动扫描以下目录，将内容注册为条目：

| 类型 | 扫描目录 | 约定 | 标题来源 |
|------|----------|------|----------|
| `prototype` | `src/prototypes/<name>/` | 需含 `index.tsx`（默认导出 React 组件） | 同级 `spec.md` 首行 `#` |
| `component` | `src/components/<name>/` | 需含 `index.tsx`（默认导出 React 组件） | 同级 `spec.md` 首行 `#` |
| `doc` | `src/docs/<name>.md` | Markdown 文件 | 文件首行 `#` |
| `theme` | `src/themes/<name>/` | 主题配置目录 | 同级 `README.md` 首行 `#` |
| `table` | `src/database/<name>.json` | JSON 数据文件 | 文件名 |

> 命名规则：名称仅允许字母、数字、中文、中划线（`-`）、下划线（`_`）。

---

## ➕ 如何新增原型

### 方式一：界面新建（推荐）

在左侧侧边栏点击「新建」，选择类型 `prototype`，填写名称与标题，工作台会自动生成：

```
src/prototypes/<name>/
├── index.tsx   # 内置 Ant Design 模板
└── spec.md     # 标题与功能描述
```

### 方式二：手动创建

1. 在 `src/prototypes/` 下新建目录 `<name>`；
2. 写入 `index.tsx`，**默认导出一个 React 组件**即可：

```tsx
import { Button } from 'antd';

export default function App() {
  return <Button type="primary">Hello Proto Hub</Button>;
}
```

3. （可选）写入 `spec.md`，首行 `# 标题` 会作为列表中展示的名称。

保存后刷新条目列表，新原型即出现在左侧。

---

## 🗂️ 分组管理

原型可通过分组按业务域归类。`src/prototypes/.groups.json` 记录分组配置：

```json
[
  { "id": "b2b-oms", "name": "B2B-OMS", "prototypes": ["b2b-order-list", "b2b-order-fee-detail"] }
]
```

- 在侧边栏可新建 / 重命名 / 删除分组，并将原型拖入或移出分组；
- 分组在侧边栏**默认全部展开**，无需逐个手动点开；
- 重命名、删除原型时会自动同步更新分组引用，无需手动维护。

---

## 🧪 功能模块

### 预览与设备模式

- 选中可预览条目后，顶部工具栏提供「桌面 / 平板 / 手机」三种视口切换；
- 「刷新」按钮可重新挂载当前原型，便于查看最新改动。

### 批注

1. 点击工具栏「批注」进入批注模式；
2. 点击页面上的任意元素，弹出输入框填写修改意见并保存；
3. 右侧「列表」面板汇总所有批注，可标记完成或删除；
4. 批注与具体原型绑定，按 `selector` + 坐标定位，刷新后仍在原位显示；
5. **一键发布到 CodeBuddy**：在批注面板点击「发布到 CodeBuddy」，系统会把所有「待处理」批注自动整理成修改指令，直接发送给本地 AI CLI（优先 CodeBuddy，未安装则自动回退到已安装的 Claude / Cursor / Gemini / Codex / OpenCode），由 AI 在当前原型目录（`src/prototypes/<name>/`）中直接改写代码，并自动刷新预览。也支持「复制为 AI 指令」手动粘贴。

### Git 快照

- 按**条目粒度**生成快照（仅提交该原型相关文件）；
- 右侧「Git 快照」面板可填写提交说明并快照，也可查看历史、一键回滚到指定版本；
- 快照使用暂存区隔离方案，不影响业务仓库的提交历史。

### 版本视觉对比

- 在右侧「Git 快照」面板勾选 **最多 2 条** 快照，点击「对比选中版本」；
- 弹出分屏视图：左右并排渲染两个历史版本的可交互原型，下方附变更清单（改动文件 / 提交说明）；
- 用于快速定位某次迭代的视觉差异，无需手动回滚比对。

### AI CLI

- 右侧「AI CLI」面板可调用已配置的 AI 命令行工具；
- 面板显示各 CLI 的可用状态，输入 prompt 即可在当前原型上下文中执行代码生成 / 修改。

### 飞书 PRD 同步（详见下方 [飞书集成](#-飞书集成)）

- 在「文档」Tab 中可为每个原型关联飞书 PRD 文档；
- 关联后可点 🔄 同步按钮拉取飞书文档的标题和功能描述内容；
- 点击文档条目在右侧主区域预览 PRD 内容，格式化为表格/列表展示。

### 文档 / 主题 / 数据表

- **文档**：Markdown 编辑器，支持实时保存；
- **主题**：可视化查看与编辑主题配置；
- **数据表**：JSON 数据在线编辑，可供原型直接消费。

---

## 🔌 飞书集成

> ⚠️ **从 Git 克隆后，飞书功能不会自动生效**，需要额外配置。

### 依赖说明

飞书 PRD 关联与内容同步依赖全局安装的 **`lark-cli`** 命令行工具，该工具不在本项目 `package.json` 中（不随 `pnpm install` 安装）。

### 安装指引

**1. 安装 lark-cli（全局）**

```bash
npm install -g lark-cli
# 或通过内部包源安装，具体方式请联系团队获取
```

**2. 登录认证**

```bash
lark-cli auth login
```

按提示完成飞书账号授权，认证信息会保存到本地 `~/.lark/` 目录。

**3. 验证**

```bash
lark-cli auth status
# 显示已登录状态即为配置成功
```

### 不影响的功能

即使不安装 `lark-cli`，以下功能仍然正常工作：

- ✅ 所有原型预览、编辑、新建
- ✅ 批注、Git 快照、AI CLI
- ✅ 文档、主题、数据表管理
- ✅ 原型关联的飞书链接（prd.link）仍然可手动打开飞书文档查看
- ❌ 飞书文档标题和内容同步（「同步」按钮点击会报错）
- ❌ 关联飞书 PRD 时自动拉取文档信息

---

## 🔌 AI CLI 配置

### 依赖说明

AI CLI 功能依赖用户本机已安装的 AI 命令行工具，**不在本项目依赖中**。

### 支持的 CLI

| CLI | 安装方式 | 说明 |
|-----|---------|------|
| CodeBuddy | `npm install -g @tencent/codebuddy` | 推荐，腾讯内部 AI 编码助手 |
| Claude Code | `npm install -g @anthropic-ai/claude-code` | Anthropic Claude |
| Cursor Agent | 通过 Cursor IDE 内置 | 需安装 Cursor |
| Gemini CLI | `npm install -g @google/generative-ai` | Google Gemini |
| OpenAI Codex | `npm install -g @openai/codex` | OpenAI |
| OpenCode | `npm install -g opencode` | 开源方案 |

### 验证

启动 Proto Hub 后，打开右侧「AI CLI」面板，绿色圆点表示对应的 CLI 可用。

---

## 🔌 API 一览

工作台通过 Vite 中间件暴露以下接口（路径前缀 `/api`）：

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 条目 | GET | `/api/entries` | 列出全部条目 |
| 条目 | POST | `/api/entries` | 新建 prototype / component |
| 条目 | POST | `/api/entries/rename` | 重命名条目（同步分组引用） |
| 条目 | DELETE | `/api/entries?type=&name=` | 删除条目 |
| 分组 | GET/POST/PUT/DELETE | `/api/groups` | 分组 CRUD |
| 分组 | POST | `/api/groups/move` | 原型移入 / 移出分组 |
| 文档 | GET/PUT/POST/DELETE | `/api/docs/:name` | 文档读写 |
| 主题 | GET/PUT/DELETE | `/api/themes/:name` | 主题读写 |
| 数据表 | GET/POST/PUT/DELETE | `/api/data/tables[/:name]` | 数据表读写 |
| Git | GET | `/api/git/status` `/api/git/log` | 快照状态 / 历史 |
| Git | POST | `/api/git/snapshot` `/api/git/restore` | 生成 / 回滚快照 |
| AI | GET | `/api/ai/status` | CLI 可用状态 |
| AI | POST | `/api/ai/execute` | 执行 AI CLI |
| 批注 | GET/POST/PUT/DELETE | `/api/annotations[/:id]` | 批注读写 |
| PRD | GET/POST/DELETE | `/api/prd/link` | PRD 链接 CRUD |
| PRD | POST | `/api/prd/sync` | 同步飞书文档标题+摘要 |
| PRD | GET | `/api/prd/all` | 汇总所有原型的 PRD 链接 |
| 原型信息 | GET | `/api/prototype/info` | 原型基本信息（组件分析） |
| 对比 | POST | `/api/compare/prepare` | 提取两版本到临时目录 |
| 对比 | GET | `/api/compare/diff` | 两版本间 diff |

---

## 📘 操作指南（快速上手）

### 场景一：新建原型并让 AI 填充

1. 左侧侧边栏点击「新建」→ 选择 `prototype` → 填写名称与标题；
2. 工作台自动生成 `index.tsx` 模板与 `spec.md`；
3. 打开右侧「AI CLI」面板，输入需求描述 → 点击「执行」；
4. AI 在当前原型目录直接改写代码，预览区实时刷新。

### 场景二：批注评审 + 一键让 AI 改代码（最常用）

1. 顶部工具栏点击「批注」进入批注模式；
2. 点击页面任意元素 → 填写修改意见 → 保存，标记状态为「待处理」；
3. 右侧「列表」面板汇总所有批注，可批量查看 / 标记完成 / 删除；
4. 在批注面板点击「发布到 CodeBuddy」；
5. 如需手动处理，可「复制为 AI 指令」粘贴到任意 AI 工具。

### 场景三：版本快照、对比与回滚

1. 阶段性成果满意时，打开右侧「Git 快照」→ 填提交说明 → 「快照」；
2. 后续迭代中，勾选任意 **2 条** 快照 →「对比选中版本」→ 左右分屏查看视觉差异与变更清单；
3. 对某版本不满意，在历史列表中点击「回滚」即可恢复。

### 场景四：关联飞书 PRD

1. 左侧切到「文档」Tab → 点击「关联飞书 PRD」；
2. 在弹窗中选择要关联的原型，粘贴飞书 PRD 链接；
3. 关联后在对应原型文件夹下可见飞书 PRD 条目；
4. 点 🔄 同步按钮拉取文档的标题和功能描述内容；
5. 点击文档条目在右侧主区域查看格式化后的 PRD 内容。

### 场景五：多设备预览

- 顶部工具栏切换「桌面 / 平板 / 手机」视口，验证响应式表现；
- 点击「刷新」重新挂载原型以查看最新改动。

### 场景六：文档 / 主题 / 数据表

- **文档**：在 `src/docs/` 新建 `.md`，工作台内可实时编辑保存；
- **主题**：在 `src/themes/` 维护配置，工作台内可视化查看与编辑；
- **数据表**：在 `src/database/` 维护 `.json`，可被原型直接消费。

---

## ⚠️ 注意事项

- 本工具为**本地工作台**，需在本机运行 `pnpm dev` 后通过浏览器访问；
- 原型代码直接运行在本地 Node/Vite 环境，请勿放入敏感凭据；
- `src/prototypes/.groups.json` 为分组配置，建议一并纳入版本管理；
- 删除原型 / 重命名时会自动清理分组中的引用，无需手动维护；
- **飞书功能**需额外安装 `lark-cli` 并完成认证（详见上方 [飞书集成](#-飞书集成)）；
- **AI CLI** 需用户自行在本地安装对应的命令行工具（详见上方 [AI CLI 配置](#-ai-cli-配置)）。

---

## 📄 License

内部工具，按团队规范使用。
