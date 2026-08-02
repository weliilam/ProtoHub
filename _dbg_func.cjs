const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
const c = dec('d:/newproject/_wiki_fetch2.json');
const j = JSON.parse(c);
const content = j.data.document.content;
const i = content.indexOf('七、功能清单');
const k = content.indexOf('八、功能描述');
console.log('=== 功能清单章节片段 ===');
console.log(content.slice(i, k));
