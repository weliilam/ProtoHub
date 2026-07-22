# Proto Hub 上手指引

> 一套**本地 AI 原型工作台**（基于 Vite + React + Ant Design），用于快速搭建、预览、评审与管理前端原型。

## 这是什么

Proto Hub 帮你和团队在同一处完成原型的设计与评审，内置能力包括：

- **实时预览 + 设备模式**：桌面 / 平板 / 手机三种视口一键切换
- **可视化批注**：点击页面任意元素钉点标注修改意见，支持「待处理 / 已完成」流转
- **Git 快照**：按原型粒度提交与回滚，演进过程可追踪
- **AI CLI**：在界面内直接调用 AI 命令行工具改代码
- **分组管理 / 飞书 PRD 同步 / 文档主题数据表在线编辑**

## 获取代码

仓库已发布到 GitHub（**仅含框架代码，原型与文档需自行创建**）：

```bash
git clone https://github.com/weliilam/ProtoHub.git
cd ProtoHub
```

## 环境要求

- Node.js 18+
- 包管理器 [pnpm](https://pnpm.io/)
- Git（用于快照功能）

## 安装与启动

```bash
pnpm install   # 安装依赖
pnpm dev       # 启动开发服务器
```

启动后浏览器访问 `http://localhost:5173`（若端口被占用会自动顺延，见终端输出）。

## 如何使用

1. 左侧侧边栏：切换「原型 / 组件 / 文档 / 主题 / 数据表」，点击「新建」可创建条目
2. 中间预览区：顶部工具栏切换设备视口，「刷新」重新挂载当前原型
3. 右侧面板：批注、Git 快照、AI CLI 等能力入口
4. 新建原型：左侧「新建」→ 选 `prototype` → 填写名称与标题，工作台自动生成 `index.tsx` 与 `spec.md`

## 注意事项

- 本仓库**有意排除** `src/prototypes/`（原型）与 `src/docs/`（文档），克隆后请在工作台内自行创建，仓库不含示例原型
- **飞书 PRD 同步**需额外安装 `lark-cli` 并完成认证；**AI CLI** 需本机安装对应的命令行工具（详见仓库 `README.md`）

## 仓库地址

https://github.com/weliilam/ProtoHub.git
