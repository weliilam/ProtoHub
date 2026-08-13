<template>
  <div class="pac-layout">
    <div class="pac-page-header">
      <div class="pac-page-title-area">
        <h2 class="pac-page-title">地址配置（POMS）</h2>
        <span class="pac-page-desc">管理供应商地址映射配置，支持搜索、筛选与新增 / 编辑 / 删除</span>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="pac-search-bar">
      <div class="pac-search-row">
        <div class="pac-search-item pac-search-item-grow">
          <span class="pac-search-label">关键词</span>
          <a-input
            v-model:value="keyword"
            placeholder="搜索 客户代码 / 客户名称 / 仓库代码 / SHEIN仓库ID / 地址"
            allow-clear
            class="pac-input"
            @press-enter="onSearch"
            @change="onSearch"
          />
        </div>
        <div class="pac-search-item">
          <span class="pac-search-label">地址类型</span>
          <a-select
            v-model:value="filterType"
            placeholder="地址类型"
            allow-clear
            class="pac-select"
            :options="typeOptions"
            @change="onSearch"
          />
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="pac-action-bar">
      <a-space>
        <a-button type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增商家配置
        </a-button>
      </a-space>
      <a-space>
        <a-button type="primary" @click="onSearch">查询</a-button>
        <a-button @click="resetFilters">重置</a-button>
      </a-space>
    </div>

    <!-- 表格 -->
    <div class="pac-table-wrapper">
      <a-table
        :columns="columns"
        :data-source="pagedData"
        :pagination="pagination"
        :scroll="{ x: 1200 }"
        size="middle"
        row-key="supplier_id"
        class="pac-table"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'address_type'">
            <a-tag :color="typeColor(record.address_type)" :bordered="false">{{ typeLabel(record.address_type) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openEdit(record)">编辑</a>
              <a-popconfirm title="确认删除该地址配置？" ok-text="删除" cancel-text="取消" @confirm="remove(record)">
                <a class="pac-danger">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId !== null ? '编辑地址配置' : '新增商家配置'"
      :width="760"
      :mask-closable="false"
      @ok="submit"
      @cancel="closeModal"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="pac-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="供应商ID (supplier_id)" name="supplier_id">
              <a-input-number v-model:value="form.supplier_id" :min="0" style="width:100%" placeholder="系统自动生成，可修改" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="地址类型" name="address_type">
              <a-select v-model:value="form.address_type" placeholder="请选择地址类型" :options="typeOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="客户代码 (customer_code)" name="customer_code">
              <a-input v-model:value="form.customer_code" placeholder="如 BCNHC54308" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户名称 (customer_name)" name="customer_name">
              <a-input v-model:value="form.customer_name" placeholder="如 PANASIA SYNERGY LIMITED" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="仓库代码 (warehouse_code)" name="warehouse_code">
              <a-input v-model:value="form.warehouse_code" placeholder="如 W220678" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="SHEIN仓库ID (shein_warehouse_id)" name="shein_warehouse_id">
              <a-input v-model:value="form.shein_warehouse_id" placeholder="如 SW100001" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="地址代码 (address_code)" name="address_code">
              <a-input v-model:value="form.address_code" placeholder="如 W220678" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="详细地址 (address)" name="address">
          <a-textarea v-model:value="form.address" :rows="3" placeholder="请输入详细地址" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

const STORAGE_KEY = 'pac_address_config'

const typeOptions = [
  { value: '1', label: 'Amazon地址' },
  { value: '2', label: '海外仓地址' },
  { value: '3', label: '私人地址' }
]
const typeColor = (v) => ({ '1': 'gold', '2': 'blue', '3': 'green' }[v] || 'default')
const typeLabel = (v) => typeOptions.find((o) => o.value === v)?.label || v

const seed = [
  { supplier_id: 18054795, customer_code: 'BCNHC54308', customer_name: 'PANASIA SYNERGY LIMITED', warehouse_code: 'W220678', shein_warehouse_id: 'SW100001', address_code: 'W220678', address_type: '2', address: '肇庆市肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18077695, customer_code: 'BCNHC75062', customer_name: 'HUA RUI CLOUD TECH LIMITED', warehouse_code: 'W220266', shein_warehouse_id: 'SW100002', address_code: 'W220266', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18181053, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100003', address_code: 'W220875', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18181041, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100004', address_code: 'W220875', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18179761, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100005', address_code: 'W220875', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18177590, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100006', address_code: 'W220875', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18150500, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100007', address_code: 'W220875', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18150387, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100008', address_code: 'W220875', address_type: '2', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' }
]

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch (e) { /* 忽略损坏数据 */ }
  return [...seed]
}
const list = reactive(loadFromStorage())
watch(list, (val) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch (e) { /* 忽略 */ }
}, { deep: true })

