const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
const s = dec('d:/newproject/_dry.txt');
const i = s.indexOf('"content"');
if (i < 0) console.log('NO content field. head:', s.slice(0, 500));
else console.log('content field snippet:', s.slice(i, i + 300));
