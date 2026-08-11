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
  kind: 'modal' | 'drawer' | 'card' | 'column' | 'button' | 'menu' | 'link' | 'field' | 'tab';
  label: string;
  container: string;
}

interface IndexResult {
  key: string;
  entries: SourceEntry[];
}

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
const BUTTON_RE = /<(a-button|el-button|Button|button)\b([^>]*)>([^<]{1,40})<\/\1>/i;
const MENU_ITEM_RE = /<(a-menu-item|el-menu-item|Menu\.Item|MenuItem)\b([^>]*)>([^<]{1,40})<\/\1>/i;
const LINK_RE = /<a(?![-\w])([^>]*)>([^<]{1,40})<\/a>/i;
const FIELD_RE =
  /<(a-input|el-input|Input|a-input-number|el-input-number|InputNumber|a-input-password|a-textarea|TextArea|a-select|el-select|Select|a-date-picker|el-date-picker|DatePicker|a-cascader|Cascader)\b([^>]*)>/i;
const COLUMNS_RE = /columns\s*[:=]\s*\[/;

function parseSource(content: string, rel: string, entries: SourceEntry[]) {
  const lines = content.split('\n');
  const stack: { label: string; kind: string }[] = [];
  const containerNow = () => (stack.length === 0 ? '页面' : `「${stack[stack.length - 1].label}」${stack[stack.length - 1].kind}`);
  const push = (e: Omit<SourceEntry, 'file'>) => entries.push({ file: rel, ...e });

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineNo = i + 1;

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

    const btnM = line.match(BUTTON_RE);
    if (btnM) {
      const label = btnM[3].trim();
      if (label) push({ line: lineNo, code: lines[i].trim(), kind: 'button', label, container: containerNow() });
      i++;
      continue;
    }

    // 5.1) 下拉/更多菜单项：<a-menu-item>备注导入</a-menu-item>
    const menuM = line.match(MENU_ITEM_RE);
    if (menuM) {
      const label = menuM[3].trim();
      if (label) push({ line: lineNo, code: lines[i].trim(), kind: 'menu', label, container: containerNow() });
      i++;
      continue;
    }

    // 5.2) 链接：<a class="..." @click="...">备注导入模板.xlsx</a>
    const linkM = line.match(LINK_RE);
    if (linkM) {
      const label = linkM[2].trim();
      if (label) push({ line: lineNo, code: lines[i].trim(), kind: 'link', label, container: containerNow() });
      i++;
      continue;
    }

    const fldM = line.match(FIELD_RE);
    if (fldM) {
      const ph = attrValue(fldM[2] || '', 'placeholder') || attrValue(fldM[2] || '', 'label');
      if (ph) push({ line: lineNo, code: lines[i].trim(), kind: 'field', label: ph, container: containerNow() });
    }

    const colM = line.match(COLUMNS_RE);
    if (colM) {
      const baseOff = offsetOfLine(content, lineNo) + (colM.index || 0);
      const closeIdx = matchBracket(content, baseOff);
      const block = content.slice(baseOff, closeIdx > 0 ? closeIdx + 1 : baseOff + 2000);
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
    const rel = path.relative(root, file).split(path.sep).join('/');
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

/** 用批注描述 + 元素文字给条目打分。返回 0 表示不匹配（将被过滤掉）。 */
function scoreEntry(e: SourceEntry, desc: string, text: string): number {
  const d = desc || '';
  const t = (text || '').trim();
  const containers = [...d.matchAll(/「([^」]+)」(?:弹窗|抽屉|卡片|标签页)/g)].map((m) => m[1]);
  const quoted = [...d.matchAll(/「([^」]+)」/g)].map((m) => m[1]);

  // ── 硬约束：有容器名时，container 不匹配直接排除（注意容器自身 entry 的 container 可能是外层，它的 label 才是容器名，所以也认 label） ──
  if (containers.length > 0 && !containers.some((c) => e.container.includes(c) || e.label === c)) return 0;

  // ── 构建匹配目标 ──
  // >20 字符 = 描述性文字（如"运单号不能为空，且必须是列表中存在..."），不是元素名
  const isVerboseText = t.length > 20;
  // quoted 里 >10 字符的词大概率是描述性说明文字，不是 UI 元素名
  const shortQuoted = quoted.filter((q) => q && q.length <= 10);
  const targets = new Set([...containers, ...shortQuoted].filter(Boolean));
  // 仅当 text 是短标题/按钮名时才作为目标
  if (!isVerboseText && t) targets.add(t);

  let s = 0;

  // 1) 标签匹配
  for (const tg of targets) {
    if (!e.label) continue;
    if (e.label === tg) s += 30; // 完全匹配
    else if (tg.length >= 2 && e.label.startsWith(tg)) s += 15; // 前缀匹配
    else if (tg.length >= 2 && e.label.includes(tg)) s += 10; // 子串匹配
  }

  // 2) 容器归属奖励（仅当已有 label 匹配时才给，防止纯靠容器位置误中）
  if (s > 0 && containers.some((c) => e.container.includes(c))) s += 25;

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
          const body = await readJsonBody<{ target?: string; description?: string; text?: string }>(req);
          const target = body.target || '';
          if (!/^[\w一-龥-]{1,60}$/.test(target)) return sendError(res, 'target 非法', 400);
          const idx = buildIndex(target);
          if (!idx) return sendError(res, '原型不存在', 404);
          const desc = body.description || '';
          const text = body.text || '';
          // 最低分数阈值：低于此分的候选视为噪音
          const MIN_SCORE = 30;
          const ranked = idx.entries
            .map((e) => ({ ...e, score: scoreEntry(e, desc, text) }))
            .filter((e) => e.score >= MIN_SCORE)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          return sendJson(res, { success: true, data: ranked });
        } catch (e: any) {
          sendError(res, e.message || '源码定位失败', 500);
        }
      });
    },
  };
}
