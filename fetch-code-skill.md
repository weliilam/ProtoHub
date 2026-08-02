---
name: "fetch-code"
description: "从 git.eminxing.com 统一拉取/更新B2B、OMS、SPMS、POMS、WT、LPS后端代码及前端代码，已有则跳过"
---

# fetch-code

统一拉取/更新所有关联项目的代码到本地目录。所有代码存储在 `D:\myskills\repos\` 下，所有会话共享，首次克隆后后续会话无需重复拉取。

其他 skill（如 oms-b2b-reader、nebula-omsv2-reader、nebula-poms-reader、nebula-loms-wt-reader 等）在使用时应该先调用本 skill 确保代码已存在。

## 认证方式

使用 Personal Access Token（HTTPS 方式），已内置在仓库 URL 中，无需额外配置 SSH key。

## 代码共享说明

所有仓库克隆到 `D:\myskills\repos\` 目录下，该目录在所有会话间共享：
- **首次调用**：克隆所有仓库
- **后续调用**（同一会话或新会话）：检查本地目录是否存在 `.git`，存在则直接跳过，不再更新代码。仅读取各仓库的 README.md 获取项目信息
- 多个会话共享同一份代码，避免重复克隆

## 支持的项目

| 项目 | 类型 | 说明（来自 README.md） | 仓库 URL |
|------|------|------|---------|
| **B2B** | 后端 | B2B系统核心实现了从中美B2B订单在线下单、智能产品匹配，到订单全状态跟踪及与履约系统数据无缝对接的一站式服务 | `lbu/ot/oms/nebula.loms.b2b` |
| **OMS** | 后端 | 全段业务（YT专线业务）订单管理系统，是面向YT（专线）业务的订单管理系统，负责全段订单的统一接入、处理与下游协同 | `lbu/ot/oms/nebula.omsv2` |
| **SPMS** | 后端 | 销售产品系统主要负责销售产品的定义和产品全生命周期管理，决定云途提供什么物流给客户 | `lbu/ot/spms/nebula.spms` |
| **POMS** | 后端 | 平台订单管理系统主要是作为连接外部业务平台与云途订单系统的中心枢纽，将不同外部平台的订单数据进行转换与映射，形成云途系统能够识别和处理的标准化数据格式 | `lbu/ot/poms/nebula.poms` |
| **WT** | 后端 | 分段业务（WT分段业务）订单管理系统，是面向WT（分段）业务的订单管理系统，负责分段订单、清关批次的统一接入、处理与下游协同 | `lbu/ot/oms/nebula.loms.wt` |
| **LPS** | 后端 | 打印系统核心提供两大服务：标签模板统一管理中心 + 标准化的标签生成服务接口 | `lbu/ot/lps/Nebula.PLS` |
| **前端(zt-portal)** | 前端 | YT、WT、B2B的Portal端代码 | `lbu/front/portal/zt-portal-oms` |
| **前端(poms)** | 前端 | POMS的Portal前端代码 | `lbu/front/portal/yt-portal-poms` |
| **前端(spms)** | 前端 | SPMS的Portal前端代码 | `lbu/front/portal/yt-portal-spms` |

## 工作机制

- **首次调用**：克隆所有仓库到 `D:\myskills\repos\`（跨会话共享目录）
- **后续调用**（本会话或新会话）：代码已存在时跳过克隆。仅读取各仓库的 README.md 获取项目信息，用于辅助分析问题
- 支持通过项目名选择性拉取

## 步骤 1：配置 Git 认证

```bash
echo "https://oauth2:yiQ2C5WzNCEdnmov4y9V@git.eminxing.com" > ~/.git-credentials
git config --global credential.helper store
```

## 步骤 2：克隆/更新代码

```bash
PROTO="https://oauth2:yiQ2C5WzNCEdnmov4y9V"
HOST="git.eminxing.com"
REPOS_BASE="$(pwd)/mnt/myskills/repos"
mkdir -p "$REPOS_BASE"
```

### 各项目克隆命令

| 项目 | 本地目录 | 仓库路径 |
|------|---------|---------|
| B2B | `oms-b2b` | `lbu/ot/oms/nebula.loms.b2b.git` |
| OMS | `oms-repo` | `lbu/ot/oms/nebula.omsv2.git` |
| SPMS | `spms-repo` | `lbu/ot/spms/nebula.spms.git` |
| POMS | `poms-repo` | `lbu/ot/poms/nebula.poms.git` |
| WT | `wt-repo` | `lbu/ot/oms/nebula.loms.wt.git` |
| LPS | `lps-repo` | `lbu/ot/lps/Nebula.PLS.git` (--depth 1) |
| 前端(zt-portal) | `repo-portal` | `lbu/front/portal/zt-portal-oms.git` |
| 前端(poms) | `poms-portal` | `lbu/front/portal/yt-portal-poms.git` |
| 前端(spms) | `spms-portal` | `lbu/front/portal/yt-portal-spms.git` |

## 步骤 3：环境配置 — 阿波罗配置中心

**YT-SIT 环境地址**：
- Config Service: `http://10.168.95.136:8080`
- Admin Service: `http://10.168.95.136:8090`