const keyword = ref('')
const filterType = ref(undefined)
const filtered = computed(() => {
  const kw = (keyword.value || '').trim().toLowerCase()
  return list.filter((r) => {
    if (filterType.value && r.address_type !== filterType.value) return false
    if (kw) {
      const hay = `${r.customer_code}${r.customer_name}${r.warehouse_code}${r.shein_warehouse_id}${r.address}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` })
const pagedData = computed(() => {
  pagination.total = filtered.value.length
  const start = (pagination.current - 1) * pagination.pageSize
  return filtered.value.slice(start, start + pagination.pageSize)
})
const onSearch = () => { pagination.current = 1 }
const resetFilters = () => { keyword.value = ''; filterType.value = undefined; pagination.current = 1 }
const onTableChange = (p) => { pagination.current = p.current; pagination.pageSize = p.pageSize }

const columns = [
  { title: 'SHEIN店铺ID', dataIndex: 'supplier_id', key: 'supplier_id', width: 120, fixed: 'left' },
  { title: '客户代码', dataIndex: 'customer_code', key: 'customer_code', width: 140 },
  { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 280, ellipsis: true },
  { title: 'SHEIN仓库ID', dataIndex: 'shein_warehouse_id', key: 'shein_warehouse_id', width: 150 },
  { title: '仓库代码', dataIndex: 'warehouse_code', key: 'warehouse_code', width: 130 },
  { title: '详细地址', dataIndex: 'address', key: 'address', width: 360, ellipsis: true },
  { title: '操作', key: 'action', width: 110, fixed: 'right' }
]

const modalOpen = ref(false)
const editingId = ref(null)
const formRef = ref()
const nextSupplierId = computed(() => {
  const max = list.reduce((m, r) => Math.max(m, Number(r.supplier_id) || 0), 0)
  return max + 1
})
const form = reactive({
  supplier_id: null, customer_code: '', customer_name: '', warehouse_code: '',
  shein_warehouse_id: '', address_code: '', address_type: undefined, address: ''
})
const rules = {
  customer_code: [{ required: true, message: '请输入客户代码' }],
  customer_name: [{ required: true, message: '请输入客户名称' }],
  warehouse_code: [{ required: true, message: '请输入仓库代码' }],
  shein_warehouse_id: [{ required: true, message: '请输入SHEIN仓库ID' }],
  address_code: [{ required: true, message: '请输入地址代码' }],
  address_type: [{ required: true, message: '请选择地址类型' }],
  address: [{ required: true, message: '请输入详细地址' }]
}

const openCreate = () => {
  editingId.value = null
  Object.assign(form, {
    supplier_id: nextSupplierId.value, customer_code: '', customer_name: '',
    warehouse_code: '', shein_warehouse_id: '', address_code: '', address_type: undefined, address: ''
  })
  modalOpen.value = true
}
const openEdit = (record) => {
  editingId.value = record.supplier_id
  Object.assign(form, { ...record })
  modalOpen.value = true
}
const closeModal = () => { modalOpen.value = false }

const submit = () => {
  formRef.value.validate().then(() => {
    const payload = {
      supplier_id: Number(form.supplier_id),
      customer_code: form.customer_code,
      customer_name: form.customer_name,
      warehouse_code: form.warehouse_code,
      shein_warehouse_id: form.shein_warehouse_id,
      address_code: form.address_code,
      address_type: form.address_type,
      address: form.address
    }
    if (editingId.value !== null) {
      const idx = list.findIndex((r) => r.supplier_id === editingId.value)
      if (idx > -1) Object.assign(list[idx], payload)
      message.success('地址配置已更新')
    } else {
      if (list.some((r) => r.supplier_id === payload.supplier_id)) {
        message.error('供应商ID已存在')
        return
      }
      list.unshift(payload)
      message.success('地址配置已添加')
    }
    modalOpen.value = false
  })
}
const remove = (record) => {
  const idx = list.findIndex((r) => r.supplier_id === record.supplier_id)
  if (idx > -1) list.splice(idx, 1)
  message.success('地址配置已删除')
}
</script>

<style scoped>
@import './style.css';

.pac-table :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.pac-table :deep(.ant-pagination) {
  margin-bottom: 0;
}
</style>
