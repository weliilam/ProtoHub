# POMS → TMS 接口文档

> TMS 配载系统 DW 送达时段模块所需调用的 POMS 接口

---

## 1. 推送运输信息并获取已选 DW

TMS 配载完成后调用，POMS 向亚马逊推送运输信息并拉取已确认的送达窗口。

| 项 | 内容 |
|----|------|
| **路径** | `POST /poms/dw/upsert-transportation` |
| **触发** | TMS 配载完成 |

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ytOrderNo` | String | 是 | YT单号 |
| `fbaShipmentId` | String | 是 | FBA货件ID（主箱号） |
| `carrierScac` | String | 是 | 承运商SCAC码 |
| `middleLegEstimatedDepartureTime` | DateTime | 是 | 预计离港时间 |
| `middleLegEstimatedArrivalTime` | DateTime | 是 | 预计到港时间 |
| `originPort` | String | 是 | 起运港 |
| `destinationPort` | String | 是 | 目的港 |
| `salesProductCode` | String | 是 | 销售产品代码 |

### POMS 处理逻辑

1. 用 `salesProductCode` 查询对应产品的派送时效、运输方式、干线服务级别
2. 调用亚马逊 `UpsertTransportationInfo` 推送运输信息
3. 用 `fbaShipmentId` + `carrierScac` 调用 `GetDeliveryWindowChoice` 获取已选 DW
4. 将 DW 数据返回 TMS

### 出参

| 字段 | 类型 | 说明 |
|------|------|------|
| `fbaShipmentList` | Object[] | 按主箱号分箱返回 |
| `fbaShipmentList[].fbaShipmentId` | String | 主箱号 |
| `fbaShipmentList[].sellerAllowCarrierUpdateDw` | Boolean | 卖家是否允许承运商更新DW |
| `fbaShipmentList[].deliveryWindowChoice.startDate` | Date | 已确认送达开始日期 |
| `fbaShipmentList[].deliveryWindowChoice.endDate` | Date | 已确认送达结束日期 |
| `fbaShipmentList[].deliveryWindowChoice.gracePeriodEndDate` | Date | 宽限期截止日期 |
| `fbaShipmentList[].deliveryWindowChoice.deliveryWindowOptionId` | String | 窗口选项唯一ID |

---

## 2. 查询可用 DW 选项

TMS 运营点击修改时调用，POMS 向亚马逊查询可用送达窗口列表。

| 项 | 内容 |
|----|------|
| **路径** | `POST /poms/dw/get-options` |
| **触发** | TMS 运营点击"修改"或"重新获取" |

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fbaShipmentId` | String | 是 | 主箱号 |

### POMS 处理逻辑

1. 用 `fbaShipmentId` + `carrierScac` + `originCountry=CN` 调用亚马逊 `GetDeliveryWindowOptions`
2. 返回可用窗口列表和 `referenceId`

### 出参