**访问方式**：必须使用 bash `curl`，不能用 `web_fetch`。

### AppId 查找（优先级: Program.cs > appsettings.json）

从 Program.cs 读取 `ConfigurationProject` 或 `ApolloConfiguration` attribute：
```bash
grep -rn "ConfigurationProject\|ApolloConfiguration" {项目目录}/server/src --include="*.cs"
```

备选从 appsettings.json 读取 `apollo.AppId`：
```bash
grep -A5 '"apollo"' {项目目录}/server/src/**/appsettings.Development.json
```

### 已确认的 AppId 映射

| 项目 | 服务 | AppId | 来源 |
|------|------|-------|------|
| OMS | Gateway | `Nebula.OMSV2.Gateway` | appsettings.json |
| OMS | Service | `Nebula.OMSV2.Service` | Program.cs |
| OMS | Jobs | `Nebula.OMSV2.Jobs` | appsettings.json |
| OMS | Platform | `Nebula.OMSV2.Platform` | appsettings.json |
| OMS | Tools | `Nebula.OMSV2.Tools` | appsettings.json |
| SPMS | Gateway | `Nebula.SPMS.Gateway` | appsettings.json |
| LPS | V2 (FastReport) | `Nebula.PLS.WebApi` | Program.cs |
| LPS | Html | `Nebula.Html.Pls.WebApi` | Program.cs |

### 常用 API

获取配置：
```bash
curl -s "http://10.168.95.136:8080/configs/{appId}/YT-SIT/application" | python3 -m json.tool
```

过滤数据库/中间件配置：
```bash
curl -s "http://10.168.95.136:8080/configs/{appId}/YT-SIT/application" | python3 -c "
import sys, json
cfgs = json.load(sys.stdin).get('configurations', {})
for k, v in cfgs.items():
    if any(w in k.lower() for w in ['connection', 'database', 'mysql', 'redis', 'rabbitmq', 'kafka', 'storage']):
        print(f'{k} = {v}')
"
```

列出所有应用：
```bash
curl -s "http://10.168.95.136:8090/apps" | python3 -m json.tool
```

### 分析问题时结合阿波罗配置

- 查数据库/中间件配置的实际值（非代码注释中的硬编码）
- 查功能开关的实际状态
- 查路由和依赖配置
- 查超时/限流参数

典型流程：代码找配置键 → 阿波罗拉取值 → 对比 → 得出结论

## 分支切换

| 系统 | 本地目录 |
|------|---------|
| B2B | `oms-b2b/` |
| OMS | `oms-repo/` |
| SPMS（后端） | `spms-repo/` |
| SPMS（前端） | `spms-portal/` |
| POMS（后端） | `poms-repo/` |
| POMS（前端） | `poms-portal/` |
| WT | `wt-repo/` |
| LPS | `lps-repo/` |
| 前端/zt-portal | `repo-portal/` |

## 目录映射汇总

| 项目 | 本地目录 |
|------|---------|
| B2B 后端 | `$(pwd)/mnt/myskills/repos/oms-b2b/` |
| OMS 后端 | `$(pwd)/mnt/myskills/repos/oms-repo/` |
| SPMS 后端 | `$(pwd)/mnt/myskills/repos/spms-repo/` |
| POMS 后端 | `$(pwd)/mnt/myskills/repos/poms-repo/` |
| WT 后端 | `$(pwd)/mnt/myskills/repos/wt-repo/` |
| LPS 后端 | `$(pwd)/mnt/myskills/repos/lps-repo/` |
| 前端 zt-portal | `$(pwd)/mnt/myskills/repos/repo-portal/` |
| 前端 poms-portal | `$(pwd)/mnt/myskills/repos/poms-portal/` |
| 前端 spms-portal | `$(pwd)/mnt/myskills/repos/spms-portal/` |
| 菜单 JSON | `$(pwd)/mnt/myskills/菜单.json` |
| 接口文档 JSON | `$(pwd)/mnt/myskills/接口文档.json` |
