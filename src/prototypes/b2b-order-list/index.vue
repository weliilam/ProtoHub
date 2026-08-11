<template>
  <div class="bol-page">
    <div class="bol-header"><h2 class="bol-title">B2B订单列表</h2></div>

    <!-- 搜索区域 -->
    <div class="bol-search-card">
      <a-form ref="searchFormRef" :model="filters" layout="inline" class="bol-search-form" @submit.prevent>
        <a-row :gutter="[8, 8]" style="width: 100%">
          <a-col :span="6">
            <a-form-item label="单号" class="bol-form-item">
              <a-input v-model:value="filters.orderNo" placeholder="请输入单号，多单号以空格或英文逗号分隔" allow-clear>
                <template #prefix><search-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="B2B单号" class="bol-form-item">
              <a-input v-model:value="filters.b2bOrderNo" placeholder="请输入单号，多单号以空格或英文逗号分隔" allow-clear>
                <template #prefix><search-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="创建时间" class="bol-form-item">
              <a-range-picker v-model:value="filters.createTimeRange" show-time style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="订单类型" class="bol-form-item">
              <a-select v-model:value="filters.orderType" placeholder="请选择" allow-clear :options="ORDER_TYPE_OPTIONS" show-search style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="订单状态" class="bol-form-item">
              <a-select v-model:value="filters.orderStatus" placeholder="请选择" mode="multiple" max-tag-count="2" :options="ORDER_STATUS_OPTIONS" show-search style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="审核状态" class="bol-form-item">
              <a-select v-model:value="filters.auditStatus" placeholder="请选择" allow-clear :options="AUDIT_STATUS_OPTIONS" show-search style="width: 100%" />
            </a-form-item>
          </a-col>

          <template v-if="expandSearch">
            <a-col :span="6">
              <a-form-item label="销售产品" class="bol-form-item">
                <a-cascader v-model:value="filters.salesProduct" placeholder="请选择" :options="SALES_PRODUCT_OPTIONS" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="目的国家" class="bol-form-item">
                <a-select v-model:value="filters.destCountry" placeholder="输入国家二字码/名称/英文搜索" allow-clear show-search :options="COUNTRY_OPTIONS" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="渠道代码" class="bol-form-item">
                <a-select v-model:value="filters.channelCode" placeholder="输入渠道代码/中英文名、服务商代码搜索" allow-clear show-search :options="CHANNEL_OPTIONS" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="业务员" class="bol-form-item">
                <a-select v-model:value="filters.salesman" placeholder="输入工号/姓名搜索" allow-clear show-search :options="SALESMAN_OPTIONS" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="跟进人" class="bol-form-item">
                <a-input v-model:value="filters.followerFilter" placeholder="输入跟进人搜索" allow-clear>
                  <template #prefix><search-outlined /></template>
                </a-input>
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="客户代码" class="bol-form-item">
                <a-select v-model:value="filters.customerCode" placeholder="输入客户代码搜索" allow-clear show-search :options="CUSTOMER_CODE_OPTIONS" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否报关件" class="bol-form-item">
                <a-select v-model:value="filters.isCustoms" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否签名" class="bol-form-item">
                <a-select v-model:value="filters.isSigned" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="地址类型" class="bol-form-item">
                <a-select v-model:value="filters.addressType" placeholder="请选择" allow-clear :options="ADDRESS_TYPE_OPTIONS" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否扣件" class="bol-form-item">
                <a-select v-model:value="filters.isDetained" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="地址审核状态" class="bol-form-item">
                <a-select v-model:value="filters.addressAuditStatus" placeholder="请选择" allow-clear :options="ADDRESS_REVIEW_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="扣件原因" class="bol-form-item">
                <a-select v-model:value="filters.detentionReason" placeholder="请选择扣件原因" mode="multiple" max-tag-count="2" allow-clear show-search style="width: 100%"
                  :options="detentionReasonOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否完成增值服务" class="bol-form-item">
                <a-select v-model:value="filters.isValueAddedDone" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否可配载" class="bol-form-item">
                <a-select v-model:value="filters.isLoadable" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否拦截" class="bol-form-item">
                <a-select v-model:value="filters.isIntercepted" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="计费结果" class="bol-form-item">
                <a-select v-model:value="filters.billingResult" placeholder="请选择" allow-clear :options="BILLING_RESULT_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="是否首批" class="bol-form-item">
                <a-select v-model:value="filters.isFirstBatch" placeholder="请选择" allow-clear :options="YES_NO_OPTIONS" show-search style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="跟进内容" class="bol-form-item">
                <a-input v-model:value="filters.latestFollowUp" placeholder="输入跟进内容关键词搜索" allow-clear>
                  <template #prefix><search-outlined /></template>
                </a-input>
              </a-form-item>
            </a-col>
          </template>
        </a-row>

        <div class="bol-search-actions">
          <a-space :size="8">
            <a-button type="primary" @click="handleSearch">
              <template #icon><search-outlined /></template>查询
            </a-button>
            <a-button @click="resetFilters">
              <template #icon><reload-outlined /></template>重置
            </a-button>
            <a-button type="link" @click="expandSearch = !expandSearch">
              <template #icon><down-outlined :rotate="expandSearch ? 180 : 0" /></template>
              {{ expandSearch ? '收起高级查询' : '展开高级查询' }}
            </a-button>
          </a-space>
        </div>
      </a-form>
    </div>

    <!-- 批量操作栏 -->
    <div class="bol-toolbar">
      <a-space :size="8" wrap>
        <a-button type="primary" :disabled="!selectedRowKeys.length" @click="handleBatchAudit">批量审核{{ selectedRowKeys.length ? ` (${selectedRowKeys.length})` : '' }}</a-button>
        <a-button :disabled="!selectedRowKeys.length" @click="handleCancelReview">撤销审核</a-button>
        <a-button :disabled="!selectedRowKeys.length" @click="handleBatchExtraService">批量修改额外服务</a-button>
        <a-button type="primary" :disabled="!selectedRowKeys.length" @click="handleBatchEditFee">批量修改费用</a-button>
        <a-button :disabled="!selectedRowKeys.length" @click="handleConfirmFee">确认费用</a-button>
        <a-button danger :disabled="!selectedRowKeys.length" @click="handleIntercept">拦截</a-button>
        <a-button :disabled="!selectedRowKeys.length" @click="openCancelIntercept">取消拦截</a-button>
        <a-button type="primary" :disabled="!selectedRowKeys.length" @click="handleClaim">认领{{ selectedRowKeys.length ? ` (${selectedRowKeys.length})` : '' }}</a-button>
        <a-button danger :disabled="!selectedRowKeys.length" @click="handleDelete">
          <template #icon><delete-outlined /></template>删除
        </a-button>
        <a-button @click="handleRefresh">
          <template #icon><reload-outlined /></template>刷新
        </a-button>
        <a-button :disabled="!selectedRowKeys.length" @click="handleAddressReview">地址审核</a-button>
        <a-button @click="columnConfigOpen = true">
          <template #icon><copy-outlined /></template>复制显示列
        </a-button>
        <a-dropdown>
          <a-button>更多 <down-outlined /></a-button>
          <template #overlay>
            <a-menu @click="onMenuClick">
              <a-menu-item-group title="导出">
                <a-menu-item v-for="e in EXPORT_TYPES" :key="`export-${e.key}`">{{ e.label }}</a-menu-item>
              </a-menu-item-group>
              <a-menu-divider />
              <a-menu-item key="export-followup">跟进记录导出</a-menu-item>
              <a-menu-item key="export-detention">扣件原因导出</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="import-remark">备注导入</a-menu-item>
              <a-menu-item key="import-addr-review">地址审核状态导入</a-menu-item>
              <a-menu-item key="1">打印运单</a-menu-item>
              <a-menu-item key="2">列配置</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-tooltip title="自定义列展示">
          <a-button @click="columnConfigOpen = true">
            <template #icon><setting-outlined /></template>
          </a-button>
        </a-tooltip>
      </a-space>
      <span class="bol-total-count">共 <b>{{ filteredData.length }}</b> 条</span>
    </div>

    <!-- 表格 -->
    <div class="bol-table-wrap">
      <a-table
        :columns="columns"
        :data-source="filteredData"
        :row-selection="rowSelection"
        :scroll="{ x: 5200 }"
        size="middle"
        :pagination="pagination"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="monoKeys.includes(column.key)"><span class="bol-mono">{{ record[column.dataIndex] }}</span></template>
          <template v-else-if="column.key === 'orderStatus'"><a-tag color="processing">{{ record.orderStatus }}</a-tag></template>
          <template v-else-if="column.key === 'isFirstBatch'"><a-tag v-if="record.isFirstBatch" color="green">是</a-tag><span v-else>否</span></template>
          <template v-else-if="column.key === 'isClearance'"><a-tag v-if="record.isClearance === 'Y'" color="green">是</a-tag><span v-else>否</span></template>
          <template v-else-if="column.key === 'addressReviewStatus'"><a-tag :color="ADDRESS_REVIEW_COLOR[record.addressReviewStatus]">{{ ADDRESS_REVIEW_LABEL[record.addressReviewStatus] ?? record.addressReviewStatus }}</a-tag></template>
          <template v-else-if="column.key === 'auditStatus'"><a-tag :color="AUDIT_TAG[record.auditStatus]">{{ record.auditStatus }}</a-tag></template>
          <template v-else-if="column.key === 'latestFollowUp'">{{ latestFollowUpOf(record) }}</template>
          <template v-else-if="column.key === 'deliveryType'">{{ record.deliveryType === 1 ? '云途' : record.deliveryType === 2 ? '客户自送' : '' }}</template>
          <template v-else-if="column.key === 'detention'">
            <a-button v-if="(MOCK_DETENTION[record.ytOrderNo] || []).length" type="link" size="small" @click="openDetention(record)">查看</a-button>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'detentionCreateTime'">{{ detCreateTime(record) }}</template>
          <template v-else-if="column.key === 'detentionFinishTime'">{{ detFinishTime(record) }}</template>
          <template v-else-if="column.key === 'chargeStatus'"><a-tag :color="CHARGE_TAG[record.chargeStatus]">{{ CHARGE_LABEL[record.chargeStatus] ?? record.chargeStatus }}</a-tag></template>
          <template v-else-if="column.key === 'interceptStatus'"><a-tag v-if="record.interceptStatus === 'Y'" color="red">是</a-tag><span v-else>否</span></template>
          <template v-else>{{ record[column.dataIndex] ?? (column.dataIndex === 'serviceChannel' ? '—' : '') }}</template>
        </template>
      </a-table>
    </div>

    <!-- 跟进备注弹窗 -->
    <a-modal v-model:open="followUpModalOpen" title="跟进备注" :width="720" :footer="null">
      <div style="margin-bottom: 12px">
        <span style="color: #6b7280">YT单号：</span><b>{{ followUpRecord?.ytOrderNo }}</b>
        <span style="margin-left: 24px; color: #6b7280">跟进人：</span>
        <a-tag color="blue">{{ followUpRecord?.follower || '未分配' }}</a-tag>
      </div>
      <div class="bol-followup-layout">
        <div class="bol-followup-left">
          <div class="bol-followup-section-title">新增跟进</div>
          <a-textarea v-model:value="followUpContent" placeholder="请输入跟进内容" :rows="5" />
        </div>
        <div class="bol-followup-right">
          <template v-if="followUpRecord && (followUpHistory[followUpRecord.ytOrderNo] || []).length">
            <div class="bol-followup-section-title">历史跟进记录 ({{ (followUpHistory[followUpRecord.ytOrderNo] || []).length }})</div>
            <div class="bol-followup-timeline-wrap">
              <a-timeline>
                <a-timeline-item v-for="(item, idx) in followUpHistory[followUpRecord.ytOrderNo]" :key="idx" :color="idx === 0 && !item.hidden ? 'blue' : 'gray'">
                  <div class="bol-timeline-item">
                    <div class="bol-timeline-header">
                      <span class="bol-timeline-time">{{ item.time }}</span>
                      <a-tag :color="idx === 0 && !item.hidden ? 'blue' : 'default'" style="margin-left: 8px">{{ item.operator }}</a-tag>
                      <a-tag v-if="item.hidden" color="orange" style="margin-left: 4px; font-size: 10px">系统</a-tag>
                    </div>
                    <div class="bol-timeline-content">{{ item.content }}</div>
                  </div>
                </a-timeline-item>
              </a-timeline>
            </div>
          </template>
          <div v-else class="bol-followup-empty">暂无跟进记录</div>
        </div>
      </div>
      <template #footer>
        <a-button @click="followUpModalOpen = false">取消</a-button>
        <a-button type="primary" @click="handleFollowUpSubmit">提交</a-button>
      </template>
    </a-modal>

    <!-- 扣件原因弹窗 -->
    <a-modal v-model:open="detentionModalOpen" :title="`扣件原因 — ${detentionRecord?.ytOrderNo ?? ''}`" :width="720" :footer="null">
      <a-table
        v-if="detentionRecord && MOCK_DETENTION[detentionRecord.ytOrderNo]"
        size="small"
        :pagination="false"
        :data-source="MOCK_DETENTION[detentionRecord.ytOrderNo].map((d, i) => ({ ...d, key: i }))"
        :columns="detentionColumns"
      />
      <template #footer><a-button @click="detentionModalOpen = false">关闭</a-button></template>
    </a-modal>

    <!-- 地址审核弹窗 -->
    <a-modal v-model:open="addressReviewOpen" title="地址审核" :width="480" :footer="null">
      <a-form layout="vertical">
        <a-form-item label="地址审核状态" required>
          <a-radio-group v-model:value="addressReviewStatus">
            <a-radio v-for="o in ADDRESS_REVIEW_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="addressReviewOpen = false">取消</a-button>
        <a-button type="primary" :disabled="!addressReviewStatus" @click="submitAddressReview">确定</a-button>
      </template>
    </a-modal>

    <!-- 拦截弹窗 -->
    <a-modal v-model:open="interceptModalOpen" title="拦截" :width="780">
      <div style="margin-bottom: 12px">
        <span style="margin-right: 16px">拦截类型：
          <a-select v-model:value="interceptCategory" :options="INTERCEPT_CATEGORY_OPTIONS" style="width: 160px" />
        </span>
        <span>搜索内容：
          <a-input v-model:value="interceptSearch" placeholder="请输入" allow-clear style="width: 240px; margin-left: 4px" />
        </span>
      </div>
      <a-table
        row-key="code"
        size="small"
        :pagination="false"
        :data-source="filteredInterceptReasons"
        :row-selection="{ type: 'radio', selectedRowKeys: interceptSelectedCode ? [interceptSelectedCode] : [], onChange: onInterceptRowChange }"
        :columns="interceptColumns"
      />
      <div style="margin-top: 16px">
        <div style="font-size: 13px; color: #333; margin-bottom: 6px">
          选择的拦截内容：{{ selectedInterceptItem ? `${selectedInterceptItem.code} ${selectedInterceptItem.name}：${selectedInterceptItem.content}` : '未选择' }}
        </div>
        <div style="font-size: 13px; margin-bottom: 4px">拦截备注</div>
        <a-textarea v-model:value="interceptRemark" :rows="4" placeholder="请输入拦截备注" />
      </div>
      <template #footer>
        <a-button @click="interceptModalOpen = false">取消</a-button>
        <a-button type="primary" @click="handleInterceptSubmit">确定</a-button>
      </template>
    </a-modal>

    <!-- 详情弹框 -->
    <a-modal
      v-model:open="detailOpen"
      title="订单详情"
      width="1200px"
      style="top: 36px"
      :body-style="{ height: '710px', overflow: 'auto', overflowX: 'hidden', padding: '30px' }"
    >
      <template v-if="detailRecord">
        <a-form layout="horizontal" :label-col="{ style: { width: '120px' } }" class="w-100p">
          <div class="bol-section">
            <div class="bol-section-title">订单基础信息</div>
            <div class="bol-grid-4">
              <a-form-item label="YT单号">{{ detailRecord.ytOrderNo }}</a-form-item>
              <a-form-item label="B2B单号">{{ detailRecord.b2bOrderNo }}</a-form-item>
              <a-form-item label="客户单号">{{ detailRecord.customerOrderNo || '-' }}</a-form-item>
              <a-form-item label="服务商单号">{{ detailRecord.serverHawbCode || '-' }}</a-form-item>
              <a-form-item label="分拣码">{{ detailRecord.sortingCode || '-' }}</a-form-item>
              <a-form-item label="客户代码">{{ detailRecord.customerCode }}</a-form-item>
              <a-form-item label="订单状态">{{ detailRecord.orderStatus }}</a-form-item>
              <a-form-item label="审核状态"><a-tag :color="AUDIT_TAG[detailRecord.auditStatus]">{{ detailRecord.auditStatus }}</a-tag></a-form-item>
              <a-form-item label="订单来源">{{ detailRecord.orderSource }}</a-form-item>
              <a-form-item label="订单类型">{{ detailRecord.orderType }}</a-form-item>
              <a-form-item label="销售产品">{{ detailRecord.salesProduct }}</a-form-item>
              <a-form-item label="服务渠道">{{ detailRecord.serviceChannel || '-' }}</a-form-item>
              <a-form-item label="目的国家">{{ detailRecord.countryName }}</a-form-item>
              <a-form-item label="清关方案">{{ detailRecord.taxMethod }}</a-form-item>
              <a-form-item label="是否报关件">{{ detailRecord.isClearance === 'Y' ? '是' : '否' }}</a-form-item>
              <a-form-item label="报关方式">{{ detailRecord.customsMode }}</a-form-item>
              <a-form-item label="业务员">{{ detailRecord.salesman }}</a-form-item>
              <a-form-item label="客服员">{{ detailRecord.csRep }}</a-form-item>
              <a-form-item label="跟进人">{{ detailRecord.follower || '-' }}</a-form-item>
            </div>
          </div>
          <div class="bol-section">
            <div class="bol-section-title">收件人信息</div>
            <div class="bol-grid-4">
              <a-form-item label="地址类型">{{ (ADDRESS_TYPE_OPTIONS.find(o => o.value === detailRecord.addressType) || {}).label ?? '-' }}</a-form-item>
              <a-form-item label="仓库代码">{{ detailRecord.warehouseCode || '-' }}</a-form-item>
              <a-form-item label="收件人">{{ detailRecord.consignee || '-' }}</a-form-item>
              <a-form-item label="目的国家">{{ detailRecord.countryName }}</a-form-item>
              <a-form-item label="邮编">{{ detailRecord.postCode }}</a-form-item>
              <a-form-item label="地址审核状态">{{ (ADDRESS_REVIEW_LABEL[detailRecord.addressReviewStatus] ?? detailRecord.addressReviewStatus) || '-' }}</a-form-item>
            </div>
          </div>
          <div class="bol-section">
            <div class="bol-section-title">货物 / 清关信息</div>
            <div class="bol-grid-4">
              <a-form-item label="件数">{{ detailRecord.goodsAmount }}</a-form-item>
              <a-form-item label="预估重量">{{ detailRecord.estimateWeight }}</a-form-item>
              <a-form-item label="计费重">{{ detailRecord.chargeWeight }}</a-form-item>
              <a-form-item label="报关方式">{{ detailRecord.customsMode }}</a-form-item>
              <a-form-item label="清关方案">{{ detailRecord.taxMethod }}</a-form-item>
              <a-form-item label="配送方式">{{ detailRecord.deliveryType === 1 ? '云途' : detailRecord.deliveryType === 2 ? '客户自送' : '-' }}</a-form-item>
              <a-form-item label="服务商单号">{{ detailRecord.serverHawbCode || '-' }}</a-form-item>
              <a-form-item label="仓库代码">{{ detailRecord.warehouseCode || '-' }}</a-form-item>
              <a-form-item label="分拣码">{{ detailRecord.sortingCode || '-' }}</a-form-item>
              <a-form-item label="是否拦截">{{ detailRecord.interceptStatus === 'Y' ? '是' : '否' }}</a-form-item>
              <a-form-item label="拦截原因">{{ detailRecord.interceptReason || '-' }}</a-form-item>
            </div>
          </div>
          <div class="bol-section">
            <div class="bol-section-title">费用信息</div>
            <div class="bol-grid-4">
              <a-form-item label="计费状态"><a-tag :color="CHARGE_TAG[detailRecord.chargeStatus]">{{ CHARGE_LABEL[detailRecord.chargeStatus] ?? detailRecord.chargeStatus }}</a-tag></a-form-item>
              <a-form-item label="入账状态">{{ detailRecord.billStatus }}</a-form-item>
            </div>
          </div>
        </a-form>
      </template>
      <template #footer><a-button @click="detailOpen = false">关闭</a-button></template>
    </a-modal>

    <!-- 编辑弹框 -->
    <a-modal
      v-model:open="editOpen"
      :title="`编辑订单 — ${editRecord?.ytOrderNo ?? ''}`"
      width="1200px"
      style="top: 36px"
      :body-style="{ height: '710px', overflow: 'auto', overflowX: 'hidden', padding: '30px' }"
    >
      <a-form v-if="editRecord" ref="editFormRef" :model="editForm" layout="horizontal" :label-col="{ style: { width: '110px' } }" class="w-100p">
        <div class="bol-section">
          <div class="bol-section-title">订单基础信息</div>
          <div class="bol-grid-4">
            <a-form-item label="YT单号">
              <span class="bol-field-readonly">{{ editRecord.ytOrderNo }}</span>
            </a-form-item>
            <a-form-item label="销售产品">
              <a-select v-model:value="editForm.salesProduct" :options="SALES_PRODUCT_FLAT" show-search placeholder="请选择" allow-clear style="width: 100%" />
            </a-form-item>
            <a-form-item label="服务渠道">
              <a-input v-model:value="editForm.serviceChannel" placeholder="请输入服务渠道代码" />
            </a-form-item>
            <a-form-item label="业务员">
              <a-input v-model:value="editForm.salesman" placeholder="请输入业务员" />
            </a-form-item>
            <a-form-item label="客服员">
              <a-input v-model:value="editForm.customerService" placeholder="请输入客服员" />
            </a-form-item>
            <a-form-item label="报关方式">
              <a-select v-model:value="editForm.customsMode" :options="CUSTOMS_CLEARANCE_OPTIONS" show-search placeholder="请选择" allow-clear style="width: 100%" />
            </a-form-item>
            <a-form-item label="清关方案">
              <a-select v-model:value="editForm.taxMethod" :options="CLEARANCE_PLAN_OPTIONS" show-search placeholder="请选择" allow-clear style="width: 100%" />
            </a-form-item>
          </div>
        </div>
        <div class="bol-section">
          <div class="bol-section-title">收件人信息</div>
          <div class="bol-grid-4">
            <a-form-item label="收件人">
              <a-input v-model:value="editForm.consignee" placeholder="请输入收件人" />
            </a-form-item>
            <a-form-item label="目的国家">
              <a-input v-model:value="editForm.countryName" placeholder="请输入目的国家" />
            </a-form-item>
            <a-form-item label="邮编">
              <a-input v-model:value="editForm.postCode" placeholder="请输入邮编" />
            </a-form-item>
            <a-form-item label="件数（件）">
              <a-input-number v-model:value="editForm.goodsAmount" :min="1" style="width: 100%" placeholder="请输入件数" />
            </a-form-item>
            <a-form-item label="预估重量（kg）">
              <a-input-number v-model:value="editForm.estimateWeight" :min="0" :step="0.1" style="width: 100%" placeholder="请输入预估重量" />
            </a-form-item>
          </div>
        </div>
      </a-form>
      <template #footer>
        <a-button @click="editOpen = false">取消</a-button>
        <a-button type="primary" @click="handleEditOk">保存</a-button>
      </template>
    </a-modal>

    <!-- 日志弹框 -->
    <a-modal v-model:open="logOpen" title="操作日志" :width="560" :footer="null">
      <a-timeline>
        <a-timeline-item v-for="(item, idx) in (MOCK_LOG[logRecord?.ytOrderNo] || [{ time: '-', operator: '系统', action: '暂无操作记录' }])" :key="idx">
          <div style="color: #6b7280; font-size: 12px">{{ item.time }} · {{ item.operator }}</div>
          <div style="margin-top: 2px">{{ item.action }}</div>
        </a-timeline-item>
      </a-timeline>
      <template #footer><a-button @click="logOpen = false">关闭</a-button></template>
    </a-modal>

    <!-- 审核不通过弹框 -->
    <a-modal v-model:open="auditOpen" :title="`审核不通过 — ${auditRecord?.ytOrderNo ?? ''}`" :width="700" :body-style="{ maxHeight: '72vh', overflowY: 'auto' }">
      <a-form layout="vertical">
        <a-form-item label="不通过原因" required>
          <a-textarea v-model:value="auditReason" :rows="4" :maxlength="200" show-count placeholder="请输入不通过原因（最多 200 字）" />
        </a-form-item>
        <div class="bol-warn-tip">
          审核不通过后，系统会<b>自动通知客户</b>。
        </div>
      </a-form>
      <template #footer>
        <a-button @click="closeAudit">取消</a-button>
        <a-button type="primary" @click="submitAudit">确定</a-button>
      </template>
    </a-modal>

    <!-- 批量审核弹框 -->
    <a-modal v-model:open="batchReviewOpen" title="批量审核" :width="520">
      <div style="margin-bottom: 8px">已勾选 <b>{{ selectedRowKeys.length }}</b> 个订单。</div>
      <a-form layout="vertical">
        <a-form-item label="审核结果" required>
          <a-radio-group v-model:value="batchReviewRadio">
            <a-radio value="审核通过">审核通过</a-radio>
            <a-radio value="审核不通过">审核不通过</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="batchReviewRadio === '审核不通过'" label="审核说明" required>
          <a-textarea v-model:value="batchReviewReason" :rows="4" :maxlength="200" show-count placeholder="请输入不通过原因（最多 200 字）" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="batchReviewOpen = false">取消</a-button>
        <a-button type="primary" :disabled="!batchReviewRadio" @click="submitBatchReview">确定</a-button>
      </template>
    </a-modal>

    <!-- 批量修改额外服务弹框 -->
    <a-modal v-model:open="extraServiceOpen" title="批量修改额外服务" :width="620">
      <div style="margin-bottom: 8px">已勾选 <b>{{ selectedRowKeys.length }}</b> 个订单，修改后将对所有勾选订单生效。</div>
      <div v-for="(item, idx) in extraServiceList" :key="idx" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center">
        <a-select style="width: 360px" placeholder="请选择额外服务" v-model:value="item.code"
          @change="(v:any, opt:any) => onExtraServiceChange(idx, v, opt)" :options="EXTRA_SERVICE_OPTIONS" show-search />
        <a-button danger size="small" @click="extraServiceList.splice(idx, 1)">删除</a-button>
      </div>
      <a-button type="dashed" block @click="extraServiceList.push({ code: undefined, name: '' })">新增一行</a-button>
      <div style="margin-top: 12px; font-size: 12px; color: #fa8c16">
        提示：批量修改额外服务会覆盖所选订单的现有服务项，请确认后提交。
      </div>
      <template #footer>
        <a-button @click="extraServiceOpen = false">取消</a-button>
        <a-button type="primary" @click="submitExtraService">确定</a-button>
      </template>
    </a-modal>

    <!-- 批量修改费用弹框 -->
    <a-modal v-model:open="editFeeOpen" title="批量修改费用" :width="620">
      <div style="margin-bottom: 8px">已勾选 <b>{{ selectedRowKeys.length }}</b> 个订单，修改后将对所有勾选订单生效。</div>
      <div v-for="(item, idx) in feeList" :key="idx" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center">
        <a-select style="width: 280px" placeholder="请选择费用项" v-model:value="item.code" @change="(v:any) => onFeeChange(idx, v)" :options="FEE_OPTIONS" show-search />
        <a-input-number style="width: 160px" placeholder="金额" :min="0" v-model:value="item.price" />
        <a-button danger size="small" @click="feeList.splice(idx, 1)">删除</a-button>
      </div>
      <a-button type="dashed" block @click="feeList.push({ code: undefined, price: null })">新增一行</a-button>
      <div style="margin-top: 12px; font-size: 12px; color: #fa8c16">
        提示：批量修改费用将同步更新计费，请确认金额无误后提交。
      </div>
      <template #footer>
        <a-button @click="editFeeOpen = false">取消</a-button>
        <a-button type="primary" @click="submitFee">确定</a-button>
      </template>
    </a-modal>

    <!-- 确认费用弹框 -->
    <a-modal v-model:open="confirmFeeOpen" title="确认费用" :width="520">
      <div style="margin-bottom: 8px">已勾选 <b>{{ selectedRowKeys.length }}</b> 个「已发货」订单。</div>
      <a-form layout="vertical">
        <a-form-item label="是否确认费用" required>
          <a-radio-group v-model:value="confirmFeeRadio">
            <a-radio :value="true">确认费用</a-radio>
            <a-radio :value="false">不确认费用</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="!confirmFeeRadio" label="不确认说明" required>
          <a-textarea v-model:value="confirmFeeMsg" :rows="3" placeholder="请填写不确认原因" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="confirmFeeOpen = false">取消</a-button>
        <a-button type="primary" @click="submitConfirmFee">确定</a-button>
      </template>
    </a-modal>

    <!-- 撤销审核弹框 -->
    <a-modal v-model:open="cancelReviewOpen" title="撤销审核" :width="520">
      <div style="margin-bottom: 8px">将撤销以下 <b>{{ selectedRowKeys.length }}</b> 条「已预报/已入仓」且审核状态为「审核通过/审核不通过」订单的审核结果。</div>
      <a-form layout="vertical">
        <a-form-item label="撤销审核说明" required>
          <a-textarea v-model:value="cancelReviewReason" :rows="4" placeholder="请输入撤销原因" />
        </a-form-item>
      </a-form>
      <div style="font-size: 12px; color: #fa8c16">提示：撤销审核后，订单将回到未审核状态，需重新提交审核。</div>
      <template #footer>
        <a-button @click="cancelReviewOpen = false">取消</a-button>
        <a-button type="primary" @click="submitCancelReview">确定</a-button>
      </template>
    </a-modal>

    <!-- 取消拦截弹框 -->
    <a-modal v-model:open="cancelInterceptOpen" title="取消拦截" :width="720">
      <div style="margin-bottom: 8px">已勾选 <b>{{ selectedRowKeys.length }}</b> 个订单，请选择需取消拦截的问题类型：</div>
      <a-checkbox-group v-model:value="cancelInterceptSelected">
        <div v-for="item in MOCK_CANCEL_INTERCEPT" :key="item.code" style="margin-bottom: 6px">
          <a-checkbox :value="item.code">{{ item.code }} {{ item.name }}</a-checkbox>
          <span style="margin-left: 8px; color: #6b7280; font-size: 12px">{{ item.content }}</span>
        </div>
      </a-checkbox-group>
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="备注">
          <a-textarea v-model:value="cancelInterceptRemark" :rows="3" placeholder="请输入备注（选填）" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="cancelInterceptOpen = false">取消</a-button>
        <a-button type="primary" @click="submitCancelIntercept">确定</a-button>
      </template>
    </a-modal>

    <!-- 打印运单弹框 -->
    <a-modal v-model:open="printOpen" title="打印运单" :width="480">
      <a-form layout="vertical">
        <a-form-item label="打印模板" required>
          <a-radio-group v-model:value="printTemplate">
            <a-radio value="label">标签</a-radio>
            <a-radio value="waybill">面单</a-radio>
          </a-radio-group>
        </a-form-item>
        <div style="font-size: 12px; color: #6b7280">
          将按所选模板批量打印当前{{ selectedRowKeys.length > 0 ? `勾选的 ${selectedRowKeys.length} 个` : '全部' }}订单。
        </div>
      </a-form>
      <template #footer>
        <a-button @click="printOpen = false">取消</a-button>
        <a-button type="primary" @click="submitPrint">打印</a-button>
      </template>
    </a-modal>

    <!-- 列配置 / 复制显示列 弹框 -->
    <a-modal v-model:open="columnConfigOpen" title="列配置 / 复制显示列" :width="560">
      <div style="margin-bottom: 8px">勾选需要显示的列（当前为演示，配置不持久化）：</div>
      <a-checkbox-group style="width: 100%">
        <a-row :gutter="[8, 8]">
          <a-col v-for="c in columns" :key="c.key" :span="8">
            <a-checkbox :value="c.key" checked>{{ c.title }}</a-checkbox>
          </a-col>
        </a-row>
      </a-checkbox-group>
      <template #footer>
        <a-button @click="columnConfigOpen = false">取消</a-button>
        <a-button @click="copyColumns">复制显示列</a-button>
        <a-button type="primary" @click="() => { columnConfigOpen = false; message.success('列配置已更新（模拟）'); }">确定</a-button>
      </template>
    </a-modal>

    <!-- 导出配置弹框 -->
    <a-modal v-model:open="exportOpen" :title="`导出配置 — ${EXPORT_TYPES.find((e:any) => e.key === exportKey)?.label ?? ''}`" :width="520">
      <a-form layout="vertical">
        <a-form-item label="导出范围" required>
          <a-radio-group v-model:value="exportOption">
            <a-radio value="selected" :disabled="!selectedRowKeys.length">导出勾选数据（{{ selectedRowKeys.length }} 条）</a-radio>
            <a-radio value="all">导出全部数据</a-radio>
          </a-radio-group>
        </a-form-item>
        <div style="font-size: 12px; color: #6b7280">导出文件将包含当前查询条件下对应字段，生成 CSV 文件下载。</div>
      </a-form>
      <template #footer>
        <a-button @click="exportOpen = false">取消</a-button>
        <a-button type="primary" @click="submitExport">导出</a-button>
      </template>
    </a-modal>

    <!-- 备注导入弹框 -->
    <a-modal
      v-model:open="remarkImportOpen"
      title="备注导入"
      :width="960"
      :mask-closable="false"
      :confirm-loading="remarkImportLoading"
      @cancel="resetRemarkImport"
    >
      <div class="bol-import-upload">
        <span class="bol-import-upload-label">请选择导入文件：</span>
        <a-upload
          accept=".xlsx"
          :multiple="false"
          :before-upload="onRemarkFileBeforeUpload"
          :file-list="remarkFileList"
          :show-upload-list="false"
          @remove="onRemarkFileRemove"
        >
          <a-button type="primary" :loading="remarkImportLoading">导入</a-button>
        </a-upload>
        <span v-if="remarkPreviewRows.length" class="bol-import-upload-tip">已解析 {{ remarkPreviewRows.length }} 条数据</span>
      </div>

      <div class="bol-import-section">
        <div class="bol-import-section-title">数据预览：</div>
        <a-table
          row-key="key"
          size="small"
          :data-source="remarkPreviewRows"
          :columns="remarkImportColumns"
          :pagination="false"
          :scroll="{ y: '50vh' }"
          :row-class-name="remarkRowClassName"
          :locale="{ emptyText: '暂无数据' }"
        >
        </a-table>
      </div>

      <div class="bol-import-section">
        <div class="bol-import-section-title">温馨提示：</div>
        <div class="bol-import-tips-text">1. 模板下载：<a class="bol-import-link" @click="downloadRemarkTemplate">备注导入模板.xlsx</a></div>
        <div class="bol-import-tips-text">2. 文件格式限制：仅支持 .xlsx，单文件不超过 10MB</div>
      </div>
      <template #footer>
        <a-button @click="remarkImportOpen = false">取消</a-button>
        <a-button type="primary" :loading="remarkImportLoading" @click="handleRemarkImport">导入数据</a-button>
      </template>
    </a-modal>

    <!-- 地址审核状态导入弹框 -->
    <a-modal
      v-model:open="addrImportOpen"
      title="地址审核状态导入"
      :width="960"
      :mask-closable="false"
      :confirm-loading="addrImportLoading"
      @cancel="resetAddrImport"
    >
      <div class="bol-import-upload">
        <a-upload
          accept=".xlsx"
          :multiple="false"
          :before-upload="onAddrFileBeforeUpload"
          :file-list="addrFileList"
          @remove="onAddrFileRemove"
        >
          <a-button :loading="addrImportLoading">
            <template #icon><upload-outlined /></template>
            选择导入文件
          </a-button>
        </a-upload>
        <div v-if="!addrFileList.length" class="bol-import-upload-tip">
          仅支持 .xlsx，表头：运单号、审核状态、收件人姓名、省/州、城市、地址1、地址2、邮编、电话、收件人公司名称、邮箱
        </div>
      </div>

      <div v-if="addrPreviewRows.length" class="bol-import-tips">
        <div class="bol-import-tips-title">数据预览</div>
        <a-table
          row-key="key"
          size="small"
          :data-source="addrPreviewRows"
          :columns="addrImportColumns"
          :pagination="false"
          :scroll="{ x: 1800, y: '50vh' }"
          :row-class-name="addrRowClassName"
        >
        </a-table>
      </div>

      <div class="bol-import-tips">
        <div class="bol-import-tips-title">温馨提示</div>
        <div class="bol-import-tips-text">
          模板下载：
          <a class="bol-import-link" @click="downloadAddrImportTemplate">地址审核状态模版.xlsx</a>
        </div>
        <div class="bol-import-tips-text">文件格式限制：仅支持 .xlsx，单文件不超过 10MB；</div>
        <div class="bol-import-tips-text">1. 运单号不能为空，且必须是列表中存在（本原型数据）的运单号；</div>
        <div class="bol-import-tips-text">2. 审核状态仅支持：待审核 / 已审核 / 待确认；</div>
        <div class="bol-import-tips-text">3. 收件人姓名、省/州、城市、地址1、地址2、邮编、电话、收件人公司名称、邮箱仅作核对参考，导入后仅更新审核状态。</div>
      </div>
      <template #footer>
        <a-button @click="addrImportOpen = false">取消</a-button>
        <a-button type="primary" :loading="addrImportLoading" @click="handleAddrImport">导入数据</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import './style.css';
