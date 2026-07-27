<template>
  <div class="sku-page">
    <div class="sku-header"><h2 class="sku-title">SKU管理</h2></div>

    <!-- 搜索区 -->
    <div class="sku-search-card">
      <a-form layout="inline" class="sku-search-form" @submit.prevent>
        <a-row :gutter="[8, 8]" style="width: 100%">
          <a-col :span="8">
            <a-form-item label="SKU" class="sku-form-item">
              <a-textarea
                v-model:value="filterData.skus"
                :auto-size="{ minRows: 1, maxRows: 3 }"
                placeholder="支持多个 SKU，以空格或英文逗号分隔"
                allow-clear
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="销售产品" class="sku-form-item">
              <a-select
                v-model:value="filterData.productCode"
                placeholder="请选择销售产品"
                allow-clear
                show-search
                style="width: 100%"
                :options="PRODUCT_OPTIONS"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="客户代码" class="sku-form-item">
              <a-select
                v-model:value="filterData.customerCode"
                placeholder="请选择客户代码"
                allow-clear
                show-search
                style="width: 100%"
                :options="CUSTOMER_OPTIONS"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="目的国家" class="sku-form-item">
              <a-select
                v-model:value="filterData.countryCode"
                placeholder="请选择目的国家"
                allow-clear
                show-search
                style="width: 100%"
                :options="COUNTRY_OPTIONS"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="创建时间" class="sku-form-item">
              <a-range-picker
                v-model:value="filterData.dateRange"
                show-time
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <div class="sku-search-actions">
          <a-space :size="8">
            <a-button type="primary" @click="handleSearch">
              <template #icon><search-outlined /></template>查询
            </a-button>
            <a-button @click="resetFilters">
              <template #icon><reload-outlined /></template>重置
            </a-button>
          </a-space>
        </div>
      </a-form>
    </div>

    <!-- 工具栏 -->
    <div class="sku-toolbar">
      <a-space :size="8" wrap>
        <a-button v-if="skumgEdit" type="primary" @click="openAdd">
          <template #icon><plus-outlined /></template>新增
        </a-button>
        <a-button
          v-if="skumgEdit"
          danger
          :disabled="!selectedRowKeys.length"
          @click="handleDelete"
        >
          <template #icon><delete-outlined /></template>删除{{ selectedRowKeys.length ? ` (${selectedRowKeys.length})` : '' }}
        </a-button>
        <a-button v-if="skumgEdit" type="primary" @click="importOpen = true">
          <template #icon><import-outlined /></template>批量导入SKU配置
        </a-button>
        <a-button @click="logOpen = true">
          <template #icon><file-text-outlined /></template>查看日志
        </a-button>
      </a-space>
      <span class="sku-total-count">共 <b>{{ filteredData.length }}</b> 条</span>
    </div>

    <!-- 表格 -->
    <div class="sku-table-wrap">
      <a-table
        row-key="Id"
        :columns="columns"
        :data-source="filteredData"
        :scroll="{ x: 1680 }"
        size="middle"
        :row-selection="{ selectedRowKeys, onChange: onSelectionChange }"
        :pagination="pagination"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'Sku'"><span class="sku-mono">{{ record.Sku }}</span></template>
          <template v-else-if="column.key === 'CustomerCode'"><span class="sku-mono">{{ record.CustomerCode }}</span></template>
          <template v-else-if="column.key === 'Operation'">
            <a-button v-if="skumgEdit" type="link" size="small" @click="openEdit(record)">编辑</a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      :title="editRecord ? '编辑 SKU' : '新增 SKU'"
      v-model:open="editOpen"
      :width="700"
      :confirm-loading="submitting"
      @ok="handleEditOk"
      ok-text="确认"
      cancel-text="取消"
      destroy-on-close
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical" class="sku-edit-form">
        <a-row :gutter="20">
          <a-col :span="12">
            <a-form-item label="SKU" name="Sku" :rules="[{ required: true, message: '请输入 SKU' }]">
              <a-input v-model:value="editForm.Sku" :maxlength="50" show-count allow-clear :disabled="!!editRecord" placeholder="请输入 SKU" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="销售产品" name="ProductCode" :rules="[{ required: true, message: '请选择销售产品' }]">
              <a-select v-model:value="editForm.ProductCode" placeholder="请选择销售产品" show-search :options="PRODUCT_OPTIONS" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户代码" name="CustomerCode" :rules="[{ required: true, message: '请选择客户代码' }]">
              <a-select v-model:value="editForm.CustomerCode" placeholder="请选择客户代码" show-search :options="CUSTOMER_OPTIONS" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="目的国家" name="CountryCode" :rules="[{ required: true, message: '请选择目的国家' }]">
              <a-select v-model:value="editForm.CountryCode" placeholder="请选择目的国家" show-search :options="COUNTRY_OPTIONS" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" name="Remark">
              <a-textarea v-model:value="editForm.Remark" :rows="4" :maxlength="200" show-count placeholder="请输入备注" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 日志弹窗 -->
    <a-modal
      title="SKU 操作日志"
      v-model:open="logOpen"
      :width="720"
      :footer="null"
    >
      <a-timeline>
        <a-timeline-item
          v-for="l in MOCK_LOG"
          :key="l.key"
          :color="l.action === '删除' ? 'red' : l.action === '编辑' ? 'blue' : 'green'"
        >
          <div class="sku-timeline-item">
            <div class="sku-timeline-header">
              <span class="sku-timeline-time">{{ l.time }}</span>
              <a-tag :color="l.action === '删除' ? 'red' : l.action === '编辑' ? 'blue' : 'green'" style="margin-left: 8px">{{ l.action }}</a-tag>
              <a-tag style="margin-left: 4px">{{ l.operator }}</a-tag>
            </div>
            <div class="sku-timeline-content">{{ l.content }}</div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-modal>

    <!-- 批量导入弹窗 -->
    <a-modal
      title="批量导入SKU配置"
      v-model:open="importOpen"
      :width="760"
    >
      <template #footer>
        <a-button @click="importOpen = false">取消</a-button>
        <a-button type="primary" ghost @click="handlePreview">预览</a-button>
        <a-button type="primary" :disabled="!previewDone" @click="handleImportConfirm">确认导入</a-button>
      </template>
      <div class="sku-import-tip">
        <download-outlined /> 导入模板：
        <a @click="() => message.info('下载模板「导入SKU配置模板.xls」（模拟）')">导入SKU配置模板.xls</a>
      </div>
      <a-upload-dragger
        accept=".xls,.xlsx"
        :multiple="false"
        :before-upload="onBeforeUpload"
        :file-list="importFile ? [{ uid: '-1', name: importFile.name }] : []"
        @remove="onFileRemove"
      >
        <p class="ant-upload-drag-icon"><inbox-outlined /></p>
        <p class="ant-upload-text">点击或拖拽 Excel 文件到此处上传</p>
        <p class="ant-upload-hint">仅支持 .xls / .xlsx，导入类型 19</p>
      </a-upload-dragger>

      <div v-if="previewDone" class="sku-import-preview">
        <div class="sku-import-preview-title">预览（共 {{ previewRows.length }} 条）</div>
        <a-table
          row-key="Id"
          size="small"
          :pagination="false"
          :data-source="previewRows"
          :columns="importColumns"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import './style.css';
