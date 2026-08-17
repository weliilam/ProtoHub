<template>
  <div class="pac-layout">
    <div class="pac-page-header">
      <div class="pac-page-title-area">
        <h2 class="pac-page-title">SHEIN账号配置</h2>
        <span class="pac-page-desc">管理供应商商家配置，支持搜索、筛选与新增 / 编辑 / 删除</span>
      </div>
    </div>

    <div class="pac-search-bar">
      <div class="pac-search-row">
        <div class="pac-search-item">
          <span class="pac-search-label">客户代码</span>
          <a-select v-model:value="keyword" placeholder="按客户代码搜索" allow-clear show-search class="pac-select" :options="keywordOptions" @change="onSearch" />
        </div>
        <div class="pac-search-item">
          <span class="pac-search-label">SHEIN店铺ID</span>
          <a-input v-model:value="storeId" placeholder="按SHEIN店铺ID搜索" allow-clear class="pac-input" @press-enter="onSearch" @change="onSearch" />
        </div>
      </div>
    </div>

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

    <div class="pac-table-wrapper">
      <a-table :columns="columns" :data-source="pagedData" :pagination="pagination" :scroll="{ x: 830 }" size="middle" row-key="supplier_id" class="pac-table" @change="onTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'warehouse'">
            <a @click="openMapView(record)">查看</a>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a @click="openEdit(record)">编辑</a>
              <a-popconfirm title="确认删除该店铺及其全部仓库映射？" ok-text="删除" cancel-text="取消" @confirm="remove(record)">
                <a class="pac-danger">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal v-model:open="modalOpen" :title="editingId !== null ? '编辑商家配置' : '新增商家配置'" :width="920" :mask-closable="false" ok-text="确定" cancel-text="取消" @ok="submit" @cancel="closeModal">
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="pac-form">
        <a-form-item label="SHEIN店铺ID" name="supplier_id">
          <a-input-number v-model:value="form.supplier_id" :min="0" :disabled="!!editingId" style="width: 100%" placeholder="如 18054795" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="客户代码" name="customer_code">
              <a-input v-model:value="form.customer_code" placeholder="如 BCNHC54308" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户名称" name="customer_name">
              <a-input v-model:value="form.customer_name" placeholder="如 PANASIA SYNERGY LIMITED" />
            </a-form-item>
          </a-col>
        </a-row>
        <div class="pac-map-header">
          <span class="pac-map-title">仓库映射</span>
        </div>
        <div class="pac-map-table">
          <div class="pac-map-row pac-map-head">
            <span><span class="pac-required">*</span>仓库代码</span>
            <span>SHEIN仓库ID<span class="pac-optional">（选填）</span></span>
            <span><span class="pac-required">*</span>详细地址</span>
            <span class="pac-map-op">操作</span>
          </div>
          <div v-for="(row, idx) in form.rows" :key="idx" class="pac-map-row">
            <a-input v-model:value="row.warehouse_code" placeholder="如 W220678" />
            <a-input v-model:value="row.shein_warehouse_id" placeholder="如 SW100001" />
            <a-input v-model:value="row.address" placeholder="请输入详细地址" />
            <span class="pac-map-op">
              <a @click="removeRow(idx)">删除</a>
            </span>
          </div>
          <a-button type="dashed" block @click="addRow">
            <template #icon><PlusOutlined /></template>
            添加映射
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="mapViewOpen" title="仓库映射" :footer="null" width="760">
      <template v-if="mapViewRecord">
        <a-table :columns="mapColumns" :data-source="mapViewRecord.maps" :pagination="false" size="small" :row-key="(r, i) => i" />
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

const STORAGE_KEY = 'pac_address_config'