import { ref, reactive, computed, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  SearchOutlined, ReloadOutlined, DownOutlined, SettingOutlined, DeleteOutlined, CopyOutlined,
  DownloadOutlined, InboxOutlined,
} from '@ant-design/icons-vue';
import * as XLSX from 'xlsx';

// ========================= 类型 =========================
interface OrderRecord {
  key: string;
  ytOrderNo: string; orderStatus: string; b2bOrderNo: string; customerOrderNo: string;
  createTime: string; orderType: string; orderSource: string; customerCode: string;
  isFirstBatch: boolean; signInTime: string; salesman: string; csRep: string; follower: string;
  latestFollowUp: string; claimedTime: string; salesProduct: string; serviceChannel: string;
  countryName: string; isClearance: string; addressReviewStatus: string; auditStatus: string;
  addressType?: number; postCode: string; goodsAmount: number; estimateWeight: number;
  chargeWeight: number; customsMode: string; taxMethod: string; deliveryType: number;
  chargeStatus: string; interceptStatus: string; interceptReason: string; serverHawbCode: string;
  consignee: string; warehouseCode: string; sortingCode: string; billStatus: string;
}

// ========================= Mock 数据 =========================
const MOCK_DETENTION: Record<string, { code: string; reason: string; createTime: string; finishTime: string }[]> = {
  '2607AA0142': [{ code: 'KC-20260701-001', reason: '货物申报重量与实际重量偏差超10%，需重新核实', createTime: '2026-07-01 12:30:00', finishTime: '' }],
  '2607AA0138': [{ code: 'KC-20260630-015', reason: '收货地址存在合规风险，触发风控拦截', createTime: '2026-06-30 18:00:00', finishTime: '2026-07-01 09:00:00' }],
  '2607AA0136': [
    { code: 'KC-20260629-008', reason: '报关资料不全，缺少原产地证明', createTime: '2026-06-29 14:20:00', finishTime: '2026-06-30 16:45:00' },
    { code: 'KC-20260630-022', reason: '收货人信息不一致，需客户补充', createTime: '2026-06-30 10:15:00', finishTime: '' },
  ],
};