import { ref, reactive, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  ImportOutlined, FileTextOutlined, DownloadOutlined, InboxOutlined,
} from '@ant-design/icons-vue';

interface SkuRecord {
  Id: number; Sku: string; ProductCode: string; ProductName: string;
  CustomerCode: string; CountryCode: string; CountryName: string;
  CreateBy: string; CreateDate: string; UpdateBy: string; UpdateDate: string; Remark: string;
}
interface SkuLog { key: string; time: string; operator: string; action: string; content: string; }

const skumgEdit = true;

const PRODUCT_OPTIONS = [
  { value: 'US-HK-NY', label: '美国海卡(经济)-纽约' },
  { value: 'US-AIR-X', label: '美国空派(特惠普货)-X' },
  { value: 'US-AIR-STD', label: '美国空派(标快普货)' },
  { value: 'US-MS', label: '美森云速达' },
  { value: 'US-HP-CLX', label: '美国海派(特快)-CLX' },
  { value: 'US-HK-LA', label: '美国海卡(经济)-洛杉矶' },
  { value: 'B2B-AIR', label: 'B2B-TEST-空运' },
];
const CUSTOMER_OPTIONS = [
  { value: 'BCNHC40325', label: 'BCNHC40325' },
  { value: 'BCN0C09842', label: 'BCN0C09842' },
  { value: 'F00ITDDT08', label: 'F00ITDDT08' },
  { value: 'BCNHC21498', label: 'BCNHC21498' },
  { value: 'BCN0C03286', label: 'BCN0C03286' },
];
const COUNTRY_OPTIONS = [
  { value: 'US', label: '美国' }, { value: 'DE', label: '德国' }, { value: 'GB', label: '英国' },
  { value: 'JP', label: '日本' }, { value: 'FR', label: '法国' }, { value: 'CA', label: '加拿大' },
];
const productNameOf = (c?: string) => PRODUCT_OPTIONS.find((p) => p.value === c)?.label || c || '';
const countryNameOf = (c?: string) => COUNTRY_OPTIONS.find((x) => x.value === c)?.label || c || '';

