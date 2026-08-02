const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
console.log('===== _ow.txt (overwrite result) =====');
console.log(dec('d:/newproject/_ow.txt').slice(0, 700));
console.log('\n===== _wiki_fetch.json docx token =====');
try {
  const s = dec('d:/newproject/_wiki_fetch.json');
  const j = JSON.parse(s);
  const d = j.data && j.data.document;
  console.log('document keys:', d ? Object.keys(d) : 'none');
  if (d) console.log('token=', d.token, '| id=', d.id, '| url=', d.url, '| doc_id=', d.doc_id);
} catch (e) {
  console.log('PARSE ERR:', e.message);
}
