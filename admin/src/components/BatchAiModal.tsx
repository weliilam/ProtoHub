import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Space, Tag, message } from 'antd';
import { CloseOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api } from '../api';
import { getAiModel, setAiModelOptions } from '../aiModelStore';
import { requestBatchNotifyPermission, refreshAiBatch } from '../aiBatchStore';
import { canPickModel } from '../aiVision';
import type { AiModelOption, BatchJob, CliStatus } from '../types';

/**
 * 批量 AI 指令弹框：对侧边栏里勾选的 N 个原型页面下一条统一指令。
 *
 * 生成 1 个 job / N 个子任务，服务端串行执行（同一时刻只有一个 CLI 在改代码），
 * 每个页面单独记录改动文件与改动前的基线快照，跑完可在批量任务面板里逐个回滚。
 */

export interface BatchTarget {
  name: string;
  title: string;
}

const EXAMPLES = [
  '给这几个列表页统一加上「批量导出」按钮，点击后导出当前筛选结果的 Excel',
  '统一把表格上方的筛选区改成两行布局，并补上「重置」按钮',
  '给每个页面底部的分页统一改成每页 20 条，并显示总条数',
];

export default function BatchAiModal(props: {
  open: boolean;
  targets: BatchTarget[];
  onCancel: () => void;
  /** 在弹框里剔除某个页面（与侧边栏勾选联动） */
  onRemoveTarget: (name: string) => void;
  onCreated: (job: BatchJob) => void;
}) {
  const { open, targets } = props;

  const [status, setStatus] = useState<Record<string, CliStatus>>({});
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [cli, setCli] = useState('');
  const [model, setModel] = useState('');
  const [instruction, setInstruction] = useState('');
  const [etaSec, setEtaSec] = useState(0);
  const [creating, setCreating] = useState(false);

  const cliOptions = useMemo(
    () =>
      Object.entries(status)
        .filter(([, v]) => v.available)
        .map(([key, v]) => ({
          value: key,
          label: v.authorized ? v.label : `${v.label}（未授权）`,
          disabled: !v.authorized,
        })),
    [status],
  );
  const aiReady = cliOptions.some((o) => !o.disabled);
  const needModelPicker = canPickModel(cli);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .aiStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s.clis);
        setModels(s.models);
        setAiModelOptions(s.models);
        setStatusLoaded(true);
        const authorized = Object.entries(s.clis).filter(([, v]) => v.available && v.authorized);
        const pick = authorized.find(([k]) => k === 'codebuddy')?.[0] || authorized[0]?.[0] || '';
        setCli((cur) => cur || pick);
        const global = getAiModel();
        setModel((cur) => (cur && s.models.some((m) => m.id === cur) ? cur : global || ''));
      })
      .catch(() => {
        if (!cancelled) setStatusLoaded(true);
      });
    // 单页面历史中位耗时 → 估算整批串行总时长（仅用于给用户一个心理预期）
    api
      .aiTask()
      .then((t) => {
        if (!cancelled) setEtaSec(t.etaSec || 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setInstruction('');
    setCreating(false);
  }, [open]);

  const perPageSec = etaSec > 0 ? etaSec : 240;
  const totalMin = Math.max(1, Math.round((perPageSec * Math.max(1, targets.length)) / 60));

  const submit = async () => {
    const text = instruction.trim();
    if (!targets.length) {
      message.warning('请至少勾选一个原型页面');
      return;
    }
    if (!text) {
      message.warning('请输入要执行的操作');
      return;
    }
    if (!cli) {
      message.warning('请选择要使用的 AI CLI');
      return;
    }
    setCreating(true);
    try {
      const { job } = await api.aiBatchCreate({
        cli,
        model: needModelPicker ? model || null : null,
        prompt: text,
        targets: targets.map((t) => ({ name: t.name, title: t.title })),
      });
      // 用户去干别的时也能收到浏览器通知
      requestBatchNotifyPermission();
      void refreshAiBatch();
      message.success(`已创建批量任务：${job.items.length} 个页面将依次执行`);
      props.onCreated(job);
    } catch (e: any) {
      message.error(e?.message || '创建批量任务失败');
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = !creating && targets.length > 0 && !!instruction.trim() && !!cli && aiReady;

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined />
          批量 AI 修改
          <Tag color="blue">{targets.length} 个页面</Tag>
        </Space>
      }
      open={open}
      width={760}
      maskClosable={false}
      onCancel={props.onCancel}
      footer={[
        <Button key="cancel" onClick={props.onCancel} disabled={creating}>
          取消
        </Button>,
        <Button
          key="ok"
          type="primary"
          icon={<RobotOutlined />}
          loading={creating}
          disabled={!canSubmit}
          onClick={submit}
        >
          开始执行
        </Button>,
      ]}
    >
      <div className="ph-create-body">
        <div className="ph-create-field">
          <div className="ph-create-label">目标页面（{targets.length}）</div>
          <div className="ph-batch-targets">
            {targets.map((t) => (
              <Tag
                key={t.name}
                closable={!creating}
                onClose={(e) => {
                  e.preventDefault();
                  props.onRemoveTarget(t.name);
                }}
                closeIcon={<CloseOutlined />}
              >
                {t.title}
                <span className="ph-batch-target-path">{t.name}</span>
              </Tag>
            ))}
            {!targets.length && <span className="ph-create-tip">还没有勾选页面，请先在左侧列表里勾选</span>}
          </div>
          <div className="ph-create-tip">
            每个页面都会单独执行一次，约束在各自目录 <code>src/prototypes/&lt;name&gt;/</code> 内，不会互相影响。
          </div>
        </div>

        <div className="ph-create-field">
          <div className="ph-create-label">操作指令</div>
          <Input.TextArea
            rows={4}
            placeholder="描述要对这些页面统一做的改动，例如：给这几个列表页统一加上批量导出按钮"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={creating}
            maxLength={2000}
            showCount
          />
          <div className="ph-batch-examples">
            {EXAMPLES.map((ex) => (
              <Tag
                key={ex}
                className="ph-batch-example"
                onClick={() => {
                  if (!creating) setInstruction(ex);
                }}
              >
                {ex}
              </Tag>
            ))}
          </div>
        </div>

        <div className="ph-create-field">
          <div className="ph-create-label">执行方式</div>
          <Space wrap>
            <Select
              value={cli || undefined}
              onChange={(v) => setCli(v)}
              style={{ width: 220 }}
              placeholder="选择 CLI"
              disabled={creating}
              options={cliOptions}
            />
            {needModelPicker && (
              <Select
                value={model || undefined}
                onChange={(v) => setModel(v)}
                style={{ width: 280 }}
                placeholder="选择模型"
                disabled={creating}
                options={models.map((m) => ({ value: m.id, label: m.label }))}
              />
            )}
          </Space>
        </div>

        {statusLoaded && !aiReady && (
          <Alert
            type="warning"
            showIcon
            message="未检测到可用的 AI CLI"
            description="请先在「AI 助手」面板按引导安装并授权 CLI，然后再使用批量修改。"
          />
        )}

        <Alert
          type="info"
          showIcon
          message={`串行执行：${targets.length} 个页面依次处理，预计约 ${totalMin} 分钟`}
          description="执行期间只有一个 AI 在改代码；每个页面开始前会自动记录一次快照，跑完可逐个「一键回滚」。可以关掉这个弹框先去忙别的，全部结束后会发浏览器通知。"
        />
      </div>
    </Modal>
  );
}
