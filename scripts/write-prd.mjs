import { execSync } from 'child_process';

const create = JSON.parse(execSync(
  'lark-cli docs +create --title "【B2B看板】B2B订单列表"',
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
));
const url = create.data.document.url;
console.log('1/2 Created:', url);

const up = JSON.parse(execSync(
  `lark-cli docs +update --doc "${url}" --command str_replace --doc-format markdown --pattern "【B2B看板】B2B订单列表" --content @src/prototypes/b2b-order-list/prd.md`,
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 2 * 1024 * 1024 }
));
if (!up.ok) { console.error('FAIL:', JSON.stringify(up.error)); process.exit(1); }
console.log('2/2 Done:', url);
