import type { AiModelOption } from './types';

/**
 * AI 图片输入的共享规则。
 *
 * 浏览器无法直接写本地文件，所以图片要先转成 dataURL 交给服务端落盘，
 * AI 再用 Read 工具去读那个真实文件——纯文本模型即使拿到路径也"看不见"图。
 * AI 面板与「AI 新建原型」弹框共用这里的数量/体积上限、模型能力闸门与 prompt 措辞，
 * 避免同一套规则在两处实现后逐渐漂移。
 */

/** 已添加的待发送图片：url 用于缩略图预览，path 是落盘后的相对路径（交给 AI 读取） */
export interface AttachedImage {
  path: string;
  url: string;
  name: string;
}

/** 单次最多附加的图片数量：过多会让 prompt 变长且拖慢执行 */
export const MAX_IMAGES = 6;
/** 单张图片体积上限（与服务端 MAX_IMAGE_BYTES 保持一致） */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** File → dataURL：交给服务端落盘，浏览器无法直接写本地文件 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

/** 只有 codebuddy/workbuddy 支持 --model，才能鉴别当前模型是否多模态 */
export function canPickModel(cli: string): boolean {
  return cli === 'codebuddy' || cli === 'workbuddy';
}

/**
 * 图片输入闸门：返回空串 = 当前模型支持图片；否则返回禁用原因。
 * 纯文本模型即使拿到图片路径也"看不见"（读到的是无意义的二进制），
 * 所以必须在粘贴/上传这一步就按模型能力拦掉，而不是等 AI 给出瞎猜的结果。
 */
export function imageBlockReason(
  cli: string,
  cliLabel: string | undefined,
  model: string,
  models: AiModelOption[],
): string {
  if (!cli) return '请先选择 CLI 后再添加图片';
  if (!canPickModel(cli)) {
    return `${cliLabel || '当前 CLI'} 无法鉴别模型是否支持图片，请切换到 CodeBuddy 并选择多模态模型`;
  }
  if (!model) {
    return '图片输入需先在上方选择多模态模型（如 GLM 5V Turbo）：“自动”模式无法确定模型能力';
  }
  const hit = models.find((m) => m.id === model);
  if (hit?.vision) return '';
  return `${hit?.label || model} 不支持图片输入，请先切换为多模态模型`;
}

/** 图片已落盘成真实文件：必须让 AI 先用 Read 工具看图，否则它只会看到一串路径 */
export function imagePromptBlock(images: AttachedImage[]): string {
  if (!images.length) return '';
  return (
    `用户提供了 ${images.length} 张参考图片，请先用 Read 工具查看以下图片文件（支持 png/jpg/gif/webp），` +
    `理解图片内容后再执行指令：\n${images.map((im, i) => `${i + 1}. ${im.path}`).join('\n')}`
  );
}
