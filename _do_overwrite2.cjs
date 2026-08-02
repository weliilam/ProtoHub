const { spawnSync } = require('child_process');
const fs = require('fs');
const content = fs.readFileSync('d:/newproject/_wiki_final.xml', 'utf8');
const url = 'https://ztn.feishu.cn/wiki/N7edwfvyDiOeOkkbO56cRm1lnOc';
const args = ['docs', '+update', '--command', 'overwrite', '--content', '-', '--doc', url, '--as', 'user', '--yes'];
const env = Object.assign({}, process.env, {
  LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
  LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
});
const r = spawnSync('lark-cli', args, { input: content, encoding: 'utf16le', env, maxBuffer: 20 * 1024 * 1024 });
console.log('status', r.status);
console.log('STDOUT_TAIL:', r.stdout ? r.stdout.slice(-1600) : '(empty)');
console.log('STDERR:', r.stderr ? r.stderr.slice(0, 400) : '(empty)');