let SEQ = 100;
const nextId = () => ++SEQ;
const now = () => new Date().toLocaleString('zh-CN', { hour12: false });

const MOCK_DATA: SkuRecord[] = [
  { Id: 1, Sku: 'SKU-A1001', ProductCode: 'US-HK-NY', ProductName: '美国海卡(经济)-纽约', CustomerCode: 'BCNHC40325', CountryCode: 'US', CountryName: '美国', CreateBy: '卓运康', CreateDate: '2026-07-01 09:12:33', UpdateBy: '卓运康', UpdateDate: '2026-07-01 09:12:33', Remark: '常规普货，走纽约仓' },
  { Id: 2, Sku: 'SKU-A1002', ProductCode: 'US-AIR-X', ProductName: '美国空派(特惠普货)-X', CustomerCode: 'BCN0C09842', CountryCode: 'DE', CountryName: '德国', CreateBy: '陈小丽', CreateDate: '2026-07-01 10:05:21', UpdateBy: '陈小丽', UpdateDate: '2026-07-02 11:30:00', Remark: '' },
  { Id: 3, Sku: 'SKU-B2001', ProductCode: 'US-AIR-STD', ProductName: '美国空派(标快普货)', CustomerCode: 'F00ITDDT08', CountryCode: 'GB', CountryName: '英国', CreateBy: '马武林', CreateDate: '2026-07-01 14:22:10', UpdateBy: '马武林', UpdateDate: '2026-07-01 14:22:10', Remark: '加急' },
  { Id: 4, Sku: 'SKU-C3001', ProductCode: 'US-MS', ProductName: '美森云速达', CustomerCode: 'BCNHC21498', CountryCode: 'US', CountryName: '美国', CreateBy: '韩利兵', CreateDate: '2026-07-02 08:40:00', UpdateBy: '韩利兵', UpdateDate: '2026-07-03 09:00:00', Remark: '美森快船' },
  { Id: 5, Sku: 'SKU-C3002', ProductCode: 'US-HP-CLX', ProductName: '美国海派(特快)-CLX', CustomerCode: 'BCN0C03286', CountryCode: 'CA', CountryName: '加拿大', CreateBy: '龚晓辉', CreateDate: '2026-07-02 13:15:44', UpdateBy: '龚晓辉', UpdateDate: '2026-07-02 13:15:44', Remark: '' },
  { Id: 6, Sku: 'SKU-D4001', ProductCode: 'US-HK-LA', ProductName: '美国海卡(经济)-洛杉矶', CustomerCode: 'BCNHC40325', CountryCode: 'JP', CountryName: '日本', CreateBy: '卓运康', CreateDate: '2026-07-02 16:08:55', UpdateBy: '卓运康', UpdateDate: '2026-07-04 10:20:00', Remark: '走洛杉矶港' },
  { Id: 7, Sku: 'SKU-D4002', ProductCode: 'B2B-AIR', ProductName: 'B2B-TEST-空运', CustomerCode: 'BCN0C09842', CountryCode: 'FR', CountryName: '法国', CreateBy: '徐铭辛', CreateDate: '2026-07-03 09:00:11', UpdateBy: '徐铭辛', UpdateDate: '2026-07-03 09:00:11', Remark: '测试用' },
  { Id: 8, Sku: 'SKU-A1003', ProductCode: 'US-HK-NY', ProductName: '美国海卡(经济)-纽约', CustomerCode: 'BCNHC21498', CountryCode: 'US', CountryName: '美国', CreateBy: '韩利兵', CreateDate: '2026-07-03 11:30:00', UpdateBy: '韩利兵', UpdateDate: '2026-07-03 11:30:00', Remark: '' },
  { Id: 9, Sku: 'SKU-B2002', ProductCode: 'US-AIR-STD', ProductName: '美国空派(标快普货)', CustomerCode: 'F00ITDDT08', CountryCode: 'DE', CountryName: '德国', CreateBy: '马武林', CreateDate: '2026-07-04 08:20:30', UpdateBy: '陈小丽', UpdateDate: '2026-07-05 14:10:00', Remark: '需配合清关资料' },
  { Id: 10, Sku: 'SKU-E5001', ProductCode: 'US-HP-CLX', ProductName: '美国海派(特快)-CLX', CustomerCode: 'BCN0C03286', CountryCode: 'GB', CountryName: '英国', CreateBy: '龚晓辉', CreateDate: '2026-07-04 15:45:09', UpdateBy: '龚晓辉', UpdateDate: '2026-07-04 15:45:09', Remark: '' },
  { Id: 11, Sku: 'SKU-F6001', ProductCode: 'US-MS', ProductName: '美森云速达', CustomerCode: 'BCNHC40325', CountryCode: 'US', CountryName: '美国', CreateBy: '卓运康', CreateDate: '2026-07-05 10:00:00', UpdateBy: '卓运康', UpdateDate: '2026-07-05 10:00:00', Remark: '大客户专属' },
  { Id: 12, Sku: 'SKU-F6002', ProductCode: 'US-AIR-X', ProductName: '美国空派(特惠普货)-X', CustomerCode: 'BCN0C09842', CountryCode: 'JP', CountryName: '日本', CreateBy: '徐铭辛', CreateDate: '2026-07-05 17:30:22', UpdateBy: '徐铭辛', UpdateDate: '2026-07-06 09:15:00', Remark: '' },
];