// 数据结构保持扁平：一行 = 一个店铺ID + 一组仓库映射；
// 同一店铺ID 可有多行（多组仓库映射）；仓库代码与SHEIN仓库ID 全局 1:1 对应
const seed = [
  { supplier_id: 18054795, customer_code: 'BCNHC54308', customer_name: 'PANASIA SYNERGY LIMITED', warehouse_code: 'W220678', shein_warehouse_id: 'SW100001', address: '肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18077695, customer_code: 'BCNHC75062', customer_name: 'HUA RUI CLOUD TECH LIMITED', warehouse_code: 'W220266', shein_warehouse_id: 'SW100002', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门/13-22门' },
  { supplier_id: 18181053, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220875', shein_warehouse_id: 'SW100003', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-21门' },
  { supplier_id: 18181041, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220876', shein_warehouse_id: 'SW100004', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓13-22门' },
  { supplier_id: 18179761, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220877', shein_warehouse_id: 'SW100005', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓14-01门' },
  { supplier_id: 18177590, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220878', shein_warehouse_id: 'SW100006', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓14-02门' },
  { supplier_id: 18150500, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220879', shein_warehouse_id: 'SW100007', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓14-03门' },
  { supplier_id: 18150387, customer_code: 'BCNHC91043', customer_name: 'PING CONSULTING SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', warehouse_code: 'W220880', shein_warehouse_id: 'SW100008', address: '广东省肇庆市鼎湖区永安镇社周路9号鼎湖京东13号仓14-04门' }
]

// 兼容：若旧 localStorage 是嵌套结构（商家+stores[]），摊平回扁平结构
const flatten = (arr) => {
  if (!Array.isArray(arr) || !arr.length) return [...seed]
  if (arr.some((r) => Array.isArray(r.stores))) {
    const out = []
    arr.forEach((g) => (g.stores || []).forEach((s) => out.push({
      supplier_id: s.supplier_id,
      customer_code: g.customer_code,
      customer_name: g.customer_name,
      warehouse_code: s.warehouse_code,
      shein_warehouse_id: s.shein_warehouse_id,
      address: s.address || g.address
    })))
    return out
  }
  return arr
}

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return flatten(parsed)
    }
  } catch (e) { /* 忽略损坏数据 */ }
  return [...seed]
}
const list = reactive(loadFromStorage())
watch(list, (val) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch (e) { /* 忽略 */ }
}, { deep: true })

const keyword = ref(undefined)
const storeId = ref('')
const keywordOptions = computed(() => {
  const seen = new Set()
  const opts = []
  list.forEach((r) => {
    if (r.customer_code && !seen.has(r.customer_code)) {
      seen.add(r.customer_code)
      opts.push({ value: r.customer_code, label: r.customer_code })
    }
  })
  return opts
})
const filtered = computed(() => {
  const kw = (keyword.value || '').trim()
  const sid = (storeId.value || '').trim()
  return list.filter((r) => {
    if (kw && r.customer_code !== kw) return false
    if (sid && String(r.supplier_id) !== sid) return false
    return true
  })
})

// 按 SHEIN店铺ID 分组：一行 = 一个店铺，maps 聚合该店铺的全部仓库映射
const groups = computed(() => {
  const map = new Map()
  filtered.value.forEach((r) => {
    if (!map.has(r.supplier_id)) {
      map.set(r.supplier_id, {
        supplier_id: r.supplier_id,
        customer_code: r.customer_code,
        customer_name: r.customer_name,
        maps: []
      })
    }
    map.get(r.supplier_id).maps.push({ warehouse_code: r.warehouse_code, shein_warehouse_id: r.shein_warehouse_id, address: r.address })
  })
  return [...map.values()]
})

const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t) => `共 ${t} 个店铺` })
const pagedData = computed(() => {
  pagination.total = groups.value.length
  const start = (pagination.current - 1) * pagination.pageSize
  return groups.value.slice(start, start + pagination.pageSize)
})
const onSearch = () => { pagination.current = 1 }
const resetFilters = () => { keyword.value = undefined; storeId.value = ''; pagination.current = 1 }
const onTableChange = (p) => { pagination.current = p.current; pagination.pageSize = p.pageSize }