interface InterceptReason { code: string; category: string; name: string; content: string; }
const MOCK_INTERCEPT_REASONS: InterceptReason[] = [
  { code: 'A1', category: '客户原因', name: '客户要求暂扣', content: '您好!贵司要求暂扣此件,我司已按扣件处理。如需放行出货,请及时与我司客服联系,谢谢。' },
  { code: 'A10', category: '客户原因', name: '客户来货面单断针', content: '您好!贵司来货面单出现断针,我司已按扣件处理。' },
  { code: 'A11', category: '客户原因', name: 'FBA来货无云途面单', content: '您好!贵司来货FBA无云途面单,我司已按扣件处理。' },
  { code: 'A5', category: '客户原因', name: '空包裹', content: '您好!此票包裹内无实物,发现破损为空包裹。' },
  { code: 'A7', category: '客户原因', name: 'HK派送件超重超长', content: '您好!此票香港派送件,因为单件毛重超过限制,我司已按扣件处理。' },
  { code: 'A9', category: '客户原因', name: '已理赔订单(找实拍图)', content: '此订单在网上订单已经理赔,仓库扣件只做登记处理。' },
  { code: 'B1', category: '货物原因', name: '预报重量与实际重量不符', content: '您好!贵司提供参考重量为****KG,我司称重实重为****KG,差异较大,需核实后处理。' },
  { code: 'B7', category: '货物原因', name: '预报(申报)数量与实收不符', content: '您好!内件****票,司申报数量****个,我司实收数量****个,数量不符需核实。' },
  { code: 'B8', category: '货物原因', name: '包装简陋不合格/包装破损', content: '您好!此票包装简陋无防护不合格,在运输过程中可能损坏,我司已按扣件处理。' },
  { code: 'B9', category: '货物原因', name: '包装压坏', content: '您好!此票外箱有件压坏,现箱已压坏需换箱,我司已按扣件处理。' },
];
const INTERCEPT_CATEGORY_OPTIONS = ['全部', '客户原因', '货物原因'].map(v => ({ value: v, label: v }));

