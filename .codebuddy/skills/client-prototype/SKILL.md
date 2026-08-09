---
name: client-prototype
description: 客户端（WinForms/DevExtreme 风格）原型制作指南。当用户要求"画客户端原型"、"用客户端样式"、"客户端风格"、"WinForms 风格"、"桌面客户端样式"、"仿 frmProductManage"或点名要"ClientToolbar/ClientFilterPanel/ClientTable"组件时使用。指导如何声明 ui:client 并通过 Client 组件库 + public/icons 图标还原 WinForms 桌面客户端视觉。
---

# 客户端原型制作指南（client-prototype）

本 Skill 用于在 Hatch 原型框架中制作 **WinForms 桌面客户端风格** 的原型（灰底窗体、ToolStrip 工具栏、DataGridView 数据网格、原生分页、模态弹窗）。

## 触发条件

用户说以下任一关键词时使用本 Skill：

- 客户端原型 / 客户端样式 / 客户端风格
- WinForms / Winform / 桌面客户端 / 仿客户端
- 提到 ClientToolbar、ClientFilterPanel、ClientTable、ClientWindow 组件
- 要还原某 C# WinForms 窗体的视觉（如 frmProductManage）

## 三步创建流程

### 1. 创建目录与配置

在 `src/prototypes/<原型名>/` 下创建两个文件：

```jsonc
// proto.config.json —— ui 字段决定客户端视觉
{
  "ui": "client"
}
```

> `ui: "client"` 是关键：框架的 `mount.tsx` 检测到后会注入 `.client-theme` 命名空间并包裹 `ClientShell`。**不写这一行就没有客户端样式。**

### 2. 编写 index.tsx

从 `admin/src/components/client` 引入组件（自动附带 client.css 主题）：

```tsx
import React, { useState } from 'react';
import {
  ClientToolbar,
  ClientFilterPanel,
  ClientTable,
  ClientPager,
  ClientWindow,
} from '/admin/src/components/client';

export default function DemoClient() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);

  const toolbarItems = [
    { key: 'view', label: '查看', icon: '/icons/toolbar/btn_View_Image.png', onClick: () => setWindowOpen(true) },
    { key: 'add', label: '新增审核', icon: '/icons/toolbar/btn_Add_Image.png', separatorBefore: true },
    { key: 'modify', label: '修改审核', icon: '/icons/toolbar/btn_Modify_Image.png' },
    { key: 'search', label: '查询', icon: '/icons/toolbar/btn_Search_Image.png' },
  ];

  const filterFields = [
    { key: 'code', label: '产品代码', width: 150 },
    { key: 'name', label: '产品名称', width: 150 },
    { key: 'status', label: '状态', type: 'select' as const, width: 143, options: [
      { value: '', label: '全部' },
      { value: '1', label: '启用' },
      { value: '0', label: '停用' },
    ]},
  ];

  const columns = [
    { key: 'code', title: '产品代码', width: 120 },
    { key: 'name', title: '产品名称', width: 180 },
    { key: 'status', title: '状态', width: 80, align: 'center' as const },
  ];

  const dataSource = [
    { id: '1', code: 'P001', name: '示例产品一', status: '启用' },
    { id: '2', code: 'P002', name: '示例产品二', status: '停用' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientToolbar items={toolbarItems} />
      <ClientFilterPanel
        fields={filterFields}
        values={{}}
        onChange={() => {}}
        onSearch={() => setPage(1)}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ClientTable
          columns={columns}
          dataSource={dataSource}
          rowKey={(r) => r.id}
          selectedKey={selected}
          onSelectRow={(r) => setSelected(r.id)}
          checkedKeys={checked}
          onCheck={(keys) => setChecked(keys)}
          centerKeys={['status']}
        />
      </div>
      <ClientPager
        total={dataSource.length}
        page={page}
        pageSize={20}
        onChange={(p) => setPage(p)}
      />
      <ClientWindow open={windowOpen} title="产品详情" width={640} height={480} onClose={() => setWindowOpen(false)}>
        窗体内容……
      </ClientWindow>
    </div>
  );
}
```

### 3. 预览验证

```bash
npm run dev
# 浏览器打开 http://localhost:5173/p/<原型名>
```

## 组件 API 速查

| 组件 | 用途 | 关键 props |
|---|---|---|
| `ClientToolbar` | ToolStrip 顶部工具栏 | `items: {key,label,icon,separatorBefore,hidden,disabled,onClick}[]` |
| `ClientFilterPanel` | WhiteSmoke 筛选面板 | `fields, values, onChange, onSearch, onReset, searchText, searchIcon` |
| `ClientTable` | DataGridView 数据网格 | `columns, dataSource, rowKey, selectedKey, onSelectRow, showCheckbox, checkedKeys, onCheck, centerKeys` |
| `ClientPager` | 底部原生分页 | `total, page, pageSize, onChange` |
| `ClientWindow` | WinForms 模态弹窗 | `open, title, icon, width, height, onClose, footer` |

> 完整示例原型：`src/prototypes/spms-product-list/`（产品管理列表，含 12 个工具栏图标 + 筛选面板 + 网格 + 分页 + 弹窗）。

## 图标资源

- 工具栏按钮图标：`/icons/toolbar/*.png`（从 frmProductManage.resx 提取，如 `btn_View_Image.png`、`btn_Add_Image.png`、`btn_Modify_Image.png`、`btn_Search_Image.png`）
- 全量客户端图标：`/icons/*.png`（105 个，从客户端 Resources 拷贝）
- 引用方式：**必须用 URL 绝对路径**（`/icons/...`），禁止 `import` 进 bundle（会 base64 内联膨胀）

## 常见坑点

1. **忘了 `"ui": "client"`**：页面显示的是普通 web 样式而非客户端灰底 → 检查 proto.config.json。
2. **图标 `import` 引入**：导致打包变慢 → 一律用 `/icons/` URL。
3. **不记得有哪些图标**：先 `Get-ChildItem public/icons/toolbar` 或 `public/icons` 列出来再引用。
4. **要还原真实系统**：先读客户端源码定位字段/枚举/接口（参照"星云系统"代码对标），再对照本 Skill 的组件拼装。
