const fs = require('fs');
let b = fs.readFileSync('d:/newproject/_wiki_fetch2.json');
let s;
if (b[0] === 0xFF && b[1] === 0xFE) s = b.slice(2).toString('utf16le');
else if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) s = b.slice(3).toString('utf8');
else s = b.toString('utf8');
const j = JSON.parse(s);
const c = j.data.document.content;
const marker = '<tbody id="doxcnIUfhISD3m3FRyKVwOc9pac">';
const start = c.indexOf(marker);
const end = c.indexOf('</tbody>', start) + '</tbody>'.length;
console.log('start=', start, 'end=', end, 'tr_in_orig=', (c.slice(start, end).match(/<tr>/g) || []).length);
let tb = c.slice(start, end);
const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';
tb = tb.slice(0, tb.length - '</tbody>'.length) + rows1 + '</tbody>';
fs.writeFileSync('d:/newproject/_tb1_v2.xml', tb);
console.log('GEN v2 len=' + tb.length + ' tr=' + (tb.match(/<tr>/g) || []).length);
