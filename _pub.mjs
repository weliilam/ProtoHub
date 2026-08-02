import { execSync } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';

const xml = readFileSync('d:/newproject/clean_gap.xml', 'utf-8');

const raw = execSync('lark-cli docs +create --content - --as user --format json', {
  encoding: 'utf-8', cwd: 'd:/newproject', input: xml,
  env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' }
});

let depth = 0, start = -1;
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === '{') { if (depth === 0) start = i; depth++; }
  else if (raw[i] === '}') { depth--; if (depth === 0) { 
    const d = JSON.parse(raw.substring(start, i+1));
    if (d.ok) {
      const url = `https://ztn.feishu.cn/docx/${d.data.document.doc_id}`;
      console.log(url);
      try { unlinkSync('d:/newproject/clean_gap.xml'); } catch(e){}
    } else {
      console.log('ERROR:', JSON.stringify(d.error));
    }
    break;
  }}
}
