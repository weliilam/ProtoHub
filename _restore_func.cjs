const { spawnSync } = require('child_process');
const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
const oc = JSON.parse(dec('d:/newproject/_wiki_fetch.json')).data.document.content;
const fi = oc.indexOf('七、功能清单');
const ts = oc.indexOf('<table', fi);
const te = oc.indexOf('</table>', ts) + '</table>'.length;
let funcTable = oc.slice(ts, te);
const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';
const fk = '提交订单前校验偏远地区偏远时弹窗提示确认</p></td></tr></tbody></table>';
if (!funcTable.includes(fk)) { console.log('FK_NOT_FOUND'); process.exit(1); }
funcTable = funcTable.replace(fk, fk.slice(0, fk.length - '</tbody></table>'.length) + rows1 + '</tbody></table>');
const url = 'https://ztn.feishu.cn/wiki/N7edwfvyDiOeOkkbO56cRm1lnOc';
const args = ['docs', '+update', '--command', 'block_replace', '--block-id', 'doxcnbs5MnBPUeQGR4DYc2tFbqt', '--content', funcTable, '--doc', url, '--as', 'user', '--yes'];
const env = Object.assign({}, process.env, { LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' });
const r = spawnSync('lark-cli', args, { encoding: 'utf16le', env, maxBuffer: 20 * 1024 * 1024 });
console.log('status', r.status);
console.log('OUT_TAIL', r.stdout ? r.stdout.slice(-1300) : '(empty)');
console.log('ERR', r.stderr ? r.stderr.slice(0, 300) : '(empty)');
