# SHEIN账号配置

## 一、页面定位
将原 POMS 中以 JSON 配置的「地址映射配置」改为可视化列表管理。支持列表展示、关键词搜索、按地址类型筛选，以及新增 / 编辑 / 删除（数据本地持久化）。

## 二、数据字段（与原始 JSON 一一对应）
| 字段 | 中文 | 类型 | 说明 |
| --- | --- | --- | --- |
| supplier_id | 供应商ID | number | 主键，新增时自动建议（当前最大+1），可修改，不可重复 |
| customer_code | 客户代码 | string | 如 BCNHC54308 |
| customer_name | 客户名称 | string | 如 PANASIA SYNERGY LIMITED |
| warehouse_code | 仓库代码 | string | 如 W220678 |
| address_code | 地址代码 | string | 实例中与仓库代码一致 |
| address_type | 地址类型 | enum | 1=Amazon地址 / 2=海外仓地址 / 3=私人地址 |
| address | 详细地址 | string | 仓库实际地址 |

## 三、交互说明
1. **筛选区**：关键词搜索（客户代码/客户名称/仓库代码/地址）+ 地址类型下拉筛选 + 重置。
2. **列表区**：分页表格，地址类型以彩色标签展示。
3. **新增**：弹窗表单，supplier_id 自动预填建议值（可改），含必填校验；提交时校验 supplier_id 唯一性。
4. **编辑**：复用同一弹窗，预填原记录，可修改全部字段（含 supplier_id）。
5. **删除**：行内二次确认后删除。
6. **持久化**：数据通过 localStorage（key `pac_address_config`）持久化，刷新后保留；无数据时回退到内置示例数据。

## 四、组件库
Vue 3 + ant-design-vue，与现有原型（b2b-order-list / address-audit-list / requirement-point-record）视觉风格保持一致。
