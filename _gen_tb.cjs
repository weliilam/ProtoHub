const fs = require('fs');
let s = fs.readFileSync('d:/newproject/_wiki_content.xml', 'utf8');

const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';

const start1 = s.indexOf('<tbody id="doxcnIUfhISD3m3FRyKVwOc9pac">');
const end1 = s.indexOf('</tbody>', start1) + '</tbody>'.length;
let tb1 = s.slice(start1, end1);
tb1 = tb1.slice(0, tb1.length - '</tbody>'.length) + rows1 + '</tbody>';
fs.writeFileSync('d:/newproject/_tb1.xml', tb1);

const rows2 = '<tr><td vertical-align="top"><p id="doxcnAdd07a">线上充值-微信浏览器支付宝拦截</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07b">在微信浏览器打开线上充值页（NUC → 交易 → 账户充值 → 线上充值）点击支付宝图标，观察是否弹窗提示“支付宝支付暂不支持微信浏览器，请切换浏览器后重试”，且未跳转支付宝</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07c">客户</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07d">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07e"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07f"></p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07g">产品：业务：</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd07h"></p></td></tr>';

const start2 = s.indexOf('<tbody id="doxcnTeTEYW1VZRV6kiWo7q0BQ5">');
const end2 = s.indexOf('</tbody>', start2) + '</tbody>'.length;
let tb2 = s.slice(start2, end2);
tb2 = tb2.slice(0, tb2.length - '</tbody>'.length) + rows2 + '</tbody>';
fs.writeFileSync('d:/newproject/_tb2.xml', tb2);

console.log('GEN_OK len1=' + tb1.length + ' len2=' + tb2.length);