const ADDRESS_REVIEW_OPTIONS = [
  { value: '0', label: '待审核' }, { value: '1', label: '已审核' }, { value: '2', label: '待确认' },
];
const CUSTOMS_CLEARANCE_OPTIONS = ['单独报关', '代理报关', '不报关'].map(v => ({ value: v, label: v }));
const CLEARANCE_PLAN_OPTIONS = ['DDU', 'DDP', 'PVA'].map(v => ({ value: v, label: v }));
const ADDRESS_TYPE_OPTIONS = [
  { value: 1, label: 'Amazon地址' }, { value: 3, label: '海外仓地址' }, { value: 2, label: '私人地址' },
];
const BILLING_RESULT_OPTIONS = [
  { value: 0, label: '未计费' }, { value: 1, label: '无需计费' }, { value: 2, label: '欠费' },
  { value: 10, label: '计费成功' }, { value: 20, label: '计费失败' },
];
const EXTRA_SERVICE_OPTIONS = [
  { value: '10', label: '报关资料上传' }, { value: 'VAS_IP', label: '保价服务' }, { value: 'VAS_SIGN', label: '签单返回' },
  { value: 'VAS_INS', label: '保险' }, { value: 'VAS_PICKUP', label: '上门提货' },
];
const FEE_OPTIONS = [
  { value: 'FREIGHT', label: '运费' }, { value: 'FUEL', label: '燃油附加费' }, { value: 'REMOTE', label: '偏远附加费' },
  { value: 'TARIFF', label: '关税' }, { value: 'CLEAR', label: '清关费' },
];
const MOCK_CANCEL_INTERCEPT: { code: string; name: string; content: string }[] = [
  { code: 'A1', name: '客户要求暂扣', content: '客户主动要求暂扣，已与客户确认后放行' },
  { code: 'A5', name: '空包裹', content: '空包裹核实后确认为正常，允许放行' },
  { code: 'B1', name: '重量不符', content: '预报重量与实际重量差异已核实，允许放行' },
  { code: 'B8', name: '包装破损', content: '包装已重新加固，允许放行' },
];
const MOCK_LOG: Record<string, { time: string; operator: string; action: string }[]> = {
  '2607AA0142': [
    { time: '2026-07-01 11:20:00', operator: '汪劭宇', action: '新建订单（来源：新用户中心）' },
    { time: '2026-07-01 11:30:00', operator: '系统', action: '自动计费完成（计费成功）' },
    { time: '2026-07-01 13:10:00', operator: '叶佳佳', action: '提交审核（审核状态：待审核）' },
    { time: '2026-07-02 09:15:00', operator: '叶佳佳', action: '审核通过' },
  ],
  '2607AA0140': [
    { time: '2026-07-01 11:15:00', operator: '张嘉琪', action: '新建订单（来源：新用户中心）' },
    { time: '2026-07-01 14:00:00', operator: '叶佳佳', action: '审核通过' },
    { time: '2026-07-01 15:20:00', operator: '徐铭辛', action: '确认费用' },
  ],
};

const ORDER_STATUS_OPTIONS = ['草稿', '已预报', '已入仓', '待客户确认', '客户已确认', '客户已驳回', '已发货', '已签收', '已退件', '已理赔', '已删除', '弃件', '已换单'].map(v => ({ value: v, label: v }));
const ORDER_TYPE_OPTIONS = ['B2B', '整柜'].map(v => ({ value: v, label: v }));
const AUDIT_STATUS_OPTIONS = ['待审核', '审核暂存', '审核通过', '审核不通过'].map(v => ({ value: v, label: v }));
const YES_NO_OPTIONS = [{ value: 'Y', label: '是' }, { value: 'N', label: '否' }];
const SALES_PRODUCT_OPTIONS: any[] = [
  { value: 'A', label: '美国海卡(经济)-纽约', children: [{ value: 'A1', label: '整柜' }, { value: 'A2', label: '拼柜' }] },
  { value: 'B', label: '美国空派(特惠普货)-X' },
  { value: 'C', label: '美国空派(标快普货)' },
  { value: 'D', label: '美森云速达' },
  { value: 'E', label: '美国海派(特快)-CLX' },
  { value: 'F', label: '美国海卡(经济)-洛杉矶' },
  { value: 'G', label: 'B2B-TEST-空运' },
];
const SALES_PRODUCT_FLAT = SALES_PRODUCT_OPTIONS.map(o => ({ value: o.label, label: o.label }));

