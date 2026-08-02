const { spawnSync } = require('child_process');
const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
// 原始完整内容 + 两行补充
let oc = JSON.parse(dec('d:/newproject/_wiki_fetch.json')).data.document.content;
const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';
const fk = '提交订单前校验偏远地区偏远时弹窗提示确认</p></td></tr></tbody></table>';
oc = oc.replace(fk, fk.slice(0, fk.length - '</tbody></table>'.length) + rows1 + '</tbody></table>');
const rows2 = '<tr><td vertical-align="top"><p id="doxcnAdd07a">线上充值-微信浏览器支付宝拦截</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07b">在微信浏览器打开线上充值页（NUC → 交易 → 账户充值 → 线上充值）点击支付宝图标，观察是否弹窗提示“支付宝支付暂不支持微信浏览器，请切换浏览器后重试”，且未跳转支付宝</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07c">客户</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07d">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07e"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07f"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07g">产品：业务：</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07h"></p></td></tr>';
const ak = 'doxcnKGO55kP3XfVI31rzjkKYMd"></p></td></tr></tbody>';
oc = oc.replace(ak, ak.slice(0, ak.length - '</tbody>'.length) + rows2 + '</tbody>');
const fullDoc = '<title id="Dbp7dikxho7RfbxF9DycnkM5nBb">【NUC】密码错误及偏远地区提示等优化</title>' + oc;
const url = 'https://ztn.feishu.cn/wiki/N7edwfvyDiOeOkkbO56cRm1lnOc';
const args = ['docs', '+update', '--command', 'overwrite', '--content', fullDoc, '--doc', url, '--as', 'user', '--yes'];
const env = Object.assign({}, process.env, { LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' });
const r = spawnSync('lark-cli', args, { encoding: 'utf16le', env, maxBuffer: 30 * 1024 * 1024 });
console.log('status', r.status);
console.log('OUT_TAIL', r.stdout ? r.stdout.slice(-1400) : '(empty)');
console.log('ERR', r.stderr ? r.stderr.slice(0, 300) : '(empty)');
