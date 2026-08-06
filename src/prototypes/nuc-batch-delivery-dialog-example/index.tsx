/**
 * @name 选择交货信息弹框
 * @mode axure
 * @desc NUC 批量下单 - 当产品代码错误导致无仓库时，增强提示 + 重新上传入口
 */

import { useState, useRef, useEffect } from 'react';
import './style.css';

/* ========================= 类型与数据 ========================= */

type Scenario = 'normal' | 'error';
type DeliveryMode = 'pickup' | 'self';

interface WarehouseOption {
  value: string;
  label: string;
  address?: string;
}

const WAREHOUSE_OPTIONS: WarehouseOption[] = [
  { value: 'WH-SZ-001', label: '深圳宝安国际仓 WH-SZ-001', address: '深圳市宝安区福永街道...' },
  { value: 'WH-GZ-002', label: '广州白云国际仓 WH-GZ-002', address: '广州市白云区人和镇...' },
  { value: 'WH-YW-003', label: '义乌国际仓 WH-YW-003', address: '义乌市北苑街道...' },
];

/* ========================= 主组件 ========================= */

export default function NucBatchDeliveryDialog() {
  const [scenario, setScenario] = useState<Scenario>('error');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('self');
  const [warehouse, setWarehouse] = useState<string>('');
  const [selectOpen, setSelectOpen] = useState(false);
  const [deliveryTime] = useState('2026-07-07 21:00');
  const [alipayDialogOpen, setAlipayDialogOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // 切换场景时重置
  useEffect(() => {
    setWarehouse('');
    setSelectOpen(false);
  }, [scenario]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showErrorHint = scenario === 'error';
  const isWarehouseValid = !!warehouse;

  const handleConfirm = () => {
    if (!isWarehouseValid) return;
  };

  return (
    <div className="nuc-bdd-page">
      <div className="nuc-bdd-header">
        <h1 className="nuc-bdd-title">
          选择交货信息弹框
          <span className="nuc-bdd-scenario-tag error" style={{ marginLeft: 12 }}>
            优化点：产品代码错误时增加引导
          </span>
        </h1>
        <p className="nuc-bdd-subtitle">
          NUC 批量下单第二步 · 系统按产品代码向 SPMS 查询交货仓库
        </p>
      </div>

      {/* 场景切换工具栏 */}
      <div className="nuc-bdd-toolbar">
        <span className="nuc-bdd-toolbar-label">演示场景：</span>
        <button
          className={`nuc-bdd-btn ${scenario === 'normal' ? 'nuc-bdd-btn-primary' : 'nuc-bdd-btn-default'}`}
          onClick={() => setScenario('normal')}
        >
          正常态（仓库有数据）
        </button>
        <button
          className={`nuc-bdd-btn ${scenario === 'error' ? 'nuc-bdd-btn-primary' : 'nuc-bdd-btn-default'}`}
          onClick={() => setScenario('error')}
        >
          异常态（仓库无数 → 重点演示）
        </button>
        <span className="nuc-bdd-toolbar-divider" />
        <button
          className="nuc-bdd-btn nuc-bdd-btn-primary"
          onClick={() => setAlipayDialogOpen(true)}
          style={{ background: '#1890ff', borderColor: '#1890ff' }}
        >
          支付宝提示弹框演示
        </button>
        <span className="nuc-bdd-toolbar-divider" />
        <span className="nuc-bdd-toolbar-label">
          当前：
          <span
            className="nuc-bdd-scenario-tag"
            style={{
              marginLeft: 6,
              background: scenario === 'normal' ? '#d1fae5' : '#fee2e2',
              color: scenario === 'normal' ? '#047857' : '#b91c1c',
            }}
          >
            {scenario === 'normal' ? '正常态' : '异常态'}
          </span>
        </span>
      </div>

      {/* 弹框预览画布 */}
      <div className="nuc-bdd-canvas">
        <div className="nuc-bdd-modal" role="dialog" aria-labelledby="modal-title">
          {/* Header */}
          <div className="nuc-bdd-modal-header">
            <h2 className="nuc-bdd-modal-title" id="modal-title">
              交货信息
            </h2>
            <button className="nuc-bdd-modal-close" aria-label="关闭">
              ×
            </button>
          </div>

          {/* Body */}
          <div className="nuc-bdd-modal-body">
            {/* 交货方式 */}
            <div className="nuc-bdd-field">
              <label className="nuc-bdd-field-label">
                <span className="nuc-bdd-required">*</span>
                交货方式
              </label>
              <div className="nuc-bdd-radio-group">
                <label
                  className={`nuc-bdd-radio ${deliveryMode === 'pickup' ? 'selected' : ''}`}
                  onClick={() => setDeliveryMode('pickup')}
                >
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={deliveryMode === 'pickup'}
                    onChange={() => setDeliveryMode('pickup')}
                  />
                  云途揽收
                </label>
                <label
                  className={`nuc-bdd-radio ${deliveryMode === 'self' ? 'selected' : ''}`}
                  onClick={() => setDeliveryMode('self')}
                >
                  <input
                    type="radio"
                    name="deliveryMode"
                    checked={deliveryMode === 'self'}
                    onChange={() => setDeliveryMode('self')}
                  />
                  客户自送
                </label>
              </div>
            </div>

            {/* 交货仓库 */}
            <div className="nuc-bdd-field">
              <label className="nuc-bdd-field-label">
                <span className="nuc-bdd-required">*</span>
                交货仓库
              </label>
              <div
                ref={selectRef}
                className={`nuc-bdd-select ${showErrorHint ? 'error' : ''} ${selectOpen ? 'open' : ''}`}
                onClick={() => !showErrorHint && setSelectOpen(!selectOpen)}
              >
                <span style={{ color: warehouse ? '#374151' : '#9ca3af' }}>
                  {warehouse
                    ? WAREHOUSE_OPTIONS.find((o) => o.value === warehouse)?.label
                    : '请选择'}
                </span>
                <span className="nuc-bdd-select-arrow">▼</span>
                {selectOpen && !showErrorHint && (
                  <div className="nuc-bdd-select-dropdown">
                    {WAREHOUSE_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className={`nuc-bdd-select-option ${warehouse === opt.value ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setWarehouse(opt.value);
                          setSelectOpen(false);
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 【新增】错误提示卡片 */}
              {showErrorHint && (
                <div className="nuc-bdd-alert">
                  <div className="nuc-bdd-alert-icon">!</div>
                  <div className="nuc-bdd-alert-content">
                    <p className="nuc-bdd-alert-title">未查询到仓库信息</p>
                    <p className="nuc-bdd-alert-desc">
                      检测到上传文件里的产品代码不正确，暂未匹配到仓库信息，请调整内容后重新上传。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 交货时间 */}
            <div className="nuc-bdd-field">
              <label className="nuc-bdd-field-label">
                <span className="nuc-bdd-required">*</span>
                交货时间
              </label>
              <div className="nuc-bdd-date-input">{deliveryTime}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="nuc-bdd-modal-footer">
            <button className="nuc-bdd-btn nuc-bdd-btn-default">取消</button>
            <button
              className="nuc-bdd-btn nuc-bdd-btn-primary"
              disabled={!isWarehouseValid}
              onClick={handleConfirm}
              title={!isWarehouseValid ? '请先选择交货仓库' : ''}
            >
              确定
            </button>
          </div>
        </div>
      </div>

      {/* ===== 支付宝提示弹框 ===== */}
      {alipayDialogOpen && (
        <div className="nuc-bdd-overlay" onClick={() => setAlipayDialogOpen(false)}>
          <div
            className="nuc-bdd-alipay-modal"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nuc-bdd-alipay-header">提示</div>
            <div className="nuc-bdd-alipay-body">
              <p>支付宝支付暂不支持微信浏览器，请切换浏览器后重试</p>
            </div>
            <div className="nuc-bdd-alipay-footer">
              <button
                className="nuc-bdd-btn nuc-bdd-btn-alipay"
                onClick={() => setAlipayDialogOpen(false)}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}