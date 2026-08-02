const fs = require('fs');
let b = fs.readFileSync('d:/newproject/_wiki_fetch2.json');
let s;
if (b[0] === 0xFF && b[1] === 0xFE) s = b.slice(2).toString('utf16le');
else if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) s = b.slice(3).toString('utf8');
else s = b.toString('utf8');
const j = JSON.parse(s);
const c = j.data.document.content;
const start = c.indexOf('<tbody id="doxcnIUfhISD3m3FRyKVwOc9pac">');
const end = c.indexOf('</tbody>', start);
let inner = c.slice(start, end).replace(/^<tbody[^>]*>/, '');
const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';
inner = inner.slice(0, inner.length - '</tr>'.length) + rows1 + '</tr>';
fs.writeFileSync('d:/newproject/_tb1_inner.xml', inner);
console.log('GEN_OK len=' + inner.length + ' rows=' + (inner.match(/<tr>/g) || []).length);
