# 客户端原型模板（client-prototype）

WinForms 桌面客户端风格原型的最小可运行模板。

## 使用方式

1. 复制本目录到 `src/prototypes/<你的原型名>/`（目录名用英文 kebab-case）
2. 改写 `index.tsx`：替换列定义、工具栏按钮、筛选字段、mock 数据
3. 启动预览：`npm run dev` → 打开 `http://localhost:5173/p/<你的原型名>`

## 文件说明

| 文件 | 作用 |
|---|---|
| `proto.config.json` | 声明 `"ui": "client"`，激活客户端视觉（关键） |
| `index.tsx` | 完整示例：工具栏 + 筛选面板 + 数据网格 + 分页 + 弹窗 |

## 组件来源

组件库位于 `admin/src/components/client/`，通过 `/admin/src/components/client` 引入（自动附带主题 CSS）。
图标位于 `public/icons/`（工具栏图标在 `public/icons/toolbar/`），一律用 `/icons/...` URL 引用。
