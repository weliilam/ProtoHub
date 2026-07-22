# IOSS税号管理

> 对应业务系统：OMS（zt-portal 基础配置 `basic-config > ioss-manage`）。
> 本原型已对齐真实业务字段/枚举，并**保留之前新增的密文与复制增强功能**。

## 功能概述
管理客户 IOSS 税号备案与审核：支持按客户代码、IOSS 识别码、审核类型、状态、创建时间筛选，
批量审核通过 / 审核不通过、导出，以及查看操作日志。

## 页面字段（表格列，对齐真实业务 TABLE_COLUMNS）
序号、客户代码、类型(0个人/1平台)、平台名称、IOSS识别码、IOSS识别名、审核类型(证书审核/常规审核)、
状态(待备案/备案通过/备案不通过/作废)、审核不通过备注、注册文件、创建时间、业务员、审核人、审核时间、操作(日志)。

> **IOSS密文列**（新增功能）：紧接「IOSS识别码」后展示该号的确定性密文，并提供「复制」按钮，可一键复制密文。

## 搜索栏
- 客户代码（精确包含）
- IOSS识别码（支持批量，多个自动成标签）：**CodeType 下拉可切换「IOSS识别码 / IOSS密文」**，选密文时按密文匹配（新增功能）
- 审核类型（全部 / 证书审核 C / 常规审核 R）
- 状态（全部 / 待备案 / 备案通过 / 备案不通过 / 作废）
- 创建时间（区间）

## 操作
- 审核通过 / 审核不通过（批量勾选；作废状态 0 不可勾选）
- 导出（CSV，含表单头）
- 查询 / 重置

## 单元格增强（新增功能，保留）
- 单元格悬浮出现「复制」图标，可复制单格内容
- 按住鼠标拖拽可框选多个单元格，Ctrl/Cmd+C 复制（失败时可手动复制弹窗文本）

## 权限
- 查看列表：`oms-iossnumberlist`
- 审核：`oms-iossnumberlist:oms-iossnumber-audit`
- 导出：`oms-iossnumberlist:oms-iossnumber-exportdata`

## 接口（原型以本地 Mock 模拟）
- `IossMgt/Query` 查询、`IossMgt/SetPass` 审核通过、`IossMgt/SetNoPass` 审核不通过
- `IossMgt/GetIossLog` 操作日志、`IossMgt/ExportData` 导出
