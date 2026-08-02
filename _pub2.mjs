import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';

// First check: if the file was deleted by the last failed run, recreate it
let xml;
try {
  xml = readFileSync('d:/newproject/clean_gap.xml', 'utf-8');
} catch(e) {
  console.log('XML file missing, recreating...');
  // need to handle this case
  process.exit(1);
}

writeFileSync('d:/newproject/clean_gap_bak.xml', xml, 'utf-8');

const raw = execSync('lark-cli docs +create --content - --as user --format json', {
  encoding: 'utf-8', cwd: 'd:/newproject', input: xml,
  env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' }
});

writeFileSync('d:/newproject/_raw_output.txt', raw, 'utf-8');
console.log('Raw written, length:', raw.length);

// Try to find JSON
let depth = 0, start = -1, lastEnd = -1;
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === '{') { if (depth === 0) start = i; depth++; }
  else if (raw[i] === '}') { depth--; if (depth === 0) lastEnd = i; }
}
if (lastEnd > 0) {
  const json = raw.substring(start, lastEnd + 1);
  const d = JSON.parse(json);
  console.log('Parsed ok:', d.ok);
  console.log('Keys of data:', Object.keys(d.data || {}));
  if (d.data?.document) console.log('Doc keys:', Object.keys(d.data.document));
  if (d.data?.document?.doc_id) console.log('URL:', `https://ztn.feishu.cn/docx/${d.data.document.doc_id}`);
}
