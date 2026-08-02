import { execSync } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';

const xml = readFileSync('d:/newproject/clean_gap.xml', 'utf-8');

const raw = execSync('lark-cli docs +create --content - --as user --format json', {
  encoding: 'utf-8', cwd: 'd:/newproject', input: xml,
  env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' }
});

writeFileSync('d:/newproject/_debug_raw.txt', raw, 'utf-8');

// Find the outermost { } JSON
let depth = 0, start = -1;
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === '{') { if (depth === 0) start = i; depth++; }
  if (raw[i] === '}') { depth--; if (depth === 0) { const json = raw.substring(start, i+1); const d = JSON.parse(json); console.log('ok:', d.ok); console.log('url:', `https://ztn.feishu.cn/docx/${d.data?.document?.doc_id || '?'}`); break; } }
}

unlinkSync('d:/newproject/clean_gap.xml');
unlinkSync('d:/newproject/_create_clean.mjs');
