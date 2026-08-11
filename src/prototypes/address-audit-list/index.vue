<template>
  <div class="aal-layout">
    <!-- 页面标题 -->
    <div class="aal-page-header">
      <div class="aal-page-title-area">
        <h3 class="aal-page-title">地址审核列表</h3>
        <span class="aal-page-desc">集中管理运单收货地址的审核状态</span>
      </div>
    </div>

    <!-- 搜索栏（顶部圆角） -->
    <div class="aal-search-bar">
      <div class="aal-search-row">
        <div class="aal-search-item">
          <span class="aal-search-label">YT单号</span>
          <a-input v-model:value="filters.ytOrderNo" placeholder="支持多单号搜索" allow-clear class="aal-input" />
        </div>
        <div class="aal-search-item">
          <span class="aal-search-label">客户编码</span>
          <a-input v-model:value="filters.customerCode" placeholder="请输入客户编码" allow-clear class="aal-input" />
        </div>
        <div class="aal-search-item">
          <span class="aal-search-label">地址审核状态</span>
          <a-select v-model:value="filters.addressAuditStatus" placeholder="请选择" allow-clear :options="AUDIT_STATUS_OPTIONS" class="aal-select" />
        </div>
        <div class="aal-search-item">
          <span class="aal-search-label">工单号</span>
          <a-input v-model:value="filters.workOrderNo" placeholder="请输入工单号" allow-clear class="aal-input" />
        </div>
        <div class="aal-search-item">
          <span class="aal-search-label">订单状态</span>
          <a-select v-model:value="filters.orderStatus" placeholder="请选择" mode="multiple" max-tag-count="2" allow-clear :options="ORDER_STATUS_OPTIONS" class="aal-select" style="min-width:180px" />
        </div>
        <div class="aal-search-item">
          <span class="aal-search-label">地址类型</span>
          <a-select v-model:value="filters.addressType" placeholder="请选择" allow-clear :options="ADDRESS_TYPE_OPTIONS" class="aal-select" />
        </div>
      </div>
    </div>

    <!-- 操作栏（中间白条：左侧批量按钮、右侧查询/重置） -->
    <div class="aal-action-bar">
      <a-space :size="8" wrap>
        <a-button type="primary" :disabled="!selectedRowKeys.length" @click="handleBatchAudit">
          批量审核{{ selectedRowKeys.length ? ` (${selectedRowKeys.length})` : '' }}
        </a-button>
      </a-space>
      <a-space :size="8">
        <a-button type="primary" @click="handleSearch">
          <template #icon><SearchOutlined /></template>查询
        </a-button>
        <a-button @click="resetFilters">
          <template #icon><ReloadOutlined /></template>重置
        </a-button>
      </a-space>
    </div>

    <!-- 表格（底部圆角） -->
    <div class="aal-table-wrapper">
      <a-table
        :columns="columns"
        :data-source="filteredData"
        :row-selection="rowSelection"
        :scroll="{ x: 1000 }"
        size="middle"
        :pagination="pagination"
        class="aal-table"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ (pagination.current - 1) * pagination.pageSize + index + 1 }}</template>
          <template v-else-if="column.key === 'ytOrderNo'"><span class="aal-mono">{{ record.ytOrderNo }}</span></template>
          <template v-else-if="column.key === 'addressAuditStatus'">
            <a-tag :color="AUDIT_STATUS_COLOR[record.addressAuditStatus]" bordered="false">{{ AUDIT_STATUS_LABEL[record.addressAuditStatus] ?? record.addressAuditStatus }}</a-tag>
          </template>
          <template v-else-if="column.key === 'orderStatus'"><a-tag color="processing" bordered="false">{{ record.orderStatus }}</a-tag></template>
          <template v-else-if="column.key === 'addressType'">{{ ADDRESS_TYPE_LABEL[record.addressType] ?? record.addressType }}</template>
        </template>
      </a-table>
    </div>

    <!-- 批量审核弹窗 -->
    <a-modal v-model:open="batchAuditOpen" title="批量地址审核" :width="420" :footer="null">
      <a-form layout="vertical">
        <a-form-item label="地址审核状态" required>
          <a-radio-group v-model:value="batchAuditStatus">
            <a-radio v-for="o in AUDIT_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="batchAuditOpen = false">取消</a-button>
        <a-button type="primary" :disabled="!batchAuditStatus" @click="submitBatchAudit">确定</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import './style.css';