const columns = [
  { title: 'SHEIN店铺ID', dataIndex: 'supplier_id', key: 'supplier_id', width: 120, fixed: 'left' },
  { title: '客户代码', dataIndex: 'customer_code', key: 'customer_code', width: 140 },
  { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 280, ellipsis: true },
  { title: '仓库代码/SHEIN仓库ID', key: 'warehouse', width: 130 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' }
]

const modalOpen = ref(false)
const mapViewOpen = ref(false)
const mapViewRecord = ref(null)
const openMapView = (record) => { mapViewRecord.value = record; mapViewOpen.value = true }

const mapColumns = [
  { title: '序号', key: 'idx', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '仓库代码', dataIndex: 'warehouse_code', key: 'warehouse_code', width: 130 },
  { title: 'SHEIN仓库ID', dataIndex: 'shein_warehouse_id', key: 'shein_warehouse_id', width: 140, customRender: ({ text }) => text || '—' },
  { title: '详细地址', dataIndex: 'address', key: 'address', customRender: ({ text }) => text || '—' }
]
// 编辑时记录当前操作的 SHEIN店铺ID（整组替换该店铺的全部仓库映射）
const editingId = ref(null)
const formRef = ref()
const emptyRow = () => ({ warehouse_code: '', shein_warehouse_id: '', address: '' })
const form = reactive({ supplier_id: null, customer_code: '', customer_name: '', rows: [] })

const rules = {
  supplier_id: [{ required: true, message: '请输入SHEIN店铺ID' }],
  customer_code: [{ required: true, message: '请输入客户代码' }],
  customer_name: [{ required: true, message: '请输入客户名称' }]
}

const openCreate = () => {
  editingId.value = null
  Object.assign(form, { supplier_id: null, customer_code: '', customer_name: '', rows: [emptyRow()] })
  modalOpen.value = true
}
const openEdit = (record) => {
  editingId.value = record.supplier_id
  const group = list.filter((r) => r.supplier_id === record.supplier_id)
  Object.assign(form, {
    supplier_id: record.supplier_id,
    customer_code: record.customer_code,
    customer_name: record.customer_name,
    rows: group.map((r) => ({ warehouse_code: r.warehouse_code, shein_warehouse_id: r.shein_warehouse_id, address: r.address }))
  })
  modalOpen.value = true
}
const closeModal = () => { modalOpen.value = false }
const addRow = () => { form.rows.push(emptyRow()) }
const removeRow = (idx) => { form.rows.splice(idx, 1) }

// 校验：仓库代码必填（允许重复）；SHEIN仓库ID 选填，同一店铺内不可重复；每行详细地址必填
const validateRows = (rows) => {
  const localWid = new Set()
  for (let i = 0; i < rows.length; i++) {
    const wc = String(rows[i].warehouse_code || '').trim()
    const wid = String(rows[i].shein_warehouse_id || '').trim()
    const addr = String(rows[i].address || '').trim()
    if (!wc) { message.error(`第 ${i + 1} 组：仓库代码为必填`); return false }
    if (!addr) { message.error(`第 ${i + 1} 组：详细地址为必填`); return false }
    if (wid) {
      if (localWid.has(wid)) { message.error(`第 ${i + 1} 组：该店铺下 SHEIN仓库ID ${wid} 重复`); return false }
      localWid.add(wid)
    }
  }
  return true
}

const submit = () => {
  formRef.value.validate().then(() => {
    if (form.supplier_id === null || form.supplier_id === undefined || form.supplier_id === '') {
      message.error('请输入SHEIN店铺ID'); return
    }
    if (!form.rows.length) { message.error('请至少添加一组仓库映射'); return }
    if (!validateRows(form.rows)) return

    const supplierId = Number(form.supplier_id)
    const base = {
      customer_code: String(form.customer_code).trim(),
      customer_name: String(form.customer_name).trim()
    }
    const payload = form.rows.map((r) => ({
      supplier_id: supplierId,
      warehouse_code: String(r.warehouse_code).trim(),
      shein_warehouse_id: String(r.shein_warehouse_id).trim(),
      address: String(r.address).trim(),
      ...base
    }))
    if (editingId.value !== null) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].supplier_id === editingId.value) list.splice(i, 1)
      }
      if (list.some((r) => r.supplier_id === supplierId)) {
        message.error(`SHEIN店铺ID ${supplierId} 已存在`); return
      }
      list.unshift(...payload)
      message.success('商家配置已更新')
    } else {
      if (list.some((r) => r.supplier_id === supplierId)) {
        message.error(`SHEIN店铺ID ${supplierId} 已存在，如需为该店铺添加仓库映射请使用「编辑」`); return
      }
      list.unshift(...payload)
      message.success('商家配置已添加')
    }
    modalOpen.value = false
  })
}
const remove = (record) => {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].supplier_id === record.supplier_id) list.splice(i, 1)
  }
  message.success('商家配置已删除')
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
