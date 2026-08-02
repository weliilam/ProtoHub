const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
const c = dec('d:/newproject/_wiki_fetch2.json');
const content = JSON.parse(c).data.document.content;
const hs = content.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) || [];
hs.forEach((h) => {
  const title = h.replace(/<[^>]+>/g, '').trim();
  const idx = content.indexOf(h) + h.length;
  const next = content.slice(idx, idx + 90).replace(/\s+/g, ' ');
  console.log(title + ' => ' + next);
});
console.log('--- count tables:', (content.match(/<table/g) || []).length, 'count <p>:', (content.match(/<p /g) || []).length);
