import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Radio, Select, Space, Tag, Upload, message } from 'antd';
import { CloseOutlined, LoadingOutlined, PictureOutlined, RobotOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api } from '../api';
import { aiRunStore } from '../aiRunStore';
import { getAiModel, setAiModelOptions } from '../aiModelStore';
import {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  canPickModel,
  fileToDataUrl,
  imageBlockReason,
  imagePromptBlock,
  type AttachedImage,
} from '../aiVision';
import type { AiModelOption, CliStatus, CreateEntryOptions } from '../types';

/**
 * 新建原型弹框：支持两种方式，由用户自行选择——
 *  ① 模板创建：生成骨架文件，不依赖任何 CLI（默认，未安装 CLI 的用户照常可用）；
 *  ② AI 生成：上传/粘贴设计稿图片 + 需求描述，由 AI CLI 直接写出原型页面。
 *
 * 组件库/技术栈必须由用户在这里选择（框架不替用户决定），
 * 选中的 engine/ui 会写进 proto.config.json，决定预览时挂载哪个入口与主题。
 */

type StackKey = 'react-antd' | 'vue-antd' | 'vue-element' | 'react-client';

interface StackDef {
  key: StackKey;
  label: string;
  engine: 'react' | 'vue';
  ui: string;
  /** 入口文件：AI 必须写这个文件，否则预览挂载不到 */
  entry: string;
  prompt: string;
}

const STACKS: StackDef[] = [
  {
    key: 'react-antd',
    label: 'React + Ant Design 5',
    engine: 'react',
    ui: '',
    entry: 'index.tsx',
    prompt: 'React 18 + TypeScript，UI 用 Ant Design 5（antd 组件 + @ant-design/icons，均已内置，无需安装）',
  },
  {
    key: 'vue-antd',
    label: 'Vue 3 + Ant Design Vue',
    engine: 'vue',
    ui: 'ant-design-vue',
    entry: 'index.vue',
    prompt: 'Vue 3（<script setup> 写法）+ ant-design-vue（已内置，无需安装），样式写在同目录 style.css',
  },
  {
    key: 'vue-element',
    label: 'Vue 3 + Element Plus',
    engine: 'vue',
    ui: 'element-plus',
    entry: 'index.vue',
    prompt: 'Vue 3（<script setup> 写法）+ Element Plus（已内置，无需安装），样式写在同目录 style.css',
  },
  {
    key: 'react-client',
    label: 'React + 客户端样式（WinForms）',
    engine: 'react',
    ui: 'client',
    entry: 'index.tsx',
    prompt:
      'React 18 + 框架内置的客户端组件库（从 admin/src/components/client 引入 ClientToolbar / ClientFilterPanel / ' +
      'ClientTable / ClientPager / ClientWindow / ClientForm），proto.config.json 已声明 "ui": "client"，' +
      '框架会自动注入 .client-theme 样式与外壳，不要引入其它 UI 库',
  },
];

/** 记忆用户上次是否选了 AI 生成，下次打开沿用 */
const MODE_KEY = 'ph_create_ai_mode';

/** 由标题生成 kebab-case 目录名（中文标题走时间戳兜底，避免中文目录导致预览 404） */
function autoDirName(t: string): string {
  const base = t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return base || `proto-${Date.now().toString(36)}`;
}

/** 目录名只允许字母/数字/中划线/下划线/中文，与后端校验保持一致 */
const DIR_NAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5-]+$/;

