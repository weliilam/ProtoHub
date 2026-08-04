# LBU-B2B客户单票特价申请 - 接口文档

## 接口一：提交特价申请

### 基本信息

| 项目 | 说明 |
|------|------|
| 接口路径 | POST /api/v1/b2b/special-price/apply |
| 请求方式 | POST |
| Content-Type | application/json |
| 接口说明 | 提交 B2B 客户单票特价申请，生成申请单并推送 OA 审批流程 |

### 请求参数

#### 基础信息

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| requestNo | string | 是 | 调用方唯一请求编号，用于幂等控制 | REQ202607030001 |
| applicant | string | 是 | 申请人 | 孙晓雨 |
| employeeNo | string | 是 | 工号 | zt19777 |
| applyDate | string | 是 | 申请日期，格式 yyyy-MM-dd | 2026-07-03 |
| dept | string | 是 | 申请人所在部门 | 数据运营组 |

#### 客户信息

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| customerCode | string | 是 | 客户代码 | CUS001 |
| salesCanFillBilling | boolean | 是 | 销售是否可以填写计费信息项 | true |

#### 报价信息

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| country | string[] | 是 | 国家，支持多选 | ["美国"] |
| productCatalog | string | 是 | 产品目录 | 海运经济 |
| packageSpec | string | 是 | 包装规格 | 10件*1000片*20CM |
| pieceCount | integer | 是 | 件数 | 100 |
| boxSizes | object[] | 是 | 单箱尺寸列表 | 见下方 boxSizes 结构 |
| cargoImages | string[] | 是 | 货物图片 URL 列表 | ["https://xxx/1.jpg"] |
| addresses | object[] | 是 | 发货地址列表 | 见下方 addresses 结构 |
| productName | string | 是 | 品名 | 电子产品 |
| hsCode | string | 是 | 材质/HS CODE | 851762 |
| cargoType | string[] | 是 | 货物类型 | ["普货"] |
| customsMode | string | 是 | 报关方式：single/none | single |
| hasLithium | boolean | 是 | 是否含锂电池 | false |
| tradeMode | string | 是 | 贸易方式：DDP/self/defer | DDP |

#### 计费信息项

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| priceItems | object[] | 是 | 单票改价信息列表 | 见下方 priceItems 结构 |
| hasSurchargeReduction | boolean | 是 | 是否存在附加费减免 | false |
| xLineReduction | integer | 否 | 满足X行时扣件减免 | 10 |
| priceValidityStart | string | 是 | 单票价格有效期开始 | 2026-07-03 |
| priceValidityEnd | string | 是 | 单票价格有效期结束 | 2026-08-03 |

#### 流程处理

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| submitIdentity | string | 是 | 提交身份 | 孙晓雨 |
| returnDirection | string | 是 | 回签方向 | N12单件分支 |
| urgency | string | 是 | 紧急程度：urgent/normal | normal |
| commonOpinion | string | 否 | 常用意见 | 同意 |
| processOpinion | string | 是 | 处理意见 | 请审批 |
| notifyOptions | string[] | 否 | 通知选项 | ["流程结束后通知我"] |
| attachments | string[] | 否 | 附件 URL 列表 | ["https://xxx/附件.pdf"] |

### 嵌套结构

#### boxSizes 单箱尺寸

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| length | number | 是 | 长度 |
| width | number | 是 | 宽度 |
| height | number | 是 | 高度 |
| unit | string | 是 | 单位：mm/cm |
| weight | number | 是 | 单箱重量，单位 KG |

#### addresses 发货地址

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| detailAddress | string | 是 | 目的地址详细地址 |
| warehouseCode | string | 否 | 目的地仓库代码 |

#### priceItems 单票改价信息

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| product | string | 是 | 适用产品 |
| weightKg | number | 是 | 单票总重量 KG |
| cbm | number | 是 | 单票总方数 CBM |
| address | string | 是 | 指定目的仓库详细地址 |
| quoteType | string | 是 | 报价方式：weight/cbm/piece |
| hasSurchargeReduction | boolean | 是 | 该行是否存在附加费减免 |
| xLineReduction | integer | 否 | 满足X行时扣件减免 |
| price | number | 是 | 报价价格 |
| priceUnit | string | 是 | 报价单位：kg/cbm/piece |
| ytOrderNo | string | 否 | YT 单号 |
| warehouseCode | string | 否 | 签入仓库 |
| image | string | 否 | 图片 URL |

