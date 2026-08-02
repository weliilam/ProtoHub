const fs = require('fs');
let s = fs.readFileSync('d:/newproject/_wiki_content.xml', 'utf8');

// 功能清单（七）：在 05 行后追加 06 行
const fk = '提交订单前校验偏远地区偏远时弹窗提示确认</p></td></tr></tbody></table>';
const fkNew = '提交订单前校验偏远地区偏远时弹窗提示确认</p></td></tr>' +
  '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>' +
  '</tbody></table>';
if (!s.includes(fk)) { console.error('FK_ANCHOR_NOT_FOUND'); process.exit(1); }
s = s.replace(fk, fkNew);

// 验收场景（九.1）：在最后一行（单票寄件-偏远）后追加新行
const ak = 'doxcnKGO55kP3XfVI31rzjkKYMd"></p></td></tr></tbody>';
const akNew = 'doxcnKGO55kP3XfVI31rzjkKYMd"></p></td></tr>' +
  '<tr><td vertical-align="top"><p id="doxcnAdd07a">线上充值-微信浏览器支付宝拦截</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07b">在微信浏览器打开线上充值页（NUC → 交易 → 账户充值 → 线上充值）点击支付宝图标，观察是否弹窗提示“支付宝支付暂不支持微信浏览器，请切换浏览器后重试”，且未跳转支付宝</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07c">客户</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07d">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07e"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07f"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07g">产品：业务：</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07h"></p></td></tr>' +
  '</tbody>';
if (!s.includes(ak)) { console.error('AK_ANCHOR_NOT_FOUND'); process.exit(1); }
s = s.replace(ak, akNew);

fs.writeFileSync('d:/newproject/_wiki_content.xml', s);
console.log('ROWS_ADDED_OK');