import { ref, reactive, computed } from 'vue';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

// ========================= 选项 =========================
const AUDIT_STATUS_OPTIONS = [
  { value: '0', label: '待审核' },
  { value: '1', label: '已审核' },
  { value: '2', label: '待确认' },
  { value: '3', label: '已确认' },
];
const AUDIT_STATUS_LABEL: Record<string, string> = { '0': '待审核', '1': '已审核', '2': '待确认', '3': '已确认' };
const AUDIT_STATUS_COLOR: Record<string, string> = { '0': 'default', '1': 'green', '2': 'orange', '3': 'blue' };

const ADDRESS_TYPE_OPTIONS = [
  { value: '1', label: 'Amazon地址' },
  { value: '2', label: '私人地址' },
  { value: '3', label: '海外仓地址' },
];
const ADDRESS_TYPE_LABEL: Record<string, string> = { '1': 'Amazon地址', '2': '私人地址', '3': '海外仓地址' };

const ORDER_STATUS_OPTIONS = ['草稿', '已预报', '已入仓', '待客户确认', '客户已确认', '客户已驳回', '已发货', '已签收']
  .map(v => ({ value: v, label: v }));

// ========================= Mock 数据 =========================
const MOCK_BASE: any[] = [
  { ytOrderNo: '2608BB0101', customerCode: 'BCNHC40325', addressAuditStatus: '0', workOrderNo: 'WO2026080001', orderStatus: '已预报', addressType: '1' },
  { ytOrderNo: '2608BB0102', customerCode: 'BCNHC94062', addressAuditStatus: '1', workOrderNo: 'WO2026080002', orderStatus: '已入仓', addressType: '3' },
  { ytOrderNo: '2608BB0103', customerCode: 'BCN0C09842', addressAuditStatus: '2', workOrderNo: 'WO2026080003', orderStatus: '待客户确认', addressType: '2' },
  { ytOrderNo: '2608BB0104', customerCode: 'F00ITDDT08', addressAuditStatus: '3', workOrderNo: 'WO2026080004', orderStatus: '已发货', addressType: '1' },
  { ytOrderNo: '2608BB0105', customerCode: 'BCN0C95318', addressAuditStatus: '0', workOrderNo: 'WO2026080005', orderStatus: '已预报', addressType: '3' },
  { ytOrderNo: '2608BB0106', customerCode: 'BCNHC40325', addressAuditStatus: '1', workOrderNo: 'WO2026080006', orderStatus: '已入仓', addressType: '2' },
  { ytOrderNo: '2608BB0107', customerCode: 'BCN0C03286', addressAuditStatus: '2', workOrderNo: 'WO2026080007', orderStatus: '已预报', addressType: '1' },
  { ytOrderNo: '2608BB0108', customerCode: 'BCNHC21498', addressAuditStatus: '0', workOrderNo: 'WO2026080008', orderStatus: '待客户确认', addressType: '3' },
  { ytOrderNo: '2608BB0109', customerCode: 'BCNHC40325', addressAuditStatus: '3', workOrderNo: 'WO2026080009', orderStatus: '已发货', addressType: '2' },
  { ytOrderNo: '2608BB0110', customerCode: 'BCN0C09842', addressAuditStatus: '1', workOrderNo: 'WO2026080010', orderStatus: '已入仓', addressType: '1' },
  { ytOrderNo: '2608BB0111', customerCode: 'BCNHC94062', addressAuditStatus: '2', workOrderNo: 'WO2026080011', orderStatus: '已预报', addressType: '3' },
  { ytOrderNo: '2608BB0112', customerCode: 'F00ITDDT08', addressAuditStatus: '0', workOrderNo: 'WO2026080012', orderStatus: '已签收', addressType: '2' },
  { ytOrderNo: '2608BB0113', customerCode: 'BCN0C95318', addressAuditStatus: '3', workOrderNo: 'WO2026080013', orderStatus: '已预报', addressType: '1' },
  { ytOrderNo: '2608BB0114', customerCode: 'BCNHC21498', addressAuditStatus: '1', workOrderNo: 'WO2026080014', orderStatus: '已发货', addressType: '3' },
  { ytOrderNo: '2608BB0115', customerCode: 'BCN0C03286', addressAuditStatus: '2', workOrderNo: 'WO2026080015', orderStatus: '待客户确认', addressType: '2' },
];