| 字段 | 类型 | 说明 |
|------|------|------|
| `sellerAllowCarrierUpdateDw` | Boolean | 卖家是否允许承运商更新DW |
| `deliveryWindowOptions` | Object[] | 可用送达窗口列表 |
| `deliveryWindowOptions[].deliveryWindowOptionId` | String | 窗口选项唯一ID |
| `deliveryWindowOptions[].startDate` | Date | 窗口开始日期（周日） |
| `deliveryWindowOptions[].endDate` | Date | 窗口结束日期（周六） |
| `deliveryWindowOptions[].availabilityStatus` | Enum | 见 [AvailabilityStatus 枚举](#availabilitystatus-枚举) |
| `deliveryWindowOptions[].gracePeriodEndDate` | Date | 宽限期截止日期 |
| `referenceId` | String | 引用ID，Confirm 时需回传 |

---

## 3. 确认 DW

TMS 运营从可用选项中选择目标窗口后调用，POMS 向亚马逊确认注册。

| 项 | 内容 |
|----|------|
| **路径** | `POST /poms/dw/confirm` |
| **触发** | TMS 运营选择 DW 后点确认 |

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fbaShipmentId` | String | 是 | 主箱号 |
| `deliveryWindowOptionId` | String | 是 | 来自接口 2 的 `deliveryWindowOptions[].deliveryWindowOptionId` |
| `referenceId` | String | 是 | 来自接口 2 的 `referenceId` |

### POMS 处理逻辑

1. 校验：`sellerAllowCarrierUpdateDw` = false → 返回 `SELLER_NOT_AUTHORIZED`
2. 校验：`gracePeriodEndDate` 已过 → 返回 `GRACE_PERIOD_EXPIRED`
3. 调用亚马逊 `ConfirmDeliveryWindowOption`
4. 结果回写 TMS

### 出参

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | Boolean | 确认是否成功 |
| `sellerAllowCarrierUpdateDw` | Boolean | |
| `errorCode` | String | 失败时返回，见 [错误码](#公共错误码) |
| `errorReason` | String | 失败原因描述 |

---

## 4. 刷新当前已选 DW

TMS 点击"重新获取"时调用，拉取亚马逊最新的已确认送达窗口状态。

| 项 | 内容 |
|----|------|
| **路径** | `POST /poms/dw/refresh-choice` |
| **触发** | TMS 运营点击"重新获取" |

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fbaShipmentId` | String | 是 | 主箱号 |

### 出参

同接口 1 `fbaShipmentList[i]` 的单条结构。

---

## 5. 批量录入约仓

TMS 勾选多条记录并填入约仓日期后调用，POMS 异步逐条查询、匹配、确认。

| 项 | 内容 |
|----|------|
| **路径** | `POST /poms/dw/batch-booking` |
| **触发** | TMS 勾选多条 → 选约仓日期 → 确认录入 |

### 入参

| 参数 | 类型 | 说明 |
|------|------|------|
| `bookings` | Object[] | 批量约仓列表 |
| `bookings[].fbaShipmentId` | String | 主箱号 |
| `bookings[].bookingDate` | Date | 约仓日期（YYYY-MM-DD） |

### POMS 处理逻辑（每条异步执行）

1. 校验：卖家未授权 → 标记失败 `SELLER_NOT_AUTHORIZED`
2. 调用 `GetDeliveryWindowOptions` 获取可用窗口
3. 用 `bookingDate` 在 `deliveryWindowOptions` 中匹配包含该日期的窗口（周日~周六 7 天）
4. 匹配逻辑：
   - 命中 AVAILABLE → 调 `Confirm` 确认
   - 命中 CONGESTED → 调 `Confirm` 确认（标注延迟风险）
   - 命中 BLOCKED → 标记失败 `WINDOW_BLOCKED`
   - 无匹配 → 标记失败 `NO_MATCHING_WINDOW`，返回可用窗口列表
5. 确认失败（超时/异常）→ 入死信队列

### 出参（同步）

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | String | 异步任务ID |

### 进度轮询

| 项 | 内容 |
|----|------|
| **路径** | `GET /poms/dw/batch-booking/{taskId}/status` |

#### 出参

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | Enum | `PROCESSING` / `COMPLETED` |
| `totalCount` | Int | 总条数 |
| `successCount` | Int | 成功数 |
| `failedCount` | Int | 失败数 |
| `results` | Object[] | 每条明细 |
| `results[].fbaShipmentId` | String | |
| `results[].status` | Enum | `SUCCESS` / `FAILED` |
| `results[].matchedWindow` | String | 成功时，格式 `YYYY-MM-DD ~ YYYY-MM-DD` |
| `results[].availabilityStatus` | Enum | 成功时，见 [AvailabilityStatus 枚举](#availabilitystatus-枚举) |
| `results[].errorCode` | String | 失败时，见 [错误码](#公共错误码) |
| `results[].errorReason` | String | 失败原因 |
| `results[].availableWindows` | Array | 匹配失败时返回可选窗口，供运营参考 |

---

## 6. 批量修改预计送达时段

TMS 勾选多条记录，统一选择目标送达时段后调用。POMS 逐条查亚马逊可用窗口，匹配到则确认，匹配不到则失败。

| 项 | 内容 |
|----|------|
| **路径** | `POST /poms/dw/batch-edit` |
| **触发** | TMS 勾选多条 → 选预计送达时段 → 确认修改 |

### 入参

| 参数 | 类型 | 说明 |
|------|------|------|
| `items` | Object[] | |
| `items[].fbaShipmentId` | String | 主箱号 |
| `items[].estimatedDwRange` | String | 目标送达时段，格式 `YYYY-MM-DD ~ YYYY-MM-DD` |

### POMS 处理逻辑（每条异步执行）

1. 用 `fbaShipmentId` 调亚马逊 `GetDeliveryWindowOptions` 获取可用窗口列表
2. 用 `estimatedDwRange` 在 `deliveryWindowOptions` 中精确匹配（`startDate` + `endDate` 完全一致）
3. 匹配到 → 调亚马逊 `ConfirmDeliveryWindowOption` 确认
4. 匹配不到 → 直接标记失败 `NO_MATCHING_WINDOW`，返回可用窗口列表供运营参考

### 出参（同步）

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | String | 异步任务ID |

### 进度轮询

| 项 | 内容 |
|----|------|
| **路径** | `GET /poms/dw/batch-edit/{taskId}/status` |

出参结构同接口 5 的进度轮询。

---

## AvailabilityStatus 枚举

| 值 | 说明 |
|----|------|
| `AVAILABLE` | 可用 |
| `CONGESTED` | 拥挤（有延迟风险，仍可确认） |
| `BLOCKED` | 被阻止（不可选择） |
| `DISCOUNTED` | 已作废 |

---

## 公共错误码

| 错误码 | 说明 |
|--------|------|
| `SELLER_NOT_AUTHORIZED` | 卖家未授权承运商更新DW |
| `NO_MATCHING_WINDOW` | 无可用窗口覆盖目标日期/时段 |
| `WINDOW_BLOCKED` | 命中窗口被亚马逊标记为 BLOCKED |
| `API_TIMEOUT` | 亚马逊接口超时 |
| `INVALID_DW_OPTION` | DW选项已过期或无效 |
| `GRACE_PERIOD_EXPIRED` | 已过宽限期 |