const MOCK_BASE: any[] = [
  { key: '1', ytOrderNo: '2607AA0142', orderStatus: '已预报', b2bOrderNo: '2607AA0142', customerOrderNo: 'FBA19H5TZF4M', createTime: '2026-07-01 11:16:31', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', csRep: '汪劭宇', follower: '卓运康', latestFollowUp: '已与客户确认收货地址，等待配载', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '' },
  { key: '2', ytOrderNo: '2607AA0141', orderStatus: '已预报', b2bOrderNo: '2607AA0141', customerOrderNo: 'NHUS606222231502', createTime: '2026-07-01 11:14:48', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC94062', isFirstBatch: false, signInTime: '', salesman: '傅势力', csRep: '温艳琪', follower: '', latestFollowUp: '', salesProduct: '美国空派(特惠普货)-X', serviceChannel: '' },
  { key: '3', ytOrderNo: '2607AA0140', orderStatus: '待客户确认', b2bOrderNo: '2607AA0140', customerOrderNo: 'CST2618209100300281', createTime: '2026-07-01 11:14:10', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C09842', isFirstBatch: false, signInTime: '', salesman: '徐铭辛', csRep: '张嘉琪', follower: '卓运康', latestFollowUp: '客户要求加急处理，已通知操作部优先安排', salesProduct: '美国空派(标快普货)', serviceChannel: '' },
  { key: '4', ytOrderNo: '2607AA0139', orderStatus: '已入仓', b2bOrderNo: '2607AA0139', customerOrderNo: 'CST2618209100100251', createTime: '2026-07-01 11:13:50', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'F00ITDDT08', isFirstBatch: false, signInTime: '2026-07-01 12:05:10', salesman: '袁韵璇', csRep: '彭军', follower: '', latestFollowUp: '', salesProduct: 'B2B-TEST-空运', serviceChannel: '' },
  { key: '5', ytOrderNo: '2607AA0138', orderStatus: '已预报', b2bOrderNo: '2607AA0138', customerOrderNo: 'CST2618209300300503', createTime: '2026-07-01 11:11:48', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C95318', isFirstBatch: false, signInTime: '', salesman: '张威', csRep: '姚婉清', follower: '', latestFollowUp: '', salesProduct: '美森云速达', serviceChannel: '' },
  { key: '6', ytOrderNo: '2607AA0137', orderStatus: '已入仓', b2bOrderNo: '2607AA0137', customerOrderNo: 'FBA19H5W72GC', createTime: '2026-07-01 11:10:33', orderType: '整柜', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '2026-07-01 12:00:00', salesman: '马武林', csRep: '汪劭宇', follower: '卓运康', latestFollowUp: '货量较大需拆单，已联系客户确认分箱方案', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '' },
  { key: '7', ytOrderNo: '2607AA0136', orderStatus: '已发货', b2bOrderNo: '2607AA0136', customerOrderNo: 'CST2618209100100244', createTime: '2026-07-01 11:06:59', orderType: 'B2B', orderSource: '', customerCode: 'BCN0C09842', isFirstBatch: false, signInTime: '2026-07-01 11:50:00', salesman: '徐铭辛', csRep: '张嘉琪', follower: '', latestFollowUp: '', salesProduct: '美国空派(标快普货)', serviceChannel: '' },
  { key: '8', ytOrderNo: '2607AA0135', orderStatus: '已发货', b2bOrderNo: '2607AA0135', customerOrderNo: 'FBA19H5T1DWV', createTime: '2026-07-01 11:06:39', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '2026-07-01 11:45:00', salesman: '马武林', csRep: '汪劭宇', follower: '', latestFollowUp: '', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '' },
  { key: '9', ytOrderNo: '2607AA0134', orderStatus: '已发货', b2bOrderNo: '2607AA0134', customerOrderNo: 'CST2618209300100580', createTime: '2026-07-01 11:06:09', orderType: '整柜', orderSource: '新用户中心', customerCode: 'BCN0C03286', isFirstBatch: false, signInTime: '2026-07-01 11:40:00', salesman: '龚晓辉', csRep: '张振星', follower: '', latestFollowUp: '', salesProduct: '美森云速达', serviceChannel: '' },
  { key: '10', ytOrderNo: '2607AA0133', orderStatus: '已删除', b2bOrderNo: '2607AA0133', customerOrderNo: 'CST2618209300100572', createTime: '2026-07-01 11:04:41', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C03286', isFirstBatch: false, signInTime: '', salesman: '龚晓辉', csRep: '张振星', follower: '', latestFollowUp: '', salesProduct: '美森云速达', serviceChannel: '' },
  { key: '11', ytOrderNo: '2607AA0132', orderStatus: '已预报', b2bOrderNo: '2607AA0132', customerOrderNo: 'FBA19H5VQ30N', createTime: '2026-07-01 11:04:16', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', csRep: '汪劭宇', follower: '', latestFollowUp: '', salesProduct: '美国海卡(经济)-洛杉矶', serviceChannel: '' },
  { key: '12', ytOrderNo: '2607AA0131', orderStatus: '待客户确认', b2bOrderNo: '2607AA0131', customerOrderNo: 'FBA19H5ZFNZX', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
  { key: '13', ytOrderNo: '2607AA0130', orderStatus: '待客户确认', b2bOrderNo: '2607AA0130', customerOrderNo: 'FBA19H60CGMJ', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
  { key: '14', ytOrderNo: '2607AA0129', orderStatus: '已入仓', b2bOrderNo: '2607AA0129', customerOrderNo: 'FBA19H5ZS4SY', createTime: '2026-07-01 11:03:55', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '2026-07-01 12:02:00', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
  { key: '15', ytOrderNo: '2607AA0128', orderStatus: '已预报', b2bOrderNo: '2607AA0128', customerOrderNo: 'FBA19H5ZPLMR', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
];

const MOCK_DATA: OrderRecord[] = MOCK_BASE.map((r, i) => ({
  ...r,
  countryName: r.countryName ?? '美国',
  isClearance: r.isClearance ?? (i % 2 ? 'Y' : 'N'),
  addressReviewStatus: r.addressReviewStatus ?? (i % 3 === 0 ? '1' : i % 3 === 1 ? '0' : '2'),
  auditStatus: r.auditStatus ?? (i % 4 === 0 ? '待审核' : i % 4 === 1 ? '审核暂存' : i % 4 === 2 ? '审核通过' : '审核不通过'),
  postCode: r.postCode ?? `9${(1000 + i * 37).toString().padStart(4, '0')}12`,
  goodsAmount: r.goodsAmount ?? 5 + i,
  estimateWeight: r.estimateWeight ?? 10 + i * 2,
  chargeWeight: r.chargeWeight ?? 10 + i * 2,
  customsMode: r.customsMode ?? (i % 2 ? '单独报关' : '代理报关'),
  taxMethod: r.taxMethod ?? (['DDU', 'DDP', 'PVA'][i % 3]),
  deliveryType: r.deliveryType ?? (i % 2 ? 2 : 1),
  chargeStatus: r.chargeStatus ?? ([0, 1, 2, 10, 20][i % 5]),
  addressType: r.addressType ?? ([1, 3, 2][i % 3]),
  interceptStatus: r.interceptStatus ?? (i === 1 ? 'Y' : 'N'),
  interceptReason: r.interceptReason ?? (i === 1 ? '客户要求暂扣' : ''),
  serverHawbCode: r.serverHawbCode ?? `SVR${r.ytOrderNo}`,
  consignee: r.consignee ?? 'John Smith',
  warehouseCode: r.warehouseCode ?? 'USLAX',
  sortingCode: r.sortingCode ?? `S${1000 + i}`,
  billStatus: r.billStatus ?? (i % 2 ? '已入账' : '未入账'),
}));

const SALESMAN_OPTIONS = Array.from(new Set(MOCK_DATA.map(d => d.salesman).filter(Boolean))).map(v => ({ value: v, label: v }));
const CUSTOMER_CODE_OPTIONS = Array.from(new Set(MOCK_DATA.map(d => d.customerCode).filter(Boolean))).map(v => ({ value: v, label: v }));
const COUNTRY_OPTIONS = Array.from(new Set(MOCK_DATA.map(d => d.countryName).filter(Boolean))).map(v => ({ value: v, label: v }));
const CHANNEL_OPTIONS = ['US-Line-A', 'US-Line-B', 'EU-Line-C', 'JP-Line-D'].map(v => ({ value: v, label: v }));
const detentionReasonOptions = Array.from(new Set(Object.values(MOCK_DETENTION).flat().map(d => d.reason))).map(v => ({ value: v, label: v }));

const MOCK_FOLLOW_UP_HISTORY: Record<string, { time: string; operator: string; content: string; hidden?: boolean }[]> = {
  '2607AA0142': [
    { time: '2026-07-01 09:30:00', operator: '卓运康', content: '已与客户确认收货地址，等待配载' },
    { time: '2026-06-30 16:20:00', operator: '卓运康', content: '联系客户确认最终收货仓库地址，客户反馈需等海外仓确认' },
    { time: '2026-06-29 14:10:00', operator: '卓运康', content: '首次跟进：获客后建单，确认货物类型为普货，预计100箱' },
  ],
  '2607AA0140': [
    { time: '2026-07-01 10:00:00', operator: '卓运康', content: '客户要求加急处理，已通知操作部优先安排' },
    { time: '2026-06-30 11:00:00', operator: '卓运康', content: '确认货物已到仓，等待排舱' },
  ],
  '2607AA0137': [
    { time: '2026-07-01 08:45:00', operator: '卓运康', content: '货量较大需拆单，已联系客户确认分箱方案' },
    { time: '2026-06-30 15:00:00', operator: '卓运康', content: '发现货量超出预估，初步判断需要拆成2-3个主箱' },
    { time: '2026-06-29 10:30:00', operator: '卓运康', content: '客户下单美国海卡(经济)-纽约，货品为家居用品' },
  ],
};

// ========================= Tag 映射 =========================
const AUDIT_TAG: Record<string, string> = { 待审核: 'default', 审核暂存: 'processing', 审核通过: 'green', 审核不通过: 'red' };
const CHARGE_TAG: Record<string, string> = { 0: 'default', 1: 'default', 2: 'red', 10: 'green', 20: 'red' };
const CHARGE_LABEL: Record<string, string> = { 0: '未计费', 1: '无需计费', 2: '欠费', 10: '计费成功', 20: '计费失败' };
const ADDRESS_REVIEW_LABEL: Record<string, string> = { '0': '待审核', '1': '已审核', '2': '待确认' };
const ADDRESS_REVIEW_COLOR: Record<string, string> = { '0': 'default', '1': 'green', '2': 'orange' };

// ========================= 状态 =========================
const expandSearch = ref(false);
const filters = reactive({
  orderNo: '', b2bOrderNo: '', createTimeRange: null as any,
  orderType: undefined as string | undefined, orderStatus: undefined as string[] | undefined,
  auditStatus: undefined as string | undefined, salesProduct: null as any,
  destCountry: undefined as string | undefined, channelCode: undefined as string | undefined,
  salesman: undefined as string | undefined, customerCode: undefined as string | undefined,
  isCustoms: undefined as string | undefined, isSigned: undefined as string | undefined,
  addressType: undefined as string | undefined, isDetained: undefined as string | undefined,
  addressAuditStatus: undefined as string | undefined, detentionReason: undefined as string[] | undefined,
  isValueAddedDone: undefined as string | undefined, isLoadable: undefined as string | undefined,
  isIntercepted: undefined as string | undefined, billingResult: undefined as string | undefined,
  isFirstBatch: undefined as string | undefined, latestFollowUp: '', followerFilter: '',
});
const selectedRowKeys = ref<string[]>([]);
const searchFormRef = ref();

const interceptModalOpen = ref(false);
const interceptCategory = ref('全部');
const interceptSearch = ref('');
const interceptSelectedCode = ref<string | null>(null);
const interceptRemark = ref('');

const followUpHistory = ref<any>({ ...MOCK_FOLLOW_UP_HISTORY });
const detentionModalOpen = ref(false);
const detentionRecord = ref<OrderRecord | null>(null);
const followUpModalOpen = ref(false);
const followUpRecord = ref<OrderRecord | null>(null);
const followUpContent = ref('');

const addressReviewOpen = ref(false);
const addressReviewStatus = ref<string | undefined>(undefined);

const detailOpen = ref(false);
const detailRecord = ref<OrderRecord | null>(null);
const editOpen = ref(false);
const editRecord = ref<OrderRecord | null>(null);
const editFormRef = ref();
const editForm = reactive({
  salesProduct: '', serviceChannel: '', salesman: '', customerService: '',
  consignee: '', countryName: '', postCode: '', goodsAmount: 1,
  estimateWeight: 0, customsMode: '', taxMethod: '',
});

const logOpen = ref(false);
const logRecord = ref<OrderRecord | null>(null);

const auditOpen = ref(false);
const auditRecord = ref<OrderRecord | null>(null);
const auditReason = ref('');

const batchReviewOpen = ref(false);
const batchReviewRadio = ref<string | undefined>(undefined);
const batchReviewReason = ref('');

const extraServiceOpen = ref(false);
const extraServiceList = ref<{ code: string | undefined; name: string }[]>([]);
const editFeeOpen = ref(false);
const feeList = ref<{ code: string | undefined; price: number | null }[]>([]);

const confirmFeeOpen = ref(false);
const confirmFeeRadio = ref<boolean>(true);
const confirmFeeMsg = ref('');

const cancelReviewOpen = ref(false);
const cancelReviewReason = ref('');

const cancelInterceptOpen = ref(false);
const cancelInterceptSelected = ref<string[]>([]);
const cancelInterceptRemark = ref('');

const printOpen = ref(false);
const printTemplate = ref<'label' | 'waybill'>('label');
const columnConfigOpen = ref(false);
const exportOpen = ref(false);
const exportKey = ref('');
const exportOption = ref('selected');

const remarkImportOpen = ref(false);
const remarkImportFile = ref<File | null>(null);
const remarkFileList = ref<any[]>([]);
const remarkPreviewRows = ref<any[]>([]);
const remarkInvalidRows = ref<any[]>([]);
const remarkImportLoading = ref(false);

const addrImportOpen = ref(false);
const addrImportFile = ref<File | null>(null);
const addrFileList = ref<any[]>([]);
const addrPreviewRows = ref<any[]>([]);
const addrInvalidRows = ref<any[]>([]);
const addrImportLoading = ref(false);

// ========================= 搜索 / 过滤 =========================
function handleSearch() {
  message.success(`查询完成，命中 ${filteredData.value.length} 条`);
}
function resetFilters() {
  Object.assign(filters, {
    orderNo: '', b2bOrderNo: '', createTimeRange: null,
    orderType: undefined, orderStatus: undefined, auditStatus: undefined, salesProduct: null,
    destCountry: undefined, channelCode: undefined, salesman: undefined, customerCode: undefined,
    isCustoms: undefined, isSigned: undefined, addressType: undefined, isDetained: undefined,
    addressAuditStatus: undefined, detentionReason: undefined, isValueAddedDone: undefined,
    isLoadable: undefined, isIntercepted: undefined, billingResult: undefined, isFirstBatch: undefined,
    latestFollowUp: '', followerFilter: '',
  });
  searchFormRef.value?.resetFields();
}

const filteredData = computed(() => MOCK_DATA.filter((r) => {
  if (filters.orderNo && !r.ytOrderNo.toLowerCase().includes(filters.orderNo.toLowerCase())) return false;
  if (filters.b2bOrderNo && !r.b2bOrderNo.toLowerCase().includes(filters.b2bOrderNo.toLowerCase())) return false;
  if (filters.orderType && r.orderType !== filters.orderType) return false;
  if (filters.orderStatus && filters.orderStatus.length > 0 && !filters.orderStatus.includes(r.orderStatus)) return false;
  if (filters.auditStatus && r.auditStatus !== filters.auditStatus) return false;
  if (filters.customerCode && !r.customerCode.toLowerCase().includes(filters.customerCode.toLowerCase())) return false;
  if (filters.salesman && !r.salesman.includes(filters.salesman)) return false;
  if (filters.isFirstBatch !== undefined) {
    if (filters.isFirstBatch === 'Y' && !r.isFirstBatch) return false;
    if (filters.isFirstBatch === 'N' && r.isFirstBatch) return false;
  }
  if (filters.latestFollowUp && !r.latestFollowUp.includes(filters.latestFollowUp)) return false;
  if (filters.followerFilter && !r.follower.includes(filters.followerFilter)) return false;
  if (filters.isCustoms !== undefined && r.isClearance !== filters.isCustoms) return false;
  if (filters.addressAuditStatus !== undefined && r.addressReviewStatus !== filters.addressAuditStatus) return false;
  if (filters.isIntercepted !== undefined && r.interceptStatus !== filters.isIntercepted) return false;
  if (filters.addressType !== undefined && r.addressType !== filters.addressType) return false;
  if (filters.billingResult !== undefined && Number(r.chargeStatus) !== Number(filters.billingResult)) return false;
  if (filters.detentionReason && filters.detentionReason.length > 0) {
    const reasons = MOCK_DETENTION[r.ytOrderNo];
    if (!reasons || !reasons.some(d => (filters.detentionReason as string[]).includes(d.reason))) return false;
  }
  return true;
}));

// ========================= 表格 =========================
const columns = [
  { title: '序号', key: 'index', width: 50, align: 'center', fixed: 'left' },
  { title: '运单号', dataIndex: 'ytOrderNo', key: 'ytOrderNo', width: 160, fixed: 'left', sorter: (a: any, b: any) => a.ytOrderNo.localeCompare(b.ytOrderNo) },
  { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 110, fixed: 'left' },
  { title: 'B2B单号', dataIndex: 'b2bOrderNo', key: 'b2bOrderNo', width: 130, sorter: true },
  { title: '客户单号', dataIndex: 'customerOrderNo', key: 'customerOrderNo', width: 200 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 155, sorter: true },
  { title: '订单类型', dataIndex: 'orderType', key: 'orderType', width: 90 },
  { title: '订单来源', dataIndex: 'orderSource', key: 'orderSource', width: 140, ellipsis: true },
  { title: '客户代码', dataIndex: 'customerCode', key: 'customerCode', width: 130 },
  { title: '是否首批', dataIndex: 'isFirstBatch', key: 'isFirstBatch', width: 90, align: 'center' },
  { title: '目的国家', dataIndex: 'countryName', key: 'countryName', width: 100 },
  { title: '是否报关件', dataIndex: 'isClearance', key: 'isClearance', width: 110, align: 'center' },
  { title: '地址审核状态', dataIndex: 'addressReviewStatus', key: 'addressReviewStatus', width: 120, align: 'center' },
  { title: '审核状态', dataIndex: 'auditStatus', key: 'auditStatus', width: 110, align: 'center' },
  { title: '业务员', dataIndex: 'salesman', key: 'salesman', width: 90 },
  { title: '客服员', dataIndex: 'csRep', key: 'csRep', width: 90 },
  { title: '跟进人', dataIndex: 'follower', key: 'follower', width: 90 },
  { title: '最新跟进内容', dataIndex: 'latestFollowUp', key: 'latestFollowUp', width: 220, ellipsis: true },
  { title: '认领时间', dataIndex: 'claimedTime', key: 'claimedTime', width: 155 },
  { title: '销售产品', dataIndex: 'salesProduct', key: 'salesProduct', width: 200, ellipsis: true },
  { title: '服务渠道名称', dataIndex: 'serviceChannel', key: 'serviceChannel', width: 200 },
  { title: '报关方式', dataIndex: 'customsMode', key: 'customsMode', width: 120 },
  { title: '清关方案', dataIndex: 'taxMethod', key: 'taxMethod', width: 110 },
  { title: '配送方式', dataIndex: 'deliveryType', key: 'deliveryType', width: 120 },
  { title: '邮编', dataIndex: 'postCode', key: 'postCode', width: 110 },
  { title: '件数', dataIndex: 'goodsAmount', key: 'goodsAmount', width: 80, align: 'right' },
  { title: '预估重量(kg)', dataIndex: 'estimateWeight', key: 'estimateWeight', width: 120, align: 'right' },
  { title: '计费重(kg)', dataIndex: 'chargeWeight', key: 'chargeWeight', width: 120, align: 'right' },
  { title: '扣件原因', key: 'detention', width: 100, align: 'center' },
  { title: '扣件生成时间', key: 'detentionCreateTime', width: 155 },
  { title: '扣件完成时间', key: 'detentionFinishTime', width: 155 },
  { title: '签入时间', dataIndex: 'signInTime', key: 'signInTime', width: 155 },
  { title: '计费状态', dataIndex: 'chargeStatus', key: 'chargeStatus', width: 120, align: 'center' },
  { title: '是否拦截', dataIndex: 'interceptStatus', key: 'interceptStatus', width: 100, align: 'center' },
  { title: '拦截原因', dataIndex: 'interceptReason', key: 'interceptReason', width: 140, ellipsis: true },
  { title: '服务商单号', dataIndex: 'serverHawbCode', key: 'serverHawbCode', width: 150 },
  { title: '收件人', dataIndex: 'consignee', key: 'consignee', width: 120 },
  { title: '仓库代码', dataIndex: 'warehouseCode', key: 'warehouseCode', width: 110 },
  { title: '分拣码', dataIndex: 'sortingCode', key: 'sortingCode', width: 110 },
  { title: '入账状态', dataIndex: 'billStatus', key: 'billStatus', width: 100, align: 'center' },
  { title: '操作', key: 'action', width: 220, fixed: 'right', customRender: ({ record }: any) =>
    h('span', { class: 'bol-action-links' }, [
      h('a', { class: 'bol-action-link', onClick: () => { detailRecord.value = record; detailOpen.value = true; } }, '详情'),
      h('span', { class: 'bol-action-divider' }, '|'),
      h('a', { class: 'bol-action-link', onClick: () => { auditRecord.value = record; auditOpen.value = true; } }, '审核'),
      h('span', { class: 'bol-action-divider' }, '|'),
      h('a', { class: 'bol-action-link', onClick: () => { detailRecord.value = record; detailOpen.value = true; } }, '编辑'),
      h('span', { class: 'bol-action-divider' }, '|'),
      h('a', { class: 'bol-action-link', onClick: () => { logRecord.value = record; logOpen.value = true; } }, '日志'),
      h('span', { class: 'bol-action-divider' }, '|'),
      h('a', { class: 'bol-action-link', onClick: () => { followUpRecord.value = record; followUpOpen.value = true; } }, '跟进备注'),
    ]),
  },
];
const monoKeys = ['ytOrderNo', 'b2bOrderNo', 'customerOrderNo', 'customerCode', 'orderType', 'postCode', 'serverHawbCode', 'warehouseCode', 'sortingCode'];

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: any) => { selectedRowKeys.value = keys; },
}));
const pagination = computed(() => ({
  total: filteredData.value.length,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (t: number) => `共 ${t} 条`,
  defaultPageSize: 20,
  pageSizeOptions: ['20', '50', '100'],
}));

const detentionColumns = [
  { title: '异常编码', dataIndex: 'code', key: 'code', width: 180, customRender: ({ text }: any) => h('span', { class: 'bol-mono' }, text) },
  { title: '异常说明', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '生成时间', dataIndex: 'createTime', key: 'createTime', width: 160 },
  { title: '完结时间', dataIndex: 'finishTime', key: 'finishTime', width: 160, customRender: ({ text }: any) => text || '' },
];
import { h } from 'vue';

function latestFollowUpOf(record: OrderRecord) {
  const history = followUpHistory.value[record.ytOrderNo] || [];
  const latestVisible = history.find((h: any) => !h.hidden);
  return latestVisible ? latestVisible.content : (record.latestFollowUp || '-');
}
function detCreateTime(record: OrderRecord) {
  const d = MOCK_DETENTION[record.ytOrderNo];
  if (!d || !d.length) return '-';
  return d.reduce((m, r) => (r.createTime < m.createTime ? r : m), d[0]).createTime;
}
function detFinishTime(record: OrderRecord) {
  const d = MOCK_DETENTION[record.ytOrderNo];
  if (!d || !d.length) return '-';
  if (d.some(r => !r.finishTime)) return '-';
  return d.reduce((m, r) => (r.finishTime > m.finishTime ? r : m), d[0]).finishTime;
}

// ========================= 批量操作 =========================
function requireSelected(actionName: string) {
  if (selectedRowKeys.value.length === 0) { message.warning(`请先勾选需要${actionName}的订单`); return false; }
  return true;
}
function selectedRecords() { return MOCK_DATA.filter(r => selectedRowKeys.value.includes(r.key)); }

function handleBatchAudit() {
  if (!requireSelected('批量审核')) return;
  batchReviewRadio.value = undefined; batchReviewReason.value = '';
  batchReviewOpen.value = true;
}
function handleBatchExtraService() {
  if (!requireSelected('批量修改额外服务')) return;
  extraServiceList.value = [{ code: undefined, name: '' }];
  extraServiceOpen.value = true;
}
function handleBatchEditFee() {
  if (!requireSelected('批量修改费用')) return;
  feeList.value = [{ code: undefined, price: null }];
  editFeeOpen.value = true;
}
function handleConfirmFee() {
  if (!requireSelected('确认费用')) return;
  const invalid = selectedRecords().filter(r => r.orderStatus !== '已发货');
  if (invalid.length > 0) { message.warning('仅「已发货」状态的订单可确认费用，请检查勾选数据'); return; }
  confirmFeeRadio.value = true; confirmFeeMsg.value = '';
  confirmFeeOpen.value = true;
}
function handleCancelReview() {
  if (!requireSelected('撤销审核')) return;
  const valid = selectedRecords().every(r => ['已预报', '已入仓', '待客户确认'].includes(r.orderStatus) && ['审核通过', '审核不通过'].includes(r.auditStatus));
  if (!valid) { message.warning('仅「已预报/已入仓/待客户确认」且审核状态为「审核通过/审核不通过」的订单可撤销审核'); return; }
  cancelReviewReason.value = ''; cancelReviewOpen.value = true;
}
function handleDelete() {
  if (!requireSelected('删除')) return;
  const invalid = selectedRecords().filter(r => r.orderStatus !== '已预报');
  if (invalid.length > 0) { message.warning('仅「已预报」状态的订单可删除，请检查勾选数据'); return; }
  Modal.confirm({
    title: '删除订单',
    content: `确定删除勾选的 ${selectedRowKeys.value.length} 条订单吗？此操作不可恢复。`,
    okText: '确定删除', okType: 'danger', cancelText: '取消',
    onOk: () => { message.success(`已删除 ${selectedRowKeys.value.length} 条订单（模拟）`); selectedRowKeys.value = []; },
  });
}
function handleRefresh() {
  if (!filters.orderNo && !filters.b2bOrderNo) { message.warning('请先输入单号或 B2B 单号后再刷新'); return; }
  message.success('列表已刷新（模拟）');
}
function handleAddressReview() {
  if (!requireSelected('地址审核')) return;
  const notPredicted = selectedRecords().filter(r => r.orderStatus !== '已预报');
  if (notPredicted.length > 0) { message.warning('只有「已预报」的订单支持修改地址审核状态，请检查'); return; }
  addressReviewStatus.value = undefined; addressReviewOpen.value = true;
}
function handleFollowUp(record: OrderRecord) {
  followUpRecord.value = record; followUpContent.value = ''; followUpModalOpen.value = true;
}
function handleFollowUpSubmit() {
  if (!followUpContent.value.trim()) { message.warning('请填写跟进内容'); return; }
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const yt = followUpRecord.value?.ytOrderNo;
  if (yt) {
    const prev = followUpHistory.value[yt] || [];
    followUpHistory.value = { ...followUpHistory.value, [yt]: [{ time: now, operator: '卓运康', content: followUpContent.value }, ...prev] };
  }
  message.success(`已为 ${followUpRecord.value?.ytOrderNo ?? ''} 添加跟进备注`);
  followUpModalOpen.value = false;
}
function handleClaim() {
  if (!requireSelected('认领')) return;
  Modal.confirm({
    title: '确认认领',
    content: `确定认领勾选的 ${selectedRowKeys.value.length} 条订单吗？认领后跟进人将变更为当前登录人（卓运康）。`,
    okText: '确定认领', cancelText: '取消',
    onOk: () => {
      const now = new Date().toLocaleString('zh-CN', { hour12: false });
      const next = { ...followUpHistory.value };
      selectedRowKeys.value.forEach(key => {
        const record = MOCK_DATA.find(r => r.key === key);
        if (record) {
          const yt = record.ytOrderNo;
          next[yt] = [{ time: now, operator: '卓运康', content: '【认领】认领该订单，跟进人变更为卓运康', hidden: true }, ...(next[yt] || [])];
        }
      });
      followUpHistory.value = next;
      message.success(`已成功认领 ${selectedRowKeys.value.length} 条订单，跟进人已变更为卓运康`);
      selectedRowKeys.value = [];
    },
  });
}

// ========================= 弹窗开关 =========================
function openDetail(record: OrderRecord) { detailRecord.value = record; detailOpen.value = true; }
function openAudit(record: OrderRecord) { auditRecord.value = record; auditReason.value = ''; auditOpen.value = true; }
function openEdit(record: OrderRecord) {
  editRecord.value = record;
  Object.assign(editForm, {
    salesProduct: record.salesProduct, serviceChannel: record.serviceChannel,
    salesman: record.salesman, customerService: record.csRep,
    consignee: record.consignee, countryName: record.countryName,
    postCode: record.postCode, goodsAmount: record.goodsAmount,
    estimateWeight: record.estimateWeight, customsMode: record.customsMode, taxMethod: record.taxMethod,
  });
  editOpen.value = true;
}
function openLog(record: OrderRecord) { logRecord.value = record; logOpen.value = true; }
function openDetention(record: OrderRecord) { detentionRecord.value = record; detentionModalOpen.value = true; }
function openCancelIntercept() {
  if (!requireSelected('取消拦截')) return;
  cancelInterceptSelected.value = []; cancelInterceptRemark.value = '';
  cancelInterceptOpen.value = true;
}
function handleEditOk() {
  editFormRef.value?.validate().then(() => {
    message.success(`已保存订单 ${editRecord.value?.ytOrderNo} 的编辑（模拟）`);
    editOpen.value = false;
  }).catch(() => {});
}
function closeAudit() { auditOpen.value = false; auditReason.value = ''; }
function submitAudit() {
  if (!auditReason.value.trim()) { message.warning('请填写不通过原因'); return; }
  message.success(`已审核不通过 ${auditRecord.value?.ytOrderNo ?? ''}（模拟）`);
  auditOpen.value = false; auditReason.value = '';
}
function submitBatchReview() {
  const pass = batchReviewRadio.value === '审核通过';
  if (!pass && !batchReviewReason.value.trim()) { message.warning('审核不通过时，审核说明为必填'); return; }
  message.success(`已批量${pass ? '审核通过' : '审核不通过'} ${selectedRowKeys.value.length} 个订单的审核（模拟）`);
  batchReviewOpen.value = false; selectedRowKeys.value = [];
}
function onExtraServiceChange(idx: number, v: string, opt: any) {
  extraServiceList.value = extraServiceList.value.map((it, i) => i === idx ? { code: v, name: opt?.label || '' } : it);
}
function submitExtraService() {
  const filled = extraServiceList.value.filter(i => i.code);
  if (filled.length === 0) { message.warning('请至少添加一项额外服务'); return; }
  message.success(`已为 ${selectedRowKeys.value.length} 个订单修改额外服务（模拟）`);
  extraServiceOpen.value = false; selectedRowKeys.value = [];
}
function onFeeChange(idx: number, v: string) {
  feeList.value = feeList.value.map((it, i) => i === idx ? { ...it, code: v } : it);
}
function submitFee() {
  const filled = feeList.value.filter(i => i.code);
  if (filled.length === 0) { message.warning('请至少添加一项费用'); return; }
  message.success(`已为 ${selectedRowKeys.value.length} 个订单修改费用（模拟）`);
  editFeeOpen.value = false; selectedRowKeys.value = [];
}
function submitConfirmFee() {
  const confirm = confirmFeeRadio.value;
  if (!confirm && !confirmFeeMsg.value.trim()) { message.warning('不确认费用时，请填写说明'); return; }
  message.success(`${confirm ? '已确认' : '已标记不确认'} ${selectedRowKeys.value.length} 个订单的费用（模拟）`);
  confirmFeeOpen.value = false; selectedRowKeys.value = [];
}
function submitCancelReview() {
  if (!cancelReviewReason.value.trim()) { message.warning('撤销审核说明为必填'); return; }
  message.success(`已撤销 ${selectedRowKeys.value.length} 条订单的审核（模拟）`);
  cancelReviewOpen.value = false; selectedRowKeys.value = [];
}
function submitCancelIntercept() {
  if (cancelInterceptSelected.value.length === 0) { message.warning('请至少选择一个问题类型'); return; }
  message.success(`已取消 ${selectedRowKeys.value.length} 条订单的拦截（模拟）`);
  cancelInterceptOpen.value = false; selectedRowKeys.value = [];
}
function submitAddressReview() {
  if (!addressReviewStatus.value) return;
  message.success(`已更新 ${selectedRowKeys.value.length} 条订单的地址审核状态（模拟）`);
  addressReviewOpen.value = false; selectedRowKeys.value = [];
}
function submitPrint() {
  message.success(`已发送「${printTemplate.value === 'label' ? '标签' : '面单'}」打印任务（模拟）`);
  printOpen.value = false;
}
function submitExport() {
  const t = EXPORT_TYPES.find((e: any) => e.key === exportKey.value);
  message.success(`已发起「${t?.label}」导出（范围：${exportOption.value === 'selected' ? '勾选数据' : '全部数据'}）（模拟）`);
  exportOpen.value = false;
}
function copyColumns() {
  const titles = columns.map(c => c.title as string).join('、');
  if (navigator.clipboard) navigator.clipboard.writeText(titles).then(() => message.success('已复制当前显示列标题')).catch(() => message.success(`显示列：${titles}`));
  else message.success(`显示列：${titles}`);
}

// ========================= 拦截 =========================
function handleIntercept() {
  if (!requireSelected('拦截')) return;
  interceptCategory.value = '全部'; interceptSearch.value = '';
  interceptSelectedCode.value = null; interceptRemark.value = '';
  interceptModalOpen.value = true;
}
const filteredInterceptReasons = computed(() => MOCK_INTERCEPT_REASONS.filter(r => {
  const catOk = interceptCategory.value === '全部' || r.category === interceptCategory.value;
  const search = interceptSearch.value.trim();
  const searchOk = !search || r.code.toLowerCase().includes(search.toLowerCase()) || r.name.includes(interceptSearch.value) || r.content.includes(interceptSearch.value);
  return catOk && searchOk;
}));
function handleSelectInterceptRow(record: InterceptReason) {
  interceptSelectedCode.value = record.code;
  interceptRemark.value = record.content;
}
function onInterceptRowChange(keys: any) {
  const code = keys[0];
  const record = MOCK_INTERCEPT_REASONS.find(r => r.code === code);
  if (record) handleSelectInterceptRow(record);
  else interceptSelectedCode.value = null;
}
function handleInterceptSubmit() {
  if (!interceptSelectedCode.value) { message.warning('请先选择一条拦截原因'); return; }
  const selected = MOCK_INTERCEPT_REASONS.find(r => r.code === interceptSelectedCode.value);
  if (selected?.name === '客户要求暂扣' && !interceptRemark.value.trim()) {
    message.warning('拦截原因选择"客户要求暂扣"时，拦截备注为必填项'); return;
  }
  message.success(`已拦截 ${selectedRowKeys.value.length} 条订单（原因：${selected?.code} ${selected?.name}）`);
  interceptModalOpen.value = false; selectedRowKeys.value = [];
}
const selectedInterceptItem = computed(() => MOCK_INTERCEPT_REASONS.find(r => r.code === interceptSelectedCode.value));
const interceptColumns = [
  { title: '序号', key: 'idx', width: 60, customRender: ({ index }: any) => index + 1 },
  { title: '助记码', dataIndex: 'code', key: 'code', width: 100 },
  { title: '中文名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '问题内容', dataIndex: 'content', key: 'content', ellipsis: true },
];

// ========================= 导出 =========================
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const BOM = '﻿';
  const csv = BOM + headers.join(',') + '\n' + rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function handleExportFollowUp() {
  const headers = ['YT单号', '跟进人', '跟进备注', '跟进时间'];
  const rows: string[][] = [];
  MOCK_DATA.forEach((r) => {
    const history = followUpHistory.value[r.ytOrderNo] || [];
    if (r.follower) history.filter((h: any) => !h.hidden).forEach(h => rows.push([r.ytOrderNo, r.follower, h.content, h.time]));
  });
  if (rows.length === 0) { message.warning('没有跟进记录可导出'); return; }
  downloadCSV(`跟进记录导出_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  message.success(`已导出 ${rows.length} 条跟进记录`);
}
function handleExportDetention() {
  const headers = ['YT单号', '扣件原因', '扣件生成时间', '扣件完成时间'];
  const rows: string[][] = [];
  MOCK_DATA.forEach((r) => {
    const reasons = MOCK_DETENTION[r.ytOrderNo];
    if (reasons?.length) reasons.forEach(d => rows.push([r.ytOrderNo, d.reason, d.createTime, d.finishTime || '未完成']));
  });
  if (rows.length === 0) { message.warning('没有扣件记录可导出'); return; }
  downloadCSV(`扣件原因导出_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  message.success(`已导出 ${rows.length} 条扣件记录`);
}
const EXPORT_TYPES: { key: string; label: string; needSelect?: boolean; statusLimit?: string[] }[] = [
  { key: 'detail', label: '订单详情导出' },
  { key: 'declare', label: '申报信息导出' },
  { key: 'charge', label: '计费信息导出' },
  { key: 'express', label: '快递发票导出' },
  { key: 'hl', label: '欧洲HL发票导出' },
  { key: 'ship', label: '发货证明导出', needSelect: true, statusLimit: ['已签收'] },
  { key: 'sign', label: '签收证明导出', needSelect: true, statusLimit: ['已发货'] },
  { key: 'board', label: '看板信息导出' },
];
function handleExportType(key: string) {
  const t = EXPORT_TYPES.find(e => e.key === key);
  if (!t) return;
  if (t.needSelect) {
    if (selectedRowKeys.value.length === 0) { message.warning('请先勾选数据再导出'); return; }
    if (t.statusLimit) {
      const invalid = selectedRecords().filter(r => !t.statusLimit!.includes(r.orderStatus));
      if (invalid.length > 0) { message.warning(`只支持导出${t.statusLimit.join('/')}状态订单`); return; }
    }
  }
  exportKey.value = key;
  exportOption.value = selectedRowKeys.value.length > 0 ? 'selected' : 'all';
  exportOpen.value = true;
}
function handleMoreMenu(key: string) {
  if (key === 'import-remark') {
    resetRemarkImport();
    remarkImportOpen.value = true;
  }
  else if (key === 'import-addr-review') {
    resetAddrImport();
    addrImportOpen.value = true;
  }
  else if (key === 'export-followup') handleExportFollowUp();
  else if (key === 'export-detention') handleExportDetention();
  else if (key.startsWith('export-')) handleExportType(key.replace('export-', ''));
  else if (key === '1') { printTemplate.value = 'label'; printOpen.value = true; }
  else if (key === '2') columnConfigOpen.value = true;
  else message.info(`功能 "${key}" 待接入后台（原型演示）`);
}
function onMenuClick(e: { key: string }) { handleMoreMenu(e.key); }

// ========================= 备注导入 =========================
const remarkImportColumns = [
  { title: '序号', key: 'idx', width: 56, customRender: ({ index }: any) => index + 1 },
  { title: '运单号', dataIndex: 'ytOrderNo', key: 'ytOrderNo', width: 150 },
  { title: '客户备注', dataIndex: 'customerRemark', key: 'customerRemark', width: 200, ellipsis: true },
  { title: '配载备注', dataIndex: 'loadingRemark', key: 'loadingRemark', width: 200, ellipsis: true },
];
function remarkRowClassName(record: any) {
  return record.valid ? '' : 'bol-import-row-error';
}
function buildRemarkPreview(rows: string[][]) {
  const header = (rows[0] || []).map(h => String(h ?? '').trim());
  if (rows.length <= 1) { message.warning('文件中没有数据行，请填写后重新上传'); return []; }
  const ytIdx = header.indexOf('运单号');
  if (ytIdx === -1) { message.warning('文件缺少「运单号」列，请下载模板后按表头填写'); return []; }
  const cuIdx = header.indexOf('客户备注');
  const loIdx = header.indexOf('配载备注');
  const preview: any[] = [];
  const invalid: any[] = [];
  rows.slice(1).forEach((r, i) => {
    const yt = String(r[ytIdx] ?? '').trim();
    const cu = cuIdx >= 0 ? String(r[cuIdx] ?? '').trim() : '';
    const lo = loIdx >= 0 ? String(r[loIdx] ?? '').trim() : '';
    const actions: string[] = [];
    if (cu) actions.push('客户备注');
    if (lo) actions.push('配载备注');
    if (!yt) {
      invalid.push({ ytOrderNo: yt || '（空）', customerRemark: cu || '-', loadingRemark: lo || '-' });
      return;
    }
    preview.push({
      key: i + 1,
      ytOrderNo: yt,
      customerRemark: cu || '-',
      loadingRemark: lo || '-',
      action: actions.length ? `更新${actions.join('、')}` : '不处理',
      valid: true,
    });
  });
  remarkInvalidRows.value = invalid;
  return preview;
}
async function onRemarkFileBeforeUpload(file: File) {
  if (!/\.xlsx$/i.test(file.name)) {
    message.error('仅支持 .xlsx 格式文件，请下载模板填写后另存为 .xlsx 再上传');
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件大小不能超过 10MB');
    return false;
  }
  remarkImportFile.value = file;
  remarkFileList.value = [{ uid: '-1', name: file.name }];
  remarkImportLoading.value = true;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    remarkPreviewRows.value = buildRemarkPreview(rows);
    if (remarkPreviewRows.value.length) message.success(`已解析文件：${file.name}，共 ${remarkPreviewRows.value.length} 条数据`);
  } catch (e) {
    message.error('文件解析失败，请检查文件内容是否正确');
    resetRemarkImport();
  } finally {
    remarkImportLoading.value = false;
  }
  return false;
}
function onRemarkFileRemove() {
  resetRemarkImport();
}
function resetRemarkImport() {
  remarkImportFile.value = null;
  remarkFileList.value = [];
  remarkPreviewRows.value = [];
  remarkInvalidRows.value = [];
}
function downloadXlsx(wb: any, fileName: string) {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
function downloadRemarkTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['运单号', '客户备注', '配载备注']]);
  XLSX.utils.book_append_sheet(wb, ws, '备注导入模板');
  downloadXlsx(wb, '备注导入模板.xlsx');
  message.success('已下载「备注导入模板.xlsx」，表头：运单号、客户备注、配载备注');
}
function handleRemarkImport() {
  if (!remarkImportFile.value) { message.warning('请先导入文件'); return; }
  if (!remarkPreviewRows.value.length) { message.warning('未解析到可导入的数据，请检查文件内容'); return; }
  const invalid = remarkInvalidRows.value;
  if (invalid.length > 0) {
    Modal.confirm({
      title: '导入失败，存在错误数据',
      width: 600,
      okText: '我知道了',
      cancelText: '关闭',
      content: () =>
        h('pre', { style: 'white-space: pre-line; max-height: 50vh; overflow: auto;' }, [
          `共 ${invalid.length} 条记录运单号为空，无法导入：`,
          ...invalid.map(r => `运单号：${r.ytOrderNo}，客户备注：${r.customerRemark}，配载备注：${r.loadingRemark}（原因：运单号为空）`),
        ].join('\n')),
    });
    return;
  }
  remarkImportLoading.value = true;
  setTimeout(() => {
    remarkImportLoading.value = false;
    Modal.success({ title: '导入成功', content: '备注导入成功，请在【下载中心】查看导入结果！' });
    remarkImportOpen.value = false;
    resetRemarkImport();
  }, 800);
}

// ========================= 地址审核状态导入 =========================
const ADDR_REVIEW_INPUT_OPTIONS = ['待审核', '已审核', '待确认'];
const ADDR_IMPORT_HEADERS = ['运单号', '审核状态', '收件人姓名', '省/州', '城市', '地址1', '地址2', '邮编', '电话', '收件人公司名称', '邮箱'];
const addrImportColumns = [
  { title: '序号', key: 'idx', width: 56, customRender: ({ index }: any) => index + 1 },
  ...ADDR_IMPORT_HEADERS.map(h => {
    const w: Record<string, number> = { '运单号': 180, '审核状态': 120, '收件人姓名': 150, '省/州': 120, '城市': 140, '地址1': 180, '地址2': 180, '邮编': 110, '电话': 160, '收件人公司名称': 180, '邮箱': 220 };
    return { title: h, dataIndex: h, key: h, width: w[h] || 160, ellipsis: true };
  }),
  { title: '导入动作', dataIndex: 'action', key: 'action', width: 160, ellipsis: true },
];
function addrRowClassName(record: any) {
  return record.valid ? '' : 'bol-import-row-error';
}
function buildAddrImportPreview(rows: string[][]) {
  const header = (rows[0] || []).map(h => String(h ?? '').trim());
  if (rows.length <= 1) { message.warning('文件中没有数据行，请填写后重新上传'); return []; }
  const idxOf = (name: string) => header.indexOf(name);
  const ytIdx = idxOf('运单号');
  if (ytIdx === -1) { message.warning('文件缺少「运单号」列，请下载模板后按表头填写'); return []; }
  const stIdx = idxOf('审核状态');
  if (stIdx === -1) { message.warning('文件缺少「审核状态」列，请下载模板后按表头填写'); return []; }
  const preview: any[] = [];
  const invalid: any[] = [];
  rows.slice(1).forEach((r, i) => {
    const yt = String(r[ytIdx] ?? '').trim();
    const st = String(r[stIdx] ?? '').trim();
    if (!yt) {
      invalid.push({ ytOrderNo: '（空）', reviewStatus: st || '-', reason: '运单号为空' });
      return;
    }
    if (!MOCK_DATA.some(d => d.ytOrderNo === yt)) {
      invalid.push({ ytOrderNo: yt, reviewStatus: st || '-', reason: '运单号不存在' });
      return;
    }
    if (!ADDR_REVIEW_INPUT_OPTIONS.includes(st)) {
      invalid.push({ ytOrderNo: yt, reviewStatus: st || '-', reason: '审核状态不合法（仅支持：待审核/已审核/待确认）' });
      return;
    }
    const row: any = { key: i + 1, '运单号': yt, '审核状态': st, '导入动作': `更新为「${st}」`, valid: true };
    ['收件人姓名', '省/州', '城市', '地址1', '地址2', '邮编', '电话', '收件人公司名称', '邮箱'].forEach(name => {
      const j = idxOf(name);
      row[name] = j === -1 ? '' : String(r[j] ?? '').trim();
    });
    preview.push(row);
  });
  addrInvalidRows.value = invalid;
  return preview;
}
async function onAddrFileBeforeUpload(file: File) {
  if (!/\.xlsx$/i.test(file.name)) {
    message.error('仅支持 .xlsx 格式文件，请下载模板填写后另存为 .xlsx 再上传');
    return false;
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件大小不能超过 10MB');
    return false;
  }
  addrImportFile.value = file;
  addrFileList.value = [{ uid: '-1', name: file.name }];
  addrImportLoading.value = true;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    addrPreviewRows.value = buildAddrImportPreview(rows);
    if (addrPreviewRows.value.length) message.success(`已解析文件：${file.name}，共 ${addrPreviewRows.value.length} 条数据`);
  } catch (e) {
    message.error('文件解析失败，请检查文件内容是否正确');
    resetAddrImport();
  } finally {
    addrImportLoading.value = false;
  }
  return false;
}
function onAddrFileRemove() {
  resetAddrImport();
}
function resetAddrImport() {
  addrImportFile.value = null;
  addrFileList.value = [];
  addrPreviewRows.value = [];
  addrInvalidRows.value = [];
}
function downloadAddrImportTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ADDR_IMPORT_HEADERS,
    ['2607AA0142', '已审核', 'John Smith', 'California', 'Los Angeles', '1234 Sunset Blvd', '', '90028', '+1 310-555-0142', 'Cloud Peak Logistics', 'ops@cloudpeak.com'],
    ['2607AA0141', '待审核', 'Mary Johnson', 'Texas', 'Houston', '789 Main St', 'Suite 5', '77001', '+1 713-555-0141', 'Blue Ocean Trade', 'mary@blueocean.com'],
    ['2607AA0140', '待确认', 'Robert Chen', 'Washington', 'Seattle', '456 Pine Ave', '', '98101', '+1 206-555-0140', 'Pacific Star Co', 'robert@pacificstar.com'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, '地址审核状态导入');
  downloadXlsx(wb, '地址审核状态模版.xlsx');
  message.success('已下载「地址审核状态模版.xlsx」，表头：运单号、审核状态、收件人姓名、省/州、城市、地址1、地址2、邮编、电话、收件人公司名称、邮箱');
}
function handleAddrImport() {
  if (!addrImportFile.value) { message.warning('请先导入文件'); return; }
  if (!addrPreviewRows.value.length) { message.warning('未解析到可导入的数据，请检查文件内容'); return; }
  const invalid = addrInvalidRows.value;
  if (invalid.length > 0) {
    Modal.confirm({
      title: '导入失败，存在错误数据',
      width: 640,
      okText: '我知道了',
      cancelText: '关闭',
      content: () =>
        h('pre', { style: 'white-space: pre-line; max-height: 50vh; overflow: auto;' }, [
          `共 ${invalid.length} 条记录存在错误，无法导入：`,
          ...invalid.map(r => `运单号：${r.ytOrderNo}，审核状态：${r.reviewStatus}（原因：${r.reason}）`),
        ].join('\n')),
    });
    return;
  }
  addrImportLoading.value = true;
  setTimeout(() => {
    addrImportLoading.value = false;
    Modal.success({ title: '导入成功', content: '地址审核状态导入成功，请在【下载中心】查看导入结果！' });
    addrImportOpen.value = false;
    resetAddrImport();
  }, 800);
}
</script>