const mockData = MOCK_BASE.map((r, i) => ({
  key: r.key ?? String(i + 1),
  ...r,
}));

// ========================= 状态 =========================
const filters = reactive({
  ytOrderNo: '',
  customerCode: '',
  addressAuditStatus: undefined as string | undefined,
  workOrderNo: '',
  orderStatus: undefined as string[] | undefined,
  addressType: undefined as string | undefined,
});

const selectedRowKeys = ref<string[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`
});

// ========================= 过滤 =========================
const filteredData = computed(() => {
  const list = mockData.filter(r => {
    if (filters.ytOrderNo) {
      const singleNos = filters.ytOrderNo.split(/[\s,]+/).filter(Boolean);
      if (singleNos.length && !singleNos.some(n => r.ytOrderNo.includes(n))) return false;
    }
    if (filters.customerCode && !r.customerCode.includes(filters.customerCode)) return false;
    if (filters.addressAuditStatus !== undefined && r.addressAuditStatus !== filters.addressAuditStatus) return false;
    if (filters.workOrderNo && !r.workOrderNo.includes(filters.workOrderNo)) return false;
    if (filters.orderStatus && filters.orderStatus.length && !filters.orderStatus.includes(r.orderStatus)) return false;
    if (filters.addressType !== undefined && r.addressType !== filters.addressType) return false;
    return true;
  });
  pagination.total = list.length;
  return list;
});

// ========================= 表格列 =========================
const columns = [
  { title: '序号', key: 'index', width: 60, align: 'center', fixed: 'left' },
  { title: 'YT单号', dataIndex: 'ytOrderNo', key: 'ytOrderNo', width: 160, fixed: 'left',
    sorter: (a: any, b: any) => a.ytOrderNo.localeCompare(b.ytOrderNo) },
  { title: '客户编码', dataIndex: 'customerCode', key: 'customerCode', width: 140 },
  { title: '地址审核状态', dataIndex: 'addressAuditStatus', key: 'addressAuditStatus', width: 130, align: 'center' },
  { title: '工单号', dataIndex: 'workOrderNo', key: 'workOrderNo', width: 160 },
  { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 130, align: 'center' },
  { title: '地址类型', dataIndex: 'addressType', key: 'addressType', width: 130 },
];

const rowSelection = {
  selectedRowKeys: selectedRowKeys,
  onChange: (keys: string[]) => { selectedRowKeys.value = keys; },
};

// ========================= 操作 =========================
const handleSearch = () => { /* reactive 自动计算 */ };
const resetFilters = () => {
  filters.ytOrderNo = '';
  filters.customerCode = '';
  filters.addressAuditStatus = undefined;
  filters.workOrderNo = '';
  filters.orderStatus = undefined;
  filters.addressType = undefined;
};

// ========================= 批量审核 =========================
const batchAuditOpen = ref(false);
const batchAuditStatus = ref<string | undefined>(undefined);

const handleBatchAudit = () => {
  if (!selectedRowKeys.value.length) { message.warning('请先勾选需要审核的订单'); return; }
  batchAuditStatus.value = undefined;
  batchAuditOpen.value = true;
};

const submitBatchAudit = () => {
  if (!batchAuditStatus.value) return;
  const count = selectedRowKeys.value.length;
  mockData.forEach(r => {
    if (selectedRowKeys.value.includes(r.key)) r.addressAuditStatus = batchAuditStatus.value;
  });
  selectedRowKeys.value = [];
  batchAuditOpen.value = false;
  message.success(`已将 ${count} 条订单的地址审核状态更新为「${AUDIT_STATUS_LABEL[batchAuditStatus.value!]}」`);
};
</script>
