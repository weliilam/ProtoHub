# B2B仓库地址管理

## 功能概述

对齐 `D:\myskills\repos\repo-portal\src\views\basic-config\B2B-warehouse-manage` 的 B2B 仓库地址管理页。

前端技术栈：Ant Design **Vue (ant-design-vue)**，页面容器为内部组件 `YtSearchPageV2`，表格为内部组件 `AppTable`，增删改弹框为 `a-modal` + `a-form`。

本原型用 React + Ant Design v5 等价组件 1:1 还原：
- 顶部查询区：关键字 `Input` + 查询/重置 `Button`
- 操作区：`Button`（新增 / 二级地址配置 / 批量导入 / 批量导出 / 启用 / 禁用）
- 主表格：`Table`（带行勾选 `rowSelection`、小尺寸 `size="small"`、分页）
- 新增/编辑：`Modal` + `Form`（仓库代码、仓库类型、二级地址类型、国家、省/州、城市、地址、地址2、邮编、云途仓库代码、联系电话、联系人）
- 二级地址配置：`Modal` + 动态 `Form.List`（中文名 / 英文名 / 校验规则）
- 批量导入：`Modal` + `Upload` 拖拽上传 + 下载模版
- 批量导出：`Modal` + `Radio`（导出全部 / 导出已选）
- 启用/禁用：`Modal.confirm` 二次确认
