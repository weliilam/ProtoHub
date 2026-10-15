import { Button, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { formatDuration } from '../aiServerTask';
import type { BatchJob } from '../types';

/**
 * 批量任务结束后的站内汇总提示（右下角浮层）。
 *
 * 配合浏览器通知使用：用户去干别的回来时，一眼能看到"这批改了几个页面、
 * 成功几个失败几个、共动了多少文件、耗时多久"，点「查看详情」打开批量任务面板
 * 就能逐个页面看改动、回滚或重试失败项。
 */
export default function BatchDoneNotice(props: {
  job: BatchJob;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { job } = props;
  const s = job.summary;
  const failed = s?.failed ?? 0;

  return (
    <div className="ph-batch-notice">
      <div className="ph-batch-notice-head">
        <span className="ph-batch-notice-title">
          {failed > 0 ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
          批量任务已结束
        </span>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={props.onClose} />
      </div>
      <div className="ph-batch-notice-body">
        <div className="ph-batch-notice-instruction">「{job.instruction}」</div>
        {s ? (
          <div className="ph-batch-notice-stats">
            <span>
              共 {s.total} 个页面：成功 <b style={{ color: '#52c41a' }}>{s.done}</b>
              {s.failed > 0 && (
                <>
                  、失败 <b style={{ color: '#ff4d4f' }}>{s.failed}</b>
                </>
              )}
              {s.cancelled > 0 && <>、取消 {s.cancelled}</>}
            </span>
            <span>改动 {s.files} 个文件 · 耗时 {formatDuration(s.elapsedSec)}</span>
          </div>
        ) : (
          <div className="ph-batch-notice-stats">任务已全部处理完毕</div>
        )}
      </div>
      <div className="ph-batch-notice-footer">
        <Space>
          <Button size="small" type="primary" onClick={props.onOpen}>
            查看详情
          </Button>
          <Button size="small" onClick={props.onClose}>
            知道了
          </Button>
        </Space>
      </div>
    </div>
  );
}