const MOCK_LOG: SkuLog[] = [
  { key: '1', time: '2026-07-06 09:15:00', operator: '徐铭辛', action: '编辑', content: 'SKU-F6002 修改目的国家为 JP' },
  { key: '2', time: '2026-07-05 10:00:00', operator: '卓运康', action: '新增', content: 'SKU-F6001 新增成功（客户 BCNHC40325）' },
  { key: '3', time: '2026-07-04 15:45:09', operator: '龚晓辉', action: '新增', content: 'SKU-E5001 新增成功（客户 BCN0C03286）' },
  { key: '4', time: '2026-07-03 11:30:00', operator: '韩利兵', action: '新增', content: 'SKU-A1003 新增成功（客户 BCNHC21498）' },
  { key: '5', time: '2026-07-02 13:15:44', operator: '龚晓辉', action: '删除', content: '删除 SKU-C9999（客户反馈配置错误）' },
];

const filterData = reactive({ skus: '', productCode: undefined as string | undefined, customerCode: undefined as string | undefined, countryCode: undefined as string | undefined, dateRange: null as any });
const baseData = ref<SkuRecord[]>([...MOCK_DATA]);
const selectedRowKeys = ref<number[]>([]);
const editOpen = ref(false);
const editRecord = ref<SkuRecord | null>(null);
const editFormRef = ref();
const editForm = reactive({ Sku: '', ProductCode: '', CustomerCode: '', CountryCode: '', Remark: '' });
const submitting = ref(false);
const logOpen = ref(false);
const importOpen = ref(false);
const previewDone = ref(false);
const previewRows = ref<SkuRecord[]>([]);
const importFile = ref<File | null>(null);