### 请求示例

```json
{
  "requestNo": "REQ202607030001",
  "applicant": "孙晓雨",
  "employeeNo": "zt19777",
  "applyDate": "2026-07-03",
  "dept": "数据运营组",
  "customerCode": "CUS001",
  "salesCanFillBilling": true,
  "country": ["美国"],
  "productCatalog": "海运经济",
  "packageSpec": "10件*1000片*20CM",
  "pieceCount": 100,
  "boxSizes": [
    { "length": 50, "width": 40, "height": 30, "unit": "cm", "weight": 12.5 }
  ],
  "cargoImages": ["https://example.com/cargo.jpg"],
  "addresses": [
    { "detailAddress": "美国加州xxx仓库", "warehouseCode": "WH001" }
  ],
  "productName": "电子产品",
  "hsCode": "851762",
  "cargoType": ["普货"],
  "customsMode": "single",
  "hasLithium": false,
  "tradeMode": "DDP",
  "priceItems": [
    {
      "product": "美国海卡经济",
      "weightKg": 1250,
      "cbm": 5.2,
      "address": "美国加州xxx",
      "quoteType": "weight",
      "hasSurchargeReduction": false,
      "price": 8.5,
      "priceUnit": "kg",
      "ytOrderNo": "2607AA0142",
      "warehouseCode": "WH001"
    }
  ],
  "hasSurchargeReduction": false,
  "priceValidityStart": "2026-07-03",
  "priceValidityEnd": "2026-08-03",
  "submitIdentity": "孙晓雨",
  "returnDirection": "N12单件分支",
  "urgency": "normal",
  "processOpinion": "请审批",
  "notifyOptions": ["流程结束后通知我"]
}
```

### 响应参数

| 字段名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| code | integer | 状态码 | 200 |
| message | string | 提示信息 | 成功 |
| data | object | 业务数据 | 见下方 |

#### data 字段

| 字段名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| applyNo | string | 申请单号 | SP202607030001 |
| processInstanceId | string | OA 流程实例 ID | OA_PI_202607030001 |
| status | string | 申请状态 | submitted/pending_billing_info |
| createTime | string | 创建时间 | 2026-07-03 10:00:00 |

### 响应示例

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "applyNo": "SP202607030001",
    "processInstanceId": "OA_PI_202607030001",
    "status": "submitted",
    "createTime": "2026-07-03 10:00:00"
  }
}
```

### 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 参数校验失败 |
| 409 | 重复提交，requestNo 已存在 |
| 422 | 业务规则校验失败 |
| 500 | 系统异常 |

## 接口二：查询申请单详情

### 基本信息

| 项目 | 说明 |
|------|------|
| 接口路径 | GET /api/v1/b2b/special-price/apply/{applyNo} |
| 请求方式 | GET |
| 接口说明 | 根据申请单号查询特价申请详情及审批状态 |

### 路径参数

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| applyNo | string | 是 | 申请单号 |

### 响应字段

返回字段与提交接口请求参数一致，额外增加：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| approvalStatus | string | 审批状态：pending/approved/rejected |
| approvalNode | string | 当前审批节点 |
| approver | string | 当前审批人 |
| approvalLogs | object[] | 审批日志 |

## 接口三：查询申请单列表

### 基本信息

| 项目 | 说明 |
|------|------|
| 接口路径 | GET /api/v1/b2b/special-price/apply/list |
| 请求方式 | GET |
| 接口说明 | 分页查询特价申请单列表 |

### 查询参数

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| pageNo | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 页大小，默认 20 |
| customerCode | string | 否 | 客户代码 |
| applicant | string | 否 | 申请人 |
| applyNo | string | 否 | 申请单号 |
| status | string | 否 | 申请状态 |
| startDate | string | 否 | 申请开始日期 |
| endDate | string | 否 | 申请结束日期 |
