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

## 完成后

服务启动成功后：
1. 在浏览器打开终端输出的地址
2. 告知用户：「Proto Hub 已启动，访问地址为 xxx」
3. 提醒用户：仓库仅含框架代码，原型和文档请在左侧边栏点击「新建」自行创建

---

> 仓库地址：https://github.com/weliilam/ProtoHub
