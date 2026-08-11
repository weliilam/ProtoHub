<template>
  <div class="wod-page">
    <!-- 顶部标题 -->
    <div class="wod-header">
      <h2 class="wod-title">工单详情</h2>
      <el-button size="small" @click="handleReset" class="wod-reset-btn">
        <el-icon><Refresh /></el-icon>
        重置状态
      </el-button>
    </div>

    <!-- 工单信息 -->
    <div class="wod-card">
      <div class="wod-card-title">工单信息</div>
      <el-form label-width="130px" label-position="left" class="wod-form">
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="运单号">
              <span class="wod-mono">{{ workOrder.trackingNo }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户单号">
              <span class="wod-mono">{{ workOrder.customerOrderNo }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="跟踪号">
              <span class="wod-mono">{{ workOrder.followUpNo }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="工单号">
              <span class="wod-mono">{{ workOrder.workOrderNo }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="标题">
              <span>{{ workOrder.title }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="失败原因">
              <span :class="{ 'wod-text-danger': workOrder.failReason }">{{ workOrder.failReason }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="目的国家">
              <span>{{ workOrder.destCountry }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户代码">
              <span class="wod-mono">{{ workOrder.customerCode }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户名称">
              <span>{{ workOrder.customerName }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="产品名称">
              <span>{{ workOrder.productName }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交仓仓库">
              <span>{{ workOrder.deliveryWarehouse }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="入仓时间">
              <span>{{ workOrder.warehouseInTime }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="异常发生地名称">
              <span>{{ workOrder.exceptionLocation }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="异常发生地类型">
              <span>{{ workOrder.exceptionLocationType }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="处理截止时间">
              <span class="wod-text-warning">{{ workOrder.deadline }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="收件人姓名">
              <span>{{ workOrder.recipientName }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="省/州">
              <span>{{ workOrder.province }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="城市">
              <span>{{ workOrder.city }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="地址1">
              <span>{{ workOrder.address1 }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="地址2">
              <span>{{ workOrder.address2 }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="邮编">
              <span class="wod-mono">{{ workOrder.zipCode }}</span>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="电话">
              <span class="wod-mono">{{ workOrder.phone }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="公司名称">
              <span>{{ workOrder.companyName }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="邮箱">
              <span>{{ workOrder.email }}</span>
            </el-form-item>
          </el-col>

        </el-row>
      </el-form>
    </div>

    <!-- 资料模板 - 平铺展开 -->
    <div class="wod-card">
      <div class="wod-card-title">资料模板</div>

      <!-- 异常箱子明细 -->
      <div class="wod-sub-section">
        <div class="wod-sub-title">
          异常箱子明细<span class="wod-sub-count">包裹数：{{ abnormalBoxes.length }}</span>
        </div>
        <el-table :data="abnormalBoxes" border stripe size="small" style="width: 100%">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="boxNo" label="箱号" width="200">
            <template #default="{ row }"><span class="wod-mono">{{ row.boxNo }}</span></template>
          </el-table-column>
          <el-table-column prop="childOrderNo" label="子单号" width="220">
            <template #default="{ row }"><span class="wod-mono">{{ row.childOrderNo }}</span></template>
          </el-table-column>
          <el-table-column prop="trackingNo" label="跟踪号" width="200">
            <template #default="{ row }"><span class="wod-mono">{{ row.trackingNo }}</span></template>
          </el-table-column>
          <el-table-column prop="weight" label="重量称重(kg)" width="140" align="right" />
          <el-table-column prop="recheckWeight" label="复核称重(kg)" width="140" align="right" />
          <el-table-column prop="recheckVolume" label="复核体积(cm)" width="140" align="right" />
          <el-table-column prop="recheckWeightInfo" label="复核称重信息(KG)" width="160" align="right" />
          <el-table-column prop="length" label="长(cm)" width="90" align="right" />
          <el-table-column prop="width" label="宽(cm)" width="90" align="right" />
          <el-table-column prop="height" label="高(cm)" width="90" align="right" />
          <el-table-column prop="signWeight" label="签重(KG)" width="100" align="right" />
        </el-table>
      </div>

      <!-- 增值服务 -->
      <div class="wod-sub-section">
        <div class="wod-sub-title">增值服务</div>
        <el-table :data="valueAddedServices" border size="small" style="width: 100%">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="serviceName" label="增值服务" />
          <el-table-column prop="startTime" label="增值服务生效时间" />
          <el-table-column prop="endTime" label="增值服务结束" />
          <el-table-column prop="remark" label="备注" />
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleEditService(row)">编辑</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <div class="wod-empty-cell">暂无数据</div>
          </template>
        </el-table>
      </div>

      <!-- 工单记录 -->
      <div class="wod-sub-section">
        <div class="wod-sub-title">
          工单记录<span class="wod-sub-count">{{ workOrder.elapsedTime }}</span>
        </div>
        <el-timeline class="wod-timeline">
          <el-timeline-item
            v-for="(item, idx) in workOrderRecords"
            :key="idx"
            :timestamp="item.time"
            :type="item.type"
            :color="item.color"
            placement="top"
          >
            <div class="wod-timeline-content">
              <div class="wod-timeline-operator">
                <el-tag :type="item.tagType" size="small">{{ item.operator }}</el-tag>
                <span class="wod-timeline-action">{{ item.action }}</span>
              </div>
              <div v-if="item.detail" class="wod-timeline-detail">{{ item.detail }}</div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>

    <!-- 工单状态：初始按钮行 -->
    <div class="wod-footer" v-if="currentStep === 0">
      <el-space :size="12">
        <el-button type="primary" @click="handleEditOrder">
          <el-icon><Edit /></el-icon>
          修改订单
        </el-button>
        <el-button type="success" @click="handleRelease">
          <el-icon><Select /></el-icon>
          放行
        </el-button>
        <el-button type="warning" @click="handleReturn">
          <el-icon><Back /></el-icon>
          退回
        </el-button>
        <el-button type="danger" @click="handleAbandon">
          <el-icon><CloseBold /></el-icon>
          弃件
        </el-button>
        <el-button @click="handleWarehouseProcess">
          <el-icon><Setting /></el-icon>
          仓库处理
        </el-button>
      </el-space>
    </div>

    <!-- 工单状态：审核按钮行（修改后） -->
    <div class="wod-footer" v-if="currentStep === 1">
      <el-space :size="12">
        <el-button type="success" @click="handleApprove">
          <el-icon><CircleCheck /></el-icon>
          同意
        </el-button>
        <el-button type="danger" @click="handleReject">
          <el-icon><CloseBold /></el-icon>
          驳回
        </el-button>
      </el-space>
    </div>

    <!-- 工单状态：驳回后恢复初始按钮行 -->
    <div class="wod-footer" v-if="currentStep === 2">
      <el-space :size="12">
        <el-button type="primary" @click="handleEditOrder">
          <el-icon><Edit /></el-icon>
          修改订单
        </el-button>
        <el-button type="success" @click="handleRelease">
          <el-icon><Select /></el-icon>
          放行
        </el-button>
        <el-button type="warning" @click="handleReturn">
          <el-icon><Back /></el-icon>
          退回
        </el-button>
        <el-button type="danger" @click="handleAbandon">
          <el-icon><CloseBold /></el-icon>
          弃件
        </el-button>
        <el-button @click="handleWarehouseProcess">
          <el-icon><Setting /></el-icon>
          仓库处理
        </el-button>
      </el-space>
    </div>

    <!-- 修改订单弹窗 -->
    <el-dialog v-model="editOrderDialogVisible" title="修改订单" width="640px">
      <el-form :model="editForm" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="收件人姓名">
              <el-input v-model="editForm.recipientName" placeholder="请输入收件人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="省/州">
              <el-input v-model="editForm.province" placeholder="请输入省/州" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="城市">
              <el-input v-model="editForm.city" placeholder="请输入城市" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮编">
              <el-input v-model="editForm.zipCode" placeholder="请输入邮编" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="地址1">
              <el-input v-model="editForm.address1" placeholder="请输入地址1" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="地址2">
              <el-input v-model="editForm.address2" placeholder="请输入地址2（选填）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话">
              <el-input v-model="editForm.phone" placeholder="请输入电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="editForm.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司名称">
              <el-input v-model="editForm.companyName" placeholder="请输入公司名称" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editOrderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEditOrder">保存</el-button>
      </template>
    </el-dialog>

    <!-- 放行确认弹窗 -->
    <el-dialog v-model="releaseDialogVisible" title="确认放行" width="480px">
      <el-form :model="releaseForm" label-width="100px">
        <el-form-item label="放行原因">
          <el-select v-model="releaseForm.reason" placeholder="请选择放行原因" style="width: 100%">
            <el-option label="异常已处理，正常放行" value="resolved" />
            <el-option label="客户沟通后放行" value="customer" />
            <el-option label="误判放行" value="misjudge" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="releaseForm.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="releaseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRelease">确定放行</el-button>
      </template>
    </el-dialog>

    <!-- 退回确认弹窗 -->
    <el-dialog v-model="returnDialogVisible" title="确认退回" width="480px">
      <el-form :model="returnForm" label-width="100px">
        <el-form-item label="退回原因" required>
          <el-input v-model="returnForm.reason" type="textarea" :rows="4" placeholder="请输入退回原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReturn">确定退回</el-button>
      </template>
    </el-dialog>

    <!-- 弃件确认弹窗 -->
    <el-dialog v-model="abandonDialogVisible" title="确认弃件" width="480px">
      <el-alert
        title="弃件后将无法恢复，请谨慎操作"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-form :model="abandonForm" label-width="100px">
        <el-form-item label="弃件原因" required>
          <el-input v-model="abandonForm.reason" type="textarea" :rows="4" placeholder="请输入弃件原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="abandonDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmAbandon">确定弃件</el-button>
      </template>
    </el-dialog>

    <!-- 仓库处理弹窗 -->
    <el-dialog v-model="warehouseDialogVisible" title="仓库处理" width="520px">
      <el-form :model="warehouseForm" label-width="100px">
        <el-form-item label="处理类型" required>
          <el-select v-model="warehouseForm.processType" placeholder="请选择处理类型" style="width: 100%">
            <el-option label="换箱" value="changeBox" />
            <el-option label="加固包装" value="reinforce" />
            <el-option label="重新贴标" value="relabel" />
            <el-option label="重新测量" value="remeasure" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="warehouseForm.remark" type="textarea" :rows="4" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="warehouseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmWarehouse">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import './style.css'
import { ref, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Download, CircleCheck, Select, Back, CloseBold, Setting, Edit, Refresh,
} from '@element-plus/icons-vue'

// ======================== 工单数据 ========================
const workOrder = reactive({
  trackingNo: 'YT2622099300309056',
  customerOrderNo: 'ALS01878741074',
  followUpNo: '',
  workOrderNo: '595432363232303039333030333039303536363420',
  title: 'B2B中检问题已验/地址信息有误/无法取提具体货站信息/请及时与我司客服取得联系,谢谢',
  failReason: 'B2B中检问题已验/地址信息有误/无法确定具体货站信息/请及时与我司客服取得联系,谢谢',
  destCountry: '美国',
  customerCode: 'BCN0C53469',
  customerName: '深圳市***',
  productName: 'ICBIP中快快递服务-东南亚',
  deliveryWarehouse: '东南亚枢纽运营中心',
  warehouseInTime: '2026-08-09 20:19:31',
  exceptionLocation: '',
  exceptionLocationType: '',
  deadline: '',
  monitorRemark: '',
  inspectionRemark: '',
  templateName: '',
  createTime: '2026-08-09 05:43:45',
  elapsedTime: '1天4小时3分53秒',
  recipientName: 'John Smith',
  province: 'California',
  city: 'Los Angeles',
  address1: '1234 Sunset Blvd, Apt 5B',
  address2: '',
  zipCode: '90028',
  phone: '+1 (323) 555-0198',
  companyName: 'Global Trade Inc.',
  email: 'john.smith@globaltrade.com',
})

// ======================== 异常箱子明细 ========================
const abnormalBoxes = ref([
  { boxNo: 'ALS01878741074-1', childOrderNo: 'YT2622099300309056L001', trackingNo: '', weight: '53.00', recheckWeight: '45.00', recheckVolume: '38.00', recheckWeightInfo: '11.480', length: '', width: '', height: '', signWeight: '' },
])

// ======================== 增值服务 ========================
const valueAddedServices = ref<any[]>([])

function handleEditService(row: any) {
  ElMessage.info(`编辑增值服务：${row.serviceName}（模拟）`)
}
function handleDeleteService(row: any) {
  ElMessageBox.confirm(`确定删除增值服务「${row.serviceName}」吗？`, '确认删除', { type: 'warning' })
    .then(() => {
      ElMessage.success(`已删除增值服务「${row.serviceName}」（模拟）`)
    })
    .catch(() => {})
}

// ======================== 工单记录 ========================
// 持久化：从 localStorage 恢复
const STORAGE_KEY = 'wod_state'
let saved = null
try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
} catch (e) { saved = null }

const workOrderRecords = ref(saved?.records ?? [
  {
    time: '2026-08-09 05:43:45',
    operator: 'ADMIN',
    action: '创建工单',
    detail: '当前处理：创建工单',
    type: 'primary' as const,
    color: '#1677ff',
    tagType: '' as const,
  },
])

// ======================== 工单状态机（持久化到 localStorage）======================
// 0: 初始（5按钮）| 1: 修改后（同意/驳回）| 2: 驳回恢复初始 | 3: 同意完结
const currentStep = ref(saved?.step ?? 0)

// 自动持久化
watch([currentStep, workOrderRecords], () => {
  const data = { step: currentStep.value, records: workOrderRecords.value }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) { /* 忽略写入错误 */ }
}, { deep: true })

// ======================== 修改订单 ========================
const editOrderDialogVisible = ref(false)
const editForm = reactive({
  recipientName: '',
  province: '',
  city: '',
  address1: '',
  address2: '',
  zipCode: '',
  phone: '',
  companyName: '',
  email: '',
})

function handleEditOrder() {
  // 回填当前数据
  editForm.recipientName = workOrder.recipientName
  editForm.province = workOrder.province
  editForm.city = workOrder.city
  editForm.address1 = workOrder.address1
  editForm.address2 = workOrder.address2
  editForm.zipCode = workOrder.zipCode
  editForm.phone = workOrder.phone
  editForm.companyName = workOrder.companyName
  editForm.email = workOrder.email
  editOrderDialogVisible.value = true
}

function confirmEditOrder() {
  // 保存到 workOrder
  workOrder.recipientName = editForm.recipientName
  workOrder.province = editForm.province
  workOrder.city = editForm.city
  workOrder.address1 = editForm.address1
  workOrder.address2 = editForm.address2
  workOrder.zipCode = editForm.zipCode
  workOrder.phone = editForm.phone
  workOrder.companyName = editForm.companyName
  workOrder.email = editForm.email

  // 增加工单记录
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  workOrderRecords.value.unshift({
    time: now.replace(/\//g, '-'),
    operator: 'ADMIN',
    action: '修改订单',
    detail: `修改收件人地址：${editForm.recipientName}，${editForm.address1}，${editForm.city}，${editForm.province} ${editForm.zipCode}`,
    type: 'warning' as const,
    color: '#faad14',
    tagType: 'warning' as const,
  })

  editOrderDialogVisible.value = false
  currentStep.value = 1
  ElMessage.success('订单修改成功，请审核')
}

// ======================== 同意 / 驳回 ========================
function handleApprove() {
  ElMessageBox.confirm('确认同意该工单？工单将关闭完结。', '确认同意', { type: 'success' })
    .then(() => {
      const now = new Date().toLocaleString('zh-CN', { hour12: false })
      workOrderRecords.value.unshift({
        time: now.replace(/\//g, '-'),
        operator: 'ADMIN',
        action: '工单完结',
        detail: '工单已审核通过，关闭完结',
        type: 'success' as const,
        color: '#52c41a',
        tagType: 'success' as const,
      })
      currentStep.value = 3
      ElMessage.success('工单已关闭完结')
    })
    .catch(() => {})
}

function handleReject() {
  ElMessageBox.prompt('请输入驳回原因', '驳回工单', {
    type: 'warning',
    inputType: 'textarea',
    inputPlaceholder: '请输入驳回原因',
  })
    .then(({ value }) => {
      const now = new Date().toLocaleString('zh-CN', { hour12: false })
      workOrderRecords.value.unshift({
        time: now.replace(/\//g, '-'),
        operator: 'ADMIN',
        action: '驳回工单',
        detail: `工单已驳回，原因：${value || '驳回重新处理'}`,
        type: 'danger' as const,
        color: '#f5222d',
        tagType: 'danger' as const,
      })
      currentStep.value = 2
      ElMessage.warning('工单已驳回，请重新处理')
    })
    .catch(() => {})
}

// ======================== 放行 ========================
const releaseDialogVisible = ref(false)
const releaseForm = reactive({ reason: '', remark: '' })
function handleRelease() {
  releaseForm.reason = ''
  releaseForm.remark = ''
  releaseDialogVisible.value = true
}
function confirmRelease() {
  if (!releaseForm.reason) { ElMessage.warning('请选择放行原因'); return }
  ElMessage.success('工单已放行（模拟）')
  releaseDialogVisible.value = false
}

// ======================== 退回 ========================
const returnDialogVisible = ref(false)
const returnForm = reactive({ reason: '' })
function handleReturn() {
  returnForm.reason = ''
  returnDialogVisible.value = true
}
function confirmReturn() {
  if (!returnForm.reason.trim()) { ElMessage.warning('请填写退回原因'); return }
  ElMessage.success('工单已退回（模拟）')
  returnDialogVisible.value = false
}

// ======================== 弃件 ========================
const abandonDialogVisible = ref(false)
const abandonForm = reactive({ reason: '' })
function handleAbandon() {
  abandonForm.reason = ''
  abandonDialogVisible.value = true
}
function confirmAbandon() {
  if (!abandonForm.reason.trim()) { ElMessage.warning('请填写弃件原因'); return }
  ElMessage.success('工单已弃件（模拟）')
  abandonDialogVisible.value = false
}

// ======================== 仓库处理 ========================
const warehouseDialogVisible = ref(false)
const warehouseForm = reactive({ processType: '', remark: '' })
function handleWarehouseProcess() {
  warehouseForm.processType = ''
  warehouseForm.remark = ''
  warehouseDialogVisible.value = true
}
function confirmWarehouse() {
  if (!warehouseForm.processType) { ElMessage.warning('请选择处理类型'); return }
  ElMessage.success('仓库处理指令已下发（模拟）')
  warehouseDialogVisible.value = false
}

// ======================== 其他 ========================
function handleReset() {
  localStorage.removeItem(STORAGE_KEY)
  currentStep.value = 0
  workOrderRecords.value = [
    {
      time: '2026-08-09 05:43:45',
      operator: 'ADMIN',
      action: '创建工单',
      detail: '当前处理：创建工单',
      type: 'primary' as const,
      color: '#1677ff',
      tagType: '' as const,
    },
  ]
  ElMessage.success('已重置为初始状态')
}

function handleDownloadTemplate() {
  ElMessage.success(`开始下载「${workOrder.templateName}」（模拟）`)
}
</script>