export default function CreatePrototypeModal(props: {
  open: boolean;
  onCancel: () => void;
  /** 落盘骨架目录（复用 App 的创建逻辑：提示 + 刷新列表） */
  onCreate: (name: string, title: string, options: CreateEntryOptions) => Promise<void>;
  /** 创建完成回传目录名，用于自动选中新原型 */
  onCreated?: (name: string) => void;
}) {
  const { open } = props;

  const [mode, setMode] = useState<'template' | 'ai'>('template');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [stack, setStack] = useState<StackKey>('react-antd');
  const [requirement, setRequirement] = useState('');
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [status, setStatus] = useState<Record<string, CliStatus>>({});
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [cli, setCli] = useState('');
  const [model, setModel] = useState('');
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [result, setResult] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const cliOptions = useMemo(
    () =>
      Object.entries(status)
        .filter(([, v]) => v.available)
        .map(([key, v]) => ({ value: key, label: v.authorized ? v.label : `${v.label}（未授权）`, disabled: !v.authorized })),
    [status],
  );
  const aiReady = cliOptions.some((o) => !o.disabled);
  const stackDef = STACKS.find((s) => s.key === stack) || STACKS[0];
  const imageHint = imageBlockReason(cli, status[cli]?.label, model, models);
  const imageOk = imageHint === '';
  const needModelPicker = canPickModel(cli);

  // 打开时拉一次 CLI/模型状态：决定 AI 方式是否可用、默认用哪个 CLI 与多模态模型
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
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
        // 图片场景必须用多模态模型：优先沿用全局已选（若支持图片），否则挑第一个支持图片的
        const global = getAiModel();
        const prefer = s.models.find((m) => m.id === global && m.vision) || s.models.find((m) => m.vision);
        setModel((cur) => (cur && s.models.some((m) => m.id === cur) ? cur : prefer?.id || ''));
        if (localStorage.getItem(MODE_KEY) === '1' && authorized.length) setMode('ai');
      })
      .catch(() => {
        if (!cancelled) setStatusLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 关闭时重置表单；仍在运行时先中止子进程
  useEffect(() => {
    if (open) return;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setTitle('');
    setName('');
    setNameEdited(false);
    setStack('react-antd');
    setRequirement('');
    setImages([]);
    setRunning(false);
    setStreaming('');
    setResult('');
    setElapsed(0);
    setError('');
    setCreating(false);
  }, [open]);

  // 生成中自动滚到输出底部
  useEffect(() => {
    const el = outputRef.current;
    if (el && running) el.scrollTop = el.scrollHeight;
  }, [streaming, running]);

  const switchMode = (v: 'template' | 'ai') => {
    setMode(v);
    setError('');
    localStorage.setItem(MODE_KEY, v === 'ai' ? '1' : '0');
  };

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!nameEdited) setName(autoDirName(v));
  };

  const addImages = async (files: File[]) => {
    const picked = files.filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;
    if (!imageOk) {
      message.warning(imageHint || '当前模型不支持图片输入');
      return;
    }
    const remain = MAX_IMAGES - images.length;
    if (remain <= 0) {
      message.warning(`一次最多添加 ${MAX_IMAGES} 张图片`);
      return;
    }
    const tooBig = picked.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      message.warning(`图片「${tooBig.name}」超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB，请压缩后再添加`);
      return;
    }
    setUploading(true);
    try {
      // 图片必须先落盘成真实文件（浏览器无法直接写本地文件），AI 才能用 Read 工具读图
      for (const f of picked.slice(0, remain)) {
        const dataUrl = await fileToDataUrl(f);
        const { path } = await api.aiUploadImage(dataUrl, f.name);
        setImages((cur) => (cur.length >= MAX_IMAGES ? cur : [...cur, { path, url: dataUrl, name: f.name }]));
      }
    } catch (e: any) {
      message.error(e?.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const buildPrompt = (n: string, stackChosen: StackDef) => {
    const dir = `src/prototypes/${n}/`;
    return [
      '当前项目是本地原型工作台（Hatch + Vite）。请新建一个原型页面。',
      [
        `原型名称：${title.trim()}`,
        `目标目录：${dir}（骨架文件已创建，直接覆盖其中的示例内容即可）`,
        `技术栈：${stackChosen.prompt}`,
        `入口文件：${stackChosen.entry}（固定，不要改名为其它文件名）`,
      ].join('\n'),
      requirement.trim() ? `需求说明：\n${requirement.trim()}` : '',
      imagePromptBlock(images),
      [
        '实现要求：',
        '1. 有参考图时严格还原图中的界面（布局结构、字段、按钮、表格列、状态与颜色、文案）；没有参考图时按需求说明实现',
        '2. 做成可交互原型：筛选、按钮、弹框、分页等有基本交互与假数据；数据写在前端常量里，不要请求后端接口',
        '3. 只在该原型目录内创建/修改文件，不要改动其它原型或框架代码',
        '4. 动手前先阅读项目根 README.md 中与原型开发相关的说明，并参考 src/prototypes/ 下已有原型的代码风格',
        `5. 更新同目录 spec.md：首行保持 "# ${title.trim()}"，并在「功能概述」下用 1-2 句话说明实现内容`,
        '6. 完成后用 3-5 句话总结你实现了什么，不要贴大段代码',
      ].join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const runAi = async (n: string) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setError('');
    setResult('');
    setStreaming('');
    setElapsed(0);
    aiRunStore.set(true);
    try {
      const res = await api.aiExecute(
        cli,
        buildPrompt(n, stackDef),
        (chunk) => setStreaming((cur) => cur + chunk),
        controller.signal,
        needModelPicker ? model : undefined,
        undefined,
        (sec) => setElapsed(sec),
      );
      setResult(res.output || '');
      if (res.timedOut) message.warning('AI 执行超时，原型可能未完成，可再次生成或手动调整');
      else message.success('AI 已生成原型');
    } catch (e: any) {
      setError(e?.message || 'AI 执行失败');
    } finally {
      setRunning(false);
      aiRunStore.set(false);
      controllerRef.current = null;
    }
  };

  const handleCreate = async () => {
    const t = title.trim();
    const n = (name.trim() || autoDirName(t)).trim();
    if (!t) {
      message.warning('请输入显示标题');
      return;
    }
    if (!n) {
      message.warning('请输入目录名');
      return;
    }
    if (!DIR_NAME_RE.test(n)) {
      message.warning('目录名只能包含字母、数字、中文、中划线与下划线');
      return;
    }
    if (mode === 'ai' && images.length && !imageOk) {
      message.warning(imageHint);
      return;
    }
    const options: CreateEntryOptions = { engine: stackDef.engine, ui: stackDef.ui };
    setCreating(true);
    try {
      await props.onCreate(n, t, options);
      props.onCreated?.(n);
    } catch {
      setCreating(false);
      return;
    }
    setCreating(false);
    if (mode === 'template') {
      props.onCancel();
      return;
    }
    void runAi(n);
  };

  const stopAi = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
    aiRunStore.set(false);
    message.info('已停止生成，已写入的文件会保留');
  };

  const handleCancel = () => {
    if (running) {
      Modal.confirm({
        title: 'AI 正在生成原型',
        content: '确定要停止生成并关闭吗？已写入的文件会保留。',
        okText: '停止并关闭',
        cancelText: '继续生成',
        onOk: () => {
          stopAi();
          props.onCancel();
        },
      });
      return;
    }
    props.onCancel();
  };

  const done = !running && (!!result || !!error);
  const canSubmit = !creating && !running && !!title.trim() && (mode === 'template' ? true : aiReady);

  const footer = running
    ? [
        <Button key="stop" danger icon={<StopOutlined />} onClick={stopAi}>
          停止生成
        </Button>,
      ]
    : done
      ? [
          <Button key="close" type="primary" onClick={props.onCancel}>
            完成
          </Button>,
        ]
      : [
          <Button key="cancel" onClick={handleCancel} disabled={creating}>
            取消
          </Button>,
          <Button
            key="ok"
            type="primary"
            icon={mode === 'ai' ? <RobotOutlined /> : <ThunderboltOutlined />}
            loading={creating}
            disabled={!canSubmit}
            onClick={handleCreate}
          >
            {mode === 'ai' ? '用 AI 生成' : '创建原型'}
          </Button>,
        ];

  return (
    <Modal title="新建原型" open={open} width={820} maskClosable={false} onCancel={handleCancel} footer={footer}>
      <div className="ph-create-body">
        <div className="ph-create-field">
          <div className="ph-create-label">显示标题</div>
          <Input
            placeholder="如：B2B 订单列表"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={running || creating}
          />
        </div>

        <div className="ph-create-field">
          <div className="ph-create-label">目录名</div>
          <Input
            placeholder="根据标题自动生成，可修改（英文/中划线，如 b2b-order-list）"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameEdited(true);
            }}
            disabled={running || creating}
          />
        </div>

        <div className="ph-create-field">
          <div className="ph-create-label">创建方式</div>
          <Radio.Group
            value={mode}
            onChange={(e) => switchMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            disabled={running || creating}
          >
            <Radio.Button value="template">
              <ThunderboltOutlined /> 模板创建
            </Radio.Button>
            <Radio.Button value="ai" disabled={!aiReady}>
              <RobotOutlined /> AI 生成（上传设计稿）
            </Radio.Button>
          </Radio.Group>
          <div className="ph-create-tip">
            模板创建不依赖任何 CLI，先把目录骨架建好；装了 CLI 后可切到 AI 生成，由 AI 直接写出页面。
          </div>
          {statusLoaded && !aiReady && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message="未检测到可用的 AI CLI，本次将使用模板创建"
              description="可先在「AI 助手」面板按引导安装并授权 CodeBuddy CLI，之后回到这里即可用图片直接生成原型。"
            />
          )}
        </div>

        {mode === 'ai' && (
          <>
            <div className="ph-create-field">
              <div className="ph-create-label">组件库 / 技术栈</div>
              <Select
                value={stack}
                onChange={(v) => setStack(v)}
                style={{ width: '100%' }}
                disabled={running || creating}
                options={STACKS.map((s) => ({ value: s.key, label: `${s.label}（入口 ${s.entry}）` }))}
              />
            </div>

            <div className="ph-create-field">
              <div className="ph-create-label">参考图（设计稿截图）</div>
              <div
                className={`ph-create-drop${dropActive ? ' active' : ''}`}
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  void addImages(Array.from(e.dataTransfer?.files || []));
                }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
                  if (files.length) {
                    e.preventDefault();
                    void addImages(files);
                  }
                }}
              >
                <Space>
                  <Upload
                    showUploadList={false}
                    multiple
                    accept="image/*"
                    disabled={running || creating || !imageOk}
                    beforeUpload={(file) => {
                      void addImages([file as File]);
                      return false;
                    }}
                  >
                    <Button icon={<PictureOutlined />} loading={uploading} disabled={running || creating || !imageOk}>
                      选择图片
                    </Button>
                  </Upload>
                  <span className="ph-create-tip">也可以直接把截图拖进来，或按 Ctrl+V 粘贴</span>
                </Space>
                {!!images.length && (
                  <div className="ph-ai-attach-list" style={{ marginTop: 8 }}>
                    {images.map((im) => (
                      <div className="ph-ai-attach-item" key={im.path} title={im.name}>
                        <img src={im.url} alt={im.name} />
                        <button
                          type="button"
                          className="ph-ai-attach-del"
                          disabled={running}
                          onClick={() => setImages((cur) => cur.filter((x) => x.path !== im.path))}
                        >
                          <CloseOutlined />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={`ph-ai-attach-hint${images.length && !imageOk ? ' blocked' : ''}`}>
                  {images.length && !imageOk
                    ? imageHint
                    : `最多 ${MAX_IMAGES} 张，单张不超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB；图片会先落盘再由 AI 读取。`}
                </div>
              </div>
            </div>

            <div className="ph-create-field">
              <div className="ph-create-label">需求说明（可选）</div>
              <Input.TextArea
                rows={3}
                placeholder="补充图片里看不出的要求，如：列表默认按创建时间倒序、状态列用彩色标签、详情用抽屉而不是弹框"
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                disabled={running || creating}
              />
            </div>

            <div className="ph-create-field">
              <div className="ph-create-label">执行方式</div>
              <Space wrap>
                <Select
                  value={cli || undefined}
                  onChange={(v) => setCli(v)}
                  style={{ width: 220 }}
                  placeholder="选择 CLI"
                  disabled={running || creating}
                  options={cliOptions}
                />
                {needModelPicker && (
                  <Select
                    value={model || undefined}
                    onChange={(v) => setModel(v)}
                    style={{ width: 300 }}
                    placeholder="选择模型"
                    disabled={running || creating}
                    options={models.map((m) => ({
                      value: m.id,
                      label: m.vision ? `${m.label}（多模态）` : m.label,
                    }))}
                  />
                )}
                {needModelPicker && !model && <Tag color="orange">未选模型时无法带图片</Tag>}
              </Space>
            </div>
          </>
        )}

        {(running || done) && (
          <div className="ph-create-field">
            <div className="ph-create-label">
              {running ? `AI 正在生成原型${elapsed ? `（已用 ${elapsed}s）` : ''}` : '生成结果'}
            </div>
            <div className="ph-create-output" ref={outputRef}>
              {running ? streaming || 'AI 正在处理…' : result || error}
            </div>
            {!!error && <Alert type="error" showIcon style={{ marginTop: 8 }} message="生成失败" description={error} />}
            {!!result && !running && (
              <div className="ph-create-tip">
                已写入 <code>src/prototypes/{name.trim()}/</code>，关闭弹框即可查看；预览不对时可在 AI 助手里继续追加要求。
              </div>
            )}
          </div>
        )}

        {running && (
          <div className="ph-create-tip">
            <LoadingOutlined /> 生成期间请勿关闭弹框；如需中断可点「停止生成」。
          </div>
        )}
      </div>
    </Modal>
  );
}
