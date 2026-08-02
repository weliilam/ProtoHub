const fs = require('fs');
// 1) 从原始完整 fetch（未被污染）提取干净 content
let b = fs.readFileSync('d:/newproject/_wiki_fetch.json');
let s;
if (b[0] === 0xFF && b[1] === 0xFE) s = b.slice(2).toString('utf16le');
else if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) s = b.slice(3).toString('utf8');
else s = b.toString('utf8');
const j = JSON.parse(s);
let c = j.data.document.content;
console.log('orig len', c.length, 'has06?', c.includes('doxcnAdd06a'), 'has验证?', c.includes('线上充值-微信浏览器支付宝拦截'));

// 2) 功能清单（七）：05 行后追加 06 行
const fk = '提交订单前校验偏远地区偏远时弹窗提示确认</p></td></tr></tbody></table>';
const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';
if (!c.includes(fk)) { console.error('FK_NOT_FOUND'); process.exit(1); }
c = c.replace(fk, fk.slice(0, fk.length - '</tbody></table>'.length) + rows1 + '</tbody></table>');

// 3) 验收场景（九.1）：最后一行（单票寄件-偏远）后追加新行
const ak = 'doxcnKGO55kP3XfVI31rzjkKYMd"></p></td></tr></tbody>';
const rows2 = '<tr><td vertical-align="top"><p id="doxcnAdd07a">线上充值-微信浏览器支付宝拦截</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07b">在微信浏览器打开线上充值页（NUC → 交易 → 账户充值 → 线上充值）点击支付宝图标，观察是否弹窗提示“支付宝支付暂不支持微信浏览器，请切换浏览器后重试”，且未跳转支付宝</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07c">客户</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07d">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07e"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07f"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07g">产品：业务：</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07h"></p></td></tr>';
if (!c.includes(ak)) { console.error('AK_NOT_FOUND'); process.exit(1); }
c = c.replace(ak, ak.slice(0, ak.length - '</tbody>'.length) + rows2 + '</tbody>');

fs.writeFileSync('d:/newproject/_wiki_final.xml', c);
console.log('FINAL len', c.length, 'has06?', c.includes('doxcnAdd06a'), 'has验证?', c.includes('线上充值-微信浏览器支付宝拦截'));
