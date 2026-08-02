const fs = require('fs');
// 仅提取 01-05 行（不带外层 tbody 标签），再加 06 行，作为 tbody 的子内容
let s = fs.readFileSync('d:/newproject/_wiki_content.xml', 'utf8');
const start = s.indexOf('<tbody id="doxcnIUfhISD3m3FRyKVwOc9pac">');
const end = s.indexOf('</tbody>', start);
let inner = s.slice(start, end); // 从 <tbody ...> 到 </tbody> 之前
// 去掉开头 <tbody ...> 标签，保留内部 tr 列表
inner = inner.replace(/^<tbody[^>]*>/, '');
// inner 现在以 <tr> 开头，以 </tr> 结尾（05 行）。在其后追加 06 行
const rows1 = '<tr><td vertical-align="top"><p id="doxcnAdd06a">06</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06b">NUC</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06c">账户充值（线上充值）</p></td>' +
  '<td vertical-align="top"><p id="doxcnAdd06d">微信浏览器内核下点击支付宝图标拦截提示切换浏览器后重试且不跳转支付宝</p></td></tr>';
inner = inner.slice(0, inner.length - '</tr>'.length) + rows1 + '</tr>';
fs.writeFileSync('d:/newproject/_tb1_inner.xml', inner);
console.log('GEN_INNER_OK len=' + inner.length);
console.log(inner.slice(0, 120));
