import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname } from './utils';

/**
 * 源码特征索引：扫描原型目录源码（.vue/.tsx/.jsx/.ts/.js），提取弹窗/抽屉标题、
 * 表格列 title、按钮文字、表单 placeholder 等特征，每条记录「文件+行号+代码原文+所属容器」。
 * 批注点选元素时用「容器+类型+文字」打分匹配，直接给出源码精确位置。
 * 只读源码、不写回、不影响 git 快照；按 mtime 指纹缓存，改动后才重建。
 */

export interface SourceEntry {
  file: string;
  line: number;
  code: string;
  /** element = 运行时溯源（React fiber 坐标）得到的元素位置 */
  kind: 'modal' | 'drawer' | 'card' | 'column' | 'button' | 'menu' | 'link' | 'field' | 'tab' | 'element';
  label: string;
  container: string;
}

interface IndexResult {
  key: string;
  entries: SourceEntry[];
}

/** 带匹配分数的索引条目；loose 表示是放宽约束后才命中的，仅供参考 */
type ScoredEntry = SourceEntry & { score: number; loose?: boolean };

const cache = new Map<string, IndexResult>();
const SOURCE_EXTS = ['.vue', '.tsx', '.jsx', '.ts', '.js', '.html'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'videos']);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of items) {
      if (IGNORE_DIRS.has(it.name)) continue;
      const p = path.join(d, it.name);
      if (it.isDirectory()) walk(p);
      else if (SOURCE_EXTS.includes(path.extname(it.name).toLowerCase())) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** 标签内取属性：兼容 :title="'x'" / :title="x" / title="x" / title='x' */
function attrValue(inner: string, name: string): string | undefined {
  let m = inner.match(new RegExp(`:\\s*${name}\\s*=\\s*['"]'([^'"]*)'['"]`));
  if (m) return m[1];
  m = inner.match(new RegExp(`:\\s*${name}\\s*=\\s*['"]([^'"{}]{1,40})['"]`));
  if (m) return m[1].trim();
  m = inner.match(new RegExp(`\\b${name}\\s*=\\s*['"]([^'"]{1,60})['"]`));
  if (m) return m[1].trim();
  m = inner.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s/>]{1,30})`));
  if (m) return m[1].trim();
  return undefined;
}

function matchBracket(content: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < content.length; i++) {
    const c = content[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function offsetOfLine(content: string, lineNo: number): number {
  let off = 0;
  for (let l = 1; l < lineNo; l++) {
    const idx = content.indexOf('\n', off);
    if (idx < 0) break;
    off = idx + 1;
  }
  return off;
}

function lineAt(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

const OPEN_RULES: { re: RegExp; kind: SourceEntry['kind']; labelKind: string }[] = [
  { re: /<(a-modal|Modal|el-dialog)\b/i, kind: 'modal', labelKind: '弹窗' },
  { re: /<(a-drawer|Drawer|el-drawer)\b/i, kind: 'drawer', labelKind: '抽屉' },
  { re: /<(a-card|Card|el-card)\b/i, kind: 'card', labelKind: '卡片' },
];
const CLOSE_CONTAINER_RE = /<\/(a-modal|Modal|el-dialog|a-drawer|Drawer|el-drawer|a-card|Card|el-card)>/i;
const OPEN_TAB_RE = /<(a-tab-pane|el-tab-pane|TabPane)\b([^>]*)>/i;
const CLOSE_TAB_RE = /<\/(a-tab-pane|el-tab-pane|TabPane)>/i;

/**
 * React antd 的 Tabs 常用数组配置：items={[{ key: 'x', label: '平台IOSS号', children: … }]}，
 * 没有可识别的 JSX 页签标签，靠「key + label 相邻」这一结构特征识别页签名。
 * 只认 label:（冒号）形式，避免误命中 JSX 属性 label="xxx"（那通常是表单项标签）。
 */
const TAB_ITEM_LABEL_RE = /\{\s*key\s*:\s*['"][^'"]*['"]\s*,\s*label\s*:\s*['"]([^'"]{1,30})['"]/g;

/**
 * 跨行标签匹配（按钮 / 菜单项 / 链接）。
 * 原来按行正则要求开闭标签在同一行，带图标或换行的按钮会被整条漏掉。
 */
const GLOBAL_TEXT_RULES: { re: RegExp; kind: SourceEntry['kind']; group: number }[] = [
  { re: /<(a-button|el-button|Button|button)\b([\s\S]{0,200}?)>([\s\S]{0,120}?)<\/\1>/gi, kind: 'button', group: 3 },
  { re: /<(a-menu-item|el-menu-item|Menu\.Item|MenuItem)\b([\s\S]{0,200}?)>([\s\S]{0,120}?)<\/\1>/gi, kind: 'menu', group: 3 },
  { re: /<a(?![-\w])([\s\S]{0,200}?)>([\s\S]{0,120}?)<\/a>/gi, kind: 'link', group: 2 },
];

const FIELD_GLOBAL_RE =
  /<(a-input|el-input|Input|a-input-number|el-input-number|InputNumber|a-input-password|a-textarea|TextArea|a-select|el-select|Select|a-date-picker|el-date-picker|DatePicker|a-cascader|Cascader)\b([\s\S]{0,300}?)\/?>/gi;

/** 去掉内嵌标签（图标等）并压缩空白，取元素的纯文字 */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 忽略所有空白后比较：antd 会给两字按钮插入字间距（源码「保存」→ 页面「保 存」） */
function normText(s: string): string {
  return (s || '').replace(/\s+/g, '');
}

/**
 * 返回行内列数组起始 `[` 的**行内**下标，匹配不到返回 -1（调用方再叠加行偏移）。
 * 单独拆出来是为了让调用方只在命中时才去算行偏移，避免逐行重复扫描全文。
 *
 * 覆盖写法：columns = [ / columns: [ / iossColumns = [ / columns={[ /
 * columns: ColumnsType<Row> = [ / columns = ref([ / :columns="[
 * 不匹配：:columns="columns"（模板引用，后面没有 `[`）
 */
function findColumnsBracketInLine(line: string): number {
  const m = line.match(/\b\w*columns\b/i);
  if (!m || m.index === undefined) return -1;
  const after = line.slice(m.index + m[0].length);
  const sep = after.search(/[:=]/);
  if (sep < 0) return -1;
  const bracket = after.indexOf('[', sep);
  if (bracket < 0) return -1;
  return m.index + m[0].length + bracket;
}

function parseSource(content: string, rel: string, entries: SourceEntry[]) {
  const lines = content.split('\n');
  const stack: { label: string; kind: string }[] = [];
  const containerNow = () => (stack.length === 0 ? '页面' : `「${stack[stack.length - 1].label}」${stack[stack.length - 1].kind}`);
  const push = (e: Omit<SourceEntry, 'file'>) => entries.push({ file: rel, ...e });
  /** 每行对应的容器名，供整文匹配到的元素回查归属 */
  const lineContainers: string[] = new Array(lines.length).fill('页面');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineNo = i + 1;
    lineContainers[i] = containerNow();

    if (CLOSE_CONTAINER_RE.test(line)) {
      if (stack.length) stack.pop();
      i++;
      continue;
    }
    if (CLOSE_TAB_RE.test(line)) {
      if (stack.length && stack[stack.length - 1].kind === '标签页') stack.pop();
      i++;
      continue;
    }

    let opened = false;
    for (const r of OPEN_RULES) {
      if (r.re.test(line)) {
        let tagText = line;
        let endLine = i;
        while (!/>/.test(tagText) && endLine < lines.length - 1) {
          endLine++;
          tagText += ' ' + lines[endLine];
        }
        const isSelfClose = /\/>\s*$/.test(tagText);
        const title = attrValue(tagText, 'title') || attrValue(tagText, 'header');
        const outer = containerNow();
        if (!isSelfClose) stack.push({ label: title || r.labelKind, kind: r.labelKind });
        if (title) push({ line: lineNo, code: lines[i].trim(), kind: r.kind, label: title, container: outer });
        i = endLine + 1;
        opened = true;
        break;
      }
    }
    if (opened) continue;

    const tabM = line.match(OPEN_TAB_RE);
    if (tabM) {
      const attrs = tabM[2] || '';
      const label = attrValue(attrs, 'tab') || attrValue(attrs, 'label') || attrValue(attrs, 'title') || '';
      const outer = containerNow();
      if (label) stack.push({ label, kind: '标签页' });
      push({ line: lineNo, code: lines[i].trim(), kind: 'tab', label: label || '标签页', container: outer });
      i++;
      continue;
    }

    // 表格列：放宽后的定位，支持 xxxColumns = [ / columns={[ / columns: T = [ 等写法
    const colRel = findColumnsBracketInLine(line);
    if (colRel >= 0) {
      const baseOff = offsetOfLine(content, lineNo) + colRel;
      const closeIdx = matchBracket(content, baseOff);
      const block = content.slice(baseOff, closeIdx > 0 ? closeIdx + 1 : baseOff + 4000);
      const c = containerNow();
      const titleRe = /title\s*:\s*['"]([^'"]{1,50})['"]/g;
      let tm: RegExpExecArray | null;
      while ((tm = titleRe.exec(block))) {
        const label = tm[1].trim();
        if (!label) continue;
        const lNo = lineAt(content, baseOff + tm.index);
        push({ line: lNo, code: lines[lNo - 1]?.trim() || '', kind: 'column', label, container: c });
      }
    }

    i++;
  }

  const containerAtLine = (lNo: number) => lineContainers[lNo - 1] || '页面';

  // ── 以下改为整文匹配：可跨行，覆盖带图标 / 换行的标签 ──

  // 页签（React Tabs 的 items 数组配置，没有可识别的 JSX 页签标签）
  TAB_ITEM_LABEL_RE.lastIndex = 0;
  let tim: RegExpExecArray | null;
  while ((tim = TAB_ITEM_LABEL_RE.exec(content))) {
    const label = tim[1].trim();
    if (!label) continue;
    const lNo = lineAt(content, tim.index);
    push({
      line: lNo,
      code: lines[lNo - 1]?.trim() || '',
      kind: 'tab',
      label,
      container: containerAtLine(lNo),
    });
  }

  // 按钮 / 菜单项 / 链接
  for (const r of GLOBAL_TEXT_RULES) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(content))) {
      const label = stripTags(m[r.group] || '');
      if (!label) continue;
      const lNo = lineAt(content, m.index);
      push({
        line: lNo,
        code: lines[lNo - 1]?.trim() || '',
        kind: r.kind,
        label,
        container: containerAtLine(lNo),
      });
    }
  }

  // 表单字段（placeholder / label）
  FIELD_GLOBAL_RE.lastIndex = 0;
  let fm: RegExpExecArray | null;
  while ((fm = FIELD_GLOBAL_RE.exec(content))) {
    const ph = attrValue(fm[2] || '', 'placeholder') || attrValue(fm[2] || '', 'label');
    if (!ph) continue;
    const lNo = lineAt(content, fm.index);
    push({
      line: lNo,
      code: lines[lNo - 1]?.trim() || '',
      kind: 'field',
      label: ph,
      container: containerAtLine(lNo),
    });
  }
}

function buildIndex(target: string): IndexResult | null {
  const root = path.join(projectRoot, 'src', 'prototypes', target);
  if (!fs.existsSync(root)) return null;
  // 读取引擎配置：只索引当前实际使用的版本，避免 Vue/React 双版本互相干扰
  let engine = '';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'proto.config.json'), 'utf8'));
    engine = String(cfg?.engine || '');
  } catch {
    /* 无配置文件时全量扫描 */
  }
  let files = collectSourceFiles(root);
  if (engine === 'vue') files = files.filter((f) => f.toLowerCase().endsWith('.vue'));
  else if (engine === 'react' || engine === 'tsx' || engine === 'jsx')
    files = files.filter((f) => /\.(tsx|jsx)$/i.test(f));
  const fingerprint = files.map((f) => `${f}:${fs.statSync(f).mtimeMs}`).join('|');
  const cached = cache.get(target);
  if (cached && cached.key === fingerprint) return cached;

  const entries: SourceEntry[] = [];
  for (const file of files) {
    // 统一用「项目根相对路径」（src/prototypes/x/index.tsx），
    // 与运行时溯源给出的坐标格式一致，AI 可直接打开，无需再拼原型目录
    const rel = path.relative(projectRoot, file).split(path.sep).join('/');
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    parseSource(content, rel, entries);
  }
  const result: IndexResult = { key: fingerprint, entries };
  cache.set(target, result);
  return result;
}

/**
 * 用批注描述 + 元素文字给条目打分。
 *
 * strictContainer=true 时，容器不匹配直接判 0（精确但可能整批落空）；
 * false 时只扣分不排除——React 原型的 Tabs items 与 columns 定义是分离的，
 * 静态扫描无法建立「列属于哪个页签」的归属，此时放宽容器才能给出候选。
 */
function scoreEntry(e: SourceEntry, desc: string, text: string, strictContainer: boolean): number {
  const d = desc || '';
  const t = (text || '').trim();
  const containers = [...d.matchAll(/「([^」]+)」(?:弹窗|抽屉|卡片|标签页)/g)].map((m) => m[1]);
  const quoted = [...d.matchAll(/「([^」]+)」/g)].map((m) => m[1]);

  // 容器是否命中。容器自身 entry 的 container 可能是外层、label 才是容器名，所以也认 label。
  // 全部忽略空白后比对：antd 会给两字中文插入字间距（源码「保存」→ 页面「保 存」）。
  const containerHit = containers.some(
    (c) => normText(e.container).includes(normText(c)) || normText(e.label) === normText(c),
  );
  if (containers.length > 0 && !containerHit && strictContainer) return 0;

  // ── 构建匹配目标 ──
  // >20 字符 = 描述性文字（如"运单号不能为空，且必须是列表中存在..."），不是元素名
  const isVerboseText = t.length > 20;
  // quoted 里 >10 字符的词大概率是描述性说明文字，不是 UI 元素名
  const shortQuoted = quoted.filter((q) => q && q.length <= 10);
  const targets = new Set([...containers, ...shortQuoted].filter(Boolean));
  // 仅当 text 是短标题/按钮名时才作为目标
  if (!isVerboseText && t) targets.add(t);

  let s = 0;

  // 1) 标签匹配（忽略空白后比对）
  const eLabel = normText(e.label);
  for (const tgRaw of targets) {
    const tg = normText(tgRaw);
    if (!eLabel || !tg) continue;
    if (eLabel === tg) s += 30; // 完全匹配
    else if (tg.length >= 2 && eLabel.startsWith(tg)) s += 15; // 前缀匹配
    else if (tg.length >= 2 && eLabel.includes(tg)) s += 10; // 子串匹配
  }

  // 1.1) 元素文字与条目标签完全一致：这是点选目标的最强信号。
  // 用来压过容器名的巧合匹配——例如「平台IOSS号」标签页里的「IOSS号」列，
  // 页签条目会因「平台IOSS号」包含「IOSS号」而误得分。
  if (t && eLabel === normText(t)) s += 40;

  // 2) 容器归属奖励（仅当已有 label 匹配时才给，防止纯靠容器位置误中）
  if (s > 0 && containers.some((c) => normText(e.container).includes(normText(c)))) s += 25;
  // 宽松模式下容器未命中：扣分而不是排除
  if (containers.length > 0 && !containerHit) s -= 10;

  // 3) 类型提示加分
  if (/列/.test(d) && e.kind === 'column') s += 15;
  if (/按钮/.test(d) && e.kind === 'button') s += 15;
  if (/菜单|下拉/.test(d) && e.kind === 'menu') s += 15;
  if (/链接|下载|模板/.test(d) && e.kind === 'link') s += 15;
  if (/弹窗/.test(d) && (e.kind === 'modal' || e.kind === 'drawer')) s += 12;
  if (/抽屉/.test(d) && e.kind === 'drawer') s += 12;
  if (/输入|下拉|选择|日期/.test(d) && e.kind === 'field') s += 15;
  if (/标签页|页签/.test(d) && e.kind === 'tab') s += 15;

  return s;
}

export function prototypeIndexApiPlugin(): Plugin {
  return {
    name: 'proto-hub-prototype-index-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (pathname !== '/api/prototype-index/match' || req.method !== 'POST') return next();
        try {
          const body = await readJsonBody<{
            target?: string;
            description?: string;
            text?: string;
            traceFile?: string;
            traceLine?: number;
          }>(req);
          const target = body.target || '';
          if (!/^[\w一-龥-]{1,60}$/.test(target)) return sendError(res, 'target 非法', 400);
          const idx = buildIndex(target);
          if (!idx) return sendError(res, '原型不存在', 404);

          // ── 运行时溯源优先 ──
          // React 原型点选时若从 fiber 拿到了精确坐标（编译期注入），直接采用：
          // 不依赖元素有文字，也不受动态渲染影响，比事后按文字匹配可靠。
          // 拿不到（Vue 原型、表格列 / 页签等配置驱动元素）时自动回退到下面的文字匹配。
          if (body.traceFile && body.traceLine) {
            const rel = String(body.traceFile).replace(/\\/g, '/').replace(/^\/+/, '');
            // 安全校验：只允许读取该原型目录下的源码，防止路径穿越
            const abs = rel.startsWith(`src/prototypes/${target}/`)
              ? path.join(projectRoot, rel)
              : '';
            if (abs && fs.existsSync(abs)) {
              const lines = fs.readFileSync(abs, 'utf8').split('\n');
              const ln = Math.max(1, Math.min(Math.floor(Number(body.traceLine)) || 1, lines.length));
              return sendJson(res, {
                success: true,
                data: [
                  {
                    file: rel,
                    line: ln,
                    code: (lines[ln - 1] || '').trim(),
                    kind: 'element',
                    label: body.text || '',
                    container: '',
                    score: 100,
                    trace: true,
                  },
                ],
              });
            }
          }

          const desc = body.description || '';
          const text = body.text || '';
          // 最低分数阈值：低于此分的候选视为噪音
          const MIN_SCORE = 30;
          const containersInDesc = [...desc.matchAll(/「([^」]+)」(?:弹窗|抽屉|卡片|标签页)/g)].map(
            (m) => m[1],
          );
          /**
           * 描述形如「X」标签页中的按钮…，说明目标是容器**里面**的元素。
           * 此时容器自身那条索引（label 恰好等于容器名）不该被当成命中位置——
           * 否则「点按钮」会定位到页签那一行，比不命中更容易误导 AI。
           */
          const inContainer = /「[^」]+」(?:弹窗|抽屉|卡片|标签页)中的/.test(desc);

          // 描述里的类型关键词 → 期望命中的条目类型
          const expectKind: SourceEntry['kind'] | null = /列/.test(desc)
            ? 'column'
            : /按钮/.test(desc)
              ? 'button'
              : /菜单|下拉/.test(desc)
                ? 'menu'
                : /链接|下载|模板/.test(desc)
                  ? 'link'
                  : /抽屉/.test(desc)
                    ? 'drawer'
                    : /弹窗/.test(desc)
                      ? 'modal'
                      : /表单字段|输入|选择|日期/.test(desc)
                        ? 'field'
                        : /标签页|页签/.test(desc)
                          ? 'tab'
                          : null;

          /**
           * 容器自身那条索引（label 恰好等于容器名的 modal / tab 行）是否算命中位置。
           *
           * 规则：只有用户点选的就是该容器本身时才算——
           * 点「页签」→ expectKind=tab → tab 行有效；
           * 点「页签里的按钮」→ expectKind=button → tab 行无效。
           * 否则点按钮会定位到页签那一行，比不命中更容易误导 AI 改错代码。
           */
          const isUselessContainerSelf = (e: SourceEntry) =>
            inContainer &&
            e.kind !== expectKind &&
            (e.kind === 'modal' || e.kind === 'drawer' || e.kind === 'card' || e.kind === 'tab') &&
            containersInDesc.some((c) => normText(e.label) === normText(c));

          const rank = (strictContainer: boolean) =>
            idx.entries
              .map((e) => ({ ...e, score: scoreEntry(e, desc, text, strictContainer) }))
              .filter((e) => e.score >= MIN_SCORE)
              .filter((e) => !isUselessContainerSelf(e))
              .sort((a, b) => b.score - a.score);

          // 先按完整约束（含容器）匹配；为空时放宽容器再试一次，并标记 loose
          let strict: ScoredEntry[] = rank(true);
          if (strict.length === 0) strict = rank(false).map((e) => ({ ...e, loose: true }));
          const top = strict.slice(0, 3);

          let ranked: ScoredEntry[] = top;
          if (expectKind) {
            // 列 / 表单等定义常与弹窗、页签的标签结构分离（写在 script 常量区），
            // 严格按容器约束会把真正想要的条目排除掉。这里补充「放宽容器后命中、
            // 且类型与描述相符」的候选，标记 loose 交用户确认。
            const seen = new Set(top.map((e) => `${e.file}:${e.line}`));
            const extra = rank(false)
              .filter((e) => e.kind === expectKind && !seen.has(`${e.file}:${e.line}`))
              .slice(0, 3)
              .map((e) => ({ ...e, loose: true }));
            ranked = [...top, ...extra].sort((a, b) => b.score - a.score).slice(0, 3);
          }
          return sendJson(res, { success: true, data: ranked });
        } catch (e: any) {
          sendError(res, e.message || '源码定位失败', 500);
        }
      });
    },
  };
}