const filteredData = computed(() => {
  const skus = filterData.skus.split(/[\s,，]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return baseData.value.filter((r) => {
    if (skus.length && !skus.some((s) => r.Sku.toLowerCase().includes(s))) return false;
    if (filterData.productCode && r.ProductCode !== filterData.productCode) return false;
    if (filterData.customerCode && r.CustomerCode !== filterData.customerCode) return false;
    if (filterData.countryCode && r.CountryCode !== filterData.countryCode) return false;
    if (filterData.dateRange && filterData.dateRange.length === 2) {
      const fmt = (d: any) => new Date(d).toLocaleString('zh-CN', { hour12: false });
      const t = r.CreateDate, start = fmt(filterData.dateRange[0]), end = fmt(filterData.dateRange[1]);
      if (t < start || t > end) return false;
    }
    return true;
  });
});

const columns = [
  { title: '序号', width: 60, align: 'center', fixed: 'left', customRender: ({ index }: any) => index + 1 },
  { title: 'SKU', dataIndex: 'Sku', key: 'Sku', width: 120, sorter: (a: any, b: any) => a.Sku.localeCompare(b.Sku) },
  { title: '销售产品代码', dataIndex: 'ProductCode', key: 'ProductCode', width: 140, sorter: (a: any, b: any) => a.ProductCode.localeCompare(b.ProductCode) },
  { title: '销售产品名称', dataIndex: 'ProductName', key: 'ProductName', width: 180, ellipsis: true, sorter: (a: any, b: any) => a.ProductName.localeCompare(b.ProductName) },
  { title: '客户代码', dataIndex: 'CustomerCode', key: 'CustomerCode', width: 140, sorter: (a: any, b: any) => a.CustomerCode.localeCompare(b.CustomerCode) },
  { title: '目的国家简码', dataIndex: 'CountryCode', key: 'CountryCode', width: 120, sorter: (a: any, b: any) => a.CountryCode.localeCompare(b.CountryCode) },
  { title: '目的国家名称', dataIndex: 'CountryName', key: 'CountryName', width: 130, sorter: (a: any, b: any) => a.CountryName.localeCompare(b.CountryName) },
  { title: '创建人', dataIndex: 'CreateBy', key: 'CreateBy', width: 100, sorter: (a: any, b: any) => a.CreateBy.localeCompare(b.CreateBy) },
  { title: '创建时间', dataIndex: 'CreateDate', key: 'CreateDate', width: 170, sorter: (a: any, b: any) => a.CreateDate.localeCompare(b.CreateDate) },
  { title: '修改人', dataIndex: 'UpdateBy', key: 'UpdateBy', width: 100, sorter: (a: any, b: any) => a.UpdateBy.localeCompare(b.UpdateBy) },
  { title: '修改时间', dataIndex: 'UpdateDate', key: 'UpdateDate', width: 170, sorter: (a: any, b: any) => a.UpdateDate.localeCompare(b.UpdateDate) },
  { title: '备注', dataIndex: 'Remark', key: 'Remark', width: 180, ellipsis: true },
  { title: '操作', key: 'Operation', width: 120, fixed: 'right' },
];

const pagination = reactive({
  total: filteredData.value.length,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (t: number) => `共 ${t} 条`,
  defaultPageSize: 20,
  pageSizeOptions: ['20', '50', '100'],
});

function handleSearch() {
  pagination.total = filteredData.value.length;
  message.success(`查询完成，命中 ${filteredData.value.length} 条`);
}
function resetFilters() {
  Object.assign(filterData, { skus: '', productCode: undefined, customerCode: undefined, countryCode: undefined, dateRange: null });
}
function onSelectionChange(keys: number[]) { selectedRowKeys.value = keys; }

function openAdd() {
  editRecord.value = null;
  Object.assign(editForm, { Sku: '', ProductCode: '', CustomerCode: '', CountryCode: '', Remark: '' });
  editOpen.value = true;
}
function openEdit(row: SkuRecord) {
  editRecord.value = row;
  Object.assign(editForm, { Sku: row.Sku, ProductCode: row.ProductCode, CustomerCode: row.CustomerCode, CountryCode: row.CountryCode, Remark: row.Remark });
  editOpen.value = true;
}
async function handleEditOk() {
  try {
    await editFormRef.value?.validate();
  } catch { return; }
  submitting.value = true;
  try {
    const nowStr = now();
    if (editRecord.value) {
      const t = editRecord.value;
      Object.assign(t, {
        ProductCode: t.ProductCode, ProductName: productNameOf(editForm.ProductCode),
        CustomerCode: editForm.CustomerCode, CountryCode: editForm.CountryCode, CountryName: countryNameOf(editForm.CountryCode),
        Remark: editForm.Remark || '', UpdateBy: '当前用户', UpdateDate: nowStr,
      });
      message.success('SKU 修改成功（模拟）');
    } else {
      baseData.value.unshift({
        Id: nextId(), Sku: editForm.Sku, ProductCode: editForm.ProductCode, ProductName: productNameOf(editForm.ProductCode),
        CustomerCode: editForm.CustomerCode, CountryCode: editForm.CountryCode, CountryName: countryNameOf(editForm.CountryCode),
        Remark: editForm.Remark || '', CreateBy: '当前用户', CreateDate: nowStr, UpdateBy: '当前用户', UpdateDate: nowStr,
      });
      message.success('SKU 新增成功（模拟）');
    }
    pagination.total = filteredData.value.length;
    editOpen.value = false;
  } finally { submitting.value = false; }
}
function handleDelete() {
  if (!selectedRowKeys.value.length) { message.warning('请先勾选需要删除的 SKU'); return; }
  Modal.confirm({
    title: '确认删除',
    content: `确定删除勾选的 ${selectedRowKeys.value.length} 个 SKU 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      baseData.value = baseData.value.filter((r) => !selectedRowKeys.value.includes(r.Id));
      selectedRowKeys.value = [];
      pagination.total = filteredData.value.length;
      message.success(`已删除 ${selectedRowKeys.value.length} 个 SKU（模拟）`);
    },
  });
}

const importColumns = [
  { title: 'SKU', dataIndex: 'Sku', key: 'Sku', width: 120 },
  { title: '客户代码', dataIndex: 'CustomerCode', key: 'CustomerCode', width: 120 },
  { title: '销售产品代码', dataIndex: 'ProductCode', key: 'ProductCode', width: 140 },
  { title: '目的国家简码', dataIndex: 'CountryCode', key: 'CountryCode', width: 120 },
  { title: '备注', dataIndex: 'Remark', key: 'Remark', ellipsis: true },
];
function onBeforeUpload(file: File) { importFile.value = file; message.success(`已选择文件：${file.name}`); return false; }
function onFileRemove() { importFile.value = null; previewRows.value = []; previewDone.value = false; }
function handlePreview() {
  if (!importFile.value) { message.warning('请先选择导入文件'); return; }
  previewRows.value = [
    { Id: nextId(), Sku: 'SKU-IMP01', ProductCode: 'US-HK-NY', ProductName: '美国海卡(经济)-纽约', CustomerCode: 'BCNHC40325', CountryCode: 'US', CountryName: '美国', CreateBy: '导入', CreateDate: '', UpdateBy: '', UpdateDate: '', Remark: '来自文件' },
    { Id: nextId(), Sku: 'SKU-IMP02', ProductCode: 'US-AIR-X', ProductName: '美国空派(特惠普货)-X', CustomerCode: 'BCN0C09842', CountryCode: 'DE', CountryName: '德国', CreateBy: '导入', CreateDate: '', UpdateBy: '', UpdateDate: '', Remark: '来自文件' },
  ];
  previewDone.value = true;
  message.success('预览完成（模拟）');
}
function handleImportConfirm() {
  if (!previewDone.value) { message.warning('请先进行预览'); return; }
  baseData.value = [...previewRows.value, ...baseData.value];
  message.success(`已导入 ${previewRows.value.length} 条 SKU 配置（模拟）`);
  previewRows.value = []; previewDone.value = false; importFile.value = null; importOpen.value = false;
  pagination.total = filteredData.value.length;
}
</script>
