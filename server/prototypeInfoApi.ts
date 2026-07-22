import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import {
  projectRoot,
  sendJson,
  sendError,
  isValidName,
  getPathname,
  getQuery,
  readJsonFile,
} from './utils';

/** antd 组件名 → 中文（让非技术同学也能看懂） */
const ANTD_ZH: Record<string, string> = {
  Table: '表格',
  Button: '按钮',
  Form: '表单',
  Modal: '对话框/弹窗',
  Drawer: '抽屉面板',
  Tag: '标签',
  Select: '下拉选择',
  Input: '输入框',
  InputNumber: '数字输入框',
  DatePicker: '日期选择',
  TimePicker: '时间选择',
  RangePicker: '日期范围选择',
  Checkbox: '复选框',
  Radio: '单选框',
  Switch: '开关',
  Upload: '文件上传',
  Tabs: '选项卡',
  Steps: '步骤条',
  Progress: '进度条',
  Badge: '徽标',
  Tooltip: '文字提示',
  Popconfirm: '气泡确认框',
  Popover: '气泡卡片',
  Dropdown: '下拉菜单',
  Menu: '菜单',
  Card: '卡片',
  List: '列表',
  Descriptions: '描述列表',
  Statistic: '统计数值',
  Avatar: '头像',
  Breadcrumb: '面包屑',
  Pagination: '分页',
  Spin: '加载中',
  Result: '结果页',
  Empty: '空状态',
  message: '全局轻提示',
  notification: '通知提醒',
  Alert: '警告提示',
  Divider: '分割线',
  Space: '间距容器',
  Row: '栅格行',
  Col: '栅格列',
  Grid: '栅格',
  Typography: '文字排版',
  Anchor: '锚点',
  Tree: '树形控件',
  Transfer: '穿梭框',
  Cascader: '级联选择',
  Slider: '滑块',
  Rate: '评分',
  Calendar: '日历',
  Carousel: '走马灯',
  Collapse: '折叠面板',
  Timeline: '时间轴',
  Skeleton: '骨架屏',
  ConfigProvider: '全局配置',
};

interface ParsedImports {
  antd: { name: string; zh: string }[];
  icons: string[];
  local: string[];
  libs: string[];
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** 读取原型目录下所有源码并解析 import，分类汇总 */
function parsePrototypeImports(dir: string): ParsedImports {
  const result: ParsedImports = { antd: [], icons: [], local: [], libs: [] };
  let content = '';
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.(t|j)sx?$/.test(f) && !f.endsWith('.d.ts'));
    for (const f of files) {
      try {
        content += '\n' + fs.readFileSync(path.join(dir, f), 'utf8');
      } catch {
        /* 忽略无法读取的文件 */
      }
    }
  } catch {
    return result;
  }

  // 具名 / 默认 import：import ... from 'mod'（s 标志让 . 跨行，支持多行 import）
  const reNamed = /import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]/gs;
  // 副作用 import：import 'mod'
  const reSide = /import\s+['"]([^'"]+)['"]/gs;

  const collectNames = (spec: string): string[] =>
    [...spec.matchAll(/[A-Za-z_$][\w$]*/g)].map((x) => x[0]);

  let m: RegExpExecArray | null;
  const seenLibs = new Set<string>();
  while ((m = reNamed.exec(content))) {
    const spec = m[1];
    const mod = m[2];
    if (mod === 'antd') {
      for (const n of collectNames(spec)) {
        result.antd.push({ name: n, zh: ANTD_ZH[n] || n });
      }
    } else if (mod.startsWith('@ant-design/icons')) {
      result.icons.push(...collectNames(spec));
    } else if (mod.startsWith('.')) {
      result.local.push(path.basename(mod).replace(/\.\w+$/, ''));
    } else {
      if (!seenLibs.has(mod)) {
        seenLibs.add(mod);
        result.libs.push(mod);
      }
    }
  }
  while ((m = reSide.exec(content))) {
    const mod = m[1];
    if (mod.startsWith('.')) {
      result.local.push(path.basename(mod).replace(/\.\w+$/, ''));
    } else if (mod !== 'antd' && !mod.startsWith('@ant-design/icons')) {
      if (!seenLibs.has(mod)) {
        seenLibs.add(mod);
        result.libs.push(mod);
      }
    }
  }

  result.antd = dedupe(result.antd.map((x) => x.name)).map((n) => ({
    name: n,
    zh: ANTD_ZH[n] || n,
  }));
  result.icons = dedupe(result.icons);
  result.local = dedupe(result.local).filter((n) => n && n !== 'style');
  result.libs = dedupe(result.libs);
  return result;
}

export function prototypeInfoPlugin(): Plugin {
  return {
    name: 'prototype-info-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/prototype/info')) return next();
        if (req.method !== 'GET') return sendError(res, '仅支持 GET', 405);

        const name = getQuery(req).get('name') || '';
        if (!isValidName(name)) return sendError(res, '非法的原型名称', 400);

        const dir = path.join(projectRoot, 'src', 'prototypes', name);
        if (!fs.existsSync(dir)) return sendError(res, '原型不存在', 404);

        // 基本信息：从入口文件顶部注释解析 @name / @mode
        let title = name;
        let mode = '';
        const entry = path.join(dir, 'index.tsx');
        if (fs.existsSync(entry)) {
          const head = fs.readFileSync(entry, 'utf8').slice(0, 2000);
          const t = head.match(/@name\s+([^\n]+)/);
          const mo = head.match(/@mode\s+([^\n]+)/);
          if (t) title = t[1].trim();
          if (mo) mode = mo[1].trim();
        }

        let mtime = '';
        try {
          mtime = fs.statSync(entry).mtime.toISOString();
        } catch {
          /* ignore */
        }

        // 批注数量
        const store: Record<string, unknown[]> = readJsonFile(
          path.join(projectRoot, 'annotations.json'),
          {},
        );
        const annotationCount = Array.isArray(store[name]) ? store[name].length : 0;

        const imports = parsePrototypeImports(dir);

        sendJson(res, {
          success: true,
          data: {
            name,
            title,
            mode,
            type: 'prototype',
            path: `src/prototypes/${name}`,
            mtime,
            annotationCount,
            components: imports,
          },
        });
      });
    },
  };
}
